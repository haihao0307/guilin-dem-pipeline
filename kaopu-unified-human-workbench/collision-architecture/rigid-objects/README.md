# Activity rigid objects, first integration stage

This platform module runs the official JoltPhysics.js 1.1.0 WASM solver for released props, gravity, floor/obstacle contact and linear continuous collision. The diagnostic page uses a yellow target ring to exercise the same held-object lifecycle. It is not a human carrying demonstration yet.

## Actor/controller contract

`await RigidObjectWorld.create({fixedStep: 1/120})` creates an independent physics world. Use the activity controller's existing fixed clock; do not enlarge `dt` or discard intermediate release events. All positions are metres, Y-up world coordinates, with xyzw unit quaternions. Positions describe the shape origin, not the center of mass. Jolt accounts for an asymmetric convex hull's center of mass internally. Returned and explicitly supplied linear velocities are center-of-mass velocities, not the velocity of an offset shape origin. For normal release, inheriting the completed MoveKinematic state avoids manually confusing these frames.

1. `addRigid({id, shape, position, rotation, mass, motion})` registers a box (`halfExtents`), sphere (`radius`) or convex hull (`points`). The same dimensions must drive the visible object. A hull fills concavities; it is not a concave surface approximation guarantee.
2. `grab(id)` captures the current world pose and switches the object to kinematic motion. Optional `grab(id, worldPose)` immediately places it at that pose; the activity controller must deliberately validate any such repositioning.
3. `setKinematicTarget(id, worldPose)` queues a hand/attachment target for the next fixed step. `step()` uses Jolt's MoveKinematic to reach it, preserving the resulting linear/angular velocity. A stationary held target remains stationary.
4. After the queued target has been stepped, call `release(id)` exactly once. It changes to dynamic motion and inherits the last completed kinematic velocity. Explicit release velocities are optional. Release with an unstepped target throws instead of silently dropping that target.
5. Each `step()` returns actual origin transforms and real Jolt contact callbacks. `timeStepEnd` is the integration step end, not a measured impact TOI. `normal` follows Jolt's body1-to-body2 convention; object IDs are provided alongside it.
6. `setPaused(true)` freezes the clock. `reset()` rebuilds the original bodies in deterministic registration order and preserves paused state. `dispose()` releases the world. No remove-body API is promised in this stage.

## Tested numerical behavior

The executable Node tests use the same integrity-verified official package as the browser loader. They cover a 2 kg box falling and resting on a floor; kinematic travel and inherited release velocity; gravity after release; pause; identical reset replays; a sphere at 80 m/s stopped by a 2 cm wall; an otherwise identical discrete-motion control that tunnels; an asymmetric convex hull; and repeated disposal/reset/state reads. Test output is stored in the accompanying QA JSON.

Contact settings are explicit: 0.5 mm penetration slop, 2 mm speculative distance and a linear-cast maximum penetration fraction of 0.005. These are tolerances, not claims of zero penetration. The fast-sphere fixture stops within 0.2 mm of first contact. This finite fixture does not certify arbitrary scales, rotations or speeds. Linear and angular velocities are limited to 200 m/s and 100 rad/s.

## Current limits

Held props are kinematic targets. They do not transfer weight to an arm, solve a physical grasp constraint, or certify hand/skin clearance. Human skin is not registered in this rigid world yet. Actual body and glove surface validation remains the separate precision pipeline. Fast rotational collision, cloth, and a contact-rich 18-ring real-time workload are not certified. Mass affects released Jolt rigid dynamics; it does not by itself produce human effort or balance feedback.

A `grab` target can deliberately reposition an object, so use the current pose for normal pickup and validate alignment before switching. The actual activity controller owns reach, hand placement, foot contact, center-of-mass animation and release timing. This module owns the object's rigid state after release.

## Upstream and loading

The existing `../vendor/jolt-physics.wasm-compat.js` loader fetches the fixed official npm `jolt-physics@1.1.0` distribution from jsDelivr, verifies SHA-256 `011233a5fff762d6f0f5b50726b315246bf68cb182f0a10024559d04f4c257de`, then instantiates the embedded real WASM. Network/integrity failures remain errors; there is no mock fallback. The package is MIT licensed. Browser QA uses Chromium with SwiftShader, not hardware-GPU certification.

Sources examined: [official JoltPhysics.js repository](https://github.com/jrouwe/JoltPhysics.js/tree/c9c122bcd48e92885fbee7d267c928c3781d581c), [Jolt PhysicsSettings](https://github.com/jrouwe/JoltPhysics/blob/e77f175595e64cb44218cc9d9d56fc365ad0e36a/Jolt/Physics/PhysicsSettings.h), [BodyInterface](https://github.com/jrouwe/JoltPhysics/blob/e77f175595e64cb44218cc9d9d56fc365ad0e36a/Jolt/Physics/Body/BodyInterface.h), [ContactListener](https://github.com/jrouwe/JoltPhysics/blob/e77f175595e64cb44218cc9d9d56fc365ad0e36a/Jolt/Physics/Collision/ContactListener.h).
