import { ensureCards } from '../scripts/update-cards.ts';

// The tests need card data; fetch it if this checkout doesn't have it yet.
export default ensureCards;
