// Originally from https://github.com/Euophrys/umamusume-tierlist
// (src/components/tierlist-calc.js, MIT — see LICENSE); maintained here now.
// test/upstream/ checks it still ranks exactly like upstream's.

// A card's `type` indexes the stats it can give: 0–4 the five trainings (Speed, Stamina, Power, Guts, Wit), 5 none
// (skill points), GROUP_TYPE (6, energy) for group ("friend") cards that aren't tied to one training. Stat and gain arrays:
// [0..4] trainings, [5] skill points, [6] energy; card events (`card.events`) add [7] bond.
// Card shorthands: sb starting bond, tb training bonus, mb motivation bonus, fs_* friendship bonuses (only while the card
// rainbows), stat_bonus[6] flat per-stat bonus, specialty_rate specialty priority.

import type { JoinedCard } from './join-cards.ts';
import type { GeneralWeights, StatWeights } from './scenarios.ts';

export type CalcCard = JoinedCard;

// A card in a deck being scored: the calculation adds these as it goes. `cardType` is set for the fixed deck's cards
// only (the candidate never gets one).
type PlayedCard = CalcCard & { index: number; rainbowSpecialty: number; offSpecialty: number; cardType?: number };
type DeckCard = PlayedCard & { cardType: number };

export type CalcWeights = GeneralWeights & StatWeights;

export type ProcessedCard = { id: number; lb: number; score: number; char_name: string };

const STAT_COUNT = 6; // five training stats + skill points
const TRAINING_COUNT = 5;
const ENERGY = 6; // index of energy within gain / weight arrays
const BOND = 7; // index of bond within card-event arrays
const GROUP_TYPE = 6;

// Appearance-rate weights (the game's "appearance rate"). Each of the five
// trainings has base weight 100; there's also a weight-50 "no training" option.
// For one card, P(lands on specialty) = specialty / (specialty + 450), where
// 450 = the other four trainings (4×100) plus the 50 no-training slot.
const BASE_WEIGHT = 100;
const OTHER_SLOTS_WEIGHT = 450;

// Bond points needed to start rainbowing, before the card's innate starting
// bond and any event bond are subtracted.
const GROUP_BOND = 55;
const NORMAL_BOND = 75;

// Each support card sharing a training adds 5% output: factor (1 + 0.05·N).
const CARD_BONUS = 0.05;

const SUMMER_RAINBOW_DAYS = 8;

const RACE_REWARDS = [
  [2, 2, 2, 2, 2, 35],
  [1.6, 1.6, 1.6, 1.6, 1.6, 25],
  [1, 1, 1, 1, 1, 20],
  [13.5, 13.5, 13.5, 13.5, 13.5, 50],
];

// Probability that this card lands on its specialty training (onSpecialty) vs.
// any single off-specialty training (offSpecialty).
function specialtyChances(card: CalcCard, weights: CalcWeights) {
  const specialty = (BASE_WEIGHT + card.specialty_rate + weights.bonusSpec) * card.unique_specialty * card.fs_specialty;
  return {
    onSpecialty: specialty / (OTHER_SLOTS_WEIGHT + specialty),
    offSpecialty: BASE_WEIGHT / (OTHER_SLOTS_WEIGHT + specialty),
  };
}

// Everything about one subset of the fixed deck that doesn't depend on the candidate, built once per processCards call
// rather than once per candidate × training. Indexed by the subset's membership mask, the order subsets() yields, so
// the sums below add up in the same order (and to the same bits) as before.
type Combo = {
  size: number;
  statBonus: number[];
  motivationBonus: number;
  trainingBonus: number[]; // by type count (highlander)
  friendshipBonus: number[]; // by training
  chance: number[]; // by training: exactly this subset lands there
  hasStatCard: boolean[]; // by training: holds a card on its specialty
};
type DeckTable = { combos: Combo[]; withoutCandidate: Map<number[], Map<number, number[][]>> };

