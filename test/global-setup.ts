import { ensureCards } from '../scripts/lib/cards/files.ts';

// The tests need card data; fetch it if this checkout doesn't have it yet.
export default ensureCards;
