#!/usr/bin/env python3
"""Make the small R02 interface from the reproducible image fit; no R01 writes."""
from pathlib import Path
import json,hashlib,sys,numpy as np
D=Path(__file__).resolve().parent
sys.path.insert(0,str(D));import fit_markups as F
raw=json.loads((D/'markup_fit.json').read_text());r=raw['image_results']
def en(p): return [int(round(p[0]/10)*10),int(round(p[1]/10)*10)]
def points(key):return [en(p) for p in r[key]['blue_route_epsg2326']]
s1,s2=r['104923']['station_centres_epsg2326'];second=r['105108']['station_centres_epsg2326'][0]
# North-aligned intent crop rounded inward on the ORIGINAL 30m grid.
# Intentionally not the larger AABB of the oblique screenshot quadrilateral.
bounds=[823020,808000,848490,845500]
stations={
 'second':{'epsg2326':en(second),'source_image':'105108','source_pixel_1000wide':[550,266],'original_dsm_height_m':round(second[2],1),'candidate_radius_m':120,'meaning':'Second large shed station, yellow circle southwest of the walled-city reference point. Fictional candidate, not surveyed.'},
 'shatinNorthwest':{'epsg2326':en(s1),'source_image':'104923','source_pixel_1000wide':[645,359],'original_dsm_height_m':round(s1[2],1),'candidate_radius_m':180,'meaning':'Raw upper circle centre for audit only; not a platform location.'},
 'shatinSoutheast':{'epsg2326':en(s2),'source_image':'104923','source_pixel_1000wide':[659,381],'original_dsm_height_m':round(s2[2],1),'candidate_radius_m':150,'meaning':'Raw lower circle centre for audit only; not a platform location.'},
 'shatinCore':{'epsg2326':en(np.mean([s1,s2],axis=0)),'source_image':'104923','candidate_radius_m':350,'meaning':'Raw two-circle midpoint for audit. Use shatinPlanningAxis for the actual compact station.'},
 'shatinPlanningAxis':{'epsg2326':[839790,829760],'source_image':'104923','candidate_radius_m':180,'planning_elevation_m':9,'axis_azimuth_clockwise_from_north_rad':0.48,'station_length_m':300,'station_width_m':90,'platform_lateral_offsets_m':[-35,35],'meaning':'One continuous compact fictional station precinct on nearby low-gradient land, using the two circles only for general locality and side-by-side relation. Platform axes are tens of metres apart.'},
 'shatinPlatformWest':{'epsg2326':[839759,829776],'planning_elevation_m':9,'axis_azimuth_clockwise_from_north_rad':0.48,'meaning':'Western parallel platform axis, 35m from shared centre.'},
 'shatinPlatformEast':{'epsg2326':[839821,829744],'planning_elevation_m':9,'axis_azimuth_clockwise_from_north_rad':0.48,'meaning':'Eastern parallel platform axis, 35m from shared centre.'}
}
# Keep the original coast departure, prefer latest yellow-station sketch through Kowloon,
# then stop at the southern tunnel candidate. North markup is separate and joins across
# Lion Rock only as a fictional tunnel concept; do NOT drape a track over the mountain.
routeSouth=points('105055')[:12]+points('105108')
routeNorth=points('104949')
result={
 'schema':'hk-r02-markup-coordinates-v1','crs':'EPSG:2326','units':'metres','status':'approximate fictional design intent, NOT exact georeferencing or engineering alignment',
 'bounds_epsg2326':bounds,'bounds_order':['west','south','east','north'],
 'bounds_size_m':[bounds[2]-bounds[0],bounds[3]-bounds[1]],
 'bounds_derivation':'Inverse-project the red screenshot quadrilateral to original DSM, then select a north-aligned rectangle near side midpoints and trim the west side slightly. Snap inward to original 30m cells. This avoids enlarging to the quadrilateral bounding box.',
 'bounds_uncertainty_m':600,
 'red_screen_corners_epsg2326':[en(p) for p in r['105236']['crop_corners_epsg2326']],
 'red_screen_corner_order':r['105236']['manual_markups']['crop_corner_order'],
 'stations':stations,
 'shatinPlanningAxis':stations['shatinPlanningAxis'],
 'stationMarkupEvidence':{
  'shatin_raw_circle_centres_epsg2326':[en(s1),en(s2)],
  'shatin_raw_circle_original_dsm_heights_m':[round(s1[2],1),round(s2[2],1)],
  'shatin_raw_circle_midpoint_epsg2326':en(np.mean([s1,s2],axis=0)),
  'interpretation':'These are broad handwritten circle marks, not exact platform endpoints. Do not bind platforms to the raw circle centres, excavate an 80m knoll, or separate platforms by ~520m.',
  'selected_site_shift_from_circle_midpoint_m':67,
  'selected_site_footprint_m':[300,90],
  'selected_site_heading_rad_from_north':0.48,
  'selected_site_parent_grid_samples_elevation_m':{'min':6.735,'max':12.358,'mean':8.764,'all_land':True},
  'selected_site_independent_bilinear_check_m':{'min':6.853,'max':11.896,'mean':8.746,'sampling':'31 along-axis × 10 cross-axis points,300m×90m,original 30m DSM bilinear'},
  'planning_level_m':9,
  'design_note':'A modest local fictional grading treatment may support a common planning level; this is not a survey or construction feasibility claim.'
 },
 'routeSouth':routeSouth,'routeSouthMeaning':'Clock tower coast departure from 105055, continuing with latest 105108 second-station and walled-city segment, ending at the south face of Lion Rock. One ~1km sketch gap between the screenshots is joined conceptually.',
 'routeNorth':routeNorth,'routeNorthMeaning':'104949 blue sketch, south of Sha Tin northward along the river side and around the bay to Tai Po. The last section crosses contemporary water; this is user-authored fictional intent, not real railway.',
 'routeSouthRaw105055':points('105055'),'routeSouthRevision105108':points('105108'),
 'tunnelConceptEndpoints':[routeSouth[-1],routeNorth[0]],
 'tunnelMeaning':'A schematic connection only. Endpoints are picked surface pixels on opposite mountain flanks and do not define tunnel portals, rail elevations, feasibility, or a surveyed path.',
 'route_intent_uncertainty_m':{'lowlands':150,'mountain_or_oblique_horizon':500,'hand_drawn_stroke_interpretation':'wide strokes and occlusion make the line a corridor, not exact control points'},
 'fit_quality':{k:{'median_route_distance_px_at_1000px_width':round(v['cyan_route_distance_median_px'],3),'p90_route_distance_px_at_1000px_width':round(v['cyan_route_distance_p90_px'],3)} for k,v in r.items()},
 'source_checksums':{},
 'cautions':[
  'The display labels move to avoid collisions. Only corrected label ground-anchor picks initialize the fit; route pixels supply the final dense control.',
  'Original 30m Copernicus DSM elevations include vegetation/buildings and are EGM2008, not bare-earth, not HKPD, not a historical terrain reconstruction.',
  'Station and route coordinates are rounded to 10m only for implementation convenience. Do not infer 10m positional accuracy.',
  'Route pixels are height-draped for recovery only. The fictional track must not inherit mountain surface heights or large river crossings as an engineering claim.',
  'The raw yellow circles are broad locality markers; do not use their ~89m/~8m centre samples as platform elevations. The selected nearby shared station precinct is ~7–12m DSM with a fictional 9m planning level.',
  'The north-aligned crop is a design interpretation of the red screen rectangle. It preserves approximate coverage while reducing area; it is not a unique exact answer.'
 ]}
for p in [F.BASE/'map-user-markups'/f'屏幕截图 2026-10-13 {k}.png' for k in r]:result['source_checksums'][p.name]=hashlib.sha256(p.read_bytes()).hexdigest()
for p in [F.BASE/'hong-kong-map-sea-r01/data/scene.json',F.BASE/'hong-kong-map-sea-r01/data/heights.npy',F.BASE/'hong-kong-map-sea-r01/map-integration.js']:result['source_checksums'][str(p.relative_to(F.BASE))]=hashlib.sha256(p.read_bytes()).hexdigest()
(D/'markup_coordinates.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'bounds':bounds,'stations':stations,'routeSouth_points':len(routeSouth),'routeNorth_points':len(routeNorth),'tunnel':result['tunnelConceptEndpoints']},ensure_ascii=False,indent=2))
