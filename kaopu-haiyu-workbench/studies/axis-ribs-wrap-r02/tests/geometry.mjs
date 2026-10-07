import {evaluate,inspect,dot,sub} from '../geometry.mjs';
import {evaluate as original, project as originalProject} from '../../axis-ribs-r01/geometry.mjs';
import {project} from '../geometry.mjs';
import assert from 'node:assert/strict';import fs from 'node:fs';
const checks=[];let maxRootError=0,maxOrtho=0,maxRecoveredLocalError=0;
for(const amplitude of[0,.4,1,2])for(const time of[0,.5,1,1.5,2,2.5,3,3.5,4])for(const ribCount of[2,12,24]){
 const p=evaluate({amplitude,time,ribCount}),old=original({amplitude,time,ribCount}),m=inspect(p);
 assert.deepEqual(p.axis,old.axis);assert.deepEqual(p.frames,old.frames);assert.deepEqual(p.stations,old.stations);
 assert.ok(m.allFinite);assert.equal(m.rootError,0);assert.ok(m.orthogonality<1e-12);assert.ok(m.adjacentNormalDot>.999);maxRootError=Math.max(maxRootError,m.rootError);maxOrtho=Math.max(maxOrtho,m.orthogonality);
 for(const r of p.ribs){const o=old.ribs.find(x=>x.id===r.id),st=p.stations[r.stationId],local=r.local,maxY=Math.max(...local.map(v=>Math.abs(v[1]))),oldMaxY=Math.max(...o.local.map(v=>Math.abs(v[1])));
  assert.ok(local.slice(1).every(v=>v[2]<0));assert.ok(local.slice(1).every(v=>r.side*v[1]>0));assert.ok(Math.abs(local.at(-1)[1])<maxY*.69);assert.ok(Math.abs(local.at(-1)[1])<Math.abs(local.at(-2)[1]));
  assert.ok(maxY/oldMaxY>.938&&maxY/oldMaxY<.941);assert.deepEqual(local.map(v=>v[0]),o.local.map(v=>v[0]));
  for(let k=0;k<r.points.length;k++){const delta=sub(r.points[k],st.root);for(const [j,key]of['T','N','B'].entries())maxRecoveredLocalError=Math.max(maxRecoveredLocalError,Math.abs(dot(delta,st.frame[key])-local[k][j]));}
 }
 for(const view of['front','top','side','orbit'])for(const point of p.axis)assert.deepEqual(project(point,view,.71,-.52),originalProject(point,view,.71,-.52));
 checks.push({amplitude,time,ribCount});
}
let boundaryStates=0;for(const wrapAngle of[2.1,2.4,2.75])for(const widthScale of[.85,.94,1])for(const depthScale of[.35,.5,.75])for(const amplitude of[0,2])for(const time of[0,1,2,3]){const p=evaluate({wrapAngle,widthScale,depthScale,amplitude,time}),m=inspect(p);assert.equal(m.rootError,0);assert.ok(m.allFinite);for(const r of p.ribs){assert.ok(r.local.slice(1).every(v=>v[2]<0));assert.ok(Math.abs(r.local.at(-1)[1])<Math.abs(r.local.at(-2)[1]));}boundaryStates++;}
assert.ok(maxRecoveredLocalError<1e-12);for(const field of['wrapAngle','widthScale','depthScale'])assert.throws(()=>evaluate({[field]:0}),/wrapping/);
const report={ok:true,selectedStates:checks.length,boundaryStates,maxRootError,maxOrthogonality:maxOrtho,maxRecoveredLocalError,axisAndFramesExactlyMatchC01:true,projectionFunctionsUnchanged:true,leftNegativeYRightPositiveY:true,allRibsOnLocalChestSide:true,allTipsTurnInward:true,defaultMaxWidthRatioToC01:'0.938–0.941, about 6% narrower',defaultTipWidthRatioToArcMaximum:'less than 0.69',scope:'Finite selected parameter grid, not all curves or global self-collision guarantee',browserVerified:false};fs.writeFileSync(new URL('../shape-report.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
