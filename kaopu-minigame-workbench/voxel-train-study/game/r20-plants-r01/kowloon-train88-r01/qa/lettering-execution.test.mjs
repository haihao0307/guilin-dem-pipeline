// CPU/source equivalence only. A successful test is not a GPU-driver pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createStationWGSL} from '../../kowloon-station-r04/receiver.mjs';
import {STATION_SCORE} from '../../kowloon-station-r04/station-score.mjs';
import {stationLetteringTemplates, nativeArcWinding, nativeArcDistance} from '../../kowloon-station-r04/native-station-lettering.mjs';
import {createStationBinding} from '../station-binding.mjs';
import {hostConstructionWGSL} from '../host-construction.mjs';
import {adaptStationLettering, stationGeometryGroupSource, GEOMETRY_GROUP_NAMES} from '../geometry-groups.mjs';
import {extraction} from '../shader-closure.mjs';

const datums = JSON.parse(fs.readFileSync(new URL('./host-datums.json', import.meta.url)));
const construction = createStationBinding({score: STATION_SCORE, ...datums}).construction;
const original = createStationWGSL({construction, hostWGSL: hostConstructionWGSL(construction.host)});
const adapted = adaptStationLettering(original);
const templates = stationLetteringTemplates({hallEmbed: .045, id: 7, seed: 187});
const tables = [...original.matchAll(/const (stationLetteringCurves([0-5]))=array<StationLetteringArc,(\d+)>\(\n([\s\S]*?)\);/g)].map(match => ({name: match[1], word: Number(match[2]), count: Number(match[3]), text: match[0], literals: match[4].split(',\n')}));
assert.equal(tables.length, 6);
function functionBlock(source, name) {
  const start = source.indexOf(`fn ${name}(`), open = source.indexOf('{', start);
  assert(start >= 0 && open > start, `Missing ${name}`);
  let depth = 1, end = open + 1;
  for (; depth; end++) {if (source[end] === '{') depth++; if (source[end] === '}') depth--; assert(end < source.length);}
  return {start, end, text: source.slice(start, end)};
}
function lookupBlocks(source, word) {
  return [...source.matchAll(new RegExp('\\bfn (stationLetteringArcWord'+word+'Glyph(\\d+))\\(', 'g'))].map(match => ({name: match[1], glyph: Number(match[2]), ...functionBlock(source, match[1])}));
}
function leafLiterals(block) {
  return [...block.text.matchAll(/(?:case (\d+)u|default):\{return (StationLetteringArc\([^;]+\));\}/g)].map(match => ({index: match[1] === undefined ? null : Number(match[1]), literal: match[2]}));
}
function undoAdapter(source) {
  let output = source;
  for (const table of tables) {
    const blocks = lookupBlocks(output, table.word); assert(blocks.length);
    const first = output.lastIndexOf('// Exact source arcs [', blocks[0].start);
    const last = blocks.at(-1).end + 1; // generated helper terminator includes one newline
    output = output.slice(0, first) + table.text + output.slice(last);
    for (const block of blocks) output = output.replaceAll(`${block.name}(i)`, `${table.name}[i]`);
  }
  return output;
}
function literalScalars(literal) {
  const flat = literal.slice('StationLetteringArc('.length, -1).replace(/vec2<f32>\(([^)]*)\)/g, '$1');
  const values = flat.split(',').map(value => Number(value.trim().replace(/u$/, '')));
  assert.equal(values.length, 14); assert(values.every(Number.isFinite)); return values;
}

test('the execution adapter is byte-for-byte reversible outside proven table accesses', () => {
  assert.equal(undoAdapter(adapted), original);
  assert.equal(adaptStationLettering(adapted), adapted, 'idempotent for combined whole/group paths');
  assert.equal(adaptStationLettering('fn materialOnly()->f32{return 1.;}'), 'fn materialOnly()->f32{return 1.;}');
  assert.doesNotMatch(adapted, /\bstationLetteringCurves[0-5]\b/);
  assert.equal((adapted.match(/fn stationLetteringArcWord/g) || []).length, 33);
  assert.deepEqual(GEOMETRY_GROUP_NAMES, ['terminal', 'hall-lettering', 'hall-forecourt-and-tower', 'shed-roofs-trusses', 'shed-castings-lamps', 'shed-platforms', 'shed-rails', 'shed-benches', 'shed-footbridge', 'approaches-goods-walk', 'waterfront', 'host-transfer']);
});

