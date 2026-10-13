"""Original CPU perspective geometry for the native Z-up face mesh.

Coordinates are native common Z-up. Rendering coordinates are (x, z, -y).
Three.js flat matrices are column-major; pixel coordinates have top-left origin
and use the CSS viewport extent (not width - 1). Perspective silhouette supports
must be rebuilt after an outer fitting update. Only keep supports fixed inside
one local residual/Jacobian evaluation; they are not anatomical landmarks.

No renderer, downloaded implementation, acceleration package or asset is used.
"""

from dataclasses import dataclass
from typing import Mapping, Optional

import numpy as np


def native_to_display(points):
    p = np.asarray(points, dtype=np.float64)
    if p.ndim != 2 or p.shape[1] != 3:
        raise ValueError("points must have shape (N, 3)")
    return p[:, [0, 2, 1]] * np.array([1., 1., -1.])


def display_to_native(points):
    p = np.asarray(points, dtype=np.float64)
    if p.ndim != 2 or p.shape[1] != 3:
        raise ValueError("points must have shape (N, 3)")
    return p[:, [0, 2, 1]] * np.array([1., -1., 1.])


def _matrix(value, name):
    m = np.asarray(value, dtype=np.float64)
    if m.shape == (16,):
        m = m.reshape((4, 4), order="F")
    elif m.shape != (4, 4):
        raise ValueError(name + " must be 16 Three column-major values or a mathematical 4x4 matrix")
    if not np.isfinite(m).all():
        raise ValueError(name + " contains nonfinite values")
    try:
        np.linalg.inv(m)
    except np.linalg.LinAlgError as exc:
        raise ValueError(name + " is singular") from exc
    return m.copy()


@dataclass(frozen=True)
class Camera:
    projection: np.ndarray
    world_inverse: np.ndarray
    width: float
    height: float

    @classmethod
    def from_three(cls, projection_matrix, matrix_world_inverse, width, height):
        projection = _matrix(projection_matrix, "projectionMatrix")
        view = _matrix(matrix_world_inverse, "matrixWorldInverse")
        if not np.isfinite([width, height]).all() or width <= 0 or height <= 0:
            raise ValueError("viewport dimensions must be finite and positive")
        # Three PerspectiveCamera / OpenGL convention. Reject an accidental
        # orthographic matrix instead of silently selecting the wrong contours.
        if not np.allclose(projection[3], [0., 0., -1., 0.], atol=1e-12, rtol=0):
            raise ValueError("expected a Three/OpenGL perspective projection")
        if not np.allclose(view[3], [0., 0., 0., 1.], atol=1e-12, rtol=0):
            raise ValueError("camera world inverse must be affine")
        rotation = view[:3, :3]
        if not np.allclose(rotation @ rotation.T, np.eye(3), atol=1e-7, rtol=0):
            raise ValueError("camera view matrix must have a rigid rotation")
        if np.linalg.det(rotation) <= 0:
            raise ValueError("camera view matrix must preserve orientation")
        return cls(projection, view, float(width), float(height))

    @property
    def position_native(self):
        return display_to_native(np.linalg.inv(self.world_inverse)[None, :3, 3])[0]


@dataclass(frozen=True)
class Projection:
    pixels: np.ndarray
    ndc: np.ndarray
    depth: np.ndarray
    clip_w: np.ndarray
    finite: np.ndarray
    in_front: np.ndarray
    in_view: np.ndarray


def _camera_and_clip(points, camera):
    display = native_to_display(points)
    homogeneous = np.column_stack((display, np.ones(len(display))))
    with np.errstate(invalid="ignore", over="ignore"):
        view = homogeneous @ camera.world_inverse.T
        clip = view @ camera.projection.T
    return view, clip


def project_native(points, camera, depth_epsilon=0.):
    """Project without clamping. in_view includes depth, near/far and viewport.

    Nonfinite inputs, points on the camera plane and arithmetic overflow produce
    invalid masks. A finite projection behind the camera is still in_front=False.
    """
    if not np.isfinite(depth_epsilon) or depth_epsilon < 0:
        raise ValueError("depth_epsilon must be finite and nonnegative")
    view, clip = _camera_and_clip(points, camera)
    w = clip[:, 3]
    finite = np.isfinite(view).all(axis=1) & np.isfinite(clip).all(axis=1) & (w != 0)
    ndc = np.full((len(clip), 3), np.nan)
    with np.errstate(invalid="ignore", divide="ignore", over="ignore"):
        np.divide(clip[:, :3], w[:, None], out=ndc, where=finite[:, None])
    pixels = (ndc[:, :2] * [0.5, -0.5] + 0.5) * [camera.width, camera.height]
    finite &= np.isfinite(ndc).all(axis=1) & np.isfinite(pixels).all(axis=1)
    depth = -view[:, 2]
    front = finite & (depth > depth_epsilon) & (w > 0)
    in_view = front & (np.abs(ndc) <= 1. + 1e-12).all(axis=1)
    return Projection(pixels, ndc, depth, w, finite, front, in_view)


