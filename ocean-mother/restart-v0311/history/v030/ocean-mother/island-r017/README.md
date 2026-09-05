# Ocean Mother Island R017

Round treeless procedural island candidate, 102 numeric controls on three pages. Default three fire sources, three flame strands and three smoke strands per source. Wind drag, gusts and lifetime determine smoke length; there is no independent fake length scaler.

Three surf bands contain depth-constrained kinematic overhanging water sheets. These are interactive geometry experiments, not a conservative free-surface fluid solver. Main water, foam and mist share wave/wind inputs. Obstacles use mesh-derived numeric height coverage. No surveyed DEM is implied.

Geometry is recompiled only after geometry controls change. Foam and wetness update on a separate clock. Visible media use instanced quads. UI time is distinct from simulation time; glass can flow while water is paused. Deep ocean and frozen weather files are not edited; an in-memory CSS skin is applied when the same-origin iframe loads.

No bitmap assets, image-generation endpoints, imported models, authored maps or CDN dependencies are introduced. Transient GPU color, depth and scalar buffers remain runtime data.

Visual and production approval remain false. See BUILD.json and PARAMETER_CATALOG.json.
