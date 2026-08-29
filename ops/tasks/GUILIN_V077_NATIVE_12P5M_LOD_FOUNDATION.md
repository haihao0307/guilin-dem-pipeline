# Guilin v0.7.7 Native 12.5 m LOD Foundation

## Scope

This stage creates the first deterministic native-pixel tile layer above the frozen v0.7.6 full-area overview. It does not publish a new public page and does not alter the frozen v0.7.5 or v0.7.6 assets.

## Immutable inputs

* TIFF: `guilin_raw_union_12_5m.tif`
* bytes: `124348471`
* SHA-256: `9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4`
* CRS: `EPSG:32649`
* grid: `17408 × 18867`
* spacing: `12.5 m × 12.5 m`
* data type: `int16`
* NoData: `0`
* accepted AOI geometry SHA-256: `36b750be56ae0dea906996258068eaf9aaa71e01667eb328b9ce6bd1b48cbe80`

## Tile contract

* stored grid: `2048 × 2048`
* stride: `2047 × 2047` samples
* neighboring tiles duplicate one native sample on each shared edge
* stored encoding: little-endian raw `int16` elevation metres
* no elevation resampling
* no quantization
* no gap fill
* no 30 m fallback
* edge tiles use NoData `0` padding only beyond their valid native windows
* source elevation delta remains exactly `0 m`
* vertical scale remains exactly `1.00`

## Initial build

Build the deterministic tiles containing the four fixed landmarks: 真寶鼎, 桂林城, 秧塘機場 and 陽朔縣. Duplicate tile requests collapse to one tile. Add QA probe tiles `row 5, column 2` and `row 6, column 1` so the first artifact proves both horizontal and vertical shared-edge identity. The full native matrix remains a later artifact stage.

## Required validation

1. Re-download the exact TIFF from release `guilin-v070-raw-mosaic-v001`.
2. Verify size and SHA-256 before opening it.
3. Compare every emitted native sample byte-for-byte with the source window.
4. Confirm east and south padding contains only NoData `0`.
5. Compare every emitted neighboring shared edge sample-for-sample.
6. Upload build files and validation receipts as a workflow artifact.
7. Keep `visualAcceptance=false` and `productionReady=false`.

## Prohibited work

* no modification of `main`
* no modification of `gh-pages`
* no force push or history rewrite
* no public deployment
* no hydrology centerline mutation
* no manual river or synthetic water
* no reuse of the 2048 overview as a high-detail source
* no claim that the generated tiles add measured resolution beyond the 12.5 m truth