def unproject_native(pixels, depth, camera):
    """Invert pixels using positive camera-axis depth, not Euclidean ray range."""
    pixels = np.asarray(pixels, dtype=np.float64)
    if pixels.ndim != 2 or pixels.shape[1] != 2 or not np.isfinite(pixels).all():
        raise ValueError("pixels must be a finite (N, 2) array")
    depth = np.broadcast_to(np.asarray(depth, dtype=np.float64), (len(pixels),))
    if not np.isfinite(depth).all() or (depth <= 0).any():
        raise ValueError("camera-axis depth must be finite and positive")
    ndc_xy = (pixels / [camera.width, camera.height] - 0.5) * [2., -2.]
    clip = np.column_stack((ndc_xy, -np.ones(len(pixels)), np.ones(len(pixels))))
    view_h = clip @ np.linalg.inv(camera.projection).T
    view = view_h[:, :3] / view_h[:, 3, None]
    view *= (-depth / view[:, 2])[:, None]
    display = np.column_stack((view, np.ones(len(view)))) @ np.linalg.inv(camera.world_inverse).T
    return display_to_native(display[:, :3])


def _mesh_arrays(vertices, faces):
    vertices = np.asarray(vertices, dtype=np.float64)
    raw_faces = np.asarray(faces)
    if vertices.ndim != 2 or vertices.shape[1] != 3 or not len(vertices):
        raise ValueError("vertices must be a nonempty (N, 3) array")
    if not np.isfinite(vertices).all():
        raise ValueError("mesh vertices must be finite")
    if raw_faces.ndim != 2 or raw_faces.shape[1] != 3 or not len(raw_faces):
        raise ValueError("faces must be a nonempty (M, 3) array")
    if raw_faces.dtype.kind not in "iu":
        raise ValueError("faces must contain integer vertex indices")
    if (raw_faces < 0).any() or (raw_faces >= len(vertices)).any():
        raise ValueError("face index outside vertex array")
    faces = raw_faces.astype(np.int64, copy=False)
    sorted_faces = np.sort(faces, axis=1)
    if (np.diff(sorted_faces, axis=1) == 0).any():
        raise ValueError("triangle contains repeated vertex indices")
    tri = vertices[faces]
    e1, e2 = tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]
    norm = np.linalg.norm(np.cross(e1, e2), axis=1)
    area_scale = np.linalg.norm(e1, axis=1) * np.linalg.norm(e2, axis=1)
    if (norm <= area_scale * 1e-14).any():
        raise ValueError("mesh contains zero-area or numerically degenerate triangles")
    return vertices, faces


@dataclass(frozen=True)
class MeshTopology:
    """Reusable immutable adjacency; geometry/facing is always recomputed."""
    faces: np.ndarray
    vertex_count: int
    edge_vertices: np.ndarray
    edge_faces: np.ndarray

    @classmethod
    def build(cls, vertices, faces):
        vertices, faces = _mesh_arrays(vertices, faces)
        if len(np.unique(np.sort(faces, axis=1), axis=0)) != len(faces):
            raise ValueError("mesh contains duplicate triangles")
        directed = np.stack((faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]), axis=1).reshape(-1, 2)
        owner = np.repeat(np.arange(len(faces)), 3)
        edges = np.sort(directed, axis=1)
        unique, inverse, counts = np.unique(edges, axis=0, return_inverse=True, return_counts=True)
        if (counts > 2).any():
            raise ValueError("nonmanifold edge has more than two incident triangles")
        order = np.argsort(inverse, kind="stable")
        starts = np.r_[0, np.cumsum(counts)[:-1]]
        adjacent = np.full((len(unique), 2), -1, dtype=np.int64)
        adjacent[:, 0] = owner[order[starts]]
        both = counts == 2
        adjacent[both, 1] = owner[order[starts[both] + 1]]
        a = directed[order[starts[both]]]
        b = directed[order[starts[both] + 1]]
        if (a == b).all(axis=1).any():
            raise ValueError("adjacent triangles have inconsistent winding")
        return cls(faces.copy(), len(vertices), unique, adjacent)


