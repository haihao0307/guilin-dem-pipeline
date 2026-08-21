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
  assert.deepEqual(
    manifest.landmarks.map(({ name }) => name),
    ["真宝鼎", "阳朔县城", "秧塘机场旧址"],
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
  assert.match(html, /assets\/DEM_PREVIEW\.png/);
  assert.match(html, /2048 级真实 DEM 地形/);
  assert.match(html, /真宝鼎、阳朔县城和秧塘机场旧址/);
  assert.doesNotMatch(html, /data:image\//);
});
