# Ocean Mother R015

Daylight and procedural glass candidate, derived from the published R012 source.

Closed outward-wound rock meshes; one CPU/GPU bed and stationary-frequency wave functions; separate opaque color/depth cache; explicit full-screen color/depth copy; one final display transform; mesh-rasterized rock-height boundary shared with water clipping and foam transport.

Glass refraction reads only the current volatile render target. Text and controls remain accessible HTML. No image generation, image assets, external models or runtime CDN. Mobile falls back to CSS glass.

Physical boundary: kinematic shallow-water appearance with terrain and obstacle-aware foam transport. This is not a conservative free-surface solver. No full wave momentum/rock coupling, spray mass or 3D overturning is claimed.

Visual approval and production approval remain false.
