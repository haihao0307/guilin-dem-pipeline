R03 CEDD REAL DETAIL PATCHES — INTEGRATION NOTES
Prepared 2026-10-13. R02 files were not modified.

WHAT EXISTS
40 newly recovered official CEDD 2020 DTM source tiles, each 1500×1200 Float32 at native0.5m spacing, EPSG2326 horizontal / HKPD vertical (EPSG5738). Every archive passed ZIP CRC, every raster passed grid checks, and source ZIP/TIFF SHA256 values are in source_manifest.json. The TIFF CRS itself is horizontal only; source_layer_metadata.json independently establishes HKPD. This is not recovery of the historical390-tile set.
Five cropped windows contain7,618,385.25m² valid native source terrain. Source acquisition dates are2019-12-20 to2020-02-02, not historic rail-era terrain.

FILES
manifest.json: Small integration/source/datum manifest, per-level transforms and raw hashes.
source_manifest.json: All40 source URLs, byte counts, hashes, CRC and grid checks.
grids/{id}/native-hkpd-0p5m.tif: Unmodified native-height cropped source.
grids/{id}/2m-* and5m-*: Exact area means of valid0.5m source cells, original HKPD and model-aligned EGM2008 variants. .f32 is little-endian Float32; .u8 is uint8; .npy mirrors each raw array.
valid: At least one native contributing sample exists. full_coverage: All native contributing samples exist. coverage255: Valid source fraction scaled0..255. Use full_coverage for raw-source triangle topology. NoData=-9999, never sea zero.
datum/datum_controls.json: Reproducible official API/web-tool control responses, formula, interpolation tests and limitations.
QA.json: Source/mask/resampling QA and real DTM versus R02 DSM differences.
anchor_terrain_samples.json: Terrain surface sample values at planning anchors; never rail/platform design levels.
clocktower_station_footprint_qa.json: Native source statistics and3.1841m nearest-valid-cell distance for the NoData clocktower anchor.

RUNTIME PAYLOAD
runtime-patches.json contains5 patches; each patch has levels['5'] and levels['2'] with x0,y0,width,height,step,heights,mask,weight.
These x0/y0 values are EPSG2326 grid NODE coordinates, not raster corner coordinates. Columns advance east; rows advance south. Heights are gzip+base64 little-endianFloat32. Mask and weight are gzip+base64uint8.
Bounds are expanded outwards to R02 30m grid nodes. Both2m/5m resolutions include all boundaries and divide30m exactly. Remove the R02 coarse triangles inside the complete patch rectangle, then draw fine triangles with the same NW-SW-NE and NE-SW-SE split.
Fallback heights are evaluated on that exact piecewise-planar R02 coarse mesh, not bilinear interpolation. R02 ocean/land/inland-water mask is retained by nearest-node sampling.
Only fully source-covered, originally R01-land, entirely unchanged R02 triangles receive DTM. Every changed R02 node and all triangles touching it are protected, including fictional river/lake removal and station grading. Source-window outer100m uses smoothstep transition to untouched R02; added padding is pure R02. Serialized0..255 weight is the actual weight applied. Weight255 is fully source detail,1..254 is explicitly synthetic display transition,0 is R02.
Raw2m/5m source grids remain untouched. Runtime blended heights are a derived display product, not measured terrain.
runtime-QA.json reports coverage and seam checks: all outer-boundary nodes and protected terrain differ from the expected R02 triangle plane only by Float32 rounding, maximum1.53e-5m.

VERTICAL ALIGNMENT
The live Lands Department tool declares HKGEOID2016_SMO, WGS84(ITRF96), reference epoch1998:121. Its HK1980 Grid+HKPD to WGS84 ellipsoidal-height computation was sampled on local controls no more than500m apart. A test at the clocktower agrees with the public v2 API.
The EGM2008 undulation came from the actual PROJ/NGA2.5-arc-minute geoid grid, cropped through GDAL /vsicurl (not a fabricated constant). Bilinear geoid-grid values were evaluated at the official transformed coordinates.
Formula: H_EGM2008_model = H_HKPD + h_WGS84_ITRF96(HKPD=0) - N_EGM2008.
The position-dependent difference across these patches is approximately-0.472 to-0.398m. At the clocktower, HKPD0 gives ellipsoid-2.665m and EGM2008 model height-0.403410645m. An independent PROJ inverse vgridshift reproduces the result and verifies the sign/grid-center convention.
20 held-out positions plus5 height-linearity tests(500m) agree with interpolated model differences to0.91mm maximum. This is ONLY computational/interpolation agreement; the API rounds to millimetres. It is NOT an absolute accuracy estimate.
There is no registered exact HKPD-to-EGM2008 operation available in the local PROJ database. The combined model chain is a reproducible visualization alignment, not an official combined survey transformation. No epoch/deformation correction between the HK frame and the Copernicus source-era realization was applied. No absolute vertical accuracy guarantee is made.

SURFACE / SEAM LIMITS
Datum alignment does not turn a DSM into a bare-earth DTM. Patch median DTM-minus-R02 differences are approximately-2.6 to-5.8m, with local tens-of-metres differences from buildings, vegetation, sampling, source dates and fictional edits. Never use those differences as a datum correction. A naive overlay will be hidden by the DSM or produce steps; use the documented runtime replacement/transition or a separate comparison view.
The Lion Rock source is mountain surface, never tunnel track elevation. The station and tunnel controls remain fictional planning candidates. No claim of whole-route0.5m coverage,0.5m runtime rendering, exact seamless survey heights, or historical shoreline reconstruction is justified.

PRIMARY SOURCES / ATTRIBUTION
CEDD dataset: https://portal.csdi.gov.hk/csdi-webpage/dataset/cedd_rcd_1629267205233_87895
Official source layer: https://portal.csdi.gov.hk/server/rest/services/common/cedd_rcd_1629267205233_87895/MapServer/0
LandsD model/tool declaration: https://www.geodetic.gov.hk/en/services/tform/tform.aspx
LandsD method and precision warning: https://www.geodetic.gov.hk/en/gi/transformation.htm
LandsD public API manual: https://www.geodetic.gov.hk/transform/tformAPI_manual.pdf
Actual geoid grid: https://cdn.proj.org/us_nga_egm08_25.tif
Model/grid provenance: https://cdn.proj.org/us_nga_README.txt
NGA model description: https://earth-info.nga.mil/index.php?action=wgs84&dir=wgs84
CSDI use terms: https://portal.csdi.gov.hk/csdi-webpage/doc/TNC

Retain credit: Source terrain data © Government of the Hong Kong Special Administrative Region, Civil Engineering and Development Department(CEDD), via Common Spatial Data Infrastructure(CSDI) Portal. Derived crops, averages and visualization transformations identified as such. EGM2008: NGA public-domain model, GeographicLib/OSGeo PROJ-data grid conversion. CSDI terms permit distribution/reproduction including commercial use subject to terms and clear attribution/IP acknowledgement.
