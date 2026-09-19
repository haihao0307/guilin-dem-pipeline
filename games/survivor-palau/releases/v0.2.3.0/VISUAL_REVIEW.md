# Stone Money Island v0.2.3.0 — visual review

The executable shoreline field and browser runtime passed their numerical/contact gates, but this candidate is **not visually accepted**.

Observed in the captured desktop and 390×844 frames:

- the new white-sand terrain/contact profile reaches the water continuously at the measured mean-water crossing;
- however, a broad bright/white near-shore water/foam region does not visually follow the new bed profile cleanly and reads as a detached or over-expanded sheet in the foreground;
- this is consistent with the intentionally preserved frozen GPU Ocean shader still using its inherited internal bathymetry while the CPU terrain, player contact and CPU water query now use `SMI_WAKE_BAY_R01`;
- therefore this increment proves the shared game-side bed/contact field, but does **not** prove the final beach–swash visual relationship.

Next correction should source-couple the Ocean Mother shoreline/swash consumer to the new authoritative bed query without editing the frozen deep-sea/cloud baseline. The target is to remove the detached bright sheet while keeping the measured water/terrain contact gap below 0.05 m on desktop and 390×844.

`visualAcceptance=false`, `physicalDeviceTest=false`, `productionReady=false`.
