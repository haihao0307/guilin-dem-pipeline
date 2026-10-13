"""Load only verified authored native responses; photographs stay in private files."""
import hashlib
import json
from pathlib import Path
import numpy as np
from scipy.optimize import least_squares
from scipy.spatial.transform import Rotation
from geometry import Camera, native_to_display, project_native


class NativeResponses:
    def __init__(self, directory):
        self.root = Path(directory)
        self.report = json.loads((self.root / 'report.json').read_text())
        if self.report.get('status') != 'native-response-captured-not-fitted' or not self.report.get('archiveRestored'):
            raise ValueError('Completed original native response and rollback receipt required')
        self.mapping = json.loads((self.root / 'mapping.json').read_text())
        if hashlib.sha256((self.root / 'mapping.json').read_bytes()).hexdigest() != self.report['mappingSHA256']:
            raise ValueError('Mapping digest mismatch')
        self.faces = np.asarray(self.mapping['faces'], dtype=np.int64).reshape(-1, 3)
        self.neutral = self.read_array('neutral.f64', '<f8').reshape(-1, 3)
        if self.neutral.shape != (25417, 3) or self.faces.shape != (50624, 3):
            raise ValueError('Unexpected original native topology')
        self.shape_jacobian = self.read_array('shape-jacobian.f32', '<f4').reshape(170, 25417, 3).astype(np.float64)
        self.expression_axes = self.report['expressionAxes']
        self.states = {}
        for row in self.report['states']:
            key = row['id']
            self.states[key] = {
                'base_positions': self.read_array(key + '.f64', '<f8').reshape(-1, 3),
                'expression_center': np.array([row['actions'].get(k, 0.) for k in self.expression_axes]),
                'expression_jacobian': np.stack([self.read_array(key + '-' + k + '.f32', '<f4').reshape(-1, 3) for k in self.expression_axes]),
            }
        self.body_count = self.mapping['bodyCount']
        component = np.asarray(self.mapping['componentId'])
        source_region = np.asarray(self.mapping['regionId'])
        self.component = np.full(len(self.neutral), -1, dtype=np.int64)
        self.region = np.full(len(self.neutral), -1, dtype=np.int64)
        for i, (a, b, t) in enumerate(self.mapping['gnmRecipes']):
            source = int(a if t < .5 else b)
            self.component[self.body_count + i] = component[source]
            self.region[self.body_count + i] = source_region[source]
        self.skin_faces = np.flatnonzero((self.component[self.faces] == 0).all(axis=1))

    def read_array(self, name, dtype):
        info = self.report['files'][name]
        raw = (self.root / name).read_bytes()
        if len(raw) != info['bytes'] or hashlib.sha256(raw).hexdigest() != info['sha256']:
            raise ValueError('Native response digest mismatch: ' + name)
        a = np.frombuffer(raw, dtype=dtype).copy()
        if not np.isfinite(a).all():
            raise ValueError('Nonfinite native response: ' + name)
        return a

    def landmark_support(self, ids):
        rows = [self.mapping['landmarks'][int(i)] for i in ids]
        for row in rows:
            if row['triangle'] is None or min(row['support']) < 0:
                raise ValueError('Unverified native triangle support ' + str(row['id']))
            w = np.asarray(row['weights'])
            if not np.isfinite(w).all() or (w < 0).any() or abs(w.sum() - 1.) > 1e-10:
                raise ValueError('Invalid normalized diagnostic support')
        return np.array([x['support'] for x in rows]), np.array([x['weights'] for x in rows])

    def validate_local_proxy(self):
        delta = np.asarray(self.report['validationShapeDelta'])
        displacement = np.einsum('d,dnc->nc', delta, self.shape_jacobian)
        results = {}
        for key, state in self.states.items():
            actual = self.read_array('validation-' + key + '.f64', '<f8').reshape(-1, 3)
            error = np.linalg.norm(state['base_positions'] + displacement - actual, axis=1)
            results[key] = {'maxM': float(error.max()), 'p95M': float(np.quantile(error, .95)), 'rmsM': float(np.sqrt(np.mean(error**2))), 'meaning': 'known original native coefficient combination, not photo-fit accuracy'}
        return results


