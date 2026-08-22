import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Guilin DEM experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /桂林扩展 DEM/);
  assert.match(html, /\/terrain\/index\.html/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|SkeletonPreview/);
});

test("terrain manifest matches the published binaries", async () => {
  const assetRoot = new URL("../public/terrain/assets/", import.meta.url);
  const manifest = JSON.parse(await readFile(new URL("terrain-manifest.json", assetRoot), "utf8"));
  assert.equal(manifest.ready, true);
  assert.equal(manifest.crs, "EPSG:32649");
  assert.equal(manifest.heightEncoding.sampleType, "uint16");
  assert.equal(manifest.heightEncoding.byteOrder, "little-endian");
  assert.equal(manifest.rowOrder, "north-to-south");
  assert.equal(manifest.columnOrder, "west-to-east");
  assert.equal(Math.max(manifest.gridWidth, manifest.gridHeight), 2048);
  assert.equal(manifest.validFraction, 1);
  assert.equal(manifest.visualFillApplied, false);
  assert.equal(manifest.sourceCoverageType, "downloaded");
  assert.equal(manifest.sourceValidFraction, 1);
  assert.equal(manifest.verticalScale, 1);
  assert.ok(manifest.waterways.length > 2000);
  assert.ok(manifest.waterwayPolygons.length > 3000);
  assert.equal(manifest.waterwayTriangles.length, 0);
  assert.match(manifest.waterwaySource, /OpenStreetMap contributors/);
  assert.ok(manifest.waterwayExcludedReservoirFeatures > 0);
  assert.equal(manifest.waterwayLabelPolicy, "只绘制水面，不显示水系名称");
  assert.equal(manifest.waterwayRepresentation, "mapped-water-surface-polygons-with-tapered-centerline-fallback");
  assert.equal(manifest.waterwayEdgePolicy, "split-then-clip-each-contiguous-part-at-terrain-boundary");
  assert.equal(manifest.waterSurfacePolicy, "sampled-to-DEM-ground-plus-0.6m-render-epsilon");
  assert.match(manifest.waterwayCenterlinePolicy, /centerlines/);
  assert.match(manifest.waterwayControlPolicy, /browser-only/);
  assert.ok(manifest.waterways.every(({ points, network }) => Array.isArray(points) && points.length >= 4 && network));
  assert.equal(manifest.waterwayNetworks.xiangjiang, "OSM-named-and-unnamed-river-ways");
  assert.equal(manifest.waterwayNetworks.lijiang, "continuous-extract-plus-OSM-ways");
  assert.equal(manifest.ecology.ready, true);
  assert.equal(manifest.ecology.sourceStatus, "deterministic-ecology-proof-awaiting-real-12.5m-dem");
  assert.deepEqual(manifest.fineRegions.map(({ status }) => status), [
    "ready_12_5m",
    "ready_12_5m",
    "ready_12_5m",
    "ready_12_5m",
  ]);
  assert.ok(manifest.fineRegions.every(({ assetManifest, requestedAreaSquareKilometers }) => assetManifest && requestedAreaSquareKilometers === 200));
  assert.deepEqual(
    manifest.landmarks.map(({ name }) => name),
    ["真寶鼎", "陽朔縣", "秧塘機場", "桂林古城"],
  );

  const height = await readFile(new URL("height_u16.bin", assetRoot));
  const mask = await readFile(new URL("mask_u8.bin", assetRoot));
  assert.equal(height.byteLength, manifest.heightByteLength);
  assert.equal(mask.byteLength, manifest.maskByteLength);
  assert.equal(createHash("sha256").update(height).digest("hex"), manifest.heightSha256);
  assert.equal(createHash("sha256").update(mask).digest("hex"), manifest.maskSha256);
  assert.ok(mask.every((value) => value === 1));
});

test("terrain page uses cacheable assets rather than embedded preview images", async () => {
  const html = await readFile(new URL("../public/terrain/index.html", import.meta.url), "utf8");
  assert.match(html, /assets\/height_u16\.bin/);
  assert.match(html, /assets\/mask_u8\.bin/);
  assert.doesNotMatch(html, /河流名称|river-name/);
  assert.match(html, /this\.exaggeration=1/);
  assert.match(html, /focusRegion/);
  assert.match(html, /zoomToPointer/);
  assert.match(html, /Math\.max\(\.012/);
  assert.match(html, /programWater/);
  assert.match(html, /waterPoint/);
  assert.match(html, /fx2/);
  assert.match(html, /data-gaea="deposition"/);
  assert.match(html, /data-gaea="talus"/);
  assert.match(html, /data-gaea="rock"/);
  assert.match(html, /waterwayPolygons/);
  assert.doesNotMatch(html, /drawArrays\(g\.LINES/);
  assert.match(html, /setTimeout\(\(\)=>\{hold=null;this\.focusRegion\(item\)/);
  assert.match(html, /marker-spin/);
  assert.match(html, /loadEcology/);
  assert.match(html, /resampleDisplayGrid/);
  assert.match(html, /2,400/);
  assert.match(html, /data-water-width="lijiang"/);
  assert.match(html, /data-water-width="xiangjiang"/);
  assert.match(html, /data-water-color/);
  assert.match(html, /waterwayCenterlinePolicy/);
  assert.doesNotMatch(html, /二维高程图/);
  assert.doesNotMatch(html, /垂直倍率/);
  assert.doesNotMatch(html, /class="side"|class="footer"|class="subtitle"/);
  assert.doesNotMatch(html, /data:image\//);
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new Function(scripts[0][1]));
});
