#!/usr/bin/env node

const DEG = Math.PI / 180;
const samples = [0, 15, 35, 65];

const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const norm = a => Math.hypot(...a);
const rotateY = (angle, p) => [
  Math.cos(angle) * p[0] + Math.sin(angle) * p[2],
  p[1],
  -Math.sin(angle) * p[0] + Math.cos(angle) * p[2],
];

const doorCenter = [-0.28, 0.40, 1.0];
const body1LocalJoint = [-0.70, 0, 0];
const body0WorldJoint = add(doorCenter, body1LocalJoint);
const windowLocal = [-0.04, 0.99, -0.18];

function explicitDualFramePose(angle) {
  return {
    origin: sub(body0WorldJoint, rotateY(angle, body1LocalJoint)),
    angle,
  };
}

function centerPivotPose(angle) {
  return { origin: doorCenter, angle };
}

function worldPoint(pose, localPoint) {
  return add(pose.origin, rotateY(pose.angle, localPoint));
}

function runFixture(name, poseFactory, attachChild) {
  let maxClosureError = 0;
  let maxChildRelativeError = 0;
  let referenceChildRelative = null;

  for (const degrees of samples) {
    const pose = poseFactory(degrees * DEG);
    const body1WorldJoint = worldPoint(pose, body1LocalJoint);

    maxClosureError = Math.max(
      maxClosureError,
      norm(sub(body1WorldJoint, body0WorldJoint)),
    );

    const windowWorld = attachChild
      ? worldPoint(pose, windowLocal)
      : add(doorCenter, windowLocal);

    const childRelative = rotateY(
      -pose.angle,
      sub(windowWorld, pose.origin),
    );

    if (!referenceChildRelative) referenceChildRelative = childRelative;

    maxChildRelativeError = Math.max(
      maxChildRelativeError,
      norm(sub(childRelative, referenceChildRelative)),
    );
  }

  return {
    name,
    max_joint_frame_closure_error: +maxClosureError.toFixed(9),
    max_child_relative_transform_error: +maxChildRelativeError.toFixed(9),
    pass: maxClosureError < 1e-9 && maxChildRelativeError < 1e-9,
  };
}

const cases = [
  runFixture("dual_local_frames_edge_hinge", explicitDualFramePose, true),
  runFixture("center_pivot_labeled_hinge", centerPivotPose, true),
  runFixture("edge_hinge_detached_child", explicitDualFramePose, false),
];

const result = {
  schema: "kaopu.dual_local_joint_frame_probe.v1",
  samples_degrees: samples,
  source_method: "OpenUSD body0/body1 local joint frames",
  cases,
  expected: {
    dual_local_frames_edge_hinge: "PASS",
    center_pivot_labeled_hinge: "REJECT",
    edge_hinge_detached_child: "REJECT",
  },
  observed_consistent:
    cases[0].pass && !cases[1].pass && !cases[2].pass,
};

console.log(JSON.stringify(result, null, 2));
