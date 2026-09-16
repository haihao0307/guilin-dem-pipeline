from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / 'workbenches/landscape-surface-r5-k2-geometry-r1/index.html'
BUILD = ROOT / 'workbenches/landscape-surface-r5-k2-geometry-r1/build.json'

s = HTML.read_text(encoding='utf-8')

old = "const requestedAmp=Number.isFinite(options.amp)?options.amp:.22,ell=options.scale||2.6,layers=Math.max(1,Math.min(9,options.layers||6)),dir=(options.directionDeg??18)*Math.PI/180,warp=options.warp??.42,bias=options.bias??.32;"
new = "const requestedAmp=Number.isFinite(options.amp)?options.amp:.22,ell=options.scale||2.6,requestedLayers=Math.max(1,Math.min(9,options.layers||6)),gridStep=Math.max(.05,options.gridStep||.5),minimumGeometryScale=gridStep*2,maxGeometryLayers=Math.max(1,1+Math.floor(Math.log2(Math.max(1,ell/minimumGeometryScale)))),layers=Math.min(requestedLayers,maxGeometryLayers),meshSafetyFraction=options.meshSafetyFraction??.08,dir=(options.directionDeg??18)*Math.PI/180,warp=options.warp??.42,bias=options.bias??.32;"
assert old in s, 'geometry parameter block missing'
s = s.replace(old, new, 1)

anchor = "function mouthProtect(x,y,z,cx,cy,cz,rx,ry,rz){let q=Math.hypot((x-cx)/rx,(y-cy)/ry,(z-cz)/rz),shell=1-smooth(.055,.24,Math.abs(q-1)),front=smooth(cz-1.5,cz+3.0,z);return shell*front}"
mesh_safety = r'''const localScale=new Float32Array(count);localScale.fill(Infinity);
function edgeLen(a,b){let A=a*3,B=b*3;return Math.hypot(P0[A]-P0[B],P0[A+1]-P0[B+1],P0[A+2]-P0[B+2])}
function safeMin(id,v){if(Number.isFinite(v)&&v>1e-8&&v<localScale[id])localScale[id]=v}
for(let q=0;q<I.length;q+=3){let a=I[q],b=I[q+1],c=I[q+2],A=a*3,B=b*3,C=c*3,ab=edgeLen(a,b),bc=edgeLen(b,c),ca=edgeLen(c,a),ux=P0[B]-P0[A],uy=P0[B+1]-P0[A+1],uz=P0[B+2]-P0[A+2],vx=P0[C]-P0[A],vy=P0[C+1]-P0[A+1],vz=P0[C+2]-P0[A+2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,area2=Math.hypot(nx,ny,nz);safeMin(a,Math.min(ab,ca,area2/Math.max(bc,1e-9)));safeMin(b,Math.min(ab,bc,area2/Math.max(ca,1e-9)));safeMin(c,Math.min(bc,ca,area2/Math.max(ab,1e-9)))}
let minLocalScale=Infinity,maxLocalScale=0,finiteLocalScaleCount=0;for(let i=0;i<count;i++){if(!Number.isFinite(localScale[i]))localScale[i]=gridStep;minLocalScale=Math.min(minLocalScale,localScale[i]);maxLocalScale=Math.max(maxLocalScale,localScale[i]);finiteLocalScaleCount++}
''' + anchor
assert anchor in s, 'mesh safety insertion point missing'
s = s.replace(anchor, mesh_safety, 1)

old_build = "function build(A){let P=new Float32Array(P0),disp=new Float32Array(count),sum2=0,maxD=0,protectedCount=0,protectedDrift=0;for(let i=0;i<count;i++){let k=i*3,g=gateAt(i);if(g<1e-7){protectedCount++;continue}let d=detailAt(i),eroded=d-bias*Math.max(0,d)*Math.max(0,d),off=A*g*eroded;disp[i]=off;P[k]=P0[k]+N0[k]*off;P[k+1]=P0[k+1]+N0[k+1]*off;P[k+2]=P0[k+2]+N0[k+2]*off;let ad=Math.abs(off);maxD=Math.max(maxD,ad);sum2+=off*off}for(let i=0;i<count;i++)if(gateAt(i)<1e-7){let k=i*3;if(P[k]!==P0[k]||P[k+1]!==P0[k+1]||P[k+2]!==P0[k+2])protectedDrift++}let flips=flipCount(P);return{P,disp,maxD,rms:Math.sqrt(sum2/count),protectedCount,protectedDrift,flips}}"
new_build = "function build(A){let P=new Float32Array(P0),disp=new Float32Array(count),sum2=0,maxD=0,protectedCount=0,protectedDrift=0,clippedVertexCount=0,minAppliedCap=Infinity,maxAppliedCap=0;for(let i=0;i<count;i++){let k=i*3,g=gateAt(i);if(g<1e-7){protectedCount++;continue}let d=detailAt(i),eroded=d-bias*Math.max(0,d)*Math.max(0,d),rawOff=A*g*eroded,cap=Math.max(1e-6,localScale[i]*meshSafetyFraction),off=clamp(rawOff,-cap,cap);if(Math.abs(off-rawOff)>1e-12)clippedVertexCount++;minAppliedCap=Math.min(minAppliedCap,cap);maxAppliedCap=Math.max(maxAppliedCap,cap);disp[i]=off;P[k]=P0[k]+N0[k]*off;P[k+1]=P0[k+1]+N0[k+1]*off;P[k+2]=P0[k+2]+N0[k+2]*off;let ad=Math.abs(off);maxD=Math.max(maxD,ad);sum2+=off*off}for(let i=0;i<count;i++)if(gateAt(i)<1e-7){let k=i*3;if(P[k]!==P0[k]||P[k+1]!==P0[k+1]||P[k+2]!==P0[k+2])protectedDrift++}let flips=flipCount(P);return{P,disp,maxD,rms:Math.sqrt(sum2/count),protectedCount,protectedDrift,flips,clippedVertexCount,minAppliedCap:Number.isFinite(minAppliedCap)?minAppliedCap:0,maxAppliedCap}}"
assert old_build in s, 'mesh-aware displacement integration point missing'
s = s.replace(old_build, new_build, 1)

