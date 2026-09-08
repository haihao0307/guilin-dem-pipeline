# Address and task contract candidate R1

Status: internal validation candidate. Production format is unchanged. Global
closure and unique intersection mapping remain unimplemented.

## Identity

An immutable domain registry must bind EarthID, DomainID, topology revision,
axis direction, dimensions and sample-center convention. Domain-wide integer
sample-center phases are computed without floating point. The R1 probe checks
both complete Wenzhou axes and routing through page sizes 16, 32 and 256.

SpectralPage is a routing reference. A point seen through neighboring pages or
halos must normalize to one domain location before forming an Object DNA anchor.
Camera, conductor, precision and storage page size must not enter that location
identity. Source revision, score hash, task precision and request generation
belong in the data/cache key, separately from the geographic location.

Page names in V0.1 are opaque labels. Source offsets in the audited manifest
determine the actual window. Never infer offsets from a page name suffix.

Reject invalid phase values, unknown Earth/domain/topology IDs and ambiguous
global mappings explicitly. Do not clamp invalid inputs to an edge or return a
default origin. Encode Q0.64 as decimal strings or fixed 8-byte integers across
JavaScript boundaries; never JSON Number.

## Global closure gate

Before freezing a global serialization format, implement and test:

1. An explicit chart/page atlas with deterministic transition and ownership rules.
2. Identification of multiple intersections and the minimal direction/chart marker
   that chooses one physical point. The two phase values alone have no proof here.
3. Closed-loop transitions returning the same normalized identity, including
   seams, chart corners, polar neighborhoods and orientation reversal.
4. Point to address to point checks plus collision searches for distinct points.

The local rectangular phase probe provides no evidence for these four items.
This contract leaves the global construction open and does not impose a new
coordinate system on the existing world architecture.

## Shared boundary and task gate

Canonical samples, masks and provenance remain immutable. Page halos are
references to the same sample identities, not separate truth. Compare identical
sample locations in overlapping halos; neighboring nonoverlapping pixel centers
are different positions and are not required to have equal heights.

Shared positions must agree under every allowed neighboring precision combination.
Validate mask identity, heights, first differences, four-page corners and
task-specific topology. The current 17x17 internal overlapping fixtures expose
failures of independent partial-band reconstruction. They do not establish a
full-size production boundary scheme.

Until calibrated task error budgets exist, hydrology and physics consumers must
request exact-truth (including the required neighbor footprint), or return an
explicit unavailable status. Approximate data cannot acquire task acceptance
solely from a conductor's name or small RMSE. Exact heights alone do not certify
drainage conditioning, collision interpolation or a vertical datum.

Visual approximations need a consistent shared-boundary reconstruction policy,
such as shared dependencies or a common boundary solve, followed by measurement.
Do not hide contradictory truth with skirts, noise, seam averaging or terrain edits.

Asynchronous commits must match score identity, task and active request generation;
late/cancelled results may not overwrite the current world state. The R1 Python
audit does not implement or certify a browser/GPU scheduler.

## Full-size evidence and next gate

The locked R2.2.1 store and index have now been verified and used to extract
candidate 512-core pages with halos. All six policies were compared across river,
coast/NoData, and southern/eastern partial final pages. Mixed precision failed;
see FULLPAGE_REPORT.json. Next implement shared-boundary dependencies and repeat
these checks, including reversed request completion order in the real scheduler.
No TIFF import, alternate AOI, resampling or synthetic fallback is permitted.
