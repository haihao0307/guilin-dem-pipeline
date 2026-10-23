/**
 * Original three-case building-system contract. These are evidence and DESIGN
 * parameters, not recovered interiors, engineering approval or a source edit.
 * The six interfaces are the same for every case. No renderer is imported.
 */
import { profileFor, SOURCE_SHA256 } from '../r07/profiles.mjs';

export const CASE_SYSTEM_CONFIG_SCHEMA = 'kaopu.three-case-building-config/0.2';
export const CASE_SYSTEM_INTERFACES = Object.freeze([
  'sourceComponents', 'levelSchedule', 'coreServiceSets',
  'circulationPolicy', 'floorArchetypes', 'entranceBindings',
]);
const SOURCE_COMMIT = 'b74929fc9f1c81eaa7e4b529a6bd5361024b035b';
const FOOTPRINTS = '../r07/sources/official-footprints.json';
const clone = value => structuredClone(value);
const EPS = 1e-7;

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function evidence(id, statement, references, extra = {}) {
  return { id, statement, references, ...extra };
}

function officialComponent(caseId, role, raw) {
  const [sourceComponentId, objectId, baseMpd, topMpd, storeys, basementStoreys, areaM2] = raw;
  const sourceUrl = 'https://portal.csdi.gov.hk/server/rest/services/common/landsd_rcd_1637211194312_35158/FeatureServer/0/query?where=OBJECTID%3D'
    + objectId + '&outFields=%2A&returnGeometry=true&f=json';
  return {
    id: `${caseId}:component:${role}`, componentId: role, sourceComponentId,
    sourceModelId: role === 'podium' ? null : profileFor(caseId).modelId,
    footprintReference: { path: FOOTPRINTS, caseId, sourceComponentId, sourceUrl },
    official: {
      objectId, baseMpd, topMpd, storeys, basementStoreys, footprintAreaM2: areaM2,
      blockType: role === 'podium' ? 'Podium' : 'Tower',
      featureDateStamp: 1599580800000,
      evidence: 'official', verticalDatum: 'Hong Kong Principal Datum',
      dateMeaning: 'feature_timestamp_not_verified_survey_date',
    },
    generatedBasements: false,
    unknown: ['individual_floor_elevations', 'interior_metric_layout', 'basement_geometry'],
  };
}

function levelComponent(caseId, componentId, prefix, countParameter, count, extra = {}) {
  return {
    id: `${caseId}:level-schedule:${componentId}`, componentId,
    sourceComponentRef: `${caseId}:component:${componentId}`,
    designIdPrefix: prefix, countParameter, defaultCount: count,
    actualFloorLabels: null, floorElevationsEvidence: 'design',
    floorHeightsEvidence: 'design', generatedBasements: false, ...extra,
  };
}

function entrance(caseId, suffix, role, componentId, status, extra = {}) {
  return {
    id: `${caseId}:entrance:${suffix}`, role, componentId, evidence: status,
    actualPosition: null, actualDimensions: null, actualRouteVerified: false,
    sourceBindingVerified: false, generatedGeometry: status === 'design', ...extra,
  };
}

function core(caseId, liftRole, count, extra = {}) {
  return {
    id: `${caseId}:core:shared`, ownership: 'building_system_not_single_floor',
    actualPlacement: null, actualPlacementEvidence: 'unknown',
    designPlacementEvidence: 'design',
    stairs: {
      id: `${caseId}:core:shared:stairs`, role: 'personnel_vertical_circulation',
      geometryEvidence: 'design', actualCount: null, actualDimensions: null,
      connects: 'adjacent_design_levels_using_shared_ffls',
    },
    lifts: {
      id: `${caseId}:core:shared:${liftRole}`, role: liftRole,
      designInterfaceCount: count, actualCount: null,
      actualPresence: 'unknown', actualStopSchedule: null,
      placementEvidence: 'design', stopScheduleEvidence: 'design',
      physicsEnabled: false, machineryGenerated: false,
    }, ...extra,
  };
}

function floor(caseId, componentId, purpose, extra = {}) {
  return {
    id: `${caseId}:floor-archetype:${componentId}`, componentId, purpose,
    footprintRef: `${caseId}:component:${componentId}`,
    geometryEvidence: 'design', metricInteriorEvidence: 'unknown',
    instancesShare: ['floor_parameters', 'core_voids', 'level_ffls'],
    actualUnitCount: null, actualPartitionLayout: null, ...extra,
  };
}