def _face_selection(value, count, label):
    value = np.asarray(value)
    if value.dtype.kind == "b":
        if value.shape != (count,):
            raise ValueError("region " + str(label) + " mask must have one entry per face")
        return value.copy()
    if value.size == 0:
        return np.zeros(count, dtype=bool)
    if value.ndim != 1 or value.dtype.kind not in "iu" or (value < 0).any() or (value >= count).any():
        raise ValueError("region " + str(label) + " must contain valid native face IDs")
    result = np.zeros(count, dtype=bool)
    result[value] = True
    return result


def perspective_face_facing(vertices, faces, camera):
    """Signed cosine of outward normal against the surface-to-camera direction."""
    tri = np.asarray(vertices, dtype=float)[faces]
    normal = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    to_camera = camera.position_native - tri.mean(axis=1)
    divisor = np.linalg.norm(normal, axis=1) * np.linalg.norm(to_camera, axis=1)
    return np.divide(np.einsum("ij,ij->i", normal, to_camera), divisor,
                     out=np.zeros(len(tri)), where=divisor > 0)


@dataclass(frozen=True)
class ContourSamples:
    triangle_ids: np.ndarray
    edge_vertex_ids: np.ndarray
    barycentric: np.ndarray
    native_points: np.ndarray
    pixels: np.ndarray
    depth: np.ndarray
    regions: np.ndarray
    kinds: np.ndarray  # silhouette, open_boundary, semantic

    def __len__(self):
        return len(self.triangle_ids)

    def take(self, selection):
        return ContourSamples(*(getattr(self, key)[selection] for key in self.__dataclass_fields__))


def _empty_samples():
    return ContourSamples(np.empty(0, dtype=np.int64), np.empty((0, 2), dtype=np.int64),
                          np.empty((0, 3)), np.empty((0, 3)), np.empty((0, 2)),
                          np.empty(0), np.empty(0, dtype=object), np.empty(0, dtype=object))


def _clip_edges(clip_a, clip_b):
    """Clip homogeneous line segments to the complete OpenGL view frustum."""
    t0 = np.zeros(len(clip_a))
    t1 = np.ones(len(clip_a))
    valid = np.isfinite(clip_a).all(axis=1) & np.isfinite(clip_b).all(axis=1)
    for axis in range(3):
        for sign in (-1., 1.):
            a = clip_a[:, 3] + sign * clip_a[:, axis]
            b = clip_b[:, 3] + sign * clip_b[:, axis]
            outside_a, outside_b = a < 0, b < 0
            valid &= ~(outside_a & outside_b)
            crossing = outside_a != outside_b
            t = np.divide(a, a - b, out=np.zeros_like(a), where=crossing)
            t0 = np.where(outside_a & crossing, np.maximum(t0, t), t0)
            t1 = np.where(outside_b & crossing, np.minimum(t1, t), t1)
    valid &= t1 > t0
    return t0, t1, valid


