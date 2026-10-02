import { useEffect, useState } from "react"
import { STATS, rankByUsefulness } from "../tierlist/index.js"
import { getServerConfig } from "../tierlist/scenarios.js"
import source from "../generated/SOURCE.json"

const SERVERS = { gl: "Global", jp: "Japan" }
const TIER_NAMES = ["S", "A", "B", "C", "D", "E", "F", "G"]

// Images from the same upstream commit as the card data.
const imageUrl = (id) =>
  `https://raw.githubusercontent.com/${source.repo}/${source.ref}/public/cardImages/support_card_s_${id}.png`

// Same banding as upstream TierList.jsx: split the score range into 7 steps.
function toTiers(ranking) {
  if (ranking.length === 0) return []
  const top = ranking[0].score
  const step = (top - ranking[ranking.length - 1].score) / 7
  let boundary = top - step
  const tiers = [[]]
  for (const card of ranking) {
    while (card.score < boundary - 1) {
      tiers.push([])
      boundary -= step
    }
    tiers[tiers.length - 1].push(card)
  }
  return tiers
}

export default function App() {
  const [server, setServer] = useState("gl")
  const [scenario, setScenario] = useState(getServerConfig("gl").defaultScenario)
  const [stat, setStat] = useState("speed")
  const [ranking, setRanking] = useState(null)

  const scenarios = getServerConfig(server).availableScenarios

  useEffect(() => {
    let cancelled = false
    setRanking(null)
    // Ranking blocks for ~100-300 ms; yield first so "Calculating…" paints.
    setTimeout(() => {
      if (cancelled) return
      rankByUsefulness(server, scenario, stat).then((r) => {
        if (!cancelled) setRanking(r)
      })
    })
    return () => {
      cancelled = true
    }
  }, [server, scenario, stat])

  function changeServer(next) {
    setServer(next)
    const config = getServerConfig(next)
    if (!config.availableScenarios.includes(scenario)) setScenario(config.defaultScenario)
  }

  return (
    <main>
      <h1>Support Card Tier List</h1>
      <div className="controls">
        <label>
          Server
          <select value={server} onChange={(e) => changeServer(e.target.value)}>
            {Object.entries(SERVERS).map(([key, name]) => (
              <option key={key} value={key}>{name}</option>
            ))}
          </select>
        </label>
        <label>
          Scenario
          <select value={scenario} onChange={(e) => setScenario(e.target.value)}>
            {scenarios.map((key) => (
              <option key={key} value={key}>{key}</option>
            ))}
          </select>
        </label>
        <label>
          Stat
          <select value={stat} onChange={(e) => setStat(e.target.value)}>
            {Object.entries(STATS).map(([key, name]) => (
              <option key={key} value={key}>{name}</option>
            ))}
          </select>
        </label>
      </div>

      {ranking === null ? (
        <p className="status">Calculating…</p>
      ) : (
        toTiers(ranking).map((tier, i) => (
          <section className="tier" key={i}>
            <div className={`tier-label tier-${i}`}>{TIER_NAMES[i]}</div>
            <div className="tier-cards">
              {tier.map((card) => (
                <figure className="card" key={`${card.id}/${card.lb}`} title={card.char_name}>
                  <img src={imageUrl(card.id)} alt={card.char_name} loading="lazy" />
                  <span className="lb">LB{card.lb}</span>
                  <figcaption>
                    <span className="name">{card.char_name}</span>
                    <span className="score">{card.score.toFixed(0)}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        ))
      )}
    </main>
  )
}
