# Karst Clear Color and Light Contract V005

## Terrain shader translation

Geometry and surface appearance remain separate stages linked by one world-space coordinate contract. Geometry inputs are numeric fields and signed-distance solids. Surface appearance is reconstructed from position, normal, cavity visibility, height, runoff orientation, exposure, weathering age, wetness, mineral deposition, soil contact, and biological suitability.

## Permanent rules

1. Macro silhouette is created by low-frequency structural fields.
2. A subtraction feature must exceed the local extraction scale before entering solid geometry.
3. Features below that scale enter micro-normal and roughness functions.
4. Geometry and material share one world coordinate frame.
5. Rock base color stores material state and contains no baked lighting.
6. Lighting and color mixing operate in linear space and output to sRGB.
7. Limestone is dielectric with metallic equal to zero and F0 equal to 0.04.
8. Ambient visibility attenuates ambient diffuse only.
9. Distance fog and decorative background terrain are excluded from close-range material inspection.
10. Strong key light, neutral fill, sky ambience, and ground bounce remain independently controllable.
11. Static preview images are excluded from Landscape Mother delivery.
12. The visual result is accepted only by the user.

## V005 material outputs

- warm calcite body reflectance
- aged limestone reflectance
- fresh fracture reflectance
- ochre and iron mineral deposition
- dark runoff staining
- soil-contact staining
- lichen suitability
- wetness darkening and roughness reduction
- micro-normal relief
- cavity-aware ambient visibility
