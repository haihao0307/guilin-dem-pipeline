"""Synthetic geometry checks; these are not real-face fitting validation."""

import time
import unittest

import numpy as np

from geometry import (Camera, ContourSamples, MeshTopology, display_to_native,
                      evaluate_support, extract_visible_contours,
                      match_same_region, native_to_display,
                      perspective_face_facing, project_native, surface_visible,
                      unproject_native)


def camera(eye=(0., 0., 0.), target=(0., 0., -4.), width=800, height=600,
           offset=(0., 0.), near=.1, far=100.):
    eye, target = np.array(eye, float), np.array(target, float)
    backward = eye - target
    backward /= np.linalg.norm(backward)
    right = np.cross([0., 1., 0.], backward)
    right /= np.linalg.norm(right)
    up = np.cross(backward, right)
    view = np.eye(4)
    view[:3, :3] = [right, up, backward]
    view[:3, 3] = -view[:3, :3] @ eye
    f = 1. / np.tan(np.deg2rad(55.) / 2)
    p = np.zeros((4, 4))
    p[0, 0], p[1, 1] = f / (width / height), f
    p[0, 2], p[1, 2] = offset
    p[2, 2], p[2, 3] = -(far + near) / (far - near), -2 * far * near / (far - near)
    p[3, 2] = -1
    return Camera.from_three(p.ravel(order="F"), view.ravel(order="F"), width, height)


