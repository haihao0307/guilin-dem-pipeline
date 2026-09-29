import { lstat, mkdir, readlink, rm, symlink } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'node_modules');
const target = resolve(root, '../kaopu-quadruped-r04/node_modules');

await mkdir(source, { recursive: true });
let existing = null;
try {
  existing = await lstat(target);
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

if (existing) {
  if (!existing.isSymbolicLink()) {
    console.log(`Frozen R04 dependency directory already exists: ${target}`);
    process.exit(0);
  }
  const current = resolve(dirname(target), await readlink(target));
  if (current === source) {
    console.log(`Frozen R04 dependency link already valid: ${target}`);
    process.exit(0);
  }
  await rm(target, { force: true });
}

await symlink(relative(dirname(target), source), target, 'junction');
console.log(`Linked frozen R04 dependency resolution: ${target} -> ${source}`);
