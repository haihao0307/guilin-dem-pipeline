"""Conservative analytic support bounds across whole permitted beta interval.
No optimization or phase samples enter these separation certificates.
"""
from pathlib import Path
import json,math
H=Path(__file__).resolve().parent
P=json.load(open(H/'PARAMETERS.json'));C=P['chest'];r=.26;b0=.11;b1=.16
# For positive beta, world Z support at station s is s*cos(beta) +/- r*sin(beta).
# Rear maximum decreases throughout interval since -s*sin(beta)+r*cos(beta)<0.
rear_s=4.35
rear_derivative_upper=-rear_s*math.sin(b0)+r*math.cos(b0)
assert rear_derivative_upper<0
rear_zmax=rear_s*math.cos(b0)+r*math.sin(b0)
# Front minimum decreases throughout interval since -s*sin(beta)-r*cos(beta)<0.
front_s=5.15
front_zmin=front_s*math.cos(b1)-r*math.sin(b1)
rear_flange_start=C['rear']-C['coverThickness'];front_flange_end=C['front']+C['coverThickness']
rear_gap=rear_flange_start-rear_zmax;front_gap=front_zmin-front_flange_end
# The X axis is invariant under all middle piston/rod/ring inclination and slider transforms.
min_chest_x=P['middleX']-C['outerRadius'];max_power_moving_x=.23495
chest_power_xgap=min_chest_x-max_power_moving_x
guide_power_xgap=P['middleX']-.035-.26
out={'sourceStatus':'Inferred dimensions; analytic separation only, not historical/pressure/structural acceptance','betaDomain':[b0,b1],'powerRearCoverMaximumWorldZ':rear_zmax,'powerFrontCoverMinimumWorldZ':front_zmin,'newRearFlangeStart':rear_flange_start,'newFrontFlangeEnd':front_flange_end,'rearCoverConservativeZGap':rear_gap,'frontCoverConservativeZGap':front_gap,'chestExceptWebToPowerPistonRingRodXGap':chest_power_xgap,'frontGuideToAllPowerCylinderXGap':guide_power_xgap,'nominalCoordinatesOnlyNoNumericalPad':True,'coversSeparatedForAllBeta':rear_gap>0 and front_gap>0,'chestExceptWebSeparatedFromPowerMoversForAllBetaAndTime':chest_power_xgap>0,'frontGuideSeparatedFromPowerCylinderForAllBetaAndTime':guide_power_xgap>0}
json.dump(out,open(H/'BETA_RANGE_SEPARATION.json','w'),indent=2);print(json.dumps(out,indent=2))