def surface_visible(vertices, faces, camera, points, exclude_faces=None,
                    epsilon=None, ray_chunk=32, face_chunk=2048):
    """Double-sided segment rays against the complete native mesh.

    The conservative screen bbox filter is exact for triangles fully in front
    of the camera. Triangles crossing the camera plane bypass that filter.
    Incident edge triangles and endpoint-scale roundoff cannot self-occlude.
    Work is O(samples * faces) cheap bbox checks, with chunk-bounded memory and
    exact Moller-Trumbore tests only for plausible ray/triangle pairs.
    """
    vertices = np.asarray(vertices, dtype=float)
    faces = np.asarray(faces, dtype=np.int64)
    points = np.asarray(points, dtype=float)
    if points.ndim != 2 or points.shape[1] != 3:
        raise ValueError("points must have shape (N, 3)")
    if ray_chunk <= 0 or face_chunk <= 0:
        raise ValueError("ray and face chunks must be positive")
    exclude = np.full((len(points), 0), -1, dtype=np.int64) if exclude_faces is None else np.asarray(exclude_faces)
    if exclude.ndim != 2 or len(exclude) != len(points) or exclude.dtype.kind not in "iu":
        raise ValueError("exclude_faces must be an integer (samples, K) array")
    origin = camera.position_native
    ray = points - origin
    distance = np.linalg.norm(ray, axis=1)
    scale = np.linalg.norm(np.ptp(vertices, axis=0))
    numerical = 64 * np.finfo(float).eps * max(np.max(np.abs(vertices)), np.max(np.abs(origin)), scale)
    eps = max(scale * 1e-7, numerical) if epsilon is None else float(epsilon)
    if not np.isfinite(eps) or eps <= 0:
        raise ValueError("visibility epsilon must be finite and positive")
    valid = np.isfinite(points).all(axis=1) & np.isfinite(distance) & (distance > eps)
    directions = np.divide(ray, distance[:, None], out=np.zeros_like(ray), where=valid[:, None])
    projected = project_native(points, camera)
    valid &= projected.in_front
    visible = valid.copy()
    vp = project_native(vertices, camera)
    tri = vertices[faces]
    e1 = tri[:, 1] - tri[:, 0]
    e2 = tri[:, 2] - tri[:, 0]
    tri_depth = vp.depth[faces]
    all_behind = (tri_depth <= 0).all(axis=1)
    projected_ok = (tri_depth > 0).all(axis=1) & vp.finite[faces].all(axis=1)
    with np.errstate(invalid="ignore"):
        lower = np.min(vp.pixels[faces], axis=1)
        upper = np.max(vp.pixels[faces], axis=1)
    screen_eps = 1e-9 * max(camera.width, camera.height)
    for r0 in range(0, len(points), ray_chunk):
        ridx = np.arange(r0, min(r0 + ray_chunk, len(points)))
        if not visible[ridx].any():
            continue
        for f0 in range(0, len(faces), face_chunk):
            active = ridx[visible[ridx]]
            if not len(active):
                break
            fids = np.arange(f0, min(f0 + face_chunk, len(faces)))
            pix = projected.pixels[active]
            bbox = ((pix[:, None, :] >= lower[fids] - screen_eps) &
                    (pix[:, None, :] <= upper[fids] + screen_eps)).all(axis=2)
            candidate = (bbox | ~projected_ok[fids]) & ~all_behind[fids]
            rr, ff = np.nonzero(candidate)
            if not len(rr):
                continue
            rr, ff = active[rr], fids[ff]
            if exclude.shape[1]:
                keep = ~(exclude[rr] == ff[:, None]).any(axis=1)
                rr, ff = rr[keep], ff[keep]
            if not len(rr):
                continue
            direction = directions[rr]
            h = np.cross(direction, e2[ff])
            det = np.einsum("ij,ij->i", e1[ff], h)
            det_tol = 1e-13 * np.linalg.norm(e1[ff], axis=1) * np.linalg.norm(e2[ff], axis=1)
            nonparallel = np.abs(det) > det_tol
            inv_det = np.divide(1., det, out=np.zeros_like(det), where=nonparallel)
            s = origin - tri[ff, 0]
            u = np.einsum("ij,ij->i", s, h) * inv_det
            q = np.cross(s, e1[ff])
            v = np.einsum("ij,ij->i", direction, q) * inv_det
            t = np.einsum("ij,ij->i", e2[ff], q) * inv_det
            hit = (nonparallel & (u >= -1e-10) & (v >= -1e-10) &
                   (u + v <= 1. + 1e-10) & (t > eps) & (t < distance[rr] - eps))
            visible[rr[hit]] = False
    return visible


