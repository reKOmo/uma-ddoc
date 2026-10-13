// Prints the usefulness ranking:  node tierlist/cli.js gl GL speed
import { type Stat, rankByUsefulness } from './index.ts';
import type { Server } from './cards.ts';

const [server = 'gl', scenario = 'GL', stat = 'speed'] = process.argv.slice(2);
// TODO(ts): command-line arguments are not checked (as before); a bad one fails in the ranking.
const ranking = await rankByUsefulness(server as Server, scenario, stat as Stat);
for (const r of ranking) {
  console.log(`${r.score.toFixed(0).padStart(6)}  ${r.char_name} (${r.id}) LB${r.lb}`);
}