def cube():
    display = np.array([[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
                        [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], float)
    display[:, 2] -= 4
    faces = np.array([[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7],
                      [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5],
                      [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]])
    return display_to_native(display), faces


def square(z=-4., radius=1.):
    v = np.array([[-radius, -radius, z], [radius, -radius, z],
                  [radius, radius, z], [-radius, radius, z]])
    return display_to_native(v), np.array([[0, 1, 2], [0, 2, 3]])


class ProjectionTests(unittest.TestCase):
    def test_exact_three_column_major_and_native_mapping(self):
        cam = camera()
        native = np.array([[1., 4., 2.]])  # display (1, 2, -4)
        result = project_native(native, cam)
        f = 1 / np.tan(np.deg2rad(55.) / 2)
        np.testing.assert_allclose(result.pixels, [[400 + 300 * f / 4, 300 - 600 * f / 4]])
        np.testing.assert_allclose(result.depth, [4])
        np.testing.assert_allclose(display_to_native(native_to_display(native)), native)
        self.assertTrue(result.in_view[0])

    def test_roundtrip_different_cameras_and_off_axis_projection(self):
        for eye in [(0., 0., 0.), (3., 2., 1.), (-4., .5, -1.)]:
            cam = camera(eye, width=1250, height=777, offset=(.13, -.07))
            points = display_to_native(np.array([[0., 0., -4.], [.3, -.2, -3.5], [-.6, .1, -4.2]]))
            p = project_native(points, cam)
            self.assertTrue(p.in_front.all())
            np.testing.assert_allclose(unproject_native(p.pixels, p.depth, cam), points, atol=1e-12)
            np.testing.assert_allclose(cam.position_native, display_to_native(np.array([eye]))[0], atol=1e-12)

    def test_finite_depth_viewport_and_near_far_are_separate(self):
        points = display_to_native(np.array([[0, 0, -4], [0, 0, 1], [0, 0, 0],
                                             [np.nan, 0, -4], [100, 0, -4], [0, 0, -.05], [0, 0, -101]]))
        p = project_native(points, camera())
        np.testing.assert_array_equal(p.in_front, [True, False, False, False, True, True, True])
        np.testing.assert_array_equal(p.in_view, [True, False, False, False, False, False, False])
        self.assertTrue(p.finite[1])
        self.assertFalse(p.finite[2])

    def test_reject_bad_camera(self):
        cam = camera()
        with self.assertRaisesRegex(ValueError, "perspective"):
            Camera.from_three(np.eye(4), np.eye(4), 800, 600)
        with self.assertRaisesRegex(ValueError, "viewport"):
            Camera.from_three(cam.projection, cam.world_inverse, 0, 600)
        with self.assertRaisesRegex(ValueError, "singular"):
            Camera.from_three(np.zeros((4, 4)), np.eye(4), 800, 600)


class TopologyTests(unittest.TestCase):
    def test_invalid_indices_degeneracy_duplicates_and_winding(self):
        v, f = square()
        cases = [([[0, 1, 4]], "outside"), ([[0, 1, 1]], "repeated"),
                 ([[0, 1, 2], [2, 0, 1]], "duplicate"),
                 ([[0, 1, 2], [0, 3, 2]], "winding")]
        for bad, message in cases:
            with self.subTest(message=message), self.assertRaisesRegex(ValueError, message):
                MeshTopology.build(v, np.array(bad))
        with self.assertRaisesRegex(ValueError, "integer"):
            MeshTopology.build(v, f.astype(float))
        with self.assertRaisesRegex(ValueError, "degenerate"):
            MeshTopology.build(np.array([[0., 0, 0], [1, 0, 0], [2, 0, 0]]), np.array([[0, 1, 2]]))

    def test_nonmanifold_rejected(self):
        v = np.array([[0., 0, 0], [1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1]])
        with self.assertRaisesRegex(ValueError, "nonmanifold"):
            MeshTopology.build(v, np.array([[0, 1, 2], [1, 0, 3], [0, 1, 4]]))

    def test_cached_topology_must_match(self):
        v, f = cube()
        topo = MeshTopology.build(v, f)
        with self.assertRaisesRegex(ValueError, "does not match"):
            extract_visible_contours(v, f[::-1], camera(), {"face": np.arange(len(f))}, topology=topo)


class ContourTests(unittest.TestCase):
    def test_perspective_facing_disagrees_with_orthographic_normal_z(self):
        display = np.array([[4., 0., -3.], [4., .3, -3.], [3.97, 0., -2.7]])
        normal = np.cross(display[1] - display[0], display[2] - display[0])
        self.assertGreater(normal[2], 0)  # Orthographic normal-Z would call this front.
        v, f = display_to_native(display), np.array([[0, 1, 2]])
        self.assertLess(perspective_face_facing(v, f, camera())[0], 0)
        samples = extract_visible_contours(v, f, camera(), {"cheek": [0]})
        self.assertEqual(len(samples), 0)

    def test_region_seam_is_not_a_silhouette(self):
        v, f = square()
        samples = extract_visible_contours(v, f, camera(), {"cheek": [0]})
        self.assertGreater(len(samples), 0)
        self.assertFalse(np.any(np.all(samples.edge_vertex_ids == [0, 2], axis=1)))
        self.assertEqual(set(samples.kinds), {"open_boundary"})
        closed_only = extract_visible_contours(v, f, camera(), {"cheek": [0]}, include_open_boundaries=False)
        self.assertEqual(len(closed_only), 0)

    def test_explicit_semantic_edges_preserve_lip_eye_regions(self):
        v, f = square()
        samples = extract_visible_contours(v, f, camera(), {"upper_lip": [0], "eye_rim": [1]},
                    semantic_edges_by_region={"upper_lip": [[0, 2]], "eye_rim": [[0, 2]]},
                    include_open_boundaries=False)
        self.assertGreater(len(samples), 0)
        self.assertEqual(set(samples.kinds), {"semantic"})
        self.assertEqual(set(samples.regions), {"upper_lip", "eye_rim"})
        with self.assertRaisesRegex(ValueError, "matching region"):
            extract_visible_contours(v, f, camera(), {"upper_lip": [0]}, semantic_edges_by_region={"eye": [[0, 2]]})
        with self.assertRaisesRegex(ValueError, "not a native"):
            extract_visible_contours(v, f, camera(), {"eye": [0]}, semantic_edges_by_region={"eye": [[1, 3]]})

    def test_native_barycentric_support_reconstructs_projection(self):
        v, f = cube()
        cam = camera((3., 2., 1.))
        samples = extract_visible_contours(v, f, cam, {"face": np.arange(len(f))}, spacing_pixels=7.)
        self.assertGreater(len(samples), 0)
        self.assertEqual(set(samples.kinds), {"silhouette"})
        np.testing.assert_allclose(samples.barycentric.sum(axis=1), 1.)
        self.assertTrue((samples.barycentric >= 0).all())
        rebuilt = evaluate_support(v, f, samples)
        np.testing.assert_allclose(rebuilt, samples.native_points, atol=1e-14)
        np.testing.assert_allclose(project_native(rebuilt, cam).pixels, samples.pixels, atol=1e-12)
        for edge in np.unique(samples.edge_vertex_ids, axis=0):
            points = samples.pixels[np.all(samples.edge_vertex_ids == edge, axis=1)]
            if len(points) > 2:
                lengths = np.linalg.norm(np.diff(points, axis=0), axis=1)
                np.testing.assert_allclose(lengths, lengths[0], rtol=1e-10, atol=1e-10)
                self.assertLessEqual(lengths[0], 7. + 1e-10)

    def test_silhouette_slides_to_new_native_support_after_camera_or_shape_change(self):
        v, f = cube()
        topo = MeshTopology.build(v, f)
        region = {"jaw": np.arange(len(f))}
        a = extract_visible_contours(v, f, camera(), region, topology=topo)
        b = extract_visible_contours(v, f, camera((4., 0., 0.)), region, topology=topo)
        moved = v.copy()
        moved[:, 0] += 3
        c = extract_visible_contours(moved, f, camera(), region, topology=topo)
        ea, eb, ec = [set(map(tuple, s.edge_vertex_ids)) for s in (a, b, c)]
        self.assertNotEqual(ea, eb)
        self.assertNotEqual(ea, ec)
        self.assertTrue(len(eb - ea) > 0)
        # A fixed anatomical edge list cannot represent these new supports.
        np.testing.assert_allclose(evaluate_support(moved, f, a), a.native_points + [3., 0., 0.])

    def test_clip_camera_plane_near_plane_and_viewport(self):
        v = display_to_native(np.array([[-.5, -.5, -2.], [.5, -.5, -2.], [0., .5, .5]]))
        f = np.array([[0, 1, 2]])
        cam = camera()
        samples = extract_visible_contours(v, f, cam, {"face": [0]}, spacing_pixels=10.)
        self.assertGreater(len(samples), 0)
        self.assertTrue(np.isfinite(samples.pixels).all())
        self.assertTrue(project_native(samples.native_points, cam).in_view.all())
        self.assertTrue((samples.depth >= .1 - 1e-12).all())

    def test_behind_camera_no_contour(self):
        v, f = square(z=4)
        f = f[:, ::-1]  # Face points toward the camera but is behind its view.
        self.assertEqual(len(extract_visible_contours(v, f, camera(), {"face": [0, 1]})), 0)


class OcclusionTests(unittest.TestCase):
    def test_full_mesh_occluder_not_in_skin_subset_and_back_facing(self):
        target, tf = square(z=-5, radius=.5)
        blocker, bf = square(z=-3, radius=1.)
        v = np.vstack((target, blocker))
        f = np.vstack((tf, bf[:, ::-1] + 4))  # Back-facing blockers still occlude.
        bare = extract_visible_contours(target, tf, camera(), {"jaw": [0, 1]})
        hidden = extract_visible_contours(v, f, camera(), {"jaw": [0, 1]})
        self.assertGreater(len(bare), 0)
        self.assertEqual(len(hidden), 0)

    def test_background_geometry_is_not_an_occluder(self):
        target, tf = square(z=-3, radius=.5)
        background, bf = square(z=-5, radius=1.)
        v, f = np.vstack((target, background)), np.vstack((tf, bf + 4))
        samples = extract_visible_contours(v, f, camera(), {"jaw": [0, 1]})
        self.assertGreater(len(samples), 0)
        self.assertTrue((samples.triangle_ids < 2).all())

    def test_visibility_scales_and_excludes_incident_surface(self):
        for scale in (1e-5, 1., 1e4):
            target, tf = square(z=-5, radius=.5)
            blocker, bf = square(z=-3, radius=.3)
            v, f = np.vstack((target, blocker)) * scale, np.vstack((tf, bf + 4))
            cam = camera(target=(0., 0., -4 * scale), near=.01 * scale, far=100 * scale)
            points = display_to_native(np.array([[0., 0., -5], [.49, .49, -5]])) * scale
            result = surface_visible(v, f, cam, points, exclude_faces=np.array([[0, 1], [0, 1]]))
            np.testing.assert_array_equal(result, [False, False])  # projected blocker covers both
            bare = surface_visible(target * scale, tf, cam, points, exclude_faces=np.array([[0, 1], [0, 1]]))
            np.testing.assert_array_equal(bare, [True, True])

    def test_triangle_crossing_camera_plane_is_not_dropped_by_bbox(self):
        # Intersects the center ray at z=-1 despite one vertex lying behind eye.
        v = display_to_native(np.array([[-2., -1., -2.], [2., -1., -2.], [0., 2., 1.]]))
        f = np.array([[0, 1, 2]])
        points = display_to_native(np.array([[0., 0., -5.], [10., 0., -5.], [0., 0., 2.]]))
        result = surface_visible(v, f, camera(), points)
        np.testing.assert_array_equal(result, [False, True, False])

    def test_chunked_projection_culling_against_independent_linear_solve(self):
        # An independent plane-coordinate linear solve checks exact visibility,
        # including crossing-camera triangles, a rotated camera and chunk seams.
        rng = np.random.default_rng(7382)
        centers = rng.uniform([-3., -2., -6.], [3., 2., 2.], size=(24, 1, 3))
        display = (centers + rng.normal(scale=.8, size=(24, 3, 3))).reshape(-1, 3)
        vertices = display_to_native(display)
        faces = np.arange(72).reshape(-1, 3)
        cam = camera((.7, .4, 1.))
        pixels = rng.uniform([40., 30.], [760., 570.], size=(41, 2))
        points = unproject_native(pixels, rng.uniform(5., 10., size=41), cam)
        origin = cam.position_native
        expected = []
        eps = np.linalg.norm(np.ptp(vertices, axis=0)) * 1e-7
        for point in points:
            ray = point - origin
            margin = eps / np.linalg.norm(ray)
            blocked = False
            for face in faces:
                a, b, c = vertices[face]
                # origin + t*ray = a + u*(b-a) + v*(c-a)
                mat = np.column_stack((ray, -(b - a), -(c - a)))
                if abs(np.linalg.det(mat)) < 1e-12:
                    continue
                t, u, v = np.linalg.solve(mat, a - origin)
                if margin < t < 1 - margin and u >= 0 and v >= 0 and u + v <= 1:
                    blocked = True
                    break
            expected.append(not blocked)
        self.assertTrue(any(expected))
        self.assertFalse(all(expected))
        for ray_chunk, face_chunk in [(1, 3), (7, 5), (32, 2048)]:
            result = surface_visible(vertices, faces, cam, points,
                                     ray_chunk=ray_chunk, face_chunk=face_chunk)
            np.testing.assert_array_equal(result, expected)


class RegionMatchTests(unittest.TestCase):
    def samples(self):
        return ContourSamples(np.array([0, 1, 2]), np.zeros((3, 2), int), np.zeros((3, 3)),
                              np.zeros((3, 3)), np.array([[100., 100.], [1., 0.], [20., 20.]]),
                              np.ones(3), np.array(["cheek", "eyeball", "upper_lip"], object),
                              np.array(["silhouette", "semantic", "semantic"], object))

    def test_cheek_cannot_attach_to_closer_eyeball(self):
        matched = match_same_region(self.samples(), {"cheek": [[1., 0.]], "lower_lip": [[20., 20.]]})
        np.testing.assert_array_equal(matched.sample_indices, [0])
        np.testing.assert_array_equal(matched.regions, ["cheek"])
        self.assertGreater(matched.distances[0], 100)
        gated = match_same_region(self.samples(), {"cheek": [[1., 0.]]}, max_distance_pixels=5.)
        self.assertEqual(len(gated), 0)

    def test_matching_direction_and_region_local_indices(self):
        target = {"eyeball": [[1., 0.], [2., 0.]], "upper_lip": [[20., 21.]]}
        m = match_same_region(self.samples(), target)
        np.testing.assert_array_equal(m.sample_indices, [1, 1, 2])
        np.testing.assert_array_equal(m.target_indices, [0, 1, 0])
        reverse = match_same_region(self.samples(), target, direction="contour_to_target")
        np.testing.assert_array_equal(reverse.sample_indices, [1, 2])
        np.testing.assert_allclose(reverse.distances, [0., 1.])


def synthetic_sphere_mesh(rings=157, segments=160):
    """25,122 vertices / 50,240 faces, smooth closed synthetic benchmark."""
    phi = np.linspace(0., 2 * np.pi, segments, endpoint=False)
    theta = np.linspace(0., np.pi, rings + 2)[1:-1]
    xyz = np.stack((np.sin(theta)[:, None] * np.cos(phi),
                    np.sin(theta)[:, None] * np.sin(phi),
                    np.broadcast_to(np.cos(theta)[:, None], (rings, segments))), axis=2).reshape(-1, 3)
    display = np.vstack(([0., 0., 1.], xyz, [0., 0., -1.]))
    faces = []
    for j in range(segments):
        k = (j + 1) % segments
        faces.append([0, 1 + j, 1 + k])
    for i in range(rings - 1):
        for j in range(segments):
            k = (j + 1) % segments
            a, b = 1 + i * segments + j, 1 + i * segments + k
            c, d = a + segments, b + segments
            faces.extend(([a, c, b], [b, c, d]))
    bottom = len(display) - 1
    for j in range(segments):
        k = (j + 1) % segments
        faces.append([bottom, 1 + (rings - 1) * segments + k, 1 + (rings - 1) * segments + j])
    display[:, 2] -= 4
    return display_to_native(display), np.asarray(faces, int)


def benchmark():
    v, f = synthetic_sphere_mesh()
    start = time.perf_counter()
    topo = MeshTopology.build(v, f)
    topology_time = time.perf_counter() - start
    start = time.perf_counter()
    s = extract_visible_contours(v, f, camera((.3, .2, 0.)), {"skin": np.arange(len(f))},
                                 topology=topo, spacing_pixels=6.)
    contour_time = time.perf_counter() - start
    start = time.perf_counter()
    for _ in range(100):
        project_native(evaluate_support(v, f, s), camera())
    support_time = (time.perf_counter() - start) / 100
    print({"synthetic_only": True, "vertices": len(v), "triangles": len(f), "samples": len(s),
           "topology_seconds": round(topology_time, 4), "contours_seconds": round(contour_time, 4),
           "fixed_support_ms": round(support_time * 1000, 4)})


if __name__ == "__main__":
    import sys
    if "--benchmark" in sys.argv:
        benchmark()
    else:
        unittest.main()