def extract_visible_contours(vertices, faces, camera, region_triangles: Mapping,
                             *, topology: Optional[MeshTopology] = None,
                             semantic_edges_by_region: Optional[Mapping] = None,
                             spacing_pixels=6., include_open_boundaries=True,
                             max_samples_per_edge=256, visibility_epsilon=None,
                             ray_chunk=32, face_chunk=2048):
    """Refresh actual perspective contour supports for each explicit region.

    region_triangles maps region names to native face IDs or face masks. It only
    gates a genuine full-mesh front/back adjacency; a semantic selection seam
    never becomes a silhouette. Hair/ears/untrusted regions are caller choices.
    Explicit semantic edges (eye/lip etc.) must be real mesh edges and have an
    incident front-facing face in the same region. They are independently tagged
    semantic; open physical mesh boundaries are tagged open_boundary.

    Edge midpoint bins avoid unstable vertex junction self-intersections. The
    points are uniformly spaced in screen space with perspective-correct edge
    barycentrics. All emitted samples pass full-mesh visibility and clipping.
    """
    vertices, faces = _mesh_arrays(vertices, faces)
    if topology is None:
        topology = MeshTopology.build(vertices, faces)
    elif topology.vertex_count != len(vertices) or not np.array_equal(topology.faces, faces):
        raise ValueError("cached topology does not match the mesh")
    if not np.isfinite(spacing_pixels) or spacing_pixels <= 0 or max_samples_per_edge < 1:
        raise ValueError("spacing and sample budget must be positive")
    regions = {label: _face_selection(ids, len(faces), label) for label, ids in region_triangles.items()}
    semantic = {} if semantic_edges_by_region is None else semantic_edges_by_region
    unknown = set(semantic) - set(regions)
    if unknown:
        raise ValueError("semantic edges require a matching region_triangles entry: " + str(unknown))
    front = perspective_face_facing(vertices, faces, camera) > 1e-10
    adjacent = topology.edge_faces
    f0 = front[adjacent[:, 0]]
    f1 = (adjacent[:, 1] >= 0) & front[np.maximum(adjacent[:, 1], 0)]
    is_open = adjacent[:, 1] < 0
    actual = f0 != f1
    if not include_open_boundaries:
        actual &= ~is_open
    owners = np.where(f0, adjacent[:, 0], adjacent[:, 1])
    lookup = None
    all_samples, all_excludes = [], []
    for label, selected in regions.items():
        candidate = np.flatnonzero(actual & selected[np.maximum(owners, 0)])
        kinds = np.where(is_open[candidate], "open_boundary", "silhouette").astype(object)
        selected_owners = owners[candidate]
        if label in semantic:
            supplied = np.asarray(semantic[label])
            if supplied.size:
                if supplied.ndim != 2 or supplied.shape[1] != 2 or supplied.dtype.kind not in "iu":
                    raise ValueError("semantic edges must be integer native vertex pairs")
                if lookup is None:
                    lookup = {tuple(edge): i for i, edge in enumerate(topology.edge_vertices)}
                try:
                    sem_ids = np.unique([lookup[tuple(sorted(edge))] for edge in supplied])
                except KeyError as exc:
                    raise ValueError("semantic edge is not a native mesh edge") from exc
                sem_owner = np.full(len(sem_ids), -1, dtype=np.int64)
                for side in (1, 0):
                    face_ids = adjacent[sem_ids, side]
                    allowed = (face_ids >= 0) & front[np.maximum(face_ids, 0)] & selected[np.maximum(face_ids, 0)]
                    sem_owner[allowed] = face_ids[allowed]
                keep = sem_owner >= 0
                # Explicit semantics take precedence over automatic contour tags.
                retain = ~np.isin(candidate, sem_ids[keep])
                candidate = np.r_[candidate[retain], sem_ids[keep]]
                selected_owners = np.r_[selected_owners[retain], sem_owner[keep]]
                kinds = np.r_[kinds[retain], np.full(keep.sum(), "semantic", dtype=object)]
        if not len(candidate):
            continue
        edges = topology.edge_vertices[candidate]
        a, b = vertices[edges[:, 0]], vertices[edges[:, 1]]
        _, ca = _camera_and_clip(a, camera)
        _, cb = _camera_and_clip(b, camera)
        t0, t1, valid = _clip_edges(ca, cb)
        clip0 = ca + t0[:, None] * (cb - ca)
        clip1 = ca + t1[:, None] * (cb - ca)
        valid &= (clip0[:, 3] > 0) & (clip1[:, 3] > 0)
        ids = np.flatnonzero(valid)
        if not len(ids):
            continue
        w0, w1 = clip0[ids, 3], clip1[ids, 3]
        p0 = (clip0[ids, :2] / w0[:, None] * [0.5, -0.5] + 0.5) * [camera.width, camera.height]
        p1 = (clip1[ids, :2] / w1[:, None] * [0.5, -0.5] + 0.5) * [camera.width, camera.height]
        count = np.clip(np.ceil(np.linalg.norm(p1 - p0, axis=1) / spacing_pixels), 1, max_samples_per_edge).astype(int)
        repeats = np.repeat(np.arange(len(ids)), count)
        chosen = ids[repeats]
        u = np.concatenate([(np.arange(n) + 0.5) / n for n in count])
        alpha = (1. - u) / w0[repeats]
        beta = u / w1[repeats]
        t = (alpha * t0[chosen] + beta * t1[chosen]) / (alpha + beta)
        native_points = a[chosen] + t[:, None] * (b[chosen] - a[chosen])
        sample_edges = edges[chosen]
        sample_triangles = selected_owners[chosen]
        bary = np.zeros((len(chosen), 3))
        owner_vertices = faces[sample_triangles]
        bary += (owner_vertices == sample_edges[:, 0, None]) * (1. - t[:, None])
        bary += (owner_vertices == sample_edges[:, 1, None]) * t[:, None]
        projection = project_native(native_points, camera)
        all_samples.append(ContourSamples(sample_triangles, sample_edges, bary, native_points,
                                          projection.pixels, projection.depth,
                                          np.full(len(chosen), label, dtype=object), kinds[chosen]))
        all_excludes.append(adjacent[candidate[chosen]])
    if not all_samples:
        return _empty_samples()
    samples = ContourSamples(*(np.concatenate([getattr(s, key) for s in all_samples])
                               for key in ContourSamples.__dataclass_fields__))
    visible = surface_visible(vertices, faces, camera, samples.native_points,
                              np.concatenate(all_excludes), epsilon=visibility_epsilon,
                              ray_chunk=ray_chunk, face_chunk=face_chunk)
    visible &= project_native(samples.native_points, camera).in_view
    return samples.take(visible)


