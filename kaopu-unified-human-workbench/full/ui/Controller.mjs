import{ALL_PRESETS,createPresetState,presetRecord}from'./PresetCatalogueR2.mjs?v=characters-r02-20261008';
import{buildCatalog,valueAt,writeValue,rowStatus}from'./catalog.mjs?v=human-r2-20261008';
/** UI transaction adapter only. All deformation and validation stay in CommonPerson. */
export class WorkbenchController extends EventTarget{
 constructor({model,contract,defaults,localGate,onGeometry=()=>{}}){super();this.model=model;this.catalog=buildCatalog(contract);this.defaults=structuredClone(defaults);this.localGate=localGate;this.onGeometry=onGeometry;this.positionReference=model.positions;this.faceReference=model.faces;this.revision=0;this.presetId=null;this.presetSignatures=new Map(ALL_PRESETS.map(p=>[JSON.stringify(createPresetState(p.id,this.defaults)),p.id]));}
 state(){return structuredClone(this.model.state);}
 status(row){return rowStatus(row,this.model.state,{localGate:this.localGate,bodyDriver:!!this.model.bodyDriver,semanticHead:!!this.model.headTransfer});}
 value(row){return valueAt(this.model.state,row);}
 commit(next){this.model.compute(next);return this.changed();}
 changed(){if(this.model.positions!==this.positionReference||this.model.faces!==this.faceReference)throw Error('Core replaced the fixed canonical buffers');this.presetId=this.presetSignatures.get(JSON.stringify(this.model.state))||null;this.revision++;this.onGeometry(this.model.positions,this.model.faces);this.dispatchEvent(new Event('change'));return this.state();}
 set(key,value){const row=this.catalog.byKey.get(key);if(!row)throw Error('Unknown parameter');const status=this.status(row);if(!status.editable)throw Error(status.reason);return this.commit(writeValue(this.state(),row,value));}
 setOwner(key,value){const owner=this.catalog.contract.currentOwners[key];if(!owner||!owner.values.includes(value))throw Error('该来源尚未接通，不能启用');const next=this.state();if(key==='headShape'){next.headShapeComposition=value==='shared'?'shared-layers/1':'legacy-owner/1';if(value!=='shared')next.owners.headShape=value;}else next.owners[key]=value;return this.commit(next);}
 resetGroup(id){const rows=this.catalog.rows.filter(r=>r.group===id),next=this.state();for(const row of rows)writeValue(next,row,valueAt(this.defaults,row));return this.commit(next);}
 resetSource(source){const next=this.state();next[source]=structuredClone(this.defaults[source]);return this.commit(next);}
 applyPreset(id){return this.commit(createPresetState(id,this.defaults));}
 resetAll(){return this.commit(structuredClone(this.defaults));}
 archive(){const a=this.model.archive();if(this.presetId)a.preset={schema:'kaopu-human-preset-reference/1',id:this.presetId};if(this.archiveSurface)a.surface=this.archiveSurface();return a;}
 restore(archive){if(archive.surface&&archive.surface.schema!=='kaopu-common-surface/1')throw Error('Unsupported surface archive');this.model.restore(archive);if(archive.surface)this.restoreSurface?.(archive.surface);return this.changed();}
 metrics(){return {...this.model.metrics(),revision:this.revision,fixedPositionBuffer:this.model.positions===this.positionReference,fixedIndexBuffer:this.model.faces===this.faceReference};}
 summary(){const counts={active:0,inactive:0,pending:0,locked:0,loading:0,'native-null':0};for(const row of this.catalog.rows)counts[this.status(row).kind]++;return {catalogScalars:1603,extraBoneTranslationScalars:312,correctiveToggles:1,...counts};}
}
