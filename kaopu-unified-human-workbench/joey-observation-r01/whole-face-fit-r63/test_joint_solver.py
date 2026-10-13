"""Synthetic contracts only. These are not validation on photographs/native faces."""
import unittest
from dataclasses import replace

import numpy as np
from scipy.optimize._numdiff import approx_derivative

from geometry import Camera, display_to_native, project_native, extract_visible_contours
from joint_solver import (Landmarks, CurveTargets, ViewModel, SolverConfig, JointSolver,
                          TrueForwardReceipt, adjusted_camera, array_sha256, camera_sha256, calibrate_camera_only)


def camera(eye=(0., 0., 0.), target=(0., 0., -.6), offset=(.04, -.03)):
    eye, target = np.asarray(eye, float), np.asarray(target, float)
    z = eye - target; z /= np.linalg.norm(z)
    x = np.cross([0., 1., 0.], z); x /= np.linalg.norm(x)
    y = np.cross(z, x)
    view = np.eye(4); view[:3, :3] = [x, y, z]; view[:3, 3] = -view[:3, :3] @ eye
    near, far, focal = .01, 10., 1.8
    p = np.zeros((4, 4)); p[0, 0] = focal * .75; p[1, 1] = focal
    p[0, 2], p[1, 2] = offset
    p[2, 2] = -(far + near) / (far - near); p[2, 3] = -2 * far * near / (far - near)
    p[3, 2] = -1
    return Camera.from_three(p, view, 800, 600)


def fixture(d=3, k=2, holdout=True):
    coords = np.linspace(-1., 1., 5)
    xx, yy = np.meshgrid(coords, coords)
    display = np.column_stack((xx.ravel() * .06, yy.ravel() * .075,
                               -.6 + .025 * (xx.ravel() ** 2 + .7 * yy.ravel() ** 2)))
    base = display_to_native(display)
    faces = []
    for row in range(4):
        for col in range(4):
            i = row * 5 + col
            faces += [[i, i + 1, i + 6], [i, i + 6, i + 5]]
    faces = np.asarray(faces)
    rng = np.random.default_rng(947)
    shape = rng.normal(size=(d, len(base), 3)) * .002
    expr = rng.normal(size=(k, len(base), 3)) * .002
    supports, bary = [], []
    for index in range(len(base)):
        face = faces[np.flatnonzero((faces == index).any(axis=1))[0]]
        supports.append(face); bary.append((face == index).astype(float))
    regions = np.asarray(["eye", "nose", "mouth", "face", "ear"] * 5, dtype=object)
    views = []
    cameras = [camera(), camera(eye=(.15, .015, .02)), camera(eye=(-.12, .025, .01))]
    for i, cam in enumerate(cameras[:3 if holdout else 2]):
        lm = Landmarks(np.asarray(supports), np.asarray(bary), project_native(base, cam).pixels,
                       sigma_pixels=1., regions=regions)
        views.append(ViewModel(f"v{i}", base.copy(), shape.copy(), expr.copy(),
                     np.full(k, .25), np.tile([0., 1.], (k, 1)), cam, lm,
                     holdout=(i == 2)))
    return views, faces, base.mean(axis=0)


def config(**kwargs):
    return replace(SolverConfig(shape_regularization=0., expression_regularization=0.,
        camera_regularization=0., robust_scale=None, max_nfev=120, outer_iterations=2,
        predicted_mesh_displacement_cap_m=.004), **kwargs)


def observed(views, center, shape=None, expressions=None, cameras=None):
    result = []
    for v in views:
        theta = np.zeros(len(v.shape_jacobian)) if shape is None else np.asarray(shape)
        e = np.zeros(len(v.expression_center)) if expressions is None else expressions.get(v.view_id, np.zeros(len(v.expression_center)))
        d = np.zeros(7) if cameras is None else cameras.get(v.view_id, np.zeros(7))
        verts = v.base_positions + np.einsum("d,dnc->nc", theta, v.shape_jacobian) + np.einsum("k,knc->nc", e, v.expression_jacobian)
        points = np.einsum("mi,mic->mc", v.landmarks.barycentric, verts[v.landmarks.triangle_vertex_ids])
        target = project_native(points, adjusted_camera(v.camera, d, center)).pixels
        result.append(replace(v, landmarks=replace(v.landmarks, target_pixels=target)))
    return result


