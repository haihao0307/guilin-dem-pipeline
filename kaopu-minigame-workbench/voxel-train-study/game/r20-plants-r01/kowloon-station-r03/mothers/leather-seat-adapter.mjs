// New station receiver; geometry refinement and GLSL field are source-preserved.
import {refinePanel} from './leather-mp2/geometry-core.mjs';
import {leatherShader} from './leather-mp2/leather-shell-shader.mjs';
export {leatherShader};
export function makeSeatPanel({widthM=.42,depthM=.38,heightM=0}={}){
 if(![widthM,depthM].every(v=>Number.isFinite(v)&&v>0))throw Error('Positive metres required');
 // Metric paper coordinates. Actual host can supply its own curved panel instead.
 return {id:'station-seat-top',uv:[[0,0],[widthM*1000,0],[widthM*1000,depthM*1000],[0,depthM*1000]],pos:new Float32Array([-widthM/2,heightM,-depthM/2,widthM/2,heightM,-depthM/2,widthM/2,heightM,depthM/2,-widthM/2,heightM,depthM/2]),norm:new Float32Array([0,1,0,0,1,0,0,1,0,0,1,0]),tris:new Uint32Array([0,2,1,0,3,2]),boundary:[0,3,2,1]};
}
export function createLeatherReceiverData({panel,maxEdgeMM=10,maxTriangles=20000}={}){
 if(!panel)throw Error('Host panel with uv millimetres and pos metres required');
 if(!Number.isFinite(maxEdgeMM)||maxEdgeMM<1||maxEdgeMM>30)throw Error('Explicit bounded sample spacing 1..30 mm required');
 const data=refinePanel(panel,maxEdgeMM);
 if(data.indices.length/3>maxTriangles)throw Error('Leather shell triangle budget exceeded');
 return {...data,shader:leatherShader,proof:{sourceGeometryFunction:'refinePanel',sourceFieldFunction:'leatherField',cpuBuildOnly:true,sampledHeightStage:'original GPU vertex shader; not CPU positions',geometricThicknessStage:'original GPU vertex shader',imageTextures:false,actualHostGeometryRequired:true,newStationAdapter:true,visualVerified:false,grainBelowMeshSpacingNotGeometric:true}};
}
export function leatherUniformParameters(p){
 if(!p||!Number.isFinite(p.seed)||!(p.tileMM>0&&p.grain>0))throw Error('Original leather recipe required');
 return {uSeed:p.seed,uCells:Math.max(8,Math.round(p.tileMM/p.grain/2)*2),uKind:p.kind,uIrregular:p.irregular,uWrinkles:p.wrinkles,uPores:p.pores,uDamage:p.damage,uDepth:p.depth,uTile:p.tileMM,uThickness:p.thickness??1.4,uPlain:0};
}
