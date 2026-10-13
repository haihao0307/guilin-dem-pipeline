"""Bounded, local CPU proposals for shared identity and per-view expression/camera.

This is an ORIGINAL linear geometry proxy, not the native model's true forward.
A successful optimizer ALWAYS returns ``requires_true_forward``. Only an external
native-engine receipt, bound to the proposal and model hashes, can commit a step.

All coordinates stay in native metres until perspective projection. Observed
pixels and their sigma are fixed; no candidate-dependent eye-distance scaling.
Holdout views never enter the fit, priors, correspondence refresh, or selection.
"""
from dataclasses import dataclass, field, replace
from hashlib import sha256
from typing import Mapping, Optional
import json

import numpy as np
from scipy.optimize import least_squares
from scipy.spatial.transform import Rotation

from geometry import (Camera, MeshTopology, native_to_display, project_native,
                      extract_visible_contours, match_same_region)


@dataclass(frozen=True)
class Landmarks:
    triangle_vertex_ids: np.ndarray
    barycentric: np.ndarray
    target_pixels: np.ndarray
    sigma_pixels: object = 1.0
    regions: object = "landmark"


@dataclass(frozen=True)
class CurveTargets:
    target_pixels: np.ndarray
    sigma_pixels: object = 1.0


@dataclass(frozen=True)
class ViewModel:
    view_id: str
    base_positions: np.ndarray
    shape_jacobian: np.ndarray       # D x N x 3, common native-neutral response
    expression_jacobian: np.ndarray  # K x N x 3, this state's native response
    expression_center: np.ndarray
    expression_bounds: np.ndarray   # K x 2 ABSOLUTE native expression bounds
    camera: Camera
    landmarks: Optional[Landmarks] = None
    curves: Mapping = field(default_factory=dict)  # region -> CurveTargets
    region_triangles: Mapping = field(default_factory=dict)
    semantic_edges_by_region: Mapping = field(default_factory=dict)
    holdout: bool = False


@dataclass(frozen=True)
class SolverConfig:
    shape_bounds: object = (-0.15, 0.15)  # scalar pair, or D x 2; delta from anchor
    shape_prior_sigma: object = 0.10
    expression_prior_sigma: object = 0.20
    camera_delta_limits: object = (0.12, 0.12, 0.12, 0.025, 0.025, 0.04, 0.10)
    camera_prior_sigma: object = (0.05, 0.05, 0.05, 0.015, 0.015, 0.025, 0.05)
    shape_regularization: float = 0.01
    expression_regularization: float = 0.01
    camera_regularization: float = 0.01
    region_weights: Mapping = field(default_factory=dict)
    robust_scale: Optional[float] = 2.0  # soft-L1 on sigma-normalized data ONLY
    outer_iterations: int = 3
    max_nfev: int = 120
    contour_spacing_pixels: float = 6.0
    correspondence_gate_pixels: float = 100.0
    depth_epsilon: float = 1e-6
    predicted_mesh_displacement_cap_m: float = 0.0015
    mesh_trust_scope: str = "identity"  # identity (default) or combined
    trust_vertex_ids: object = None  # optional native skin vertex subset
    true_forward_max_vertex_rmse_m: float = 0.002
    true_forward_max_vertex_error_m: float = 0.00025
    true_forward_max_proxy_pixel_rmse: float = 2.0
    true_forward_max_normalized_rms: float = 5.0
    true_forward_max_error_ratio: float = 1.02
    true_forward_error_slack: float = 1e-6


@dataclass(frozen=True)
class Parameters:
    shape: np.ndarray
    expression_delta: Mapping
    camera_delta: Mapping


@dataclass(frozen=True)
class Proposal:
    proposal_hash: str
    model_fingerprint: str
    path: str
    parameters: Parameters
    training_view_ids: tuple
    holdout_view_ids: tuple
    proxy_metrics: Mapping
    optimizer_reports: tuple
    status: str = "requires_true_forward"
    forward_kind: str = "local_linear_geometry_proxy"


@dataclass(frozen=True)
class TrueForwardReceipt:
    proposal_hash: str
    engine_id: str
    model_hash: str
    vertices_by_view: Mapping
    vertices_sha256: Mapping
    camera_sha256: Mapping
    source: str = "native_engine_true_forward"


@dataclass(frozen=True)
class CommitResult:
    status: str
    reason: str
    proposal: Proposal
    metrics: Mapping = field(default_factory=dict)


def array_sha256(value):
    """Canonical float64 array hash for a native-engine receipt."""
    a = np.ascontiguousarray(value, dtype="<f8")
    return sha256(str(a.shape).encode() + a.tobytes()).hexdigest()


def camera_sha256(camera):
    return sha256((array_sha256(camera.projection) + array_sha256(camera.world_inverse)
                   + array_sha256([camera.width, camera.height])).encode()).hexdigest()


def _finite(value, shape, name):
    a = np.asarray(value, dtype=float)
    if a.shape != shape or not np.isfinite(a).all():
        raise ValueError(f"{name} must be finite with shape {shape}")
    return a.copy()


def _positive(value, shape, name):
    try:
        a = np.broadcast_to(np.asarray(value, dtype=float), shape).copy()
    except ValueError as exc:
        raise ValueError(f"{name} cannot broadcast to {shape}") from exc
    if not np.isfinite(a).all() or (a <= 0).any():
        raise ValueError(f"{name} must be finite and positive")
    return a


def _sigma(value, n):
    a = np.asarray(value, dtype=float)
    if a.shape == (n,):
        a = a[:, None]
    return _positive(a, (n, 2), "sigma_pixels")


