# Mother interfaces for Survivor: Palau

The Game layer owns scenario state, mission logic, spawn orchestration, saving, patrol logic and player interaction.

Ocean Mother owns water surface, nearshore/deep-water continuity, tide/wave/wind-water coupling, reef bathymetry and water queries.

Landscape Mother can later provide higher-fidelity karst field operators. The Game layer must not overwrite Landscape Mother truth once a formal island terrain package is supplied.

Vegetation Mother provides reusable plant bodies and placement metadata. The current vegetation in V0.1.0 is a procedural placeholder family for scale/composition only.

Bird/Animal Mothers provide body/motion packages. Game code should consume bridge interfaces rather than rewrite those mothers.

Recommended bridge fields: world transform, bounding volume, collision proxy, locomotion state, animation/action commands, visibility/LOD policy, habitat tag, water-depth limits, performance budget and evidence status.