function base(caseId, dimensions) {
  const profile = profileFor(caseId);
  return {
    schema: CASE_SYSTEM_CONFIG_SCHEMA, id: `${caseId}:whole-building-config`,
    caseId, name: profile.name, use: profile.use,
    source: {
      modelId: profile.modelId, scoreSha256: SOURCE_SHA256[profile.modelId],
      commit: SOURCE_COMMIT,
      scorePath: `../../hk-three-buildings-r01/geometry/${profile.modelId}.score.json`,
      ledgerPath: '../r07/' + profile.ledger.replace(/^\.\//, ''),
      officialFootprintsPath: FOOTPRINTS, sourceUrls: clone(profile.sourceUrls),
      preserveOriginalShape: true, preserveSourceHash: true,
      transformApplied: false, externalReferenceImagesBundled: false,
    },
    dimensions,
    evidence: { official: [], observed: [], derived: [], design: [], unknown: [] },
    assumptions: {
      actualInteriorComplete: false, structuralCertification: false,
      fireSafetyCertification: false, physicsEnabled: false,
      materialIdentification: 'unknown', openingMechanisms: 'unknown',
    },
  };
}

const lowrise = base('lowrise', {
  units: 'metres', sourceDisplayAxes: ['east', 'up', 'south'],
  sourceOriginENH: [836766.125, 821374, 26.288999557495117],
  measuredSourceBounds: {
    min: [-7.394531250093678, 0, -9.550781292995996],
    max: [7.39453125, 10.913000123085938, 9.55078128446363],
  },
  sourceBoundsEvidence: 'derived', roofPolicy: 'preserve_all_176_source_surface_patches',
  officialHeightSpanM: 7.7,
  heightSpanMeaning: 'official_attribute_difference_not_floor_height_or_mesh_height',
});
lowrise.sourceComponents = [officialComponent('lowrise', 'main',
  ['3676421372T20050430', 47805, 26, 33.7, 2, null, 202.47031488576536])];
lowrise.levelSchedule = {
  id: 'lowrise:level-schedule', evidence: 'design',
  components: [levelComponent('lowrise', 'main', 'L', 'floorCount', 2, {
    recordedFloorLabels: ['G/F', '1/F'], recordedLabelEvidence: 'observed',
    recordedLabelMapping: 'design_ordinal_only_actual_ffls_unknown',
  })],
  rawOfficialRecords: { mainStoreys: 2, mainBasements: null },
  verifiedWholeBuildingTotal: null, ownerWholeBuildingStatement: null,
  labelPolicy: 'L_identifiers_are_design_ids_recorded_G_F_and_1_F_are_separate',
  countPolicy: 'two_storeys_of_No_33_only_not_combined_31_33_site',
  rooftopOccupiedStoreyInferred: false, basementGeneration: 'not_requested',
};
lowrise.coreServiceSets = [core('lowrise', 'passenger_lift', 0)];
lowrise.circulationPolicy = {
  id: 'lowrise:circulation-policy', defaultMode: 'stairs', allowedModes: ['stairs'],
  routeRoles: ['personnel'], liftInferenceAllowed: false,
  stairsEvidence: 'design', actualStairLocation: null,
  sharedGateIsBuildingDoor: false, streetApproachVerified: false,
  completeScope: 'authored_entry_to_two_design_levels_not_surveyed_interiors',
};
lowrise.floorArchetypes = [floor('lowrise', 'main', 'lowrise_residential_flexible_plan', {
  subdivisionPolicy: 'no_KCC_six_unit_template_no_verified_room_layout',
  roofEnvelopePolicy: 'source_complex_roof_is_not_replaced_or_flattened',
})];
lowrise.entranceBindings = [
  entrance('lowrise', 'shared-site-gate', 'shared_site_gate', null, 'observed', {
    sourceScope: 'combined_31_33_premises', generatedGeometry: false,
    sourceReference: '../r07/sources/33-lasalle-evidence.json#/actualPhotoReferences',
    inferredRole: 'vehicular_gate_not_verified_sole_pedestrian_entry',
  }),
  entrance('lowrise', 'site-gate-design', 'shared_site_gate', null, 'design', {
    observedRoleRef: 'lowrise:entrance:shared-site-gate',
    bindsTo: 'authored_site_boundary_not_verified_No_33_gate_coordinates',
    connectsTo: 'authored_site_approach', actualSiteExtent: null,
  }),
  entrance('lowrise', 'house-design', 'personnel', 'main', 'design', {
    bindsTo: 'official_main_footprint_boundary', connectsTo: 'lowest_design_level',
    observedGateRef: 'lowrise:entrance:shared-site-gate',
    representsObservedGate: false,
  }),
];
lowrise.evidence = {
  official: [evidence('lowrise:evidence:official-levels', 'Official Storeys=2 for the No.33 source feature; basement null remains unknown.', [FOOTPRINTS])],
  observed: [
    evidence('lowrise:evidence:labels', 'Property records list G/F and 1/F; they do not calibrate floor elevations.', [lowrise.source.ledgerPath + '#/verified/1']),
    evidence('lowrise:evidence:gate', 'A shared 31–33 street gate is visible; the No.33 house door is not separately identified.', [lowrise.source.ledgerPath + '#/actualPhotoReferences']),
  ],
  derived: [evidence('lowrise:evidence:source-shape', 'The unchanged measured recipe includes a complex roof; mesh extent differs from the official height difference.', [lowrise.source.scorePath])],
  design: [evidence('lowrise:evidence:interior', 'Floor distribution, stair layout, house entrance and interior divisions are replaceable authored design.', [])],
  unknown: [evidence('lowrise:evidence:unresolved', 'Lift presence, stairs, room layout, rear/service entries and actual door metrics are unknown.', [lowrise.source.ledgerPath + '#/unknown'])],
};

const kcc = base('kcc', {
  units: 'metres', sourceDisplayAxes: ['east', 'up', 'south'],
  sourceOriginENH: [836004.8125, 819943.3125, 20.641998291015625],
  measuredSourceBounds: { min: [-12.23828125, 0.00000191, -15.96484375], max: [12.23828125, 70.20300293, 15.96484375] },
  sourceBoundsEvidence: 'derived', measuredTowerFootprintPointCount: 20,
  fixedComponentJointMpd: 22.4, officialTowerHeightSpanM: 68.5,
  conservativeDesignTopMpd: 90.84500122101563,
  heightSpanMeaning: 'official_and_derived_heights_retained_separately_not_floor_heights',
});
kcc.sourceComponents = [
  officialComponent('kcc', 'podium', ['3600619942P20060311', 229126, 8, 22.4, 4, 1, 1114.0892625182385]),
  officialComponent('kcc', 'tower', ['3599719944T20050430', 235909, 22.4, 90.9, 24, null, 392.15994703904505]),
];
kcc.levelSchedule = {
  id: 'kcc:level-schedule', evidence: 'design',
  components: [levelComponent('kcc', 'podium', 'P', 'podiumFloorCount', 4), levelComponent('kcc', 'tower', 'T', 'towerFloorCount', 24)],
  rawOfficialRecords: { towerStoreys: 24, towerBasements: null, podiumStoreys: 4, podiumBasements: 1 },
  verifiedWholeBuildingTotal: null,
  ownerWholeBuildingStatement: { count: 28, evidence: 'observed', source: 'https://hkkcc.org.hk/about-kcc/introduction?lang=zh', independentlyStated: true },
  labelPolicy: 'P_and_T_are_design_ids_not_actual_floor_labels',
  countPolicy: 'retain_component_counts_and_independent_owner_28_statement_do_not_conflate',
  basementGeneration: 'not_requested',
};
const kccCore = core('kcc', 'passenger_lift', 3);
kccCore.stairs.observedTopology = 'paired_routes_drawn_exact_3D_interlock_unknown';
kccCore.lifts.actualPresence = 'observed_in_unscaled_plan_families';
kccCore.lifts.observedPlanCount = 3;
kccCore.lifts.observedScope = ['5–17/F', '18–26/F'];
kccCore.lifts.countEvidence = 'observed';
kcc.coreServiceSets = [kccCore];
kcc.circulationPolicy = {
  id: 'kcc:circulation-policy', defaultMode: 'stairs', allowedModes: ['stairs', 'lift'],
  routeRoles: ['personnel'], liftInferenceAllowed: false,
  liftCountScope: 'three_symbols_in_published_plan_families_not_verified_current_equipment',
  liftDoorCondition: 'car_arrived_at_same_shared_design_ffl',
  streetApproachVerified: false,
  completeScope: 'authored_podium_tower_connected_design_not_actual_stops_or_room_survey',
};
kcc.floorArchetypes = [
  floor('kcc', 'podium', 'mixed_use_podium_circulation', { subdivisionPolicy: 'no_residential_six_unit_template_on_podium' }),
  floor('kcc', 'tower', 'residential_plan_relationships', {
    observedUnitLabels: ['A', 'B', 'C', 'D', 'E', 'F'],
    observedPlanScopes: ['5–17/F', '18–26/F'],
    observedTopologyEvidence: 'observed', designTopology: 'six_units_around_shared_core',
    actualFloorRegistration: null,
    extentCaution: 'plan_does_not_cover_every_present_day_floor_podium_or_roof',
  }),
];
kcc.entranceBindings = [
  entrance('kcc', 'chamber-observed', 'chamber_signed_entry', 'podium', 'observed', {
    sourceReference: '../r07/sources/kcc-evidence.json#/sources/S11',
    relationshipToResidentialLobby: 'unknown',
  }),
  entrance('kcc', 'podium-design', 'personnel', 'podium', 'design', {
    bindsTo: 'official_podium_footprint_boundary', connectsTo: 'lowest_design_level',
    representsObservedChamberEntry: false,
  }),
];
kcc.evidence = {
  official: [evidence('kcc:evidence:components', 'Upper 24, separate podium 4 and podium basement 1 are raw component records.', [FOOTPRINTS, kcc.source.ledgerPath + '#/sources/S04'])],
  observed: [
    evidence('kcc:evidence:owner-count', 'The owner independently states 28 above-ground storeys; this is not an inferred arithmetic sum or verified label map.', ['https://hkkcc.org.hk/about-kcc/introduction?lang=zh']),
    evidence('kcc:evidence:plan-topology', 'Published unscaled plan ranges show A–F, three lifts and the central stair/lobby relationship.', [kcc.source.ledgerPath + '#/drawing_observations']),
  ],
  derived: [evidence('kcc:evidence:source-shape', 'The original 20-point wing footprint and source bounds are retained with their own height provenance.', [kcc.source.scorePath])],
  design: [evidence('kcc:evidence:design-levels', 'P/T IDs, FFL distribution, core placement, portals and lift stopping relations are authored design.', [])],
  unknown: [evidence('kcc:evidence:unresolved', 'Metric interior, current lift operation, true floor label registration and residential entry correspondence are unknown.', [kcc.source.ledgerPath + '#/unknowns'])],
};

const warehouse = base('warehouse', {
  units: 'metres', sourceDisplayAxes: ['east', 'up', 'south'],
  sourceOriginENH: [836896.75, 818601.75, 17.523000717163086],
  measuredSourceBounds: { min: [-33.046875, 0, -32.560546880966264], max: [33.04687501051261, 37.70700073, 32.5625] },
  sourceBoundsEvidence: 'derived', fixedComponentJointMpd: 17.5,
  mainRoofLocalY: 33.82499695, parapetLocalY: 34.07299805, higherStripLocalY: 37.70700073,
  mainRoofMpd: 51.347997667163086,
  roofPolicy: 'preserve_horizontal_roof_planes_parapet_and_higher_strip',
  heightSpanMeaning: 'upper_source_extent_is_not_complete_street_to_roof_height',
});
warehouse.sourceComponents = [
  officialComponent('warehouse', 'podium', ['3690318597P20060311', 237016, 4, 17.5, 2, 2, 3115.6254814995486]),
  officialComponent('warehouse', 'tower', ['3691218584T20050430', 158577, 17.5, 51.7, 12, null, 2329.776236010047]),
];
warehouse.levelSchedule = {
  id: 'warehouse:level-schedule', evidence: 'design',
  components: [levelComponent('warehouse', 'podium', 'P', 'podiumFloorCount', 2), levelComponent('warehouse', 'tower', 'W', 'towerFloorCount', 12)],
  rawOfficialRecords: { towerStoreys: 12, towerBasements: null, podiumStoreys: 2, podiumBasements: 2 },
  verifiedWholeBuildingTotal: null, ownerWholeBuildingStatement: null,
  historicalLabels: { description: 'G/F,1/F–12/F,two basements and local cocklofts', evidence: 'observed', sourceScope: '2021–2022_historical_court_text_via_mirror_not_current_uniform_plates' },
  labelPolicy: 'P_and_W_are_design_ids_not_actual_floor_labels',
  countPolicy: 'raw_12_2_2_not_a_verified_total_never_assert_16_storeys',
  basementGeneration: 'not_requested', cockloftsGenerated: false,
};
warehouse.coreServiceSets = [core('warehouse', 'freight_lift', 1, {
  actualCoreCount: null, actualCoreLayout: null,
  freightCountPolicy: 'one_design_interface_not_the_unverified_broker_reported_nine',
})];
warehouse.circulationPolicy = {
  id: 'warehouse:circulation-policy', defaultMode: 'stairs', allowedModes: ['stairs', 'lift'],
  routeRoles: ['personnel', 'vehicle', 'freight'], liftInferenceAllowed: false,
  roleSeparation: { vehicle: 'loading_threshold_only', personnel: 'entry_and_stairs', freight: 'loading_to_design_freight_interface' },
  vehicleRouteIsPersonnelRoute: false, vehicleRouteUsesStairs: false,
  liftDoorCondition: 'car_arrived_at_same_shared_design_ffl',
  tallPodiumRisePolicy: 'authored_transfer_landings_are_not_additional_verified_storeys',
  streetApproachVerified: false, actualCoreLayoutVerified: false,
  completeScope: 'authored_storage_and_loading_circulation_not_as_built_logistics_or_safety',
};
warehouse.floorArchetypes = [
  floor('warehouse', 'podium', 'warehouse_loading_and_personnel', { subdivisionPolicy: 'loading_storage_and_personnel_roles_no_residential_units' }),
  floor('warehouse', 'tower', 'open_storage', { subdivisionPolicy: 'no_residential_six_units_no_inferred_column_grid' }),
];
warehouse.entranceBindings = [
  entrance('warehouse', 'vehicle-history', 'vehicle', 'podium', 'observed', {
    sourceScope: 'historical_2021_description_and_undated_photo',
    sourceReference: '../r07/sources/warehouse-evidence.json#/entrances',
  }),
  entrance('warehouse', 'personnel-history', 'personnel', 'podium', 'observed', {
    sourceScope: 'historical_2021_description_and_undated_photo',
    sourceReference: '../r07/sources/warehouse-evidence.json#/entrances',
  }),
  entrance('warehouse', 'vehicle-design', 'vehicle', 'podium', 'design', {
    bindsTo: 'official_podium_boundary', connectsTo: 'loading_zone',
    observedRoleRef: 'warehouse:entrance:vehicle-history',
  }),
  entrance('warehouse', 'personnel-design', 'personnel', 'podium', 'design', {
    bindsTo: 'official_podium_boundary', connectsTo: 'lowest_design_personnel_level',
    observedRoleRef: 'warehouse:entrance:personnel-history',
  }),
  entrance('warehouse', 'freight-design', 'freight', 'podium', 'design', {
    bindsTo: 'design_loading_zone', connectsTo: 'warehouse:core:shared:freight_lift',
    observedRoleRef: null,
  }),
];
warehouse.evidence = {
  official: [evidence('warehouse:evidence:components', 'Upper 12, podium 2 and podium basement 2 remain separate raw records, not a verified total.', [FOOTPRINTS, warehouse.source.ledgerPath + '#/floorEvidence'])],
  observed: [evidence('warehouse:evidence:entrance-roles', 'Historical documentation distinguishes wider vehicle and narrower personnel entries; exact current placement is unknown.', [warehouse.source.ledgerPath + '#/entrances'])],
  derived: [evidence('warehouse:evidence:flat-roof', 'All source roof planes are horizontal; the main roof, parapet and higher strip are distinct preserved features.', [warehouse.source.scorePath, warehouse.source.ledgerPath + '#/roof'])],
  design: [evidence('warehouse:evidence:circulation', 'Open storage plates, transfer landings, one freight interface and distinct route-role bindings are authored design.', [])],
  unknown: [evidence('warehouse:evidence:unresolved', 'The actual core layout, freight-lift count, internal plan, column grid, current entries and cockloft geometry remain unknown.', [warehouse.source.ledgerPath + '#/circulation', warehouse.source.ledgerPath + '#/plans'])],
};

// Numeric domains are bounded design domains, never factual building dimensions.
const number = (min, max, extra = {}) => ({ type: 'number', min, max, evidence: 'design', ...extra });
const integer = (min, max) => number(min, max, { type: 'integer' });
kcc.defaultParameters = {
  towerFloorCount: 24, podiumFloorCount: 4, slabThickness: .18,
  minimumHeadroom: 2.3, wallHeight: 2.55,
  stairRun: 2.2, stairWidth: 1.1, stairGap: .2, landingDepth: 1,
};
kcc.parameterLimits = {
  towerFloorCount: integer(2, 24), podiumFloorCount: integer(1, 4),
  towerFloorHeight: number(2.6, 4.2), podiumFloorHeight: number(2.6, 4.2),
  towerFloorHeights: { type: 'number-array', min: 2.6, max: 4.2, lengthFrom: 'towerFloorCount', evidence: 'design' },
  podiumFloorHeights: { type: 'number-array', min: 2.6, max: 4.2, lengthFrom: 'podiumFloorCount', evidence: 'design' },
  slabThickness: number(.12, .3), minimumHeadroom: number(2.2, 2.6), wallHeight: number(2.3, 2.6),
  stairRun: number(2.2, 2.25), stairWidth: number(1.05, 1.1), stairGap: number(.18, .22), landingDepth: number(1, 1.05),
};
kcc.parameterAliases = { floorCount: 'towerFloorCount', floorHeight: 'towerFloorHeight' };

// The lowrise and warehouse domains were chosen with their own footprint/stair
// generator. Exact core/portal containment still belongs to geometry validation.
const otherDefaults = {
  slabThickness: .18, minimumHeadroom: 2.3, wallHeight: 2.5,
  stairWidth: 1.1, stairGap: .2, landingDepth: 1.1,
  stairTreadDepth: .28, maximumRiserHeight: .18, doorWidth: 1,
};
const otherLimits = {
  slabThickness: number(.12, .24), minimumHeadroom: number(2.2, 2.5), wallHeight: number(2.3, 2.6),
  stairWidth: number(1.05, 1.2), stairGap: number(.18, .25), landingDepth: number(1.05, 1.3),
  stairTreadDepth: number(.25, .32), maximumRiserHeight: number(.16, .19), doorWidth: number(.9, 1.2),
};
lowrise.defaultParameters = { ...otherDefaults, floorCount: 2, floorHeight: 3.2, gateWidth: 4.6 };
lowrise.parameterLimits = { ...clone(otherLimits), floorCount: integer(2, 2), floorHeight: number(2.7, 4.5), floorHeights: { type: 'number-array', min: 2.7, max: 4.5, lengthFrom: 'floorCount', evidence: 'design' }, gateWidth: number(3.5, 5) };
lowrise.parameterAliases = {};
warehouse.defaultParameters = {
  ...otherDefaults, towerFloorCount: 12, podiumFloorCount: 2,
  towerFloorHeight: 2.8, podiumFloorHeight: 6.75,
  vehicleWidth: 4.6, freightDoorWidth: 2.6, freightDoorHeight: 2.2,
  freightInterfaceCount: 1, transferMaxRise: 3.6,
};
warehouse.parameterLimits = {
  ...clone(otherLimits), towerFloorCount: integer(2, 12), podiumFloorCount: integer(2, 2),
  towerFloorHeight: number(2.6, 3.6), podiumFloorHeight: number(5.6, 7.9),
  towerFloorHeights: { type: 'number-array', min: 2.6, max: 3.6, lengthFrom: 'towerFloorCount', evidence: 'design' },
  podiumFloorHeights: { type: 'number-array', min: 5.6, max: 7.9, lengthFrom: 'podiumFloorCount', evidence: 'design' },
  vehicleWidth: number(4, 5.5), freightDoorWidth: number(2.2, 3), freightDoorHeight: number(2.1, 2.3),
  freightInterfaceCount: integer(1, 1), transferMaxRise: number(3.6, 3.6),
};
warehouse.parameterAliases = { floorCount: 'towerFloorCount', floorHeight: 'towerFloorHeight' };

export const CASE_SYSTEM_CONFIGS = deepFreeze({ lowrise, kcc, warehouse });

/** Return an isolated contract; a caller cannot mutate another case or the source. */
export function caseSystemConfig(id) {
  if (typeof id !== 'string' || !Object.hasOwn(CASE_SYSTEM_CONFIGS, id)) throw new Error('Unknown building system case: ' + String(id));
  return clone(CASE_SYSTEM_CONFIGS[id]);
}

/** Return only geometry-native parameter keys, never metadata or evidence fields. */
export function resolveCaseParameters(id, input = {}) {
  const config = caseSystemConfig(id);
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) throw new Error('Case parameters must be a plain object');
  const normalized = {};
  for (const [key, value] of Object.entries(input)) {
    const target = config.parameterAliases[key] ?? key;
    if (!Object.hasOwn(config.parameterLimits, target)) throw new Error('Unknown ' + id + ' parameter: ' + key);
    if (Object.hasOwn(normalized, target) && normalized[target] !== value) throw new Error('Conflicting parameter aliases for ' + target);
    normalized[target] = clone(value);
  }
  const result = { ...config.defaultParameters, ...normalized };
  if(id==='lowrise'&&normalized.floorHeights){if(Object.hasOwn(normalized,'floorHeight'))throw Error('Choose scalar or explicit lowrise floor heights');result.floorHeight=normalized.floorHeights[0];}
  for (const kind of ['tower', 'podium']) {
    const scalarKey = kind + 'FloorHeight', arrayKey = kind + 'FloorHeights';
    if (Object.hasOwn(normalized, arrayKey)) {
      if (Object.hasOwn(normalized, scalarKey)) throw new Error('Choose scalar or array ' + kind + ' heights, not both');
      delete result[scalarKey];
    }
  }
  for (const [key, value] of Object.entries(result)) {
    const limit = config.parameterLimits[key];
    if (limit.type === 'number-array') {
      if (!Array.isArray(value) || value.length !== result[limit.lengthFrom] || value.some(v => !Number.isFinite(v) || v < limit.min || v > limit.max)) throw new Error(key + ' outside design array bounds');
    } else if (!Number.isFinite(value) || value < limit.min || value > limit.max || (limit.type === 'integer' && !Number.isInteger(value))) throw new Error(key + ' outside bounded design domain');
  }
  if (id === 'kcc') validateKccHeights(result);
  else validateOtherHeights(id, result);
  return result;
}