function deckTable(deck: DeckCard[]): DeckTable {
  const types = [0, 1, 2, 3, 4, 5, GROUP_TYPE];
  const combos = subsets(deck, 0).map((combination) => ({
    size: combination.length,
    statBonus: [0, 1, 2, 3, 4, 5].map((stat) => comboStatBonus(combination, stat)),
    motivationBonus: comboMotivationBonus(combination),
    trainingBonus: [0, 1, 2, 3, 4, 5, 6, 7].map((typeCount) => comboTrainingBonus(combination, typeCount)),
    friendshipBonus: types.map((type) => comboFriendshipBonus(combination, type)),
    chance: types.map((type) => combinationChance(combination, deck, type)),
    hasStatCard: types.map((type) => combination.some((c) => c.cardType === type)),
  }));
  return { combos, withoutCandidate: new Map() };
}

export function processCards(cards: CalcCard[], weights: CalcWeights, deck: CalcCard[]): ProcessedCard[] {
  const processedCards: ProcessedCard[] = [];
  // TODO(ts): the copies get their calculation fields (cardType, index, …) filled in just below
  const selectedCards = deck.map((c) => ({ ...c })) as DeckCard[];

  // Pre-process the fixed deck: its training types, its cards by type, and the bond it needs before anyone rainbows.
  const presentTypes = [false, false, false, false, false, false, false];
  const cardsPerType: DeckCard[][] = [[], [], [], [], [], [], []];
  let baseBondNeeded = 0;
  for (let i = 0; i < selectedCards.length; i++) {
    const selectedCard = selectedCards[i];
    const chances = specialtyChances(selectedCard, weights);
    selectedCard.rainbowSpecialty = chances.onSpecialty;
    selectedCard.offSpecialty = chances.offSpecialty;
    selectedCard.cardType = selectedCard.type;
    selectedCard.index = i;
    presentTypes[selectedCard.cardType] = true;
    cardsPerType[selectedCard.cardType].push(selectedCard);

    baseBondNeeded += (selectedCard.cardType === GROUP_TYPE ? GROUP_BOND : NORMAL_BOND) - selectedCard.sb;
    if (selectedCard.events) {
      baseBondNeeded -= selectedCard.events[BOND];
    }
  }

  baseBondNeeded += NORMAL_BOND * (5 - selectedCards.length);

  // Chance that an off-type training rainbows on a given turn; discounts the candidate's own rainbow rate (one
  // training per turn). The weights' own stat is skipped.
  const preferredRainbowChances = [0, 0, 0, 0, 0];
  for (let type = 0; type < TRAINING_COUNT; type++) {
    if (type === weights.type) continue;
    if (cardsPerType[type].length === 0) continue;

    const minimum = weights.prioritize ? 2 : 1;
    const combos = subsets(cardsPerType[type], minimum);
    preferredRainbowChances[type] = combos.reduce(
      (total, combo) => total + combinationChance(combo, undefined, type),
      0
    );
  }

  const chanceOfPreferredRainbow = 1 - preferredRainbowChances.reduce((product, chance) => product * (1 - chance), 1);
  const table = deckTable(selectedCards);

  for (let i = 0; i < cards.length; i++) {
    // TODO(ts): rainbowSpecialty / offSpecialty are set below, before anything reads them
    const card = { ...cards[i] } as PlayedCard;
    const cardType = card.type;
    card.index = 6; // distinct from the selected cards' indices (0..5)

    let bondNeeded = baseBondNeeded + (cardType === GROUP_TYPE ? GROUP_BOND : NORMAL_BOND) - card.sb;

    const presentTypesWithCard = presentTypes.slice();
    presentTypesWithCard[cardType] = true;
    const typeCount = presentTypesWithCard.filter(Boolean).length;

    let score = card.sb;
    let energyGain = 0;
    const statGains = card.starting_stats.slice();
    statGains.push(0); // skill-points slot

    // Event rewards (or, for cards without an event entry, the flat rarity
    // bonuses). Both also reduce the bond still needed and add to the score.
    if (card.events) {
      for (let stat = 0; stat < STAT_COUNT; stat++) {
        statGains[stat] += card.events[stat] * card.effect_size_up;
      }
      energyGain += card.events[ENERGY] * card.energy_up;
      bondNeeded -= card.events[BOND];
      score += card.events[BOND];
    } else {
      if (card.rarity === 2) {
        for (let stat = 0; stat < TRAINING_COUNT; stat++) statGains[stat] += 7;
        bondNeeded -= 5;
      } else if (card.rarity === 3) {
        for (let stat = 0; stat < TRAINING_COUNT; stat++) statGains[stat] += 9;
        bondNeeded -= 5;
      }
      score += 5;
    }

    // "Initial <Stat>" bonuses granted once per card in the run: the candidate
    // plus every deck member. Group cards spread the bonus across all 5 stats.
    if (card.type_stats > 0) {
      statGains[card.type] += card.type_stats;
      for (let s = 0; s < selectedCards.length; s++) {
        if (selectedCards[s].type < GROUP_TYPE) {
          statGains[selectedCards[s].type] += card.type_stats;
        } else {
          for (let stat = 0; stat < TRAINING_COUNT; stat++) {
            statGains[stat] += card.type_stats / 5;
          }
        }
      }
    }

    // Split the run's training days into the bonding phase (before the card
    // hits max bond) and the rainbow phase (after).
    let trainingDays = 65 - weights.races[0] - weights.races[1] - weights.races[2];
    if (cardType === GROUP_TYPE) trainingDays -= 5;
    const daysToBond = bondNeeded / weights.bondPerDay;
    const rainbowDays = trainingDays - daysToBond;

    const chances = specialtyChances(card, weights);
    const specialtyPercent = chances.onSpecialty;
    const otherPercent = chances.offSpecialty;
    const offstatAppearanceDenominator = card.offstat_appearance_denominator;

    const daysPerTraining = [0, 0, 0, 0, 0];
    const bondedDaysPerTraining = [0, 0, 0, 0, 0];
    let rainbowTraining = 0;

    // Non-group cards can only rainbow in one training per turn, so discount
    // their rainbow time by the chance a preferred off-type rainbow steals it.
    let rainbowOverride = 1;
    if (cardType !== GROUP_TYPE) {
      card.rainbowSpecialty = specialtyPercent;
      card.offSpecialty = otherPercent;
      const cardsOfThisType: PlayedCard[] = cardsPerType[cardType].slice();
      cardsOfThisType.push(card);

      let chanceOfSingleRainbow = 0;
      for (let j = 0; j < cardsOfThisType.length; j++) {
        chanceOfSingleRainbow += combinationChance([cardsOfThisType[j]], cardsOfThisType, cardType);
      }
      rainbowOverride = 1 - chanceOfPreferredRainbow * chanceOfSingleRainbow;
    }

    for (let stat = 0; stat < TRAINING_COUNT; stat++) {
      if (stat === cardType) {
        rainbowTraining = specialtyPercent * rainbowDays * rainbowOverride;
        daysPerTraining[stat] = specialtyPercent * daysToBond;
      } else {
        daysPerTraining[stat] = (otherPercent / offstatAppearanceDenominator) * daysToBond;
        bondedDaysPerTraining[stat] = (otherPercent / offstatAppearanceDenominator) * rainbowDays;
      }
    }

    if (weights.onlySummer) {
      rainbowTraining = SUMMER_RAINBOW_DAYS * specialtyPercent * rainbowOverride;
    }

    // Cards whose unique friendship bonus ramps up: average it over the first
    // ~2/3 of rainbow days, while the ramp is still climbing.
    if (card.fs_ramp[0] > 0) {
      let current_bonus = 0;
      let total = 0;
      for (let j = rainbowTraining * 0.66; j > 0; j--) {
        total += current_bonus;
        current_bonus = Math.min(current_bonus + card.fs_ramp[0], card.fs_ramp[1]);
      }
      card.unique_fs_bonus = 1 + total / rainbowTraining / 100;
    }

    for (let training = 0; training < TRAINING_COUNT; training++) {
      const gains = weights.unbondedTrainingGain[training];
      const daysOnThisTraining = daysPerTraining[training];
      energyGain += daysOnThisTraining * gains[ENERGY] * card.energy_discount;

      const trainingGains = crossTrainingGain(
        gains,
        weights,
        card,
        table,
        training,
        daysOnThisTraining,
        typeCount,
        false
      );

      for (let stat = 0; stat < STAT_COUNT; stat++) {
        statGains[stat] += trainingGains[stat];
      }
    }

    for (let training = 0; training < TRAINING_COUNT; training++) {
      const gains = weights.bondedTrainingGain[training];
      const daysOnThisTraining = bondedDaysPerTraining[training];
      energyGain += daysOnThisTraining * gains[ENERGY] * card.energy_discount;
      energyGain += daysOnThisTraining * gains[ENERGY] * card.fs_energy;

      const trainingGains = crossTrainingGain(
        gains,
        weights,
        card,
        table,
        training,
        daysOnThisTraining,
        typeCount,
        true
      );

      for (let stat = 0; stat < STAT_COUNT; stat++) {
        statGains[stat] += trainingGains[stat];
      }

      if (training === 4 && card.group) {
        energyGain += (daysOnThisTraining * card.wisdom_recovery) / 5;
      }
    }

    if (cardType < GROUP_TYPE) {
      energyGain += rainbowTraining * card.wisdom_recovery;
      const specialtyGains = weights.onlySummer
        ? weights.summerTrainingGain[cardType]
        : weights.bondedTrainingGain[cardType];

      const trainingGains = trainingGain(
        specialtyGains,
        weights,
        card,
        table,
        cardType,
        rainbowTraining,
        true,
        typeCount
      );

      for (let stat = 0; stat < STAT_COUNT; stat++) {
        statGains[stat] += trainingGains[stat];
      }
    }

    for (let raceType = 0; raceType < RACE_REWARDS.length; raceType++) {
      for (let stat = 0; stat < STAT_COUNT; stat++) {
        const gain = RACE_REWARDS[raceType][stat] * (card.race_bonus / 100) * weights.races[raceType];
        statGains[stat] += gain;
      }
    }

    score += gainsToScore(statGains, weights);
    score += energyGain * weights.stats[ENERGY];

    if (weights.scenarioLink.indexOf(card.char_name) > -1) {
      score += weights.scenarioBonus;
    }

    processedCards.push({
      id: card.id,
      lb: card.limit_break,
      score,
      char_name: card.char_name,
    });
  }

  processedCards.sort((a, b) => b.score - a.score);
  return processedCards;
}

