// R17: verified WD datums constrain independent components, never a whole-train XYZ scale.
// The locomotive remains the original fictional WD280. No prototype overall length is asserted.
import {TRACK,WD_VERIFIED,WD_AXLES,CONSIST,SCALE_SOURCES} from './metre-scale.mjs';
export const STEAM_AUTHORING=Object.freeze({
  boilerOutsideDiameter:1.75,cabFloorAboveRail:1.32,cabRoofAboveRail:3.92,cabFrontX:-4.02,cabRoofWidth:2.79,
  tenderWheelRadius:.48,tenderFrontX:-6.48,tenderRearX:CONSIST.tenderRearX,
  cylinderAxisAboveRail:WD_VERIFIED.driverDiameter/2,cylinderX:2.80,cylinderSideZ:1.065,
  mainRodLength:4.20,driverHeightM:1.80,driverOriginalStature:1.385,driverOriginalWithCap:1.475,
  status:'Authoring assumptions: boiler outside diameter, body longitudinal contour, cab floor/roof, cylinder placement, connecting rod length and all tender geometry. These are not prototype dimensions.'
});
export const STEAM_CALIBRATION=Object.freeze({
  status:'partial-primary-datum-calibration; fictional WD280; overall prototype dimensions unknown',units:'metres',source:SCALE_SOURCES.wd,page:12,
  verified:WD_VERIFIED,unknown:Object.freeze(['locomotive overall length','maximum overall width','maximum overall height','boiler outside diameter','tender dimensions']),
  assumptions:STEAM_AUTHORING,crankRadius:.3556,pistonStroke:.7112,beatsPerRevolution:4,
});
const identity=x=>x;
function linear(source,target){const a=(target[1]-target[0])/(source[1]-source[0]);return x=>target[0]+(x-source[0])*a;}
function piecewise(pairs){return x=>{let i=0;while(i<pairs.length-2&&x>pairs[i+1][0])i++;return linear([pairs[i][0],pairs[i+1][0]],[pairs[i][1],pairs[i+1][1]])(x);};}
// Array-based helpers also expose their exact local derivative to preserve smooth normals.
function mapper(x,y,z){const f=p=>[x(p[0]),y(p[1]),z(p[2])];f.normal=(p,n)=>{const e=1e-5,s=[(x(p[0]+e)-x(p[0]-e))/(2*e),(y(p[1]+e)-y(p[1]-e))/(2*e),(z(p[2]+e)-z(p[2]-e))/(2*e)];return n.map((v,i)=>v/s[i]);};return f;}
export const STEAM_CAB_REAR_X=WD_AXLES.drivers[0]-WD_VERIFIED.cabRearFromLastDriver;
export const STEAM_CAB_FLOOR_Y=TRACK.railHead+STEAM_AUTHORING.cabFloorAboveRail;
export const STEAM_BOILER_CENTER_Y=TRACK.railHead+WD_VERIFIED.boilerCenterAboveRail;
export const STEAM_CHIMNEY_TOP_Y=TRACK.railHead+WD_VERIFIED.chimneyTopAboveRail;
export const steamBodyX=piecewise([[-2.13,STEAM_CAB_REAR_X],[-.64,STEAM_AUTHORING.cabFrontX],[3.84,3.84],[5,5]]);
export const steamChassisX=piecewise([[-2.13,STEAM_CAB_REAR_X],...[-1.32,-.04,1.24,2.52].map((x,i)=>[x,WD_AXLES.drivers[i]]),[3.84,3.84],[5,5]]);
const bodyWidthScale=WD_VERIFIED.cabSideWidth/(2*(.984+.050)),boilerScale=STEAM_AUTHORING.boilerOutsideDiameter/(2*.705);
export const steamTenderX=linear([-8.01,-2.85],[STEAM_AUTHORING.tenderRearX,STEAM_AUTHORING.tenderFrontX]);
export const STEAM_MAPS=Object.freeze({
  chassis:mapper(steamChassisX,piecewise([[TRACK.railHead,TRACK.railHead],[1.06,TRACK.railHead+WD_VERIFIED.driverDiameter/2],[1.55,1.86]]),identity),
  boiler:mapper(steamBodyX,y=>STEAM_BOILER_CENTER_Y+(y-2.26)*boilerScale,z=>z*boilerScale),
  accessories:mapper(steamBodyX,piecewise([[1.06,TRACK.railHead+WD_VERIFIED.driverDiameter/2],[1.55,1.86],[2.26,STEAM_BOILER_CENTER_Y],[2.965,STEAM_BOILER_CENTER_Y+.875],[3.5275,4.24]]),z=>z*bodyWidthScale),
  cab:mapper(steamBodyX,linear([1.575,3.5105],[STEAM_CAB_FLOOR_Y,TRACK.railHead+STEAM_AUTHORING.cabRoofAboveRail]),z=>z*bodyWidthScale),
  cabRoof:mapper(steamBodyX,linear([1.575,3.5105],[STEAM_CAB_FLOOR_Y,TRACK.railHead+STEAM_AUTHORING.cabRoofAboveRail]),z=>z*(STEAM_AUTHORING.cabRoofWidth/(2*1.168))),
  tender:mapper(steamTenderX,y=>TRACK.railHead+(y-TRACK.railHead)*1.18,z=>z*bodyWidthScale),
  lamp:mapper(steamBodyX,y=>y-.20,identity),
  coupling:mapper(linear([-2.12,-2.97],[STEAM_CAB_REAR_X,-6.62]),y=>STEAM_CAB_FLOOR_Y+(y-1.51)*1.1,z=>z*bodyWidthScale),
});
// Vertical fittings retain circular X/Z sections independently of longitudinal boiler length.
export function steamFittingMap(x,baseY,topY,targetBase,targetTop){return mapper(v=>steamBodyX(x)+(v-x)*boilerScale,linear([baseY,topY],[targetBase,targetTop]),z=>z*boilerScale);}
export const STEAM_CHIMNEY_MAP=steamFittingMap(3.03,2.90,3.68+.023*Math.sin(2*Math.PI/5),STEAM_BOILER_CENTER_Y+.835,STEAM_CHIMNEY_TOP_Y);
export function steamCrewMap(heightM=STEAM_AUTHORING.driverHeightM){if(!Number.isFinite(heightM)||heightM<=0||heightM>3)throw new RangeError('driverHeightM must be a positive metre stature no greater than 3');const s=heightM/STEAM_AUTHORING.driverOriginalStature;return mapper(x=>steamBodyX(-1.74)+(x+1.74)*s,y=>STEAM_CAB_FLOOR_Y+(y-1.595)*s,z=>.76+(z-.61)*s);}
export const STEAM_SOCKETS=Object.freeze({
 chimney:Object.freeze([steamBodyX(3.03),STEAM_CHIMNEY_TOP_Y,0]),
 whistle:Object.freeze(STEAM_MAPS.accessories([-.60,3.5275,-.36])),
 cylinderLeft:Object.freeze([STEAM_AUTHORING.cylinderX,TRACK.railHead+STEAM_AUTHORING.cylinderAxisAboveRail,-STEAM_AUTHORING.cylinderSideZ]),
 cylinderRight:Object.freeze([STEAM_AUTHORING.cylinderX,TRACK.railHead+STEAM_AUTHORING.cylinderAxisAboveRail,STEAM_AUTHORING.cylinderSideZ]),
});
