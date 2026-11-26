import type { Ranked } from '../../../tierlist/index.ts';
import { cards } from '../../../tierlist/cards.ts';
import { cardIcon } from '../../lib/gametora.ts';
import { lbName } from '../../i18n/index.ts';
import { cardUrl } from '../../routes.ts';
import styles from './CardTile.module.css';

export default function CardTile({ card }: { card: Ranked }) {
  return (
    <a className={styles.card} href={cardUrl(card.id)} title={card.char_name}>
      <figure>
        <img src={cardIcon(card.id, cards)} alt={card.char_name} loading="lazy" />
        <span className={styles.lb}>{lbName(card.lb)}</span>
        <figcaption>
          <span className={styles.name}>{card.char_name}</span>
          <span className={styles.score}>{card.score.toFixed(0)}</span>
        </figcaption>
      </figure>
    </a>
  );
}
