# Guilin DEM truth line status, 2026-08-29

## Stewardship

This record belongs to the Xiaogui Guilin DEM truth line. It preserves the accepted 12.5 m DEM, approved AOI, version lineage, browser QA evidence, and release receipts.

## V0.7.6 frozen full handoff Release

* production branch: `project/guilin-v076-hydrology-2048`
* frozen source commit: `c1be401e5838bdefb0c5bd223d19da73776cb39f`
* Release tag: `guilin-v076-full-handoff-20260829`
* Release ID: `378874116`
* package asset ID: `534751340`
* package: `Xiaogui_Guilin_DEM_V076_Full_Codex_Handoff_2026-08-29.zip`
* package bytes: `150560025`
* package SHA256: `c60d93fe94910847599935e288572a726be785bf4fd284ad1a94b42cada92c52`
* checksum asset ID: `534751433`
* source workflow run: `33230401417`
* source artifact ID: `9708298456`
* release workflow run: `33233918478`
* release receipt artifact ID: `9709331564`
* release receipt artifact SHA256: `e679a5dfc3afb18abeccdcfc6291138eecd8951f3542ddf97a78fcbf55e96c57`
* Release re-download identity check: passed
* Release ZIP integrity test: passed
* frozen truth modified: false
* `gh-pages` modified: false

## Locked truth identity

* accepted AOI area: `33113.874 km²`
* accepted AOI geometry SHA256: `36b750be56ae0dea906996258068eaf9aaa71e01667eb328b9ce6bd1b48cbe80`
* truth TIFF: `guilin_raw_union_12_5m.tif`
* truth TIFF bytes: `124348471`
* truth TIFF SHA256: `9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4`
* CRS: `EPSG:32649`
* source grid: `17408 × 18867`
* source spacing: `12.5 m × 12.5 m`
* source type: `int16`
* source NoData: `0`

## V0.7.7 native LOD foundation

* branch: `project/guilin-v077-native-12p5m-lod-foundation`
* Draft PR: `#56`
* base: frozen V0.7.6 commit `c1be401e5838bdefb0c5bd223d19da73776cb39f`
* reviewed browser source commit: `cf50b0a89758eaea141f804d21b80827ca80eccd`
* overlay and favicon fix: `4519a3b8a7c0e1fa4c6659acaf76586ad32f64c5`
* render status timing fix: `50df793d4070b2fa03472dac5e3a7a6f75e2c288`
* successful browser package run head: `18639014604598297cac17f95fd896d1bf8983f2`
* successful browser package run: `33233786774`
* successful browser package artifact ID: `9709295488`
* browser package artifact bytes: `17975517`
* browser package artifact SHA256: `e84e76c330ccd3704f0ada8ab0aba00720da0c943678db1cfcd856030f6be649`

### Native tile contract

* full AOI matrix: `9 rows × 6 columns`, 54 possible tiles
* first validated build: 5 tiles
* stored tile grid: `2048 × 2048`
* tile stride: `2047 × 2047` source samples
* shared edge: one duplicated native source sample
* encoding: little-endian raw `int16` elevation metres
* first validated raw tile bytes: `41943040`
* resampling: none
* quantization: none
* synthetic gap fill: none
* 30 m fallback: none
* source elevation modification: `0 m`
* vertical scale: `1.00`

### First validated landmark tiles

* 真寶鼎: `native-r01-c03`
* 桂林城: `native-r05-c01`
* 秧塘機場: `native-r05-c01`
* 陽朔縣: `native-r07-c02`
* horizontal seam probe: `native-r05-c02`
* vertical seam probe: `native-r06-c01`

### Successful QA evidence

* exact source TIFF byte count and SHA256: passed
* native sample identity: passed
* NoData padding identity: passed
* horizontal shared edge identity: passed
* vertical shared edge identity: passed
* desktop Chromium WebGL2: passed
* mobile Chromium at `390 × 844`: passed
* CJK font rendering: passed
* console and runtime errors: zero
* five evidence screenshots: present and validated
* Windows local launcher: included
* package checksum manifest: passed after independent re-download

## Frozen protections

* Draft PR remains open and unmerged.
* `main` remains unchanged.
* `gh-pages` remains unchanged.
* V0.7.5 rollback assets remain unchanged.
* V0.7.6 public pages remain unchanged.
* OSM hydrology centerlines remain unchanged.
* no manual river geometry was introduced.
* no synthetic water surface was introduced.
* `visualAcceptance=false` until user review.
* `productionReady=false` until the later approval gates are complete.

## Next approval gate

Use the V0.7.7 local browser package to review terrain clarity, camera interaction, the 25.6 km overview, the 6.4 km native window, and all four landmark jumps. After visual approval, expand to the complete 54-tile matrix and synchronize tiled hydrology, water polygons, lakes, and measured river widths without altering the locked DEM truth.
