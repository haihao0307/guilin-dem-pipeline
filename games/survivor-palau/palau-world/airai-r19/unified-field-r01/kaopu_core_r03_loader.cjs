'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

const sourcePath = path.join(__dirname, 'kaopu_core_r03.cjs');
let source = fs.readFileSync(sourcePath, 'utf8');

const original = `function ok(meta = {}) {
  return { ok: true, meta: clone(meta) };
}`;
const corrected = `function ok(meta = {}) {
  // Internal validator metadata may contain Set instances used for referential checks.
  // Preserve those structures in-process; final public receipts remain JSON-serializable.
  return { ok: true, meta };
}`;

if (!source.includes(original)) {
  throw new Error('R03 loader could not find the exact ok(meta) implementation to correct.');
}

source = source.replace(original, corrected);

const compiled = new Module(`${sourcePath}#set-preserving-loader`, module);
compiled.filename = sourcePath;
compiled.paths = module.paths;
compiled._compile(source, sourcePath);

module.exports = compiled.exports;
