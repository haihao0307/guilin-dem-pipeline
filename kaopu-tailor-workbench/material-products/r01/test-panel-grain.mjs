import assert from 'node:assert/strict';
import fs from 'node:fs';import zlib from 'node:zlib';import {createHash} from 'node:crypto';
import {mapPanelUV,grainAxes} from './panel-grain.mjs';
const root=new URL('./',import.meta.url),lock=JSON.parse(fs.readFileSync(new URL('SOURCE_LOCK.json',root)));
const rows=[];let edgeCount=0,maxError=0;
for(const[id,input]of Object.entries(lock.garments)){
 const bytes=fs.readFileSync(new URL(input.path,root));assert.equal(createHash('sha256').update(bytes).digest('hex'),input.sha256,'Original native garment changed: '+id);
 const packet=JSON.parse(zlib.gunzipSync(bytes));assert(packet.record.staticGate.passed);
 for(const panel of packet.spec.panels){
  const [a,b,c,d]=grainAxes(panel.id);assert.equal(a*a+c*c,1);assert.equal(b*b+d*d,1);assert.equal(a*b+c*d,0);assert.equal(a*d-b*c,1);
  let worst=0;
  for(const face of panel.triangles)for(const[i,j]of[[face[0],face[1]],[face[1],face[2]],[face[2],face[0]]]){
   const p=panel.uvMm[i],q=panel.uvMm[j],u=mapPanelUV(panel.id,...p),v=mapPanelUV(panel.id,...q);
   const before=Math.hypot(p[0]-q[0],p[1]-q[1])*.001,after=Math.hypot(u[0]-v[0],u[1]-v[1]);worst=Math.max(worst,Math.abs(before-after));edgeCount++;
  }
  assert(worst<1e-12,'Appearance mapping stretched a cutting edge');maxError=Math.max(maxError,worst);rows.push({garment:id,panel:panel.id,matrix:[a,b,c,d],maximumEdgeLengthErrorM:worst});
 }
}
assert.equal(Object.keys(lock.garments).length,7);assert.equal(rows.length,42);
assert.deepEqual(mapPanelUV('left_sleeve_f',-512,0),[0,.512]);assert.deepEqual(mapPanelUV('right_sleeve_f',512,0),[0,.512]);
assert.throws(()=>mapPanelUV('left_ftorso',NaN,0));
const report={passed:true,garments:7,panels:rows.length,edgesChecked:edgeCount,maximumEdgeLengthErrorM:maxError,garmentCoordinatesUnchanged:true,originalRestPanelsUnchanged:true,physicalSolverGrainChanged:false,appearanceGrainCalibratedBy:'Known original sleeve pattern long axis X versus torso and trouser long axis Y; no manufacturing certificate',rows};
fs.writeFileSync(new URL('PANEL_GRAIN_REPORT.json',root),JSON.stringify(report,null,2));console.log('PANEL_GRAIN_METRIC_PASS',report.panels,edgeCount,maxError);