old = "let attempts=[requestedAmp,requestedAmp*.75,requestedAmp*.5,requestedAmp*.25,0],chosen=null,effectiveAmp=0;for(let A of attempts){let r=build(A);if(r.flips===0&&r.protectedDrift===0){chosen=r;effectiveAmp=A;break}}if(!chosen)throw Error('Microscope geometry safety gate failed');"
new = "let attempts=[requestedAmp,requestedAmp*.75,requestedAmp*.5,requestedAmp*.25,requestedAmp*.125,requestedAmp*.0625,0],attemptReports=[],chosen=null,effectiveAmp=0;for(let A of attempts){let r=build(A);attemptReports.push({amplitudeM:A,maxDisplacementM:r.maxD,rmsDisplacementM:r.rms,triangleFlipCount:r.flips,protectedDriftCount:r.protectedDrift,clippedVertexCount:r.clippedVertexCount});if(r.flips===0&&r.protectedDrift===0){chosen=r;effectiveAmp=A;break}}if(!chosen)throw Error('Microscope geometry safety gate failed');"
assert old in s, 'amplitude backoff block missing'
s = s.replace(old, new, 1)

old = "mesh.positions=chosen.P;mesh.N=N;mesh.microscopeGeometry={schema:'LANDSCAPE_MICROSCOPE_GEOMETRY_R1',requestedAmplitudeM:requestedAmp,effectiveAmplitudeM:effectiveAmp,scaleM:ell,layers,directionDeg:(options.directionDeg??18),warp,bias,maxDisplacementM:chosen.maxD,rmsDisplacementM:chosen.rms,maxNormalAngleDeg:maxNormal,protectedVertexCount:chosen.protectedCount,protectedDriftCount:chosen.protectedDrift,triangleFlipCount:chosen.flips,referenceDomain:'immutable main.rest P0',cameraAffectsGeometry:false,timeAffectsStaticRock:false,fieldCoupled:false};"
new = "mesh.positions=chosen.P;mesh.N=N;mesh.microscopeGeometry={schema:'LANDSCAPE_MICROSCOPE_GEOMETRY_R1',requestedAmplitudeM:requestedAmp,effectiveAmplitudeM:effectiveAmp,scaleM:ell,requestedLayers,effectiveLayers:layers,gridStepM:gridStep,minimumGeometryScaleM:minimumGeometryScale,finestGeometryScaleM:ell/Math.pow(2,layers-1),finerScalesRemainSurfaceOnly:layers<requestedLayers,meshSafetyFraction,minLocalMeshScaleM:minLocalScale,maxLocalMeshScaleM:maxLocalScale,localScaleVertexCount:finiteLocalScaleCount,clippedVertexCount:chosen.clippedVertexCount,minAppliedCapM:chosen.minAppliedCap,maxAppliedCapM:chosen.maxAppliedCap,attempts:attemptReports,directionDeg:(options.directionDeg??18),warp,bias,maxDisplacementM:chosen.maxD,rmsDisplacementM:chosen.rms,maxNormalAngleDeg:maxNormal,protectedVertexCount:chosen.protectedCount,protectedDriftCount:chosen.protectedDrift,triangleFlipCount:chosen.flips,referenceDomain:'immutable main.rest P0',cameraAffectsGeometry:false,timeAffectsStaticRock:false,fieldCoupled:false};"
assert old in s, 'geometry report block missing'
s = s.replace(old, new, 1)

old = "const geometryMicroscope=microscopeGeometryR1(main,{amp:geometryAmp,scale:2.6,layers:6,directionDeg:18,warp:.42,bias:.32});"
new = "const geometryMicroscope=microscopeGeometryR1(main,{amp:geometryAmp,scale:2.6,layers:6,gridStep:step,meshSafetyFraction:.08,directionDeg:18,warp:.42,bias:.32});"
assert old in s, 'geometry call block missing'
s = s.replace(old, new, 1)

HTML.write_text(s, encoding='utf-8')

b = json.loads(BUILD.read_text(encoding='utf-8'))
b['geometry']['requestedLayers'] = 6
b['geometry']['effectiveLayersExpected'] = 2
b['geometry']['gridStepM'] = 0.5
b['geometry']['minimumGeometryScaleM'] = 1.0
b['geometry']['finestGeometryScaleM'] = 1.3
b['geometry']['finerScalesRemainSurfaceOnly'] = True
b['geometry']['meshSafetyFraction'] = 0.08
b['geometry']['localMeshSafety'] = 'per-vertex displacement is capped by 8% of the minimum incident edge/triangle-altitude scale'
b['geometry'].pop('layers', None)
b['geometry']['bandwidthRule'] = 'real geometry only for scales >= 2 * fixed mesh step; finer Microscope scales remain shading/surface response'
BUILD.write_text(json.dumps(b, ensure_ascii=False, indent=2), encoding='utf-8')

print(json.dumps({
    'requestedLayers': 6,
    'effectiveLayersExpected': 2,
    'gridStepM': 0.5,
    'minimumGeometryScaleM': 1.0,
    'finestGeometryScaleM': 1.3,
    'meshSafetyFraction': 0.08,
}, ensure_ascii=False))
