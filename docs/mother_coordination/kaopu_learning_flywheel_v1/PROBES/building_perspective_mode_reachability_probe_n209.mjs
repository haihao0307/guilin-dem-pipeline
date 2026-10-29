#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(process.argv[2] ?? '');
if (!root || !fs.existsSync(root)) {
  console.error('usage: node building_perspective_mode_reachability_probe_n209.mjs <extracted-package-root>');
  process.exit(2);
}

const read = file => fs.readFileSync(file, 'utf8');
const rel = file => path.relative(root, file).split(path.sep).join('/');
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
const entrypoints = JSON.parse(read(path.join(root, 'ENTRYPOINTS.json')));

const patterns = [
  ['perspective_literal', /\bperspective\b/gi],
  ['fov_tangent', /Math\.tan\s*\([^\n;]{0,80}\bfov(?:Radians)?\b[^\n;]{0,80}\/[ ]*2\s*\)/gi],
  ['depth_division', /\/\s*\(\s*depth\s*\*\s*tan|\/\s*depth\b/gi],
  ['perspective_camera_fit', /\bfitBoundsCamera\b/g],
  ['perspective_ray_api', /\bcameraRay\b/g],
  ['fov_radians_api', /\bfovRadians\b/g]
];

function moduleRefs(file, source) {
  const refs = new Set();
  const add = (value, allowDocumentRelative = false) => {
    if (!value || (!allowDocumentRelative && !value.startsWith('.')) || /^(?:[a-z]+:|\/\/|\/)/i.test(value)) return;
    const clean = value.split(/[?#]/, 1)[0];
    refs.add(path.resolve(path.dirname(file), clean));
  };
  if (/\.html?$/.test(file)) {
    for (const m of source.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) add(m[1], true);
  }
  for (const re of [
    /\b(?:import|export)\s*(?:[^'";]*?\s*from\s*)?["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\bnew\s+URL\s*\(\s*["']([^"']+)["']\s*,\s*import\.meta\.url\s*\)/g
  ]) for (const m of source.matchAll(re)) add(m[1]);
  return [...refs];
}

function scanFile(file) {
  const source = read(file);
  const lines = source.split(/\r?\n/);
  const markers = [];
  for (const [kind, re] of patterns) {
    re.lastIndex = 0;
    for (const match of source.matchAll(re)) {
      const line = source.slice(0, match.index).split(/\r?\n/).length;
      markers.push({kind, line, excerpt: lines[line - 1].trim().slice(0, 240)});
    }
  }
  return {source, markers};
}

function closure(entry) {
  const start = path.join(root, entry.path);
  const stack = [start];
  const seen = new Set();
  const evidence = [];
  const missing = [];
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      missing.push(rel(file));
      continue;
    }
    const {source, markers} = scanFile(file);
    if (markers.length) evidence.push({file: rel(file), sha256: sha256(source), markers});
    for (const child of moduleRefs(file, source)) stack.push(child);
  }
  return {
    title: entry.title,
    entrypoint: entry.path,
    reachableFiles: [...seen].filter(fs.existsSync).map(rel).sort(),
    missing: [...new Set(missing)].sort(),
    perspectiveEvidence: evidence.sort((a, b) => a.file.localeCompare(b.file)),
    verdict: evidence.length ? 'ACTIVE_PERSPECTIVE_PATH_PRESENT' : 'NO_PERSPECTIVE_MARKER_IN_STATIC_REACHABILITY'
  };
}

const audits = entrypoints.map(closure);
const active = audits.filter(x => x.perspectiveEvidence.length);
const result = {
  schema: 'KAOPU_BUILDING_PERSPECTIVE_REACHABILITY_N209_V1',
  source: {
    packageName: path.basename(root),
    packageZipSha256: process.env.PACKAGE_ZIP_SHA256 ?? null,
    packageManifestSha256: sha256(read(path.join(root, 'MANIFEST.json'))),
    entrypointsSha256: sha256(read(path.join(root, 'ENTRYPOINTS.json')))
  },
  boundedQuestion: 'Was the far-small-near-large perspective display path removed from every active Lean Code entrypoint?',
  userFrozenInvariant: 'PERSPECTIVE_DISPLAY_FORBIDDEN',
  counts: {
    entrypoints: audits.length,
    entrypointsWithPerspectivePath: active.length,
    entrypointsWithoutDetectedPerspectivePath: audits.length - active.length,
    totalReachableFiles: new Set(audits.flatMap(x => x.reachableFiles)).size,
    totalMissingStaticDependencies: audits.reduce((n, x) => n + x.missing.length, 0)
  },
  audits,
  decision: active.length ? 'REJECT_ACTIVE_PERSPECTIVE_MODE_STILL_REACHABLE' : 'CANDIDATE_NO_STATIC_PERSPECTIVE_PATH_DETECTED',
  limits: [
    'Static literal import/new-URL reachability only; runtime-generated paths are outside this probe.',
    'Marker absence is not visual acceptance; marker presence on an active path is sufficient to reject the frozen invariant.',
    'This probe does not judge package size, Wood separation, geometry fidelity, or production adoption.'
  ]
};

process.stdout.write(JSON.stringify(result, null, 2) + '\n');