// Each folds the bonuses contributed by the *other* cards sharing a training.
// Training and motivation bonuses add (less their identity of 1); friendship
// bonuses multiply, and only for cards on their own specialty training.

function comboTrainingBonus(combination: DeckCard[], typeCount: number) {
  return combination.reduce((total, c) => {
    let training = total + (c.tb - 1) + combination.length * c.crowd_bonus;
    if (typeCount >= c.highlander_threshold) training += c.highlander_training;
    return training;
  }, 1);
}

function comboFriendshipBonus(combination: DeckCard[], trainingType: number) {
  return combination.reduce(
    (total, c) => (c.cardType === trainingType ? total * c.fs_bonus * c.unique_fs_bonus : total),
    1
  );
}

function comboMotivationBonus(combination: DeckCard[]) {
  return combination.reduce((total, c) => total + c.mb - 1, 1);
}

function comboStatBonus(combination: DeckCard[], stat: number) {
  return combination.reduce((total, c) => total + c.stat_bonus[stat], 0);
}

// Gain from the candidate training on its own specialty. Sums over every way
// the deck members could join it that turn, weighted by how likely each is.
function trainingGain(
  gains: number[],
  weights: CalcWeights,
  card: PlayedCard,
  table: DeckTable,
  trainingType: number,
  days: number,
  rainbow: boolean,
  typeCount: number
) {
  const trainingGains = [0, 0, 0, 0, 0, 0, 0];

  let trainingBonus = card.tb + card.fan_bonus * weights.fanBonus;
  if (typeCount >= card.highlander_threshold) trainingBonus += card.highlander_training;
  let fsBonus = 1;
  let motivationBonus = card.mb;
  if (rainbow) {
    fsBonus = card.fs_bonus * card.unique_fs_bonus;
    motivationBonus += card.fs_motivation;
    trainingBonus += card.fs_training;
  }

  const soloGain = [0, 0, 0, 0, 0, 0];
  for (let stat = 0; stat < STAT_COUNT; stat++) {
    if (gains[stat] === 0) continue;

    let base = gains[stat] + card.stat_bonus[stat];
    if (rainbow) base += card.fs_stats[stat];
    soloGain[stat] +=
      base *
        trainingBonus *
        (1 + weights.motivation * motivationBonus) *
        fsBonus *
        (1 + CARD_BONUS) *
        weights.umaBonus[stat] -
      gains[stat];
  }
  if (gainsToScore(soloGain, weights) > weights.minimum) {
    for (let stat = 0; stat < STAT_COUNT; stat++) {
      trainingGains[stat] +=
        soloGain[stat] * days * table.combos[0].chance[trainingType] * (rainbow ? weights.multi : 1);
    }
  }

  // Case 2: each non-empty subset of deck members joins the candidate. The
  // candidate's marginal contribution is (gain with it) − (gain without it).
  const withoutCandidate = [0, 0, 0, 0, 0, 0];
  const withCandidate = [0, 0, 0, 0, 0, 0];
  for (let mask = 1; mask < table.combos.length; mask++) {
    const combo = table.combos[mask];
    withoutCandidate.fill(0);
    withCandidate.fill(0);

    const selfTrainingBonus = trainingBonus + (combo.size + 1) * card.crowd_bonus;
    const combinationTrainingBonus = combo.trainingBonus[typeCount];
    const combinationFriendshipBonus = combo.friendshipBonus[trainingType];
    const combinationMotivationBonus = combo.motivationBonus;

    for (let stat = 0; stat < STAT_COUNT; stat++) {
      if (gains[stat] === 0) continue;

      let base = gains[stat] + combo.statBonus[stat];
      if (rainbow) base += card.fs_stats[stat];

      withoutCandidate[stat] +=
        base *
        combinationTrainingBonus *
        (1 + weights.motivation * combinationMotivationBonus) *
        combinationFriendshipBonus *
        (1 + CARD_BONUS * combo.size) *
        weights.umaBonus[stat];

      withCandidate[stat] +=
        (base + card.stat_bonus[stat]) *
        (combinationTrainingBonus + selfTrainingBonus - 1) *
        (1 + weights.motivation * (combinationMotivationBonus + motivationBonus - 1)) *
        (combinationFriendshipBonus * fsBonus) *
        (1 + CARD_BONUS * (combo.size + 1)) *
        weights.umaBonus[stat];
    }

    if (gainsToScore(withCandidate, weights) > weights.minimum) {
      const chance = combo.chance[trainingType];
      for (let stat = 0; stat < STAT_COUNT; stat++) {
        trainingGains[stat] +=
          (withCandidate[stat] - withoutCandidate[stat]) * days * chance * (rainbow ? weights.multi : 1);
      }
    }
  }

  return trainingGains;
}