def evaluate_support(vertices, faces, samples):
    """Cheap fixed-support evaluation for one inner residual/Jacobian step."""
    triangles = np.asarray(vertices, dtype=float)[np.asarray(faces)[samples.triangle_ids]]
    return np.einsum("ni,nij->nj", samples.barycentric, triangles)


@dataclass(frozen=True)
class RegionMatches:
    sample_indices: np.ndarray
    target_indices: np.ndarray  # indices inside each target region array
    target_pixels: np.ndarray
    distances: np.ndarray
    regions: np.ndarray

    def __len__(self):
        return len(self.sample_indices)


def match_same_region(samples, targets_by_region, *, max_distance_pixels=np.inf,
                      direction="target_to_contour", chunk_size=256):
    """Nearest visible samples with strict region identity and optional gating.

    No unknown-region fallback is allowed. Targets are finite Nx2 arrays. A cheek
    target cannot attach to an eyeball/lip sample, even if geometrically closer.
    target_to_contour is the default so each observed target contributes once;
    contour_to_target can be requested for a complementary coverage term.
    """
    if direction not in ("target_to_contour", "contour_to_target"):
        raise ValueError("unknown matching direction")
    if np.isnan(max_distance_pixels) or max_distance_pixels < 0 or chunk_size < 1:
        raise ValueError("invalid distance gate or chunk size")
    fields = [[] for _ in range(5)]
    for region, target in targets_by_region.items():
        target = np.asarray(target, dtype=float)
        if target.size == 0:
            continue
        if target.ndim != 2 or target.shape[1] != 2 or not np.isfinite(target).all():
            raise ValueError("region targets must be finite (N, 2) pixel arrays")
        source_ids = np.flatnonzero(samples.regions == region)
        if not len(source_ids):
            continue
        source = samples.pixels[source_ids]
        query, reference = (target, source) if direction == "target_to_contour" else (source, target)
        for start in range(0, len(query), chunk_size):
            qids = np.arange(start, min(start + chunk_size, len(query)))
            squared = np.sum((query[qids, None, :] - reference[None, :, :]) ** 2, axis=2)
            nearest = squared.argmin(axis=1)
            distance = np.sqrt(squared[np.arange(len(qids)), nearest])
            keep = distance <= max_distance_pixels
            src, dst = (nearest, qids) if direction == "target_to_contour" else (qids, nearest)
            fields[0].append(source_ids[src[keep]])
            fields[1].append(dst[keep])
            fields[2].append(target[dst[keep]])
            fields[3].append(distance[keep])
            fields[4].append(np.full(keep.sum(), region, dtype=object))
    if not fields[0]:
        return RegionMatches(np.empty(0, dtype=np.int64), np.empty(0, dtype=np.int64),
                             np.empty((0, 2)), np.empty(0), np.empty(0, dtype=object))
    return RegionMatches(*(np.concatenate(field) for field in fields))
