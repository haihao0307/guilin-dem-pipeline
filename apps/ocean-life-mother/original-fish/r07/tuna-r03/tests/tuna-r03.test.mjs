import assert from 'node:assert/strict';
import {
  TUNA_R03_PROFILE as P,resampleSections,sectionAt,buildBodyMesh,buildMedianFins,buildLateralFins,
  buildFinlets,buildEyes,buildMouthAndOperculum,buildKeels,buildSemanticSkeleton,buildTunaR03,motionAt,finletMotion
} from '../source-bundle.mjs';

const finite=a=>a.every(Number.isFinite);
let assertions=0;
const ok=(value,message)=>{assert(value,message);assertions++};
const eq=(a,b,message)=>{assert.equal(a,b,message);assertions++};

// Exact identity and evidence boundary.
eq(P.schema,'kaopu.original-fish.tuna-native-profile/0.3');
eq(P.source.referenceId,'FISH-REF-002');
eq(P.source.geometryRigMotion.sha256,'f75f073a2999ee20c4839434d28f90565e486b50270e663f48484cca2dbae9f0');
eq(P.source.appearance.sha256,'5603d4aabc9a1127856841335a86ae7aa462b6b25d1a6586e93bf644f4d47abe');
eq(P.source.runtimeDependency,false);
eq(P.semanticRig.sourceJoints,98);
eq(P.semanticRig.nativeControls,24);
eq(P.identity.biologicalSpecies,'UNVERIFIED_TUNA_REFERENCE');

// Sections are physical and monotonic.
eq(P.bodySections.length,41);
for(let i=0;i<P.bodySections.length;i++){
  const [u,w,top,bottom]=P.bodySections[i];
  ok([u,w,top,bottom].every(Number.isFinite),`finite section ${i}`);
  ok(w>0&&top>bottom,`physical section ${i}`);
  if(i)ok(u>P.bodySections[i-1][0],`monotonic section ${i}`);
}
const sampled=resampleSections(P.bodySections,3);
ok(sampled.length>P.bodySections.length,'sections resampled');
for(let i=1;i<sampled.length;i++)ok(sampled[i][0]>sampled[i-1][0],'sampled monotonic');
const mid=sectionAt(.55),tail=sectionAt(.02),head=sectionAt(.98);
ok(mid[1]>tail[1]*4,'midbody wider than peduncle');
ok(mid[1]>head[1]*3,'midbody wider than snout');

// Generated semantic parts.
const body=buildBodyMesh({radialSegments:32,subdivisions:1});
ok(body.positions.length>0&&body.indices.length>0,'body generated');
ok(finite(body.positions)&&finite(body.indices),'body finite');
eq(body.material,'body');
const median=buildMedianFins();eq(median.length,6);ok(median.every(x=>x.transparent&&x.material==='fin'),'median fins transparent');
const lateral=buildLateralFins();eq(lateral.length,4);ok(lateral.every(x=>x.positions.length>0),'lateral fins generated');
const finlets=buildFinlets();eq(finlets.length,10);ok(finlets.every(x=>x.name.includes('Finlet')),'ten named finlets');
const eyes=buildEyes();eq(eyes.length,8);ok(eyes.some(x=>x.material==='cornea'&&x.transparent),'separate cornea');
const oral=buildMouthAndOperculum();eq(oral.length,5);ok(oral.some(x=>x.name==='mouthCavity'),'mouth cavity');ok(oral.filter(x=>x.name.startsWith('operculum')).length===2,'paired opercula');
const keels=buildKeels();eq(keels.length,2);ok(keels.every(x=>x.material==='keel'),'paired peduncle keels');
const skeleton=buildSemanticSkeleton();eq(skeleton.controls.length,24);ok(skeleton.segments.length>=20,'semantic skeleton connected');

const built=buildTunaR03();
eq(built.schema,'kaopu.original-fish.generated/0.3');
eq(built.branch,'tuna');
eq(built.sourceRuntimeDependency,false);
eq(built.parts.length,36);
eq(built.skeleton.controls.length,24);
for(const part of built.parts){ok(part.positions.length>0&&part.indices.length>0,`${part.name} nonempty`);ok(finite(part.positions)&&finite(part.indices),`${part.name} finite`)}
const names=new Set(built.parts.map(x=>x.name));
for(const name of['body','dorsalMain','dorsalRear','anal','caudalUpper','caudalLower','caudalRoot','pectoralLeft','pectoralRight','pelvicLeft','pelvicRight','eyeLeft','eyeRight','corneaLeft','corneaRight','irisLeft','pupilLeft','irisRight','pupilRight','upperLip','lowerLip','mouthCavity','operculumLeft','operculumRight','keelLeft','keelRight'])ok(names.has(name),`contains ${name}`);

// Motion relationships: stiff front, rising amplitude toward tail, phase delay and no scale channel.
const t=.43;
const front=motionAt(.90,t,{amplitude:.06,period:2.166666746});
const rear=motionAt(.12,t,{amplitude:.06,period:2.166666746});
ok(Math.abs(rear.lateral)>Math.abs(front.lateral)*2,'tail amplitude dominates front');
ok(rear.envelope>front.envelope,'motion envelope rises tailward');
const fm0=finletMotion(0,t,{period:2.166666746,side:1});
const fm4=finletMotion(4,t,{period:2.166666746,side:1});
ok(Math.abs(fm0.pitch-fm4.pitch)>1e-4,'finlet posterior phase delay');
const dorsal=finletMotion(2,t,{period:2.166666746,side:1});
const ventral=finletMotion(2,t,{period:2.166666746,side:-1});
ok(Math.abs(dorsal.pitch+ventral.pitch)<1e-10,'dorsal ventral phase relationship');
eq(P.acceptance.visual,false);eq(P.acceptance.motion,false);eq(P.acceptance.productionReady,false);

const triangles=built.parts.reduce((s,p)=>s+p.indices.length/3,0);
ok(triangles>12000&&triangles<30000,'bounded triangle budget');
console.log(`Original Fish Tuna R03: ${assertions} assertions passed; ${built.parts.length} parts; ${Math.round(triangles)} triangles`);
