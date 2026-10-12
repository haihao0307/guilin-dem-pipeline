# R53: frozen-face cheek illumination diagnostic

This phase does not change R52 identity. It separates the authored key/fill balance from cast shadows while retaining the same native mesh, eyes, brows, expression, material, camera and R30 hair. It uses the existing pinned R05 engine and isolated Chromium/SwiftShader runner.

The three cases are original illumination, half of the directional-key scalar intensity redistributed to hemisphere fill, and original illumination with cast shadows disabled. Equal intensity sums do not imply equal physical irradiance. Hemisphere fill is not a recovered photographic area light. Full native mesh and hair hashes must match the frozen R52 run; original pixels must restore after every case. No private photographs or image target coordinates are included.

The authored hypothesis is that an overly sharp cheek-to-nose/mouth transition may combine low-frequency geometry with lighting. This test must be visually reviewed before proposing any geometry change. E04 is the adjustment view; U05/U07 are reserved from this new adjustment, though they have appeared in earlier work. They are not previously unseen blind identities. No production page is modified.

First run 38215808405 produced three E04 frames but failed exact original-light pixel restoration. It rebuilt lights and toggled the global shadow feature with manual material invalidation. The corrected diagnostic keeps the same light objects, material hooks and global renderer feature, changes existing light intensities and only the key's cast-shadow flag, and requires the same exact restoration assertion. The original failure is retained; the three frames are diagnostic only.
