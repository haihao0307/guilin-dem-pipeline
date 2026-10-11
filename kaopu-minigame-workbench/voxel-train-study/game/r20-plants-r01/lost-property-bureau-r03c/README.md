# Bureau R03c — two-street arcades and four-storey entrance tower

Independent candidate based on R03b 3a07c6d61b16d1acc5a9edea5af534dab578bd9e.
R02, R03 and R03b remain unchanged. No Pages deployment is included.

## Reference and authored architecture
The AMO worksheet and its 1930s GPO photograph were actually viewed before
implementation. Their visual principles inform this fictional building:
continuous round-headed arcades, recessed upper office windows, stone
archivolts and string courses against brick, pedimented gables and a taller
entrance landmark. This is not a surveyed reconstruction or a world-record claim.
Reference: https://www.amo.gov.hk/filemanager/amo/common/form/whatsnew_20140415.pdf
Reference images are research only and are NOT distributed with the runtime.

## Area and program
Main designed footprint 92 x 80 m, x[-42,50], z[-40,40]; arcaded eaves and
entrance projections extend locally beyond it. The exact net storage rectangle
x[-28,44], z[-28,34.5] is 72 x 62.5 = 4,500 m², excluding offices, public hall,
wall thicknesses, rear receiving, specialist service strip, boiler yard and tracks.
Storage aisles are included. It is not shelf-only footprint or gross floor area.
Two-street covered walks are approximately 3.2 m clear (3.9 m facade-to-arcade axis) and continuous around the
southwest corner. The only principal entrance still faces x-negative/right street.
Ground floor serves public business; second floor is offices. The entrance tower
has four occupied storeys and a 23.5 m ridge; the ordinary wings remain lower.
The rear chimney has a 30 m height and 3.6 m outside diameter, with a hollow flue.
These are design parameters, not certified structural/fire/boiler calculations.

The two genuinely quarter-turned rack banks remain. Bank A starts x=-25; B moves
to x=12, increasing storage circulation/end space without inventing stock.
Each bank has 16 rows x 20 bays x 6 levels; 22,080 mixed-size addresses remain
capacity, while the original 24 fictional 1948–1976 records remain inventory.
The east service strip and special custody positions move to x=46.5; routes
use x=42.5 before the rear cross aisle. World/local item dimensions and addresses
remain consistent. Schema 5 and the r03c key reject incompatible older saves.

## Material noise diagnosis and bounded receiver correction
The roof slate at .125 m source scale and pavement stone at .12353 m specimen
scale contain centimetre/sub-centimetre noise. At whole-building distances the
pixel footprint exceeds those features. The mothers' fp only filters vein edges,
not the full broad/cleavage/weather fields. Camera-plane fp also misses grazing
stretch. The generic displacement cutoff at abs(d)=.025 was discontinuous.
R03c adds a continuous displacement envelope and 4x4 tangent-plane footprint
integration for minified stone/slate, averaging unchanged mother outputs in
linear color. No palette replacement, material-scale inflation, image texture or
mother-file changes. Integration is bounded, not a guarantee against all aliasing.
Actual screenshots must still be inspected; no claim of final visual polish.

## Native function implementation and verification limits
All architecture, rack repetition, machinery and pipes are WGSL fields with
materials/age at the same field entry. Three full-screen vertices, compute
intersection, sparse continuation and independent material pass. No per-cabinet
meshes, CPU expanded vertex lists, external mesh files or appearance images.
Inventory persists for years without automatic claim; hidden-feature/identity
verification, reservation, physical transport, arrival and confirmed handover
remain distinct and idempotent. Local JSON persistence is not native SQLite.KaoPu.
Route tests cover rack footprints and selected gates, not full swept machinery.

Run node qa/source.test.mjs and node --test qa/inventory.test.mjs.
Real WebGPU QA uses official pinned Chromium/SwiftShader on GitHub Actions.
The three review cameras are identical to R03b. No phone or hardware FPS claim.
