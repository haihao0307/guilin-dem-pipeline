# Procedural Surface Field Contracts v0.4.0

## Truth fields

```text
z_truth_m
base_normal_xyz
slope_deg
aspect_rad
profile_curvature
plan_curvature
flow_direction_xy
flow_accumulation
permanent_water_mask
active_bank_mask
historical_landuse_class
road_distance_m
settlement_distance_m
airport_exclusion_mask
```

## Procedural identity fields

```text
macro_landcover_id
forest_cell_id
open_land_cell_id
parcel_id
orchard_block_id
row_id
tree_id
species_profile_id
crop_profile_id
```

## Visual fields

```text
z_micro_delta_m
canopy_density
canopy_profile
canopy_microheight_m
crop_row_direction_xy
crop_row_phase
bund_core_mask
bund_shoulder_mask
path_mask
strand_density
strand_direction_xy
rock_strata_mask
rock_fissure_mask
surface_color_rgb
surface_roughness
normal_delta_xyz
```

## Seam rule

All fields sample global projected coordinates. Voronoi, Wave, White Noise and strand-parallax coordinates, rotations, seeds and phases remain continuous across tile boundaries. Numeric seam tests are mandatory.