// Gain from the candidate training off its specialty. Only the deck members
// on *their* specialty can rainbow here, so the candidate's contribution
// counts only for combinations that include such a card.
function crossTrainingGain(
  gains: number[],
  weights: CalcWeights,
  card: PlayedCard,
  table: DeckTable,
  trainingType: number,
  days: number,
  typeCount: number,
  bonded: boolean
) {
  const trainingGains = [0, 0, 0, 0, 0, 0, 0];
  let trainingBonus = card.tb + card.fan_bonus * weights.fanBonus;
  if (typeCount >= card.highlander_threshold) trainingBonus += card.highlander_training;
  let fsBonus = 1;
  if (card.group && bonded) {
    fsBonus += (card.fs_bonus + card.unique_fs_bonus - 1) / 5;
  }

  const without = withoutCandidateGains(table, gains, weights, trainingType, typeCount);
  const withCandidate = [0, 0, 0, 0, 0, 0];
  for (let mask = 1; mask < table.combos.length; mask++) {
    const combo = table.combos[mask];
    // Without a deck card on its specialty nothing rainbows: no gain either way.
    if (!combo.hasStatCard[trainingType]) continue;
    withCandidate.fill(0);

    const selfTrainingBonus = trainingBonus + (combo.size + 1) * card.crowd_bonus;
    const combinationTrainingBonus = combo.trainingBonus[typeCount];
    const combinationFriendshipBonus = combo.friendshipBonus[trainingType];
    const combinationMotivationBonus = combo.motivationBonus;

    for (let stat = 0; stat < STAT_COUNT; stat++) {
      if (gains[stat] === 0) continue;

      const base = gains[stat] + combo.statBonus[stat];

      if (bonded) {
        withCandidate[stat] +=
          (base + card.stat_bonus[stat] + card.fs_stats[stat]) *
          (combinationTrainingBonus + selfTrainingBonus + card.fs_training - 1) *
          (1 + weights.motivation * (combinationMotivationBonus + card.mb + card.fs_motivation - 1)) *
          (combinationFriendshipBonus * fsBonus) *
          (1 + CARD_BONUS * (combo.size + 1)) *
          weights.umaBonus[stat];
      } else {
        withCandidate[stat] +=
          (base + card.stat_bonus[stat]) *
          (combinationTrainingBonus + selfTrainingBonus - 1) *
          (1 + weights.motivation * (combinationMotivationBonus + card.mb - 1)) *
          (1 + CARD_BONUS * (combo.size + 1)) *
          weights.umaBonus[stat];
      }
    }

    if (gainsToScore(withCandidate, weights) > weights.minimum) {
      const chance = combo.chance[trainingType];
      const withoutCandidate = without[mask];
      for (let stat = 0; stat < STAT_COUNT; stat++) {
        trainingGains[stat] += (withCandidate[stat] - withoutCandidate[stat]) * days * chance * weights.multi;
      }
    }
  }

  return trainingGains;
}

