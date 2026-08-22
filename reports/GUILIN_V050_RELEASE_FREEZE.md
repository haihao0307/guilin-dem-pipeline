# Guilin v0.5 public release freeze

Effective immediately, the Guilin v0.5 candidate is classified as a rejected regression build.

Automatic public deployment has been disabled in the main Guilin workflow. Future builds are private artifacts by default. A public deployment requires manual workflow dispatch with `publish_public=true`, `releaseAllowed=true` in QA, all gates in `projects/guilin/config/release_gate_v050.json`, and controller visual approval.

The current defects include unexplained line artifacts, hydrology topology and rendering faults, mixed overall and core DEM clarity, black outer boundary, ecology scope outside the agreed core-only policy, loss of the executable v0.3.1 ecology baseline, missing hydrology controls, and insufficient ground access.

The stable rollback remains v0.3.1. No v0.5 branch may change the default release until the recovery PR passes.