function validateOtherHeights(id, parameters) {
  const clearance = Math.max(parameters.minimumHeadroom, parameters.wallHeight);
  function validate(heights, total, mustFill = false) {
    if (heights.some(height => height - parameters.slabThickness < clearance - EPS)) throw new Error('Floor headroom / wall clearance conflict');
    const sum = heights.reduce((a, b) => a + b, 0);
    if (sum > total + EPS) throw new Error('Floor height/count exceeds source component bounds');
    if (mustFill && Math.abs(sum - total) > 1e-6) throw new Error('Podium heights must join the fixed tower datum');
  }
  if (id === 'lowrise') {
    validate(parameters.floorHeights??Array(parameters.floorCount).fill(parameters.floorHeight), 33.7 - 26 - parameters.slabThickness);
  } else {
    validate(parameters.towerFloorHeights ?? Array(parameters.towerFloorCount).fill(parameters.towerFloorHeight), warehouse.dimensions.mainRoofMpd - 17.5 - parameters.slabThickness);
    validate(parameters.podiumFloorHeights ?? Array(parameters.podiumFloorCount).fill(parameters.podiumFloorHeight), 17.5 - 4, true);
    if (parameters.freightDoorHeight > parameters.wallHeight + EPS) throw new Error('Freight portal height exceeds authored wall');
  }
}

function validateKccHeights(parameters) {
  for (const kind of ['tower', 'podium']) {
    const scalar = parameters[kind + 'FloorHeight'];
    const array = parameters[kind + 'FloorHeights'];
    if (scalar !== undefined && array !== undefined) throw new Error('Choose scalar or array ' + kind + ' heights, not both');
    const total = kind === 'tower'
      ? kcc.dimensions.conservativeDesignTopMpd - 22.4 - parameters.slabThickness
      : 22.4 - 8;
    const count = parameters[kind + 'FloorCount'];
    const heights = array ?? Array(count).fill(scalar ?? (kind === 'tower' ? Math.min(3.6, total / count) : total / count));
    if (heights.some(height => height < 2.6 || height > 4.2 || height - parameters.slabThickness < Math.max(parameters.minimumHeadroom, parameters.wallHeight) - EPS)) throw new Error(kind + ' floor headroom / wall clearance conflict');
    const sum = heights.reduce((a, b) => a + b, 0);
    if (sum > total + EPS) throw new Error(kind + ' floor height/count exceeds source bounds');
    if (kind === 'podium' && Math.abs(sum - total) > 1e-6) throw new Error('Podium heights must join the fixed tower datum');
  }
}