// crossTrainingGain's deck-only side (the training's gain without the candidate), per subset; the same for every
// candidate, so worked out once per deck.
function withoutCandidateGains(
  table: DeckTable,
  gains: number[],
  weights: CalcWeights,
  trainingType: number,
  typeCount: number
) {
  // Keyed by the gains array itself: they're the weights' own arrays, one per training.
  const byGains = table.withoutCandidate.get(gains) ?? new Map<number, number[][]>();
  table.withoutCandidate.set(gains, byGains);
  const key = trainingType * 8 + typeCount;
  const cached = byGains.get(key);
  if (cached) return cached;
  const result = table.combos.map((combo) => {
    const withoutCandidate = [0, 0, 0, 0, 0, 0];
    for (let stat = 0; stat < STAT_COUNT; stat++) {
      if (gains[stat] === 0) continue;
      withoutCandidate[stat] +=
        (gains[stat] + combo.statBonus[stat]) *
        combo.trainingBonus[typeCount] *
        (1 + weights.motivation * combo.motivationBonus) *
        combo.friendshipBonus[trainingType] *
        (1 + CARD_BONUS * combo.size) *
        weights.umaBonus[stat];
    }
    return withoutCandidate;
  });
  byGains.set(key, result);
  return result;
}

function gainsToScore(gains: number[], weights: CalcWeights) {
  let score = 0;
  for (let stat = 0; stat < STAT_COUNT; stat++) {
    score += Math.min(gains[stat], weights.cap) * weights.stats[stat];
  }
  return score;
}

// Every subset of `cards` with at least `minLength` members (built by treating
// the bits of each number 0..2^n-1 as a membership mask).
function subsets<T>(cards: T[], minLength = 1): T[][] {
  const combinations: T[][] = [];
  const count = 2 ** cards.length;

  for (let mask = 0; mask < count; mask++) {
    const subset: T[] = [];
    for (let j = 0; j < cards.length; j++) {
      if (mask & (2 ** j)) subset.push(cards[j]);
    }
    if (subset.length >= minLength) combinations.push(subset);
  }

  return combinations;
}

// Probability that exactly `combination` lands on `trainingType` this turn:
// the combination members do, and (when `cards` is given) none of the rest do.
function combinationChance(combination: PlayedCard[], cards: PlayedCard[] | undefined, trainingType: number) {
  const landsOn = (card: PlayedCard) => (card.cardType === trainingType ? card.rainbowSpecialty : card.offSpecialty);

  let chance = combination.reduce((current, card) => current * landsOn(card), 1);

  if (cards) {
    const otherCards = cards.filter((c) => combination.findIndex((d) => c.index === d.index) === -1);
    chance = otherCards.reduce((current, card) => current * (1 - landsOn(card)), chance);
  }

  return chance;
}
