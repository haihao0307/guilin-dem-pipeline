from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / 'workbenches/landscape-surface-r5-k2-geometry-r1/index.html'
BUILD = ROOT / 'workbenches/landscape-surface-r5-k2-geometry-r1/build.json'

s = HTML.read_text(encoding='utf-8')

old = "const requestedAmp=Number.isFinite(options.amp)?options.amp:.22,ell=options.scale||2.6,layers=Math.max(1,Math.min(9,options.layers||6)),dir=(options.directionDeg??18)*Math.PI/180,warp=options.warp??.42,bias=options.bias??.32;"
new = "const requestedAmp=Number.isFinite(options.amp)?options.amp:.22,ell=options.scale||2.6,requestedLayers=Math.max(1,Math.min(9,options.layers||6)),gridStep=Math.max(.05,options.gridStep||.5),minimumGeometryScale=gridStep*2,maxGeometryLayers=Math.max(1,1+Math.floor(Math.log2(Math.max(1,ell/minimumGeometryScale)))),layers=Math.min(requestedLayers,maxGeometryLayers),dir=(options.directionDeg??18)*Math.PI/180,warp=options.warp??.42,bias=options.bias??.32;"
assert old in s, 'geometry parameter block missing'
s = s.replace(old, new, 1)

old = "let attempts=[requestedAmp,requestedAmp*.75,requestedAmp*.5,requestedAmp*.25,0],chosen=null,effectiveAmp=0;"
new = "let attempts=[requestedAmp,requestedAmp*.75,requestedAmp*.5,requestedAmp*.25,requestedAmp*.125,requestedAmp*.0625,0],chosen=null,effectiveAmp=0;"
assert old in s, 'amplitude backoff block missing'
s = s.replace(old, new, 1)

old = "mesh.positions=chosen.P;mesh.N=N;mesh.microscopeGeometry={schema:'LANDSCAPE_MICROSCOPE_GEOMETRY_R1',requestedAmplitudeM:requestedAmp,effectiveAmplitudeM:effectiveAmp,scaleM:ell,layers,directionDeg:(options.directionDeg??18),warp,bias,maxDisplacementM:chosen.maxD,rmsDisplacementM:chosen.rms,maxNormalAngleDeg:maxNormal,protectedVertexCount:chosen.protectedCount,protectedDriftCount:chosen.protectedDrift,triangleFlipCount:chosen.flips,referenceDomain:'immutable main.rest P0',cameraAffectsGeometry:false,timeAffectsStaticRock:false,fieldCoupled:false};"
new = "mesh.positions=chosen.P;mesh.N=N;mesh.microscopeGeometry={schema:'LANDSCAPE_MICROSCOPE_GEOMETRY_R1',requestedAmplitudeM:requestedAmp,effectiveAmplitudeM:effectiveAmp,scaleM:ell,requestedLayers,effectiveLayers:layers,gridStepM:gridStep,minimumGeometryScaleM:minimumGeometryScale,finestGeometryScaleM:ell/Math.pow(2,layers-1),finerScalesRemainSurfaceOnly:layers<requestedLayers,directionDeg:(options.directionDeg??18),warp,bias,maxDisplacementM:chosen.maxD,rmsDisplacementM:chosen.rms,maxNormalAngleDeg:maxNormal,protectedVertexCount:chosen.protectedCount,protectedDriftCount:chosen.protectedDrift,triangleFlipCount:chosen.flips,referenceDomain:'immutable main.rest P0',cameraAffectsGeometry:false,timeAffectsStaticRock:false,fieldCoupled:false};"
assert old in s, 'geometry report block missing'
s = s.replace(old, new, 1)

old = "const geometryMicroscope=microscopeGeometryR1(main,{amp:geometryAmp,scale:2.6,layers:6,directionDeg:18,warp:.42,bias:.32});"
new = "const geometryMicroscope=microscopeGeometryR1(main,{amp:geometryAmp,scale:2.6,layers:6,gridStep:step,directionDeg:18,warp:.42,bias:.32});"
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
b['geometry'].pop('layers', None)
b['geometry']['bandwidthRule'] = 'real geometry only for scales >= 2 * fixed mesh step; finer Microscope scales remain shading/surface response'
BUILD.write_text(json.dumps(b, ensure_ascii=False, indent=2), encoding='utf-8')

print(json.dumps({
    'requestedLayers': 6,
    'effectiveLayersExpected': 2,
    'gridStepM': 0.5,
    'minimumGeometryScaleM': 1.0,
    'finestGeometryScaleM': 1.3,
}, ensure_ascii=False))
