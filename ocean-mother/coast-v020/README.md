# Ocean Mother Coast 0.2.0 R010

R010 establishes a texture-free photoreal nearshore candidate aligned with the preserved deep-ocean visual language. It uses Beer Lambert water-path absorption, Fresnel reflection, depth-limited refraction, premultiplied transparency, stateful foam, wetness history, active and frozen numeric tiles, an opaque-scene cache, and sparse procedural spray.

The runtime contains no imported or generated raster images, normal maps, noise maps, environment maps, animation atlases, external models, or external CDN dependencies. Runtime WebGL textures only carry ephemeral numeric state and are not persisted as assets.

The fixed physics step is 1/120 second. Surface foam updates at a lower explicit rate and preserves world-space history. Static bed and rock geometry are compiled once. Opaque sky, bed, and rock rendering is reused while its dependencies remain unchanged.

R010 does not claim a complete local three-dimensional pressure free-surface solver. Full overturning, enclosed air, impact pressure, and two-way mass and momentum exchange remain a separate solver milestone.

visualApproved=false
productionApproved=false
fullReplication=false
