import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { SourceTextModule } from 'node:vm';

const root = process.argv[2];
if (!root) throw new Error('USAGE: node --experimental-vm-modules n247_probe.mjs <package-root>');

const siteRoot = path.resolve(root, 'site');
const version = JSON.parse(await fs.readFile(path.join(siteRoot, 'version.json'), 'utf8'));
const declared = new Map(version.displayPolicy.dependencies.map((x) => [x.module, x.sha256]));
const seen = new Map();
const unresolved = [];
const external = [];

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function visit(absPath) {
  const normalized = path.normalize(absPath);
  if (seen.has(normalized)) return;
  const source = await fs.readFile(normalized, 'utf8');
  const module = new SourceTextModule(source, { identifier: normalized });
  const rel = path.relative(siteRoot, normalized).replaceAll(path.sep, '/');
  seen.set(normalized, {
    module: rel,
    sha256: sha256(source),
    requests: module.moduleRequests.map((r) => r.specifier),
  });
  for (const req of module.moduleRequests) {
    const spec = req.specifier;
    if (!spec.startsWith('.') && !spec.startsWith('/')) {
      external.push({ from: rel, specifier: spec });
      continue;
    }
    const resolved = path.resolve(path.dirname(normalized), spec);
    if (!resolved.startsWith(siteRoot + path.sep) && resolved !== siteRoot) {
      unresolved.push({ from: rel, specifier: spec, reason: 'OUTSIDE_SITE_ROOT' });
      continue;
    }
    try {
      await fs.access(resolved);
      await visit(resolved);
    } catch {
      unresolved.push({ from: rel, specifier: spec, reason: 'MISSING_FILE' });
    }
  }
}

await visit(path.join(siteRoot, 'app.mjs'));

const graph = [...seen.values()].sort((a, b) => a.module.localeCompare(b.module));
const graphMap = new Map(graph.map((x) => [x.module, x]));
const declaredRows = [...declared].map(([module, expected]) => {
  const observed = graphMap.get(module);
  return {
    module,
    expected,
    inStaticClosure: Boolean(observed),
    observed: observed?.sha256 ?? null,
    hashMatch: observed ? observed.sha256 === expected : null,
  };
});
const undeclaredStaticClosure = graph
  .filter((x) => !declared.has(x.module))
  .map((x) => ({ module: x.module, sha256: x.sha256 }));

async function requestsFor(relativePath) {
  const source = await fs.readFile(path.join(siteRoot, relativePath), 'utf8');
  const module = new SourceTextModule(source, { identifier: relativePath });
  return module.moduleRequests.map((r) => r.specifier);
}

const result = {
  schema: 'kaopu.learning-flywheel/node-static-module-closure-probe/1.0',
  subject: {
    package: 'Mechanical-Mother-v37-offline.zip',
    packageSha256: 'd4f19a70a743e8c78b859cb5c69c26543ed3b59cc4c3a7bd20cf12199b086b81',
    sourceCommit: 'b7281661a7f05ee8a4d9710e80f55c36a339cdfe',
    root: 'site/app.mjs',
  },
  runtime: {
    node: process.version,
    api: 'node:vm SourceTextModule.moduleRequests',
    experimentalFlagRequired: true,
  },
  boundedQuestion: 'Can a parser-derived static ESM closure detect render.mjs missing from displayPolicy.dependencies?',
  result: {
    staticClosureCount: graph.length,
    unresolved,
    external,
    renderInStaticClosure: graphMap.has('render.mjs'),
    renderDeclaredInDisplayPolicy: declared.has('render.mjs'),
    declaredDependencyCount: declared.size,
    declaredRows,
    undeclaredStaticClosure,
    bootModuleRequests: await requestsFor('boot.js'),
    appModuleRequests: await requestsFor('app.mjs'),
  },
  decision:
    graphMap.has('render.mjs') && !declared.has('render.mjs')
      ? 'STATIC_ESM_CLOSURE_DETECTS_N246_RENDER_OMISSION_HOLD_DYNAMIC_IMPORT_DISCOVERY'
      : 'NO_NOVELTY_OR_PROBE_FAILED',
};

console.log(JSON.stringify(result, null, 2));
