// Prints the usefulness ranking:  node tierlist/cli.js gl GL speed
import { rankByUsefulness } from './index.js';

const [server = 'gl', scenario = 'GL', stat = 'speed'] = process.argv.slice(2);
const ranking = await rankByUsefulness(server, scenario, stat);
for (const r of ranking) {
  console.log(`${r.score.toFixed(0).padStart(6)}  ${r.char_name} (${r.id}) LB${r.lb}`);
}
