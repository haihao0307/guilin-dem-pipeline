import{buildCatalog,valueAt,writeValue,rowStatus}from'./catalog.mjs';
/** UI transaction adapter only. All deformation and validation stay in CommonPerson. */
export class WorkbenchController extends EventTarget{
 constructor({model,contract,defaults,localGate,onGeometry=()=>{}}){super();this.model=model;this.catalog=buildCatalog(contract);this.defaults=structuredClone(defaults);this.localGate=localGate;this.onGeometry=onGeometry;this.positionReference=model.positions;this.faceReference=model.faces;this.revision=0;}
 state(){return structuredClone(this.model.state);}
 status(row){return rowStatus(row,this.model.state,{localGate:this.localGate,bodyDriver:!!this.model.bodyDriver});}
 value(row){return valueAt(this.model.state,row);}
 commit(next){this.model.compute(next);return this.changed();}
 changed(){if(this.model.positions!==this.positionReference||this.model.faces!==this.faceReference)throw Error('Core replaced the fixed canonical buffers');this.revision++;this.onGeometry(this.model.positions,this.model.faces);this.dispatchEvent(new Event('change'));return this.state();}
 set(key,value){const row=this.catalog.byKey.get(key);if(!row)throw Error('Unknown parameter');const status=this.status(row);if(!status.editable)throw Error(status.reason);return this.commit(writeValue(this.state(),row,value));}
 setOwner(key,value){const owner=this.catalog.contract.currentOwners[key];if(!owner||!owner.values.includes(value))throw Error('该来源尚未接通，不能启用');const next=this.state();next.owners[key]=value;return this.commit(next);}
 resetGroup(id){const rows=this.catalog.rows.filter(r=>r.group===id),next=this.state();for(const row of rows)writeValue(next,row,valueAt(this.defaults,row));return this.commit(next);}
 resetSource(source){const next=this.state();next[source]=structuredClone(this.defaults[source]);return this.commit(next);}
 resetAll(){return this.commit(structuredClone(this.defaults));}
 archive(){return this.model.archive();}
 restore(archive){this.model.restore(archive);return this.changed();}
 metrics(){return {...this.model.metrics(),revision:this.revision,fixedPositionBuffer:this.model.positions===this.positionReference,fixedIndexBuffer:this.model.faces===this.faceReference};}
 summary(){const counts={active:0,inactive:0,pending:0,locked:0,loading:0};for(const row of this.catalog.rows)counts[this.status(row).kind]++;return {catalogScalars:1596,extraBoneTranslationScalars:312,correctiveToggles:1,...counts};}
}
