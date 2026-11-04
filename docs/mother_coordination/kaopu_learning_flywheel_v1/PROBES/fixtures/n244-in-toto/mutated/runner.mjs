import { writeFileSync } from 'node:fs';
import { resolveSide } from './declared-command-binding.mjs';

const side = await resolveSide();
writeFileSync('result.json', JSON.stringify({ side }));
