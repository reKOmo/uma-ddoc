import clsx from 'clsx';
import type { Rarity } from '../../../shared/schemas/common.ts';
import styles from './CardArt.module.css';

const FRAME: Record<Rarity, string | undefined> = { R: styles.r, SR: styles.sr, SSR: styles.ssr };

type CardArtProps = { src: string; alt: string | undefined; rarity: Rarity; className?: string };

// The card's art in its rarity's in-game frame colours.
export default function CardArt({ src, alt, rarity, className }: CardArtProps) {
  return (
    <figure className={clsx(styles.frame, FRAME[rarity], className)}>
      <img className={styles.image} src={src} alt={alt} />
    </figure>
  );
}