def _targets(value):
    a = np.asarray(value, dtype=float)
    if a.ndim != 2 or a.shape[1] != 2 or not len(a) or not np.isfinite(a).all():
        raise ValueError("target_pixels must be a nonempty finite (M, 2) array")
    return a.copy()


def _copy_parameters(p):
    return Parameters(p.shape.copy(), {k: v.copy() for k, v in p.expression_delta.items()},
                      {k: v.copy() for k, v in p.camera_delta.items()})


def adjusted_camera(camera, delta, face_center_native):
    """Camera-axis rotvec about a common native centre, metres, then log focal.

    Delta order is rx, ry, rz [radians], tx, ty, tz [metres], log(f/f0).
    Projection's principal-point and all other entries remain exactly fixed.
    """
    d = _finite(delta, (7,), "camera delta")
    center = _finite(face_center_native, (3,), "face center")
    c = camera.world_inverse @ np.r_[native_to_display(center[None])[0], 1.0]
    r = Rotation.from_rotvec(d[:3]).as_matrix()
    transform = np.eye(4)
    transform[:3, :3] = r
    transform[:3, 3] = c[:3] + d[3:6] - r @ c[:3]
    projection = camera.projection.copy()
    projection[0, 0] *= np.exp(d[6])
    projection[1, 1] *= np.exp(d[6])
    return Camera.from_three(projection, transform @ camera.world_inverse,
                             camera.width, camera.height)


@dataclass
class _Support:
    view: ViewModel
    vertices: np.ndarray
    barycentric: np.ndarray
    target: np.ndarray
    sigma: np.ndarray
    regions: np.ndarray
    base: np.ndarray
    shape: np.ndarray  # M x 3 x D
    expression: np.ndarray  # M x 3 x K
    weights: np.ndarray


