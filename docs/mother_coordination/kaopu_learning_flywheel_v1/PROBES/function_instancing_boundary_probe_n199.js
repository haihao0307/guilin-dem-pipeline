#!/usr/bin/env node

const EPS = 1e-6;

const add = (a, b) => a.map((v, i) => v + b[i]);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);

function rayAabb(origin, direction, min, max) {
  let tNear = -Infinity;
  let tFar = Infinity;

  for (let axis = 0; axis < 3; axis += 1) {
    if (Math.abs(direction[axis]) < EPS) {
      if (origin[axis] < min[axis] || origin[axis] > max[axis]) return null;
      continue;
    }

    let t0 = (min[axis] - origin[axis]) / direction[axis];
    let t1 = (max[axis] - origin[axis]) / direction[axis];
    if (t0 > t1) [t0, t1] = [t1, t0];
    tNear = Math.max(tNear, t0);
    tFar = Math.min(tFar, t1);
    if (tNear > tFar) return null;
  }

  if (tFar <= EPS) return null;
  return { tNear: Math.max(tNear, 0), tFar };
}

function bounds(cube) {
  return {
    min: cube.center.map((v, i) => v - cube.half[i]),
    max: cube.center.map((v, i) => v + cube.half[i]),
  };
}

function visibleToDirectionalLight(sample, directionToLight, selfId, cubes) {
  const origin = add(sample, directionToLight.map(v => v * EPS * 10));
  for (const cube of cubes) {
    if (cube.id === selfId) continue;
    const box = bounds(cube);
    if (rayAabb(origin, directionToLight, box.min, box.max)) return false;
  }
  return true;
}

function cameraWinner(origin, direction, cubes) {
  return cubes
    .map(cube => {
      const box = bounds(cube);
      const hit = rayAabb(origin, direction, box.min, box.max);
      return hit ? { id: cube.id, tNear: hit.tNear } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.tNear - b.tNear);
}

function rotateX(degrees, p) {
  const a = degrees * Math.PI / 180;
  return [
    p[0],
    Math.cos(a) * p[1] - Math.sin(a) * p[2],
    Math.sin(a) * p[1] + Math.cos(a) * p[2],
  ];
}

function costCase(name, { instances, visibleInstances, functionSetup, transform, visibilityAndShading }) {
  const naive = instances * (functionSetup + transform + visibilityAndShading);
  const shared = functionSetup + instances * transform + visibleInstances * visibilityAndShading;
  return {
    name,
    instances,
    visible_instances: visibleInstances,
    units_naive: naive,
    units_shared_function_class: shared,
    remaining_fraction: +(shared / naive).toFixed(6),
    speedup: +(naive / shared).toFixed(6),
  };
}

const sameFunctionCubes = [
  { id: "lower", center: [0, 0, 0], half: [1, 1, 1] },
  { id: "upper", center: [0, 3, 0], half: [1, 1, 1] },
];
const directionToSun = [0, 1, 0];
const canonicalTopNormal = [0, 1, 0];

const shadowCases = sameFunctionCubes.map(cube => {
  const topSample = add(cube.center, [0, 1, 0]);
  return {
    id: cube.id,
    same_function_class: "unitCube",
    same_local_surface_sample: [0, 1, 0],
    n_dot_l_without_visibility: dot(canonicalTopNormal, directionToSun),
    visible_to_sun: visibleToDirectionalLight(
      topSample,
      directionToSun,
      cube.id,
      sameFunctionCubes,
    ),
  };
});

const cameraCubes = [
  { id: "front", center: [0, 0, 2], half: [1, 1, 1] },
  { id: "rear", center: [0, 0, -2], half: [1, 1, 1] },
];
const cameraHits = cameraWinner([0, 0, 10], [0, 0, -1], cameraCubes);

const rotatedNormals = [0, 60].map(rotation => ({
  rotation_x_degrees: rotation,
  n_dot_l: +dot(rotateX(rotation, canonicalTopNormal), directionToSun).toFixed(6),
}));

const amdahl = [0.5, 0.9, 0.99, 0.999898, 1].map(shareableFraction => ({
  shareable_fraction: shareableFraction,
  speedup_at_100_instances: +(
    1 / ((1 - shareableFraction) + shareableFraction / 100)
  ).toFixed(6),
}));

const result = {
  schema: "kaopu.function_instancing_boundary_probe.v1",
  purpose: "Oracle replay only; this does not prescribe a ray-based production renderer.",
  correctness: {
    same_local_surface_different_shadow: shadowCases,
    same_projected_function_different_camera_depth: {
      ordered_hits: cameraHits,
      visible_instance: cameraHits[0].id,
      occluded_instance: cameraHits[1].id,
    },
    same_function_different_instance_orientation: rotatedNormals,
    assertions: {
      shared_unoccluded_local_response: shadowCases.every(c => c.n_dot_l_without_visibility === 1),
      final_shadow_visibility_must_differ: shadowCases[0].visible_to_sun !== shadowCases[1].visible_to_sun,
      camera_visibility_must_choose_one_instance: cameraHits.length === 2 && cameraHits[0].id === "front",
      orientation_requires_per_instance_direction_transform: rotatedNormals[0].n_dot_l !== rotatedNormals[1].n_dot_l,
    },
  },
  cost_model: {
    formula_naive: "N * (F + T + R)",
    formula_shared: "K * F + N * T + M * R",
    variables: {
      N: "instance count",
      K: "function-class count",
      M: "visible/evaluated instance count after culling",
      F: "shareable function compile/setup/data cost",
      T: "per-instance transform/bounds cost",
      R: "per-visible-instance/sample visibility and shading cost",
    },
    cases: [
      costCase("all_visible_balanced_cost", {
        instances: 100,
        visibleInstances: 100,
        functionSetup: 100,
        transform: 1,
        visibilityAndShading: 100,
      }),
      costCase("all_visible_setup_dominated", {
        instances: 100,
        visibleInstances: 100,
        functionSetup: 100000,
        transform: 1,
        visibilityAndShading: 100,
      }),
      costCase("ten_visible_after_culling", {
        instances: 100,
        visibleInstances: 10,
        functionSetup: 100,
        transform: 1,
        visibilityAndShading: 100,
      }),
    ],
    amdahl_100_instances: amdahl,
  },
  decision: "PARTIAL_FEASIBLE_REJECT_UNCONDITIONAL_ONE_PERCENT_CLAIM",
};

console.log(JSON.stringify(result, null, 2));
