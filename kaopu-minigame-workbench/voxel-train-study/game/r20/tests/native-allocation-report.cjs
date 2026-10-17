/* Read-only QA reporter. Missing pre-score data is explicit, never zero-valued. */
'use strict';
const assert=require('node:assert/strict');
const fields={peakStreetGeometryBytes:'peakAllocatedGeometryBytes',peakStreetInstanceBytes:'peakAllocatedInstanceBytes',peakStreetMaterials:'peakAllocatedMaterials',peakPendingCells:'pendingCells',maxCooperativeSliceMs:'maxSliceMs',maxCoverageExceptionMs:'maxCoverageMs'};
function summarizeRenderAllocation(events,gl){
 const initialized=[],uninitialized=[];let sawBatch=false;
 for(const [index,row] of events.entries()){
  if(!row.batch){
   const life=row.lifecycle;
   assert(!sawBatch&&life?.status==='score-loading'&&life.ready===false&&life.started===false&&row.distance===0&&row.elapsed===0&&row.builds===0&&row.loads===0&&row.unloads===0,'Missing render batch outside pre-score initialization at event '+index);
   uninitialized.push({index,distance:row.distance,elapsed:row.elapsed,ms:row.ms,lifecycle:life,reason:'Score not ready; no street allocation measurement yet'});continue;
  }
  sawBatch=true;initialized.push(row);
  for(const key of Object.values(fields))assert(Number.isFinite(row.batch[key])&&row.batch[key]>=0,'Invalid allocation measurement '+key+' at event '+index);
 }
 assert(initialized.length>0,'No initialized street allocation measurements');
 const out={scope:'Street CPU backing arrays include detached staging; actual uploaded whole-game WebGL buffers exclude textures/programs. Initial uninitialized rows are reported separately, not assumed zero; their CPU time remains in world-update statistics.',measuredRows:initialized.length,uninitializedRows:uninitialized};
 for(const [name,key] of Object.entries(fields))out[name]=Math.max(...initialized.map(row=>row.batch[key]));
 out.actualWebGLBuffers=gl;return out;
}
function validateFirstActiveFrame(frame){
 assert(frame&&frame.ready&&frame.batchPresent,'First interactive native frame must have initialized street geometry');
 assert(['active','streaming'].includes(frame.status));assert(frame.required.length>0,'First native frame needs a non-empty protected coverage set');
 assert.deepEqual(frame.missing,[]);assert(frame.required.every(id=>frame.renderedIds.includes(id)),'First native frame must actually render every protected parcel');return frame;
}
module.exports={summarizeRenderAllocation,validateFirstActiveFrame};