test('each of 653 original arcs is emitted once with identical 14 scalar literals and unchanged in-range index mapping', () => {
  let count = 0, largestLookup = 0;
  for (const table of tables) {
    assert.equal(table.literals.length, table.count);
    const blocks = lookupBlocks(adapted, table.word);
    assert.equal(blocks.length, templates[table.word].glyphs.length);
    let offset = 0;
    for (const block of blocks) {
      const leaves = leafLiterals(block), expected = templates[table.word].glyphs[block.glyph].arcs.length;
      largestLookup = Math.max(largestLookup, leaves.length);
      assert.equal(leaves.length, expected);
      assert.equal(leaves.at(-1).index, null, 'only the last valid index uses default');
      assert(adapted.includes(`for(var i=${offset}u;i<${offset+expected}u;i++){let arc=${block.name}(i);`));
      for (let local = 0; local < leaves.length; local++) {
        const index = offset + local, leaf = leaves[local];
        if (local < leaves.length - 1) assert.equal(leaf.index, index);
        assert.equal(leaf.literal, table.literals[index], `word ${table.word} glyph ${block.glyph} arc ${index}`);
        const a = literalScalars(leaf.literal), b = literalScalars(table.literals[index]);
        assert.deepEqual(new Uint32Array(new Float32Array(a.slice(0, 12)).buffer), new Uint32Array(new Float32Array(b.slice(0, 12)).buffer));
        assert.deepEqual(a.slice(12), b.slice(12)); count++;
      }
      offset += expected;
    }
    assert.equal(offset, table.count);
  }
  assert.equal(count, 653); assert.equal(largestLookup, 118);
});

test('lookup literals reproduce original CPU Bézier winding and distance, preserving step budgets', () => {
  let checks = 0;
  for (const table of tables) {
    const originalArcs = templates[table.word].glyphs.flatMap(glyph => glyph.arcs);
    const leaves = lookupBlocks(adapted, table.word).flatMap(leafLiterals);
    for (let i = 0; i < leaves.length; i++) {
      const v = literalScalars(leaves[i].literal), arc = originalArcs[i];
      const restored = {...arc, degree: v[12], steps: v[13], points: Array.from({length: v[12] + 1}, (_, j) => v.slice(j * 2, j * 2 + 2)), bounds: {min: v.slice(8, 10), max: v.slice(10, 12)}};
      assert.deepEqual(restored.points, arc.points); assert.deepEqual(restored.bounds, arc.bounds); assert.equal(restored.steps, arc.steps);
      const points = [arc.points[0], [(arc.bounds.min[0] + arc.bounds.max[0]) / 2, (arc.bounds.min[1] + arc.bounds.max[1]) / 2], [arc.bounds.max[0] + .000031, arc.bounds.min[1] - .000017]];
      for (const point of points) {
        assert.equal(nativeArcWinding(restored, point), nativeArcWinding(arc, point));
        assert.equal(nativeArcDistance(restored, point), nativeArcDistance(arc, point)); checks++;
      }
    }
  }
  assert.equal(checks, 1959);
  for (const name of ['stationLetteringWinding', 'stationLetteringArcDistance', 'stationLetteringBezier', 'stationLetteringExtrude', 'stationLetteringMiss', 'stationLetteringPlatform', 'stationLetteringHall', 'stationDomain', 'resolveCandidates']) assert.equal(functionBlock(adapted, name).text, functionBlock(original, name).text, `${name} remains authoritative`);
});

test('ten already-executing group closures are unchanged; only hall/platform lettering gain lookup functions', () => {
  for (let index = 0; index < GEOMETRY_GROUP_NAMES.length; index++) {
    const selected = stationGeometryGroupSource(original, index), before = undoAdapter(selected);
    const a = extraction(selected).closure(['stationField']), b = extraction(before).closure(['stationField']);
    if (![1, 4].includes(index)) assert.equal(a, b, `Nonlettering group ${index} closure changed`);
    else {
      assert.doesNotMatch(a, /const stationLetteringCurves/);
      assert.equal((a.match(/fn stationLetteringArcWord/g) || []).length, index === 1 ? 9 : 24);
    }
  }
});

test('unrecognized array references and changed/noncontiguous loop intervals fail closed', () => {
  assert.throws(() => adaptStationLettering(original.replace('i<21u;i++', 'i<22u;i++')), /intervals/);
  assert.throws(() => adaptStationLettering(original.replace('let arc=stationLetteringCurves0[i];', 'let arc=stationLetteringCurves0[i+1u];')), /intervals|traversed|reference/);
  assert.throws(() => adaptStationLettering(original.replace('array<StationLetteringArc,172>', 'array<StationLetteringArc,173>')), /count mismatch/);
  assert.throws(() => adaptStationLettering(original + '\nfn forbiddenRead()->StationLetteringArc{return stationLetteringCurves5[0u];}'), /reference remains/);
});
