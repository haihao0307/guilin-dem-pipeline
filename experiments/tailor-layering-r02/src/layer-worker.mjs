import {LayerWorld} from './layer-world.mjs';
let world=null;
let chain=Promise.resolve();
async function handle(d) {
 if(d.type==='init') {
  const response=await fetch(new URL('./upstream/cloth-kernel.wasm',import.meta.url));if(!response.ok)throw Error('物理核载入失败');
  world=await LayerWorld.create(d.body,d.rows,await response.arrayBuffer(),d.options);
 }else if(!world)throw Error('布料尚未准备');
 else if(d.type==='step')world.step(d.dt??1/120);
 else if(d.type==='add')world.add(d.row);
 else if(d.type==='remove')world.remove(d.garmentId);
 else if(d.type==='reset')world.reset();
 else if(d.type==='settings')world.set(d.options);
 else if(d.type==='thickness')world.setThickness(d.garmentId,d.value);
 else if(d.type==='perturb')world.perturb(d.garmentId,d.kind);
 else if(d.type==='drag')world.setDrag(d.drag);
 else if(d.type!=='snapshot')throw Error('未知布料操作');
 const result=world.snapshot({bodySamples:d.bodySamples===true});
 if(d.type==='snapshot'&&d.bodySamples===true){
  // A manual inspection measures the current geometry and configured margins.
  // It does not replace solver history, alter positions or advance its clock.
  const began=performance.now();
  result.audit.contact=world.options.contactEnabled?world.contacts.measure(world.surfaces()):null;
  result.audit.bodyEnvelope=world.measureBodyEnvelope();
  result.audit.explicitContactInspection={measurementOnly:true,advancedSimulation:false,
   measurementMS:performance.now()-began,
   scope:'Current discrete cross-garment contacts and body triangle-feature envelope; not continuous collision or individual-yarn certification'};
 }
 const transfer=result.rows.flatMap(r=>[r.positions.buffer,r.normals.buffer]);
 self.postMessage({id:d.id,...result},transfer);
}
self.onmessage=({data:d})=>{chain=chain.then(()=>handle(d)).catch(e=>self.postMessage({id:d.id,error:e.message,stack:e.stack}));};
