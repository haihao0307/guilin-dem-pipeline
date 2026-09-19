# Stone Money Island V0.2.2 — known limitations

This increment responds only to the user's immediate beach/water/house/fish/wave correction.

## Implemented relationship

- The authored candidate island radius is 92 m and nominal white-sand width is 50 m. Its idealized annular sand area is about 14.16 times the original 27 m / 11 m candidate. This is a design candidate, not a surveyed island dimension.
- The upper beach rises continuously from the mean shoreline to the interior; the shallow shelf descends continuously offshore.
- The local authored water pass now reads the same bed function used by player contact. A fragment is rejected when the local bed exceeds the shared run-up ceiling. Water can make a thin swash excursion over low sand, but cannot continue through higher beach terrain.
- The three visible curl-wall gains default to zero, the separate curl sheet is not drawn, and foam is reduced to a minor translucent aerated-water cue. The primary motion is low-amplitude irregular swash plus wet-sand response.
- The constructed stone-house envelope, rectangular floor and ramp are removed. The rest target is a natural terrain location with a leaf mat only.
- Uncaught fish are positioned from the shared water/bed queries. Fish that cannot obtain adequate depth are neither rendered nor targetable; the browser gate requires zero fish-water violations.

## Not proven

- The new 92 m / 50 m dimensions are not real survey truth for any named Palau island.
- Water/terrain clipping is checked numerically and in software-GPU browser screenshots; physical iPhone GPU depth precision, frame rate, temperature and battery use are untested.
- The original Ocean Mother deep sea/cloud payload remains byte-stable, but the nearshore authored adapter is still a candidate and is not a complete hydrodynamic solver.
- Wet sand is still an optical/temporal candidate, not calibrated sediment saturation.
- Fish bodies are still generic programmatic candidates and not accepted Palau species.
- Removing the fake stone house does not yet create a source-coupled Landscape Mother cave or limestone overhang.
- Swimming, diving, underwater camera transition, coral, underwater rock groups and final fish ecology remain subsequent increments.

`visualAcceptance`, `physicalDeviceTest` and `productionReady` remain false.
