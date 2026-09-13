"""Explicit SI sections and ideal hydrostatic opening flow, research only.

No regional parameters are supplied by this module. Manning is a separate
uniform-flow diagnostic, never used as a downstream backwater solver.
"""
from dataclasses import dataclass
from math import isfinite, sqrt


def number(value, label, *, minimum=None, positive=False):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not isfinite(value):
        raise ValueError(f"{label}: finite numeric value required")
    if positive and value <= 0 or minimum is not None and value < minimum:
        raise ValueError(f"{label}: out of range")
    return value


@dataclass(frozen=True)
class ChannelSection:
    bottom_width_m: float
    side_horizontal_per_vertical: float
    bank_depth_m: float

    def __post_init__(self):
        number(self.bottom_width_m, "bottom width", positive=True)
        number(self.side_horizontal_per_vertical, "side slope", minimum=0)
        number(self.bank_depth_m, "bank depth", positive=True)

    def measure(self, water_depth_m):
        y = number(water_depth_m, "water depth", minimum=0)
        if y > self.bank_depth_m:
            raise ValueError("overtopping is outside the channel section model")
        b, z = self.bottom_width_m, self.side_horizontal_per_vertical
        area = y * (b + z * y)
        perimeter = b + 2 * y * sqrt(1 + z * z)
        return dict(area_m2=area, wetted_perimeter_m=perimeter if y else 0.,
                    hydraulic_radius_m=area / perimeter, top_width_m=b + 2*z*y,
                    freeboard_m=self.bank_depth_m-y)

    def profile(self):
        """Open soil cut (x,z); no arbitrary tube geometry or water surface."""
        b, z, h = self.bottom_width_m/2, self.side_horizontal_per_vertical, self.bank_depth_m
        return ((-b-z*h, h), (-b, 0.), (b, 0.), (b+z*h, h))

    def normal_discharge(self, *, water_depth_m, manning_n, energy_slope,
                         uniform_flow_confirmed):
        if uniform_flow_confirmed is not True:
            raise ValueError("normal flow not established; use a backwater/unsteady solver")
        n = number(manning_n, "Manning n [s/m^(1/3)]", positive=True)
        s = number(energy_slope, "energy slope", minimum=0)
        m = self.measure(water_depth_m)
        return m["area_m2"] * m["hydraulic_radius_m"] ** (2/3) * sqrt(s) / n


@dataclass(frozen=True)
class BundSection:
    crest_width_m: float
    crest_elevation_m: float
    left_toe_elevation_m: float
    right_toe_elevation_m: float
    left_horizontal_per_vertical: float
    right_horizontal_per_vertical: float

    def __post_init__(self):
        number(self.crest_width_m, "crest width", positive=True)
        for name in ("crest_elevation_m", "left_toe_elevation_m", "right_toe_elevation_m"):
            number(getattr(self, name), name)
        for name in ("left_horizontal_per_vertical", "right_horizontal_per_vertical"):
            number(getattr(self, name), name, minimum=0)
        if self.crest_elevation_m <= max(self.left_toe_elevation_m, self.right_toe_elevation_m):
            raise ValueError("bund crest must be above both toes")

    def profile(self):
        c = self.crest_elevation_m
        half = self.crest_width_m / 2
        return ((-half-(c-self.left_toe_elevation_m)*self.left_horizontal_per_vertical, self.left_toe_elevation_m),
                (-half, c), (half, c),
                (half+(c-self.right_toe_elevation_m)*self.right_horizontal_per_vertical, self.right_toe_elevation_m))


@dataclass(frozen=True)
class Opening:
    id: str
    a: str
    b: str
    invert_m: float
    width_m: float
    height_m: float
    discharge_coefficient: float
    blockage: float = 0.
    model: str = "ideal_hydrostatic_slot"

    def __post_init__(self):
        if any(not isinstance(i, str) or not i.strip() for i in (self.id, self.a, self.b)) or self.a == self.b:
            raise ValueError("distinct endpoint identities and a nonempty opening id required")
        number(self.invert_m, "invert")
        number(self.width_m, "width", positive=True)
        number(self.height_m, "height", positive=True)
        cd = number(self.discharge_coefficient, "discharge coefficient", positive=True)
        blockage = number(self.blockage, "blockage", minimum=0)
        if cd != 1 or self.model != "ideal_hydrostatic_slot":
            raise ValueError("only Cd=1 ideal reference supported; real opening requires calibration")
        if blockage > 1:
            raise ValueError("blockage must be a width fraction in [0,1]")

    def discharge(self, head_a_m, head_b_m, gravity_m_s2=9.80665):
        """Signed Q a->b; integrate sqrt(2g * pressure-head difference) vertically.

        Hydrostatic, negligible approach speed, zero loss, ventilated free jet.
        Partial submergence is split into a drowned rectangle and a free strip.
        This ideal calculation has no field calibration or erosion prediction.
        """
        ha, hb = number(head_a_m, "head a"), number(head_b_m, "head b")
        g = number(gravity_m_s2, "gravity", positive=True)
        if ha == hb or self.blockage == 1:
            return 0.
        high, low = max(ha, hb), min(ha, hb)
        z0, z1 = self.invert_m, min(high, self.invert_m + self.height_m)
        if z1 <= z0:
            return 0.
        drowned_height = max(0., min(low, z1) - z0)
        integral = drowned_height * sqrt(high - low)
        free_bottom = max(z0, low)
        if z1 > free_bottom:
            integral += 2/3 * ((high-free_bottom)**1.5 - (high-z1)**1.5)
        q = self.width_m * (1-self.blockage) * sqrt(2*g) * integral
        if not isfinite(q):
            raise ValueError("non-finite opening discharge")
        return q if ha > hb else -q