def camera_from_pose(width, height, focal_pixels, rotation, center_native, offset_camera):
    """Perspective pinhole, principal point at source-image centre, metres."""
    if focal_pixels <= 0 or not np.isfinite(focal_pixels):
        raise ValueError('Positive finite focal length required')
    R = Rotation.from_rotvec(np.asarray(rotation)).as_matrix()
    center = native_to_display(np.asarray(center_native)[None])[0]
    V = np.eye(4); V[:3, :3] = R; V[:3, 3] = np.asarray(offset_camera) - R @ center
    near, far = .01, 100.
    P = np.zeros((4, 4)); P[0, 0] = 2*focal_pixels/width; P[1, 1] = 2*focal_pixels/height
    P[2, 2] = -(far+near)/(far-near); P[2, 3] = -2*far*near/(far-near); P[3, 2] = -1
    return Camera.from_three(P, V, width, height)


def calibrate_camera_envelope(points_native, target_pixels, sigma_pixels, width, height, *, focal_ratios=(.8, 2., 5.), center_native=None):
    """Camera-only calibration. Fixed identity; no use of held-out shape targets.

    Each fixed focal seed returns a distinct solution. Similar reprojection
    errors do not imply a unique physical focal length or head depth.
    """
    points = np.asarray(points_native, float); target = np.asarray(target_pixels, float)
    sigma = np.broadcast_to(np.asarray(sigma_pixels, float), (len(points),))
    if points.shape != (len(target), 3) or target.shape[1:] != (2,) or len(points) < 6 or (sigma <= 0).any() or not np.isfinite(points).all() or not np.isfinite(target).all():
        raise ValueError('At least six finite trusted 2D/3D calibration points required')
    center = points.mean(axis=0) if center_native is None else np.asarray(center_native, float)
    span = max(float(np.ptp(native_to_display(points)[:, 0])), .025)
    image_span = max(float(np.ptp(target[:, 0])), 20.)
    rows = []
    for ratio in focal_ratios:
        f = width*ratio; depth = f*span/image_span
        shift = (target.mean(axis=0) - [width/2, height/2])*depth/f * [1, -1]
        starts = [np.r_[np.array([0., yaw, 0.]), shift, -depth] for yaw in [-.5, 0., .5]]
        def residual(x):
            camera = camera_from_pose(width, height, f, x[:3], center, x[3:])
            q = project_native(points, camera)
            r = (np.nan_to_num(q.pixels, nan=1e5, posinf=1e5, neginf=-1e5) - target)/sigma[:, None]
            # Keep a fixed residual length even if a proposal crosses the eye plane.
            depth_penalty = np.maximum(.02-q.depth, 0.)*1e4
            return np.r_[r.ravel(), depth_penalty]
        candidates = [least_squares(residual, x, bounds=(np.r_[[-1.2, -1.4, -1.4], [-2., -2., -8.]], np.r_[[1.2, 1.4, 1.4], [2., 2., -.03]]), loss='soft_l1', f_scale=1., max_nfev=160) for x in starts]
        best = min(candidates, key=lambda x: float(np.sum(residual(x.x)**2)))
        camera = camera_from_pose(width, height, f, best.x[:3], center, best.x[3:]); error = project_native(points, camera).pixels-target
        rows.append({'focalRatio': float(ratio), 'focalPixels': f, 'camera': camera, 'poseVector': best.x, 'rmsPixels': float(np.sqrt(np.mean(error**2))), 'normalizedRms': float(np.sqrt(np.mean((error/sigma[:, None])**2))), 'optimizerSuccess': bool(best.success), 'physicalCameraKnown': False})
    return sorted(rows, key=lambda x:x['normalizedRms'])