def solver(views, faces, center, **kwargs):
    return JointSolver(views, faces, center, config=config(**kwargs),
                       native_engine_id="synthetic_test_engine", native_model_hash="a" * 64)


def receipt(s, p, changes=None):
    vertices = {v.view_id: s.proxy_vertices(p.parameters, v.view_id) for v in s.views}
    if changes:
        for key, delta in changes.items():
            vertices[key] = vertices[key] + delta
    cameras = s.proposal_cameras(p)
    # Test-only simulated independent native forward. Production MUST obtain
    # these arrays and hashes from the trusted original native engine.
    return TrueForwardReceipt(p.proposal_hash, "synthetic_test_engine", "a" * 64,
          vertices, {k: array_sha256(a) for k, a in vertices.items()},
          {k: camera_sha256(c) for k, c in cameras.items()})


class JointSolverTests(unittest.TestCase):
    def test_camera_only_actually_moves_perspective_camera(self):
        views, faces, center = fixture()
        deltas = {"v0": np.array([.025, -.02, .015, .001, -.0008, .003, .012]),
                  "v1": np.array([-.02, .015, -.01, -.001, .0004, -.002, -.008])}
        s = solver(observed(views, center, cameras=deltas), faces, center)
        p = s.propose("camera_only")
        self.assertLess(p.proxy_metrics["normalized_rms"], 1e-5)
        self.assertGreater(np.linalg.norm(p.parameters.camera_delta["v0"]), .02)
        np.testing.assert_allclose(p.parameters.shape, 0.)
        np.testing.assert_allclose(p.parameters.expression_delta["v0"], 0.)
        for vid, delta in deltas.items():
            np.testing.assert_allclose(p.parameters.camera_delta[vid], delta, atol=1e-5)
        np.testing.assert_array_equal(p.parameters.camera_delta["v2"], np.zeros(7))

    def test_camera_delta_rotates_about_shared_center_and_preserves_principal_point(self):
        _, _, center = fixture()
        cam = camera(); delta = np.array([.1, -.08, .03, .001, -.002, .003, .07])
        adjusted = adjusted_camera(cam, delta, center)
        self.assertEqual(adjusted.projection[0, 2], cam.projection[0, 2])
        self.assertEqual(adjusted.projection[1, 2], cam.projection[1, 2])
        np.testing.assert_allclose(np.diag(adjusted.projection)[:2], np.diag(cam.projection)[:2] * np.exp(.07))
        from geometry import native_to_display
        homogeneous = np.r_[native_to_display(center[None])[0], 1.]
        np.testing.assert_allclose((adjusted.world_inverse @ homogeneous)[:3],
                                  (cam.world_inverse @ homogeneous)[:3] + delta[3:6], atol=1e-14)

    def test_shared_shape_one_theta_recovers_across_views(self):
        views, faces, center = fixture()
        truth = np.array([.11, -.065, .08])
        s = solver(observed(views, center, shape=truth), faces, center)
        p = s.propose("shared_shape")
        np.testing.assert_allclose(p.parameters.shape, truth, atol=1e-7)
        self.assertLess(p.proxy_metrics["normalized_rms"], 1e-7)
        self.assertEqual(p.training_view_ids, ("v0", "v1"))
        self.assertEqual(p.holdout_view_ids, ("v2",))
        for value in p.parameters.camera_delta.values():
            np.testing.assert_array_equal(value, np.zeros(7))

    def test_expression_only_is_independent_per_view_with_absolute_bounds(self):
        views, faces, center = fixture()
        expressions = {"v0": np.array([.12, -.08]), "v1": np.array([-.10, .15])}
        s = solver(observed(views, center, expressions=expressions), faces, center)
        p = s.propose("expression_only")
        for key, expected in expressions.items():
            np.testing.assert_allclose(p.parameters.expression_delta[key], expected, atol=1e-7)
        np.testing.assert_allclose(p.parameters.shape, 0.)
        np.testing.assert_allclose(p.parameters.expression_delta["v2"], 0.)

    def test_nuisance_only_fits_camera_expression_with_identity_exactly_zero(self):
        views, faces, center = fixture()
        expr = {"v0": np.array([.11, -.08]), "v1": np.array([-.09, .13])}
        cameras = {"v0": np.array([.015, -.01, .006, .0003, -.0004, .002, .004]),
                   "v1": np.array([-.011, .007, -.005, -.0003, .0002, -.001, -.003])}
        s = solver(observed(views, center, expressions=expr, cameras=cameras), faces, center)
        p = s.propose("nuisance_only")
        np.testing.assert_array_equal(p.parameters.shape, np.zeros(3))
        self.assertLess(p.proxy_metrics["normalized_rms"], 1e-6)
        for key in expr:
            np.testing.assert_allclose(p.parameters.expression_delta[key], expr[key], atol=2e-5)
            np.testing.assert_allclose(p.parameters.camera_delta[key], cameras[key], atol=2e-5)
        self.assertEqual(p.status, "requires_true_forward")

    def test_identity_cap_does_not_suppress_large_necessary_expression(self):
        views, faces, center = fixture()
        views = [replace(v, expression_jacobian=v.expression_jacobian * 30.) for v in views]
        expr = {"v0": np.array([.11, -.08]), "v1": np.array([-.09, .13])}
        s = solver(observed(views, center, expressions=expr), faces, center,
                   predicted_mesh_displacement_cap_m=.0015)
        p = s.propose("expression_only")
        self.assertLess(p.proxy_metrics["normalized_rms"], 1e-6)
        report = p.proxy_metrics["mesh_trust_region"]
        self.assertEqual(report["scope"], "identity")
        self.assertEqual(report["step_scale"], 1.)
        self.assertEqual(report["identity_max_displacement_m"], 0.)
        self.assertGreater(max(report["expression_max_displacement_m_by_view"].values()), .005)
        outcome = s.verify_and_commit(p, receipt(s, p))
        self.assertEqual(outcome.status, "committed", outcome.reason)

    def test_optional_combined_cap_explicitly_limits_expression_too(self):
        views, faces, center = fixture()
        views = [replace(v, expression_jacobian=v.expression_jacobian * 30.) for v in views]
        expr = {"v0": np.array([.11, -.08]), "v1": np.array([-.09, .13])}
        s = solver(observed(views, center, expressions=expr), faces, center,
                   predicted_mesh_displacement_cap_m=.0015, mesh_trust_scope="combined")
        p = s.propose("expression_only")
        report = p.proxy_metrics["mesh_trust_region"]
        self.assertLess(report["step_scale"], 1.)
        self.assertLessEqual(max(report["combined_max_displacement_m_by_view"].values()), .0015 + 1e-12)

    def test_joint_recovers_shared_shape_expression_and_camera_together(self):
        views, faces, center = fixture()
        shape = np.array([.1, -.07, .06])
        expr = {"v0": np.array([.11, -.08]), "v1": np.array([-.09, .13])}
        cameras = {"v0": np.array([.015, -.01, .006, .0003, -.0004, .002, .004]),
                   "v1": np.array([-.011, .007, -.005, -.0003, .0002, -.001, -.003])}
        s = solver(observed(views, center, shape, expr, cameras), faces, center)
        p = s.propose("joint")
        self.assertLess(p.proxy_metrics["normalized_rms"], 1e-6)
        np.testing.assert_allclose(p.parameters.shape, shape, atol=2e-5)
        for key in expr:
            np.testing.assert_allclose(p.parameters.expression_delta[key], expr[key], atol=2e-5)
            np.testing.assert_allclose(p.parameters.camera_delta[key], cameras[key], atol=2e-5)

    def test_all_170_shape_axes_are_available_including_last_axis(self):
        views, faces, center = fixture(d=170)
        j = np.zeros_like(views[0].shape_jacobian)
        j[169] = views[0].shape_jacobian[169]
        views = [replace(v, shape_jacobian=j.copy()) for v in views]
        truth = np.zeros(170); truth[169] = .09
        s = solver(observed(views, center, shape=truth), faces, center, max_nfev=30)
        p = s.propose("shared_shape")
        self.assertEqual(p.parameters.shape.shape, (170,))
        self.assertAlmostEqual(p.parameters.shape[169], .09, places=6)
        self.assertLess(p.proxy_metrics["normalized_rms"], 1e-6)

    def test_holdout_targets_cannot_affect_fit_or_read_only_validation(self):
        views, faces, center = fixture()
        views = observed(views, center, shape=[.1, -.07, .05])
        s1 = solver(views, faces, center); p1 = s1.propose("joint")
        bad = replace(views[2], landmarks=replace(views[2].landmarks,
                      target_pixels=views[2].landmarks.target_pixels + 1000))
        s2 = solver(views[:2] + [bad], faces, center); p2 = s2.propose("joint")
        np.testing.assert_array_equal(p1.parameters.shape, p2.parameters.shape)
        for key in ("v0", "v1", "v2"):
            np.testing.assert_array_equal(p1.parameters.camera_delta[key], p2.parameters.camera_delta[key])
        before = p2.proposal_hash
        score = s2.validate_holdouts(p2)
        self.assertGreater(score["normalized_rms"], 1000.)
        self.assertEqual(before, p2.proposal_hash)
        np.testing.assert_array_equal(s2.accepted_parameters.shape, np.zeros(3))
        # Even very poor holdout error cannot veto a native-forward fit commit.
        self.assertEqual(s2.verify_and_commit(p2, receipt(s2, p2)).status, "committed")

    def test_wrong_camera_and_invalid_native_landmark_support_are_rejected(self):
        views, faces, center = fixture()
        invalid = Camera(np.eye(4), np.eye(4), 800, 600)
        with self.assertRaisesRegex(ValueError, "perspective"):
            solver([replace(views[0], camera=invalid), views[1]], faces, center)
        view = np.eye(4); view[2, 3] = 2.
        behind = Camera.from_three(views[0].camera.projection, view, 800, 600)
        with self.assertRaisesRegex(ValueError, "in front"):
            solver([replace(views[0], camera=behind), views[1]], faces, center)
        lm = replace(views[0].landmarks, triangle_vertex_ids=np.tile([0, 1, 24], (25, 1)))
        with self.assertRaisesRegex(ValueError, "native mesh triangle"):
            solver([replace(views[0], landmarks=lm), views[1]], faces, center)

    def test_curve_regions_cannot_fall_back_to_eyes(self):
        views, faces, center = fixture(holdout=False)
        curve = CurveTargets(np.array([[400., 300.]]))
        with self.assertRaisesRegex(ValueError, "same-region"):
            solver([replace(views[0], curves={"face": curve}, region_triangles={"eye": [0, 1]}), views[1]], faces, center)
        with self.assertRaisesRegex(ValueError, "no triangles"):
            solver([replace(views[0], curves={"ear": curve}, region_triangles={"ear": np.array([], dtype=int), "eye": [0, 1]}), views[1]], faces, center)
        # A valid face region completely away from the observed point must fail
        # its gate; the nearby eye is not an admissible fallback.
        v = replace(views[0], curves={"face": CurveTargets(np.array([[400., 300.]]))},
                    region_triangles={"face": [0], "eye": np.arange(len(faces))})
        with self.assertRaisesRegex(ValueError, "same-region"):
            solver([v, views[1]], faces, center, correspondence_gate_pixels=.001)

    def test_visible_curve_supports_refresh_outer_loop(self):
        views, faces, center = fixture(holdout=False)
        new = []
        for v in views:
            regions = {"face": np.arange(len(faces))}
            samples = extract_visible_contours(v.base_positions, faces, v.camera, regions, spacing_pixels=12.)
            self.assertGreater(len(samples), 5)
            new.append(replace(v, curves={"face": CurveTargets(samples.pixels)}, region_triangles=regions))
        s = solver(new, faces, center, contour_spacing_pixels=12.)
        p = s.propose("camera_only")
        self.assertLess(p.proxy_metrics["normalized_rms"], 1e-8)
        counts = p.optimizer_reports[0]["fixed_support_counts"]
        self.assertGreater(counts["v0"], 25)

    def test_dense_region_does_not_overweight_sparse_features(self):
        views, faces, center = fixture(holdout=False)
        truth = [.09, -.07, .04]
        views = observed(views, center, shape=truth)
        # Make a non-perfect-fit conflict in just one region.
        changed = []
        for v in views:
            lm = v.landmarks
            target = lm.target_pixels.copy(); target[lm.regions == "face", 0] += 1.7
            changed.append(replace(v, landmarks=replace(lm, target_pixels=target)))
        s1 = solver(changed, faces, center); p1 = s1.propose("shared_shape")
        repeated = []
        for v in changed:
            lm = v.landmarks
            ids = np.r_[np.arange(25), np.tile(np.flatnonzero(lm.regions == "face"), 25)]
            repeated.append(replace(v, landmarks=Landmarks(lm.triangle_vertex_ids[ids], lm.barycentric[ids],
                        lm.target_pixels[ids], 1., lm.regions[ids])))
        s2 = solver(repeated, faces, center); p2 = s2.propose("shared_shape")
        np.testing.assert_allclose(p1.parameters.shape, p2.parameters.shape, atol=1e-7)

    def test_soft_l1_derivative_and_camera_shape_jacobian_match_finite_difference(self):
        views, faces, center = fixture(holdout=False)
        views = observed(views, center, shape=[.08, -.07, .05])
        s = solver(views, faces, center, robust_scale=2., shape_regularization=.01,
                   expression_regularization=.01, camera_regularization=.01)
        seed = s.accepted_parameters
        entries, x, _ = s._layout("joint", seed)
        x += np.linspace(.0001, .002, len(x))
        supports = [s._refresh_support(v, seed) for v in s.training_views]
        fun, jac = s._objective(supports, entries, seed)
        numerical = approx_derivative(fun, x, method="3-point")
        np.testing.assert_allclose(jac(x), numerical, atol=1e-5, rtol=2e-5)

    def test_bounds_and_mesh_trust_region_shrink_large_displacements(self):
        views, faces, center = fixture()
        j = views[0].shape_jacobian * 20.
        views = [replace(v, shape_jacobian=j.copy()) for v in views]
        views = observed(views, center, shape=[.13, -.12, .11])
        s = solver(views, faces, center, predicted_mesh_displacement_cap_m=.0015)
        p = s.propose("shared_shape")
        trust = p.proxy_metrics["mesh_trust_region"]
        self.assertLess(trust["step_scale"], .5)
        self.assertLessEqual(trust["max_displacement_m"], .0015)
        self.assertGreater(trust["unlimited_displacement_m"], .005)
        self.assertEqual(p.status, "requires_true_forward")
        for v in s.training_views:
            maximum = np.linalg.norm(s.proxy_vertices(p.parameters, v.view_id) - v.base_positions, axis=1).max()
            self.assertLessEqual(maximum, .0015 + 1e-12)

    def test_optimizer_success_never_auto_commits_without_receipt(self):
        views, faces, center = fixture()
        s = solver(observed(views, center, shape=[.1, -.06, .07]), faces, center)
        p = s.propose("shared_shape")
        self.assertEqual(p.status, "requires_true_forward")
        self.assertEqual(p.forward_kind, "local_linear_geometry_proxy")
        np.testing.assert_array_equal(s.accepted_parameters.shape, np.zeros(3))
        outcome = s.verify_and_commit(p)
        self.assertEqual(outcome.status, "rolled_back")
        self.assertIn("receipt", outcome.reason)
        np.testing.assert_array_equal(s.accepted_parameters.shape, np.zeros(3))

    def test_matching_external_native_receipt_commits(self):
        views, faces, center = fixture()
        s = solver(observed(views, center, shape=[.1, -.06, .07]), faces, center)
        p = s.propose("shared_shape")
        outcome = s.verify_and_commit(p, lambda candidate: receipt(s, candidate))
        self.assertEqual(outcome.status, "committed", outcome.reason)
        self.assertIn("proxy_vs_native", outcome.metrics)
        np.testing.assert_allclose(s.accepted_parameters.shape, [.1, -.06, .07], atol=1e-7)
        self.assertEqual(p.status, "requires_true_forward")  # immutable audit object
        self.assertEqual(outcome.proposal.status, "committed")

    def test_native_proxy_deviation_rolls_back_existing_anchor(self):
        views, faces, center = fixture()
        s = solver(observed(views, center, shape=[.1, -.06, .07]), faces, center)
        p = s.propose("shared_shape")
        outcome = s.verify_and_commit(p, receipt(s, p, {"v0": np.array([.008, 0., 0.])}))
        self.assertEqual(outcome.status, "rolled_back")
        self.assertTrue("diverges" in outcome.reason or "trust cap" in outcome.reason)
        self.assertGreater(outcome.metrics["proxy_vs_native"]["v0"]["vertex_rmse_m"], .007)
        np.testing.assert_array_equal(s.accepted_parameters.shape, np.zeros(3))

    def test_native_nonfinite_wrong_hash_camera_and_engine_are_rejected(self):
        views, faces, center = fixture()
        s = solver(views, faces, center); p = s.propose("shared_shape")
        r = receipt(s, p)
        cases = [replace(r, proposal_hash="wrong"), replace(r, model_hash="wrong"),
                 replace(r, engine_id="wrong"), replace(r, source="linear_proxy"),
                 replace(r, vertices_sha256={**r.vertices_sha256, "v0": "wrong"}),
                 replace(r, camera_sha256={**r.camera_sha256, "v0": "wrong"})]
        nonfinite = {k: a.copy() for k, a in r.vertices_by_view.items()}; nonfinite["v0"][0, 0] = np.nan
        cases.append(replace(r, vertices_by_view=nonfinite))
        for bad in cases:
            with self.subTest(reason=bad):
                outcome = s.verify_and_commit(p, bad)
                self.assertEqual(outcome.status, "rolled_back")
                np.testing.assert_array_equal(s.accepted_parameters.shape, np.zeros(3))

    def test_true_forward_small_but_worsening_error_fails_error_gate(self):
        views, faces, center = fixture()
        s = solver(views, faces, center); p = s.propose("shared_shape")
        outcome = s.verify_and_commit(p, receipt(s, p, {"v0": np.array([.00005, 0., 0.])}))
        self.assertEqual(outcome.status, "rolled_back")
        self.assertIn("worsens", outcome.reason)

    def test_mutating_proposal_or_callback_cannot_bypass_hash(self):
        views, faces, center = fixture()
        s = solver(views, faces, center); p = s.propose("joint")
        good = receipt(s, p)
        def callback(candidate):
            candidate.parameters.shape[0] = .01
            return good
        outcome = s.verify_and_commit(p, callback)
        self.assertEqual(outcome.status, "rolled_back")
        self.assertIn("hash", outcome.reason)

    def test_frozen_camera_calibration_uses_only_designated_points(self):
        views, faces, center = fixture()
        delta = np.array([.02, -.015, .008, .0004, -.0003, .002, .006])
        modified = observed(views, center, cameras={"v2": delta})[2]
        # The scoring target can be arbitrary; only the designated calibration
        # observations below are supplied to the camera-only helper.
        corrupted = replace(modified, landmarks=replace(modified.landmarks,
                             target_pixels=modified.landmarks.target_pixels + 1000.))
        lm = modified.landmarks
        eye_nose = np.flatnonzero(np.isin(lm.regions, ["eye", "nose"]))
        calibration = Landmarks(lm.triangle_vertex_ids[eye_nose], lm.barycentric[eye_nose],
                                lm.target_pixels[eye_nose], 1., lm.regions[eye_nose])
        result = calibrate_camera_only(corrupted, faces, center, calibration,
                                       frozen_vertices=modified.base_positions, config=config())
        np.testing.assert_allclose(result["camera_delta"], delta, atol=1e-5)
        self.assertFalse(result["identity_fitted"])
        self.assertEqual(result["status"], "calibration_only")

    def test_single_native_vertex_spike_cannot_hide_in_small_mean_error(self):
        views, faces, center = fixture()
        s = solver(views, faces, center, predicted_mesh_displacement_cap_m=.0015)
        p = s.propose("shared_shape")
        change = np.zeros_like(views[0].base_positions); change[0, 0] = .003
        outcome = s.verify_and_commit(p, receipt(s, p, {"v0": change}))
        self.assertEqual(outcome.status, "rolled_back")
        self.assertIn("diverges", outcome.reason)

    def test_shape_nuisance_identifiability_reports_without_fitting(self):
        views, faces, center = fixture()
        s = solver(views, faces, center)
        diagnostic = s.identifiability_diagnostics()
        self.assertEqual(diagnostic["shape_dimensions"], 3)
        self.assertGreater(diagnostic["nuisance_rank"], 0)
        self.assertEqual(len(diagnostic["nuisance_explained_shape_fraction"]), 3)
        self.assertTrue(all(0 <= x <= 1 for x in diagnostic["nuisance_explained_shape_fraction"]))
        np.testing.assert_array_equal(s.accepted_parameters.shape, np.zeros(3))


if __name__ == "__main__":
    unittest.main()
