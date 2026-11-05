import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const acorn = require('internal/deps/acorn/acorn/dist/acorn');
const walk = require('internal/deps/acorn/acorn-walk/dist/walk');

const file = path.resolve(process.argv[2]);
const source = fs.readFileSync(file, 'utf8');
const ast = acorn.parse(source, {
  ecmaVersion: 'latest',
  sourceType: file.endsWith('.mjs') ? 'module' : 'script',
  locations: true
});

function literalSpecifier(node) {
  if (!node) return null;
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0].value.cooked;
  }
  return null;
}

function resolveLocal(specifier) {
  if (!specifier || !specifier.startsWith('.')) return null;
  return path.resolve(path.dirname(file), specifier);
}

const dynamicImports = [];
const workers = [];
walk.full(ast, node => {
  if (node.type === 'ImportExpression') {
    const specifier = literalSpecifier(node.source);
    const resolved = resolveLocal(specifier);
    dynamicImports.push({
      specifier,
      analyzable: specifier !== null,
      resolved,
      exists: resolved === null ? null : fs.existsSync(resolved),
      line: node.loc.start.line
    });
  }
  if (
    node.type === 'NewExpression' &&
    node.callee?.type === 'Identifier' &&
    (node.callee.name === 'Worker' || node.callee.name === 'SharedWorker')
  ) {
    let arg = node.arguments[0];
    if (
      arg?.type === 'NewExpression' &&
      arg.callee?.type === 'Identifier' &&
      arg.callee.name === 'URL'
    ) arg = arg.arguments[0];
    const specifier = literalSpecifier(arg);
    const resolved = resolveLocal(specifier);
    workers.push({
      kind: node.callee.name,
      specifier,
      analyzable: specifier !== null,
      resolved,
      exists: resolved === null ? null : fs.existsSync(resolved),
      line: node.loc.start.line
    });
  }
});

const unresolved = [...dynamicImports, ...workers].filter(x => !x.analyzable || x.exists === false);
console.log(JSON.stringify({
  tool: 'acorn',
  toolVersion: acorn.version,
  nodeVersion: process.version,
  file,
  dynamicImports,
  workers,
  decision: unresolved.length ? 'HOLD_UNRESOLVED_RUNTIME_ENTRYPOINT' : 'PASS_LITERAL_RUNTIME_ENTRYPOINT_DISCOVERY',
  unresolvedCount: unresolved.length
}, null, 2));
process.exitCode = unresolved.length ? 2 : 0;