class JointSolver:
    """One anchor and one bounded local region; no external model is executed.

    ``native_model_hash`` is the expected hash of the native engine/model asset,
    not this proxy's hash. A receipt authenticates byte binding, NOT provenance;
    callers must only supply receipts obtained from their trusted native runner.
    """
    def __init__(self, views, faces, face_center_native, *, config=None,
                 native_engine_id=None, native_model_hash=None):
        self.config = config or SolverConfig()
        self.face_center_native = _finite(face_center_native, (3,), "face center")
        self.native_engine_id = native_engine_id
        self.native_model_hash = native_model_hash
        self.views = tuple(views)
        if not self.views or len({v.view_id for v in self.views}) != len(self.views):
            raise ValueError("views must be nonempty with unique IDs")
        if any(not isinstance(v.view_id, str) or not v.view_id for v in self.views):
            raise ValueError("view_id must be a nonempty string")
        first = self.views[0]
        if np.asarray(first.base_positions).ndim != 2 or np.asarray(first.base_positions).shape[1] != 3:
            raise ValueError("base_positions must be N x 3")
        self.n = len(first.base_positions)
        j = np.asarray(first.shape_jacobian)
        if j.ndim != 3 or j.shape[1:] != (self.n, 3) or not j.shape[0]:
            raise ValueError("shape_jacobian must be D x N x 3")
        self.d = len(j)
        shared_shape = _finite(j, (self.d, self.n, 3), "shape_jacobian")
        shared_shape.flags.writeable = False
        self.topology = MeshTopology.build(first.base_positions, faces)
        self.faces = self.topology.faces.copy()
        self._face_set = {tuple(sorted(f)) for f in self.faces}
        normalized = []
        for v in self.views:
            base = _finite(v.base_positions, (self.n, 3), "base_positions")
            supplied_shape = np.asarray(v.shape_jacobian, dtype=float)
            if supplied_shape.shape != shared_shape.shape or not np.array_equal(supplied_shape, shared_shape):
                raise ValueError("all views must share the same native-neutral shape Jacobian")
            shape = shared_shape
            expr = np.asarray(v.expression_jacobian, dtype=float)
            if expr.ndim != 3 or expr.shape[1:] != (self.n, 3):
                raise ValueError("expression_jacobian must be K x N x 3")
            expr = _finite(expr, expr.shape, "expression_jacobian")
            center = _finite(v.expression_center, (len(expr),), "expression_center")
            bounds = _finite(v.expression_bounds, (len(expr), 2), "expression_bounds")
            if (bounds[:, 0] >= bounds[:, 1]).any() or (center < bounds[:, 0]).any() or (center > bounds[:, 1]).any():
                raise ValueError("expression_center must lie within ordered absolute bounds")
            cam = Camera.from_three(v.camera.projection, v.camera.world_inverse, v.camera.width, v.camera.height)
            lm = self._normalize_landmarks(v.landmarks)
            curves = {region: CurveTargets(_targets(c.target_pixels), _sigma(c.sigma_pixels, len(c.target_pixels)))
                      for region, c in v.curves.items()}
            unknown = set(curves) - set(v.region_triangles)
            if unknown:
                raise ValueError(f"curve regions lack same-region triangle selection: {unknown}")
            regions = {}
            for name, ids in v.region_triangles.items():
                ids = np.asarray(ids)
                if ids.dtype.kind == "b" and ids.shape == (len(self.faces),):
                    ids = np.flatnonzero(ids)
                if ids.ndim != 1 or ids.dtype.kind not in "iu" or (ids < 0).any() or (ids >= len(self.faces)).any():
                    raise ValueError("region_triangles must contain native triangle IDs")
                if name in curves and not len(ids):
                    raise ValueError("observed curve region has no triangles")
                regions[name] = ids.astype(int).copy()
            semantic = {name: np.asarray(ids).copy() for name, ids in v.semantic_edges_by_region.items()}
            normalized.append(replace(v, base_positions=base, shape_jacobian=shape,
                                      expression_jacobian=expr, expression_center=center,
                                      expression_bounds=bounds, camera=cam, landmarks=lm,
                                      curves=curves, region_triangles=regions,
                                      semantic_edges_by_region=semantic))
        self.views = tuple(normalized)
        self.training_views = tuple(v for v in self.views if not v.holdout)
        self.holdout_views = tuple(v for v in self.views if v.holdout)
        if not self.training_views:
            raise ValueError("at least one training view is required")
        if any(v.landmarks is None and not v.curves for v in self.training_views):
            raise ValueError("each training view needs observations")
        self._validate_config()
        self._accepted = Parameters(np.zeros(self.d),
                                    {v.view_id: np.zeros(len(v.expression_center)) for v in self.views},
                                    {v.view_id: np.zeros(7) for v in self.views})
        self._accepted_vertices = {v.view_id: v.base_positions.copy() for v in self.views}
        # Fingerprint includes observations, split and configuration, so receipts
        # cannot be replayed across cameras, targets, priors, or a different split.
        parts = [array_sha256(self.faces), array_sha256(self.face_center_native), repr(self.config),
                 str(native_engine_id), str(native_model_hash)]
        shared_shape_hash = array_sha256(shared_shape)
        for v in self.views:
            parts += [v.view_id, str(v.holdout), camera_sha256(v.camera), shared_shape_hash]
            parts += [array_sha256(a) for a in (v.base_positions,
                       v.expression_jacobian, v.expression_center, v.expression_bounds)]
            if v.landmarks:
                l = v.landmarks
                parts += [array_sha256(a) for a in (l.triangle_vertex_ids, l.barycentric,
                          l.target_pixels, l.sigma_pixels)] + [json.dumps(l.regions.tolist())]
            for name in sorted(v.curves):
                parts += [name, array_sha256(v.curves[name].target_pixels),
                          array_sha256(v.curves[name].sigma_pixels), array_sha256(v.region_triangles[name])]
            for name in sorted(v.semantic_edges_by_region):
                parts += [name, array_sha256(v.semantic_edges_by_region[name])]
        self.model_fingerprint = sha256("|".join(parts).encode()).hexdigest()
        # Detect a wrong-facing/behind-camera anchor before any numerical fit.
        for v in self.training_views:
            self._refresh_support(v, self._accepted)

    def _normalize_landmarks(self, lm):
        if lm is None:
            return None
        target = _targets(lm.target_pixels)
        ids = np.asarray(lm.triangle_vertex_ids)
        if ids.shape != (len(target), 3) or ids.dtype.kind not in "iu":
            raise ValueError("landmark triangle vertices must be integer (M, 3)")
        if any(tuple(sorted(row)) not in self._face_set for row in ids):
            raise ValueError("landmark support is not a native mesh triangle")
        bary = _finite(lm.barycentric, (len(target), 3), "landmark barycentric")
        if (bary < 0).any() or (bary > 1).any() or not np.allclose(bary.sum(axis=1), 1., atol=1e-10):
            raise ValueError("landmark barycentric weights must form convex unit sums")
        regions = np.broadcast_to(np.asarray(lm.regions, dtype=object), (len(target),)).copy()
        if any(not isinstance(r, str) or not r for r in regions):
            raise ValueError("landmark regions must be nonempty names")
        return Landmarks(ids.astype(int).copy(), bary, target, _sigma(lm.sigma_pixels, len(target)), regions)

    def _validate_config(self):
        c = self.config
        b = np.asarray(c.shape_bounds, dtype=float)
        if b.shape == (2,):
            b = np.tile(b, (self.d, 1))
        self.shape_bounds = _finite(b, (self.d, 2), "shape_bounds")
        if (b[:, 0] >= b[:, 1]).any() or (b[:, 0] > 0).any() or (b[:, 1] < 0).any():
            raise ValueError("shape bounds must be ordered and include the anchor (zero)")
        self.shape_prior = _positive(c.shape_prior_sigma, (self.d,), "shape prior sigma")
        self.camera_limits = _positive(c.camera_delta_limits, (7,), "camera delta limits")
        self.camera_prior = _positive(c.camera_prior_sigma, (7,), "camera prior sigma")
        for v in self.views:
            _positive(c.expression_prior_sigma, (len(v.expression_center),), "expression prior sigma")
        values = [c.shape_regularization, c.expression_regularization, c.camera_regularization,
                  c.true_forward_error_slack]
        if not np.isfinite(values).all() or min(values) < 0:
            raise ValueError("regularization and error slack must be finite and nonnegative")
        positive = [c.contour_spacing_pixels, c.correspondence_gate_pixels, c.depth_epsilon,
                    c.predicted_mesh_displacement_cap_m,
                    c.true_forward_max_vertex_rmse_m, c.true_forward_max_vertex_error_m, c.true_forward_max_proxy_pixel_rmse,
                    c.true_forward_max_normalized_rms, c.true_forward_max_error_ratio]
        if not np.isfinite(positive).all() or min(positive) <= 0:
            raise ValueError("solver and receipt gates must be finite and positive")
        if c.robust_scale is not None and (not np.isfinite(c.robust_scale) or c.robust_scale <= 0):
            raise ValueError("robust_scale must be positive, or None")
        if c.mesh_trust_scope not in ("identity", "combined"):
            raise ValueError("mesh_trust_scope must be identity or combined")
        if c.trust_vertex_ids is None:
            self.trust_vertex_ids = np.arange(self.n)
        else:
            ids = np.asarray(c.trust_vertex_ids)
            if ids.ndim != 1 or not len(ids) or ids.dtype.kind not in "iu" or (ids < 0).any() or (ids >= self.n).any():
                raise ValueError("trust_vertex_ids must be a nonempty native vertex subset")
            self.trust_vertex_ids = np.unique(ids)
        if c.outer_iterations < 1 or c.max_nfev < 1:
            raise ValueError("iteration budgets must be positive")
        if any(not np.isfinite(w) or w <= 0 for w in c.region_weights.values()):
            raise ValueError("region weights must be finite and positive")

    @property
    def accepted_parameters(self):
        return _copy_parameters(self._accepted)

    def proxy_vertices(self, parameters, view_id):
        v = next(v for v in self.views if v.view_id == view_id)
        return (v.base_positions + np.einsum("d,dnc->nc", parameters.shape, v.shape_jacobian)
                + np.einsum("k,knc->nc", parameters.expression_delta[view_id], v.expression_jacobian))

    def proposal_cameras(self, proposal):
        self._check_proposal(proposal)
        return {v.view_id: adjusted_camera(v.camera, proposal.parameters.camera_delta[v.view_id],
                                          self.face_center_native) for v in self.views}

    def _refresh_support(self, v, p, vertices=None):
        vertices = self.proxy_vertices(p, v.view_id) if vertices is None else vertices
        cam = adjusted_camera(v.camera, p.camera_delta[v.view_id], self.face_center_native)
        ids, bary, target, sigmas, labels = [], [], [], [], []
        if v.landmarks is not None:
            l = v.landmarks
            ids.append(l.triangle_vertex_ids); bary.append(l.barycentric)
            target.append(l.target_pixels); sigmas.append(l.sigma_pixels); labels.append(l.regions)
        if v.curves:
            samples = extract_visible_contours(vertices, self.faces, cam, v.region_triangles,
                       topology=self.topology, semantic_edges_by_region=v.semantic_edges_by_region,
                       spacing_pixels=self.config.contour_spacing_pixels)
            matches = match_same_region(samples, {r: c.target_pixels for r, c in v.curves.items()},
                                       max_distance_pixels=self.config.correspondence_gate_pixels)
            expected = sum(len(c.target_pixels) for c in v.curves.values())
            if len(matches) != expected:
                raise ValueError(f"{v.view_id}: missing visible same-region curve correspondence")
            chosen = samples.take(matches.sample_indices)
            ids.append(self.faces[chosen.triangle_ids]); bary.append(chosen.barycentric)
            target.append(matches.target_pixels); labels.append(matches.regions)
            sigmas.append(np.asarray([v.curves[r].sigma_pixels[i]
                                      for r, i in zip(matches.regions, matches.target_indices)]))
        if not ids:
            return None
        ids, bary = np.concatenate(ids), np.concatenate(bary)
        targets, sigma, regions = np.concatenate(target), np.concatenate(sigmas), np.concatenate(labels)
        points = np.einsum("mi,mic->mc", bary, vertices[ids])
        if not project_native(points, cam, self.config.depth_epsilon).in_front.all():
            raise ValueError(f"{v.view_id}: observation support is not in front of the perspective camera")
        base = np.einsum("mi,mic->mc", bary, v.base_positions[ids])
        shape = np.einsum("mi,dmic->mcd", bary, v.shape_jacobian[:, ids])
        expr = np.einsum("mi,kmic->mck", bary, v.expression_jacobian[:, ids])
        unique, counts = np.unique(regions, return_counts=True)
        weights = np.empty(len(regions))
        # A region contributes its mean loss, irrespective of how many samples
        # it contains. Landmark and contour points of the same region share it.
        total_weight = sum(self.config.region_weights.get(r, 1.) for r in unique)
        for region, count in zip(unique, counts):
            weights[regions == region] = np.sqrt(self.config.region_weights.get(region, 1.) / count / total_weight)
        return _Support(v, ids, bary, targets, sigma, regions, base, shape, expr, weights)

    def _layout(self, path, seed):
        if path not in ("joint", "camera_only", "expression_only", "shared_shape", "nuisance_only"):
            raise ValueError("unknown proposal path")
        entries, x0, lower, upper = [], [], [], []
        def add(kind, key, value, lo, hi):
            start = len(x0); value = np.asarray(value)
            entries.append((kind, key, slice(start, start + len(value))))
            x0.extend(value); lower.extend(lo); upper.extend(hi)
        if path in ("joint", "shared_shape"):
            add("shape", None, seed.shape, self.shape_bounds[:, 0], self.shape_bounds[:, 1])
        for v in self.training_views:
            if path in ("joint", "expression_only", "nuisance_only") and len(v.expression_center):
                add("expression", v.view_id, seed.expression_delta[v.view_id],
                    v.expression_bounds[:, 0] - v.expression_center,
                    v.expression_bounds[:, 1] - v.expression_center)
            if path in ("joint", "camera_only", "nuisance_only"):
                add("camera", v.view_id, seed.camera_delta[v.view_id], -self.camera_limits, self.camera_limits)
        if not x0:
            raise ValueError("requested path has no active parameters")
        return entries, np.asarray(x0), (np.asarray(lower), np.asarray(upper))

    def _unpack(self, x, entries, seed):
        p = _copy_parameters(seed)
        for kind, key, sl in entries:
            if kind == "shape":
                p.shape[:] = x[sl]
            else:
                getattr(p, kind + "_delta")[key][:] = x[sl]
        return p

    def _project_jacobian(self, support, p):
        v, sid = support.view, support.view.view_id
        points = support.base + np.einsum("mcd,d->mc", support.shape, p.shape)
        points += np.einsum("mck,k->mc", support.expression, p.expression_delta[sid])
        d = p.camera_delta[sid]
        cam = adjusted_camera(v.camera, d, self.face_center_native)
        display = native_to_display(points)
        base_camera = display @ v.camera.world_inverse[:3, :3].T + v.camera.world_inverse[:3, 3]
        center = (v.camera.world_inverse @ np.r_[native_to_display(self.face_center_native[None])[0], 1.])[:3]
        centered = base_camera - center
        rotation = Rotation.from_rotvec(d[:3]).as_matrix()
        q = centered @ rotation.T + center + d[3:6]
        clip = np.column_stack((q, np.ones(len(q)))) @ cam.projection.T
        w = clip[:, 3]
        # Finite barrier projection keeps the optimizer evaluable near the camera
        # plane. The separate depth residual pushes support back into view.
        safe_w = np.maximum(w, self.config.depth_epsilon)
        scale = np.asarray([cam.width / 2, -cam.height / 2])
        pixels = clip[:, :2] / safe_w[:, None] * scale + [cam.width / 2, cam.height / 2]
        dw = cam.projection[3, :3][None, :] * (w > self.config.depth_epsilon)[:, None]
        dp = (cam.projection[:2, :3][None] / safe_w[:, None, None]
              - clip[:, :2, None] * dw[:, None, :] / safe_w[:, None, None] ** 2) * scale[None, :, None]
        native_rotation = rotation @ v.camera.world_inverse[:3, :3] @ np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]])
        shape_camera = np.einsum("ab,mbd->mad", native_rotation, support.shape)
        expr_camera = np.einsum("ab,mbk->mak", native_rotation, support.expression)
        dcamera = np.zeros((len(q), 3, 7))
        h = 1e-6
        for axis in range(3):
            step = np.eye(3)[axis] * h
            dr = (Rotation.from_rotvec(d[:3] + step).as_matrix()
                  - Rotation.from_rotvec(d[:3] - step).as_matrix()) / (2 * h)
            dcamera[:, :, axis] = centered @ dr.T
        dcamera[:, :, 3:6] = np.eye(3)
        jc = np.einsum("mab,mbk->mak", dp, dcamera)
        jc[:, 0, 6] = scale[0] * cam.projection[0, 0] * q[:, 0] / safe_w
        jc[:, 1, 6] = scale[1] * cam.projection[1, 1] * q[:, 1] / safe_w
        derivatives = {"shape": np.einsum("mab,mbd->mad", dp, shape_camera),
                       "expression": np.einsum("mab,mbk->mak", dp, expr_camera), "camera": jc}
        depth = -q[:, 2]
        depth_derivatives = {"shape": -shape_camera[:, 2], "expression": -expr_camera[:, 2],
                             "camera": -dcamera[:, 2]}
        return pixels, derivatives, depth, depth_derivatives

    def _objective(self, supports, entries, seed):
        c = self.config
        def evaluate(x):
            p = self._unpack(x, entries, seed)
            residuals, jacobians = [], []
            view_weight = 1. / np.sqrt(len(self.training_views))
            for s in supports:
                pixels, deriv, depth, depth_deriv = self._project_jacobian(s, p)
                raw = (pixels - s.target) / s.sigma
                if c.robust_scale is None:
                    robust, slope = raw, np.ones_like(raw)
                else:
                    root = np.hypot(1., raw / c.robust_scale)
                    factor = np.sqrt(2. / (root + 1.))
                    robust = raw * factor
                    slope = factor * (root + 1.) / (2. * root)
                weight = s.weights[:, None] * view_weight
                residuals.append((robust * weight).ravel())
                jac = np.zeros((len(raw), 2, len(x)))
                for kind, key, sl in entries:
                    if kind == "shape" or key == s.view.view_id:
                        jac[:, :, sl] = deriv[kind] / s.sigma[:, :, None] * (slope * weight)[:, :, None]
                jacobians.append(jac.reshape(-1, len(x)))
                behind = np.maximum(c.depth_epsilon - depth, 0.)
                residuals.append(behind * 1e5 * s.weights * view_weight)
                dj = np.zeros((len(depth), len(x)))
                for kind, key, sl in entries:
                    if kind == "shape" or key == s.view.view_id:
                        dj[:, sl] = -depth_deriv[kind] * ((behind > 0) * 1e5 * s.weights * view_weight)[:, None]
                jacobians.append(dj)
            for kind, key, sl in entries:
                if kind == "shape":
                    prior, weight = self.shape_prior, c.shape_regularization
                elif kind == "camera":
                    prior, weight = self.camera_prior, c.camera_regularization / len(self.training_views)
                else:
                    prior = _positive(c.expression_prior_sigma, (sl.stop - sl.start,), "expression prior sigma")
                    weight = c.expression_regularization / len(self.training_views)
                reg = np.sqrt(weight) / prior
                residuals.append(x[sl] * reg)
                jac = np.zeros((len(reg), len(x))); jac[:, sl] = np.diag(reg)
                jacobians.append(jac)
            return np.concatenate(residuals), np.vstack(jacobians)
        cache = {}
        def both(x):
            if "x" not in cache or not np.array_equal(cache["x"], x):
                cache["x"] = x.copy(); cache["result"] = evaluate(x)
            return cache["result"]
        return lambda x: both(x)[0], lambda x: both(x)[1]

    def _parameter_hash(self, path, p):
        parts = [self.model_fingerprint, path, array_sha256(p.shape)]
        for v in self.views:
            parts += [v.view_id, array_sha256(p.expression_delta[v.view_id]), array_sha256(p.camera_delta[v.view_id])]
        return sha256("|".join(parts).encode()).hexdigest()

    def propose(self, path="joint"):
        seed = self.accepted_parameters
        if path == "nuisance_only":
            # Fair old-identity baseline: exactly theta=0, same observations,
            # expression/camera bounds, priors and contour refresh as joint.
            seed.shape[:] = 0.
        entries, x, bounds = self._layout(path, seed)
        reports = []
        for outer in range(self.config.outer_iterations):
            p = self._unpack(x, entries, seed)
            supports = [self._refresh_support(v, p) for v in self.training_views]
            fun, jac = self._objective(supports, entries, seed)
            result = least_squares(fun, x, jac=jac, bounds=bounds, max_nfev=self.config.max_nfev,
                                   ftol=1e-9, xtol=1e-9, gtol=1e-9, x_scale="jac")
            reports.append({"outer_iteration": outer + 1, "nfev": result.nfev,
                            "cost": float(result.cost), "optimality": float(result.optimality),
                            "optimizer_success": bool(result.success), "message": result.message,
                            "fixed_support_counts": {s.view.view_id: len(s.target) for s in supports}})
            previous = x; x = result.x
            if not any(v.curves for v in self.training_views) or np.linalg.norm(x - previous) < 1e-8:
                break
        p = self._unpack(x, entries, seed)
        p, trust = self._limit_mesh_step(seed, p)
        metrics = self._evaluate(p, self.training_views)
        metrics["mesh_trust_region"] = trust
        return Proposal(self._parameter_hash(path, p), self.model_fingerprint, path, p,
                        tuple(v.view_id for v in self.training_views), tuple(v.view_id for v in self.holdout_views),
                        metrics, tuple(reports))

    def _mesh_components(self, p):
        identity = np.einsum("d,dnc->nc", p.shape, self.views[0].shape_jacobian)[self.trust_vertex_ids]
        expression = {v.view_id: np.einsum("k,knc->nc", p.expression_delta[v.view_id],
                      v.expression_jacobian)[self.trust_vertex_ids] for v in self.training_views}
        return identity, expression

    def _mesh_displacement(self, p):
        identity, expression = self._mesh_components(p)
        if self.config.mesh_trust_scope == "identity":
            return float(np.linalg.norm(identity, axis=1).max())
        return max(float(np.linalg.norm(identity + e, axis=1).max()) for e in expression.values())

    def _mesh_report(self, p):
        identity, expression = self._mesh_components(p)
        return {"scope": self.config.mesh_trust_scope,
                "identity_max_displacement_m": float(np.linalg.norm(identity, axis=1).max()),
                "expression_max_displacement_m_by_view":
                    {key: float(np.linalg.norm(value, axis=1).max()) for key, value in expression.items()},
                "combined_max_displacement_m_by_view":
                    {key: float(np.linalg.norm(identity + value, axis=1).max()) for key, value in expression.items()}}

    def _limit_mesh_step(self, seed, candidate):
        cap = self.config.predicted_mesh_displacement_cap_m
        predicted = self._mesh_displacement(candidate)
        if predicted <= cap:
            return candidate, {"cap_m": cap, "max_displacement_m": predicted,
                               "step_scale": 1.0, **self._mesh_report(candidate)}
        # The default cap constrains shared identity relative to this proxy's
        # original anchor. Necessary smile/expression motion keeps its own bounds.
        # Optional combined mode shrinks expression with identity as well.
        start_id, start_expr = self._mesh_components(seed)
        end_id, end_expr = self._mesh_components(candidate)
        if self.config.mesh_trust_scope == "identity":
            displacement = [(start_id, end_id - start_id)]
        else:
            displacement = [(start_id + start_expr[key], end_id + end_expr[key] - start_id - start_expr[key])
                            for key in start_expr]
        def within_cap(alpha):
            return all(np.linalg.norm(start + alpha * step, axis=1).max() <= cap
                       for start, step in displacement)
        def interpolate(alpha):
            out = _copy_parameters(candidate)
            out.shape[:] = seed.shape + alpha * (candidate.shape - seed.shape)
            if self.config.mesh_trust_scope == "combined":
                for v in self.training_views:
                    key = v.view_id
                    out.expression_delta[key][:] = (seed.expression_delta[key]
                        + alpha * (candidate.expression_delta[key] - seed.expression_delta[key]))
            return out
        lo, hi = 0., 1.
        for _ in range(50):
            middle = (lo + hi) / 2
            if within_cap(middle):
                lo = middle
            else:
                hi = middle
        out = interpolate(lo)
        return out, {"cap_m": cap, "max_displacement_m": self._mesh_displacement(out),
                     "unlimited_displacement_m": predicted, "step_scale": lo,
                     **self._mesh_report(out)}

    def identifiability_diagnostics(self, proposal=None, *, relative_tolerance=1e-7):
        """Local data-Jacobian overlap, not an assertion of true-model recovery.

        Excludes priors and holdouts. Returns shape energy explainable by camera
        or expression nuisance columns at current correspondences. Larger overlap
        means identity is locally less separable; no parameter selection occurs.
        """
        if not np.isfinite(relative_tolerance) or relative_tolerance <= 0:
            raise ValueError("relative_tolerance must be finite and positive")
        if proposal is not None:
            self._check_proposal(proposal)
        p = self.accepted_parameters if proposal is None else proposal.parameters
        entries, x, _ = self._layout("joint", p)
        supports = [self._refresh_support(v, p) for v in self.training_views]
        blocks = []
        for support in supports:
            _, deriv, _, _ = self._project_jacobian(support, p)
            jac = np.zeros((len(support.target), 2, len(x)))
            for kind, key, sl in entries:
                if kind == "shape" or key == support.view.view_id:
                    jac[:, :, sl] = deriv[kind] / support.sigma[:, :, None] * support.weights[:, None, None]
            blocks.append(jac.reshape(-1, len(x)))
        jac = np.vstack(blocks)
        shape, nuisance = jac[:, :self.d], jac[:, self.d:]
        u, singular, _ = np.linalg.svd(nuisance, full_matrices=False)
        rank = int(np.sum(singular > (singular[0] * relative_tolerance if len(singular) else 0)))
        unexplained = shape - u[:, :rank] @ (u[:, :rank].T @ shape)
        energy = np.sum(shape ** 2, axis=0)
        remaining = np.sum(unexplained ** 2, axis=0)
        overlap = np.divide(energy - remaining, energy, out=np.zeros_like(energy), where=energy > 0)
        return {"forward_kind": "local_linear_geometry_proxy", "shape_dimensions": self.d,
                "nuisance_rank": rank, "shape_energy": energy.tolist(),
                "nuisance_explained_shape_fraction": np.clip(overlap, 0., 1.).tolist(),
                "residual_shape_singular_values": np.linalg.svd(unexplained, compute_uv=False).tolist()}

    def _check_proposal(self, proposal):
        if proposal.model_fingerprint != self.model_fingerprint or proposal.proposal_hash != self._parameter_hash(proposal.path, proposal.parameters):
            raise ValueError("proposal hash does not match this solver and its parameters")
        p = proposal.parameters
        if not np.isfinite(p.shape).all() or (p.shape < self.shape_bounds[:, 0]).any() or (p.shape > self.shape_bounds[:, 1]).any():
            raise ValueError("proposal shape is outside local bounds")
        if self._mesh_displacement(p) > self.config.predicted_mesh_displacement_cap_m * (1. + 1e-10):
            raise ValueError("proposal exceeds local mesh displacement trust cap")
        for v in self.views:
            e, d = p.expression_delta[v.view_id], p.camera_delta[v.view_id]
            if not np.isfinite(e).all() or (v.expression_center + e < v.expression_bounds[:, 0]).any() or (v.expression_center + e > v.expression_bounds[:, 1]).any():
                raise ValueError("proposal expression is outside bounds")
            if not np.isfinite(d).all() or (np.abs(d) > self.camera_limits).any():
                raise ValueError("proposal camera is outside bounds")

    def _evaluate(self, p, views, vertices_by_view=None):
        by_view, total = {}, []
        for v in views:
            verts = self.proxy_vertices(p, v.view_id) if vertices_by_view is None else vertices_by_view[v.view_id]
            support = self._refresh_support(v, p, verts)
            if support is None:
                by_view[v.view_id] = {"no_scored_observations": True}
                continue
            cam = adjusted_camera(v.camera, p.camera_delta[v.view_id], self.face_center_native)
            points = np.einsum("mi,mic->mc", support.barycentric, verts[support.vertices])
            delta = project_native(points, cam).pixels - support.target
            scaled = delta / support.sigma
            by_region = {}
            for region in np.unique(support.regions):
                mask = support.regions == region
                by_region[region] = {"points": int(mask.sum()),
                    "pixel_rms": float(np.sqrt(np.mean(np.sum(delta[mask] ** 2, axis=1)))),
                    "normalized_rms": float(np.sqrt(np.mean(np.sum(scaled[mask] ** 2, axis=1))))}
            mse = float(np.sum(scaled ** 2 * support.weights[:, None] ** 2))
            total.append(mse)
            by_view[v.view_id] = {"normalized_rms": float(np.sqrt(mse)), "regions": by_region}
        return {"normalized_rms": float(np.sqrt(np.mean(total))) if total else None,
                "views": by_view, "scoring": "fixed observed pixels/sigma, region means, equal view means"}

    def validate_holdouts(self, proposal, *, vertices_by_view=None):
        """Read-only fixed-camera evaluation. No optimizer or model selection.

        Holdout camera/expression values remain at the independently calibrated
        anchor. To calibrate a holdout camera, do so BEFORE constructing this
        solver, using only allowed calibration points, then remove those points
        from its scored Landmarks. Never use holdout scores to choose identity.
        """
        self._check_proposal(proposal)
        return self._evaluate(proposal.parameters, self.holdout_views, vertices_by_view)

    def verify_and_commit(self, proposal, receipt=None):
        """Commit only a trusted native-forward result passing every local gate.

        A callable may be supplied as receipt; it receives the immutable proposal
        and must return TrueForwardReceipt. This function never runs an engine.
        Rollback means the previously accepted parameters/vertices are untouched.
        """
        metrics = {}
        try:
            self._check_proposal(proposal)
            if proposal.status != "requires_true_forward":
                raise ValueError("proposal is not awaiting true forward")
            if receipt is None:
                raise ValueError("missing external native true-forward receipt")
            if callable(receipt):
                receipt = receipt(proposal)
                self._check_proposal(proposal)
            if not isinstance(receipt, TrueForwardReceipt):
                raise ValueError("external callback did not return TrueForwardReceipt")
            if not self.native_engine_id or not self.native_model_hash:
                raise ValueError("expected native engine/model identity was not configured")
            if receipt.source != "native_engine_true_forward" or receipt.engine_id != self.native_engine_id or receipt.model_hash != self.native_model_hash:
                raise ValueError("native engine/model receipt identity mismatch")
            if receipt.proposal_hash != proposal.proposal_hash:
                raise ValueError("native receipt proposal hash mismatch")
            expected = {v.view_id for v in self.views}
            if set(receipt.vertices_by_view) != expected or set(receipt.vertices_sha256) != expected or set(receipt.camera_sha256) != expected:
                raise ValueError("receipt must cover exactly every native view")
            cameras = self.proposal_cameras(proposal)
            vertices = {}
            deviations = {}
            for v in self.views:
                actual = _finite(receipt.vertices_by_view[v.view_id], (self.n, 3), "native true-forward vertices")
                if receipt.vertices_sha256[v.view_id] != array_sha256(actual):
                    raise ValueError("native receipt vertex hash mismatch")
                if receipt.camera_sha256[v.view_id] != camera_sha256(cameras[v.view_id]):
                    raise ValueError("native receipt camera hash mismatch")
                proxy = self.proxy_vertices(proposal.parameters, v.view_id)
                vertex_error = np.linalg.norm(actual - proxy, axis=1)
                rmse = float(np.sqrt(np.mean(vertex_error ** 2)))
                max_error = float(vertex_error.max())
                # Project the SAME support in actual and proxy; rematching would
                # hide a geometric discrepancy by changing its measurement.
                support = None if v.holdout else self._refresh_support(v, proposal.parameters, proxy)
                pixel_rmse = 0.
                if support is not None:
                    a = np.einsum("mi,mic->mc", support.barycentric, actual[support.vertices])
                    b = np.einsum("mi,mic->mc", support.barycentric, proxy[support.vertices])
                    pa, pb = project_native(a, cameras[v.view_id]), project_native(b, cameras[v.view_id])
                    if not pa.in_front.all() or not pb.in_front.all():
                        raise ValueError("native receipt has invalid camera support")
                    pixel_rmse = float(np.sqrt(np.mean(np.sum((pa.pixels - pb.pixels) ** 2, axis=1))))
                native_displacement = float(np.linalg.norm((actual - v.base_positions)[self.trust_vertex_ids], axis=1).max())
                deviations[v.view_id] = {"vertex_rmse_m": rmse, "vertex_max_error_m": max_error, "support_pixel_rmse": pixel_rmse,
                                        "native_max_displacement_m": native_displacement}
                vertices[v.view_id] = actual
            metrics["proxy_vs_native"] = deviations
            # Holdout discrepancies are reported but NEVER decide the identity
            # commit; even an acceptance gate would leak holdout model selection.
            for v in self.training_views:
                dev = deviations[v.view_id]
                if self.config.mesh_trust_scope == "combined" and dev["native_max_displacement_m"] > self.config.predicted_mesh_displacement_cap_m * (1. + 1e-8):
                    raise ValueError("native true forward exceeds local mesh displacement trust cap")
                if (dev["vertex_rmse_m"] > self.config.true_forward_max_vertex_rmse_m
                        or dev["vertex_max_error_m"] > self.config.true_forward_max_vertex_error_m
                        or dev["support_pixel_rmse"] > self.config.true_forward_max_proxy_pixel_rmse):
                    raise ValueError("native true forward diverges from local proxy")
            actual_score = self._evaluate(proposal.parameters, self.training_views, vertices)
            baseline_score = self._evaluate(self._accepted, self.training_views, self._accepted_vertices)
            metrics.update(native_training=actual_score, accepted_training=baseline_score)
            score, baseline = actual_score["normalized_rms"], baseline_score["normalized_rms"]
            if score is None or not np.isfinite(score) or score > self.config.true_forward_max_normalized_rms:
                raise ValueError("native true-forward residual fails absolute error gate")
            if score > baseline * self.config.true_forward_max_error_ratio + self.config.true_forward_error_slack:
                raise ValueError("native true-forward residual worsens accepted anchor")
            self._accepted = _copy_parameters(proposal.parameters)
            self._accepted_vertices = {key: value.copy() for key, value in vertices.items()}
            return CommitResult("committed", "external native forward passed hash, finite, proxy and residual gates",
                                replace(proposal, status="committed"), metrics)
        except Exception as exc:
            return CommitResult("rolled_back", str(exc), replace(proposal, status="rolled_back"), metrics)


