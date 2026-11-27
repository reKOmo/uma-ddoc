import type { CSSProperties } from 'react';

// TODO(ts): CSSProperties has no index for custom properties.
export const tierStyle = (tier: number) => ({ '--band': `var(--tier-${tier})` }) as CSSProperties;