def calibrate_camera_only(view, faces, face_center_native, calibration_landmarks,
                          *, frozen_vertices, config=None):
    """Independently calibrate a camera on caller-designated eye/nose points.

    ``frozen_vertices`` must already represent the identity/expression to freeze
    (prefer native true forward). Only calibration_landmarks are read; the view's
    ordinary targets/curves never enter this solve. Remove calibration points
    from held-out scoring. This helper neither fits identity nor commits a face.
    Its returned Camera may become the holdout baseline BEFORE JointSolver is
    constructed; validate_holdouts never invokes it or feeds residuals back.
    """
    frozen = _finite(frozen_vertices, np.asarray(view.base_positions).shape, "frozen vertices")
    calibration_view = replace(view, base_positions=frozen, landmarks=calibration_landmarks,
                               curves={}, region_triangles={}, semantic_edges_by_region={}, holdout=False)
    local = JointSolver([calibration_view], faces, face_center_native, config=config)
    proposal = local.propose("camera_only")
    return {"camera": local.proposal_cameras(proposal)[view.view_id],
            "camera_delta": proposal.parameters.camera_delta[view.view_id].copy(),
            "calibration_metrics": proposal.proxy_metrics,
            "status": "calibration_only", "identity_fitted": False,
            "scoring": "calibration points only; exclude from held-out score"}
