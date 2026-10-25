/** Photo-informed appearance only; geometry and light settings are not inputs. */
export const MATERIAL_PRESETS={
 lowrise:{base:'#e4dfcb',accent:'#aaa48e',frame:'#a9ada9',glass:'#8eaaa8',type:1,label:'浅奶油涂饰墙候选；实见色区，基材待核'},
 kcc:{base:'#deded4',accent:'#727674',frame:'#404b49',glass:'#829e9b',type:2,label:'已见高层浅横面砖、深灰窗下砖带；具体分区为可替换拟合'},
 warehouse:{base:'#aa7063',accent:'#ddd1b5',frame:'#a6aaa3',glass:'#879b98',type:3,label:'红褐小块饰面候选；浅米白水平凸带，细缝尺寸未实测'}
};
export const materialOverrides={};
export function setMaterialBase(id,value){if(!MATERIAL_PRESETS[id]||!/^#[0-9a-f]{6}$/i.test(value))throw Error('Invalid material color');materialOverrides[id]=value;}
export function materialForRecord(r){const id=r.caseId??({'B367642137201063C0':'lowrise','B359971994401063C0':'kcc','B369121858401063C0':'warehouse'}[r.buildingId]),p=MATERIAL_PRESETS[id];
 if(!p)return{color:r.color,type:0,accent:r.color};
 let color='#b9b8b3',type=1,accent=p.accent;
 // Neutral material candidates replace legacy diagnostic colors. These are
 // not claims that the real building's hidden structure was surveyed.
 const candidates={UNKNOWN:'#b9b8b3',wall:'#d6d4cb',column:'#bdbcb5',beam:'#bdbcb5',stair:'#bbb9b1',floor:'#b5b4ad',roof:'#777a76',elevator:'#9ca39f',handrail:'#737c79'};
 if(candidates[r.classKey])color=candidates[r.classKey];
 const outer=r.geometryKind==='unsigned-shell-surface'&&r.classKey==='wall';
 if(outer||(id==='lowrise'&&r.classKey==='wall')||(id==='warehouse'&&r.classKey==='wall')){color=materialOverrides[id]??p.base;type=p.type;}
 if(r.classKey==='door'){color=r.part==='leaf'?'#8e6b4e':'#726b60';type=r.part==='leaf'?4:1;}
 if(r.classKey==='window'){color=r.part==='glass'?p.glass:p.frame;}
 if(id==='warehouse'&&r.classKey==='grille')color='#81564c';
 if(id==='warehouse'&&r.classKey==='equipment')color='#d6d3bf';
 if(id==='warehouse'&&r.classKey==='equipment_recess')color='#4f5753';
 // Every source tower facade uses the same photo-informed tile family, not
 // only the six window-bearing faces. This is an appearance extrapolation,
 // not per-face material survey; podium/internal records are not changed.
 if(id==='kcc'&&outer)type=2;
 return{color,type,accent,evidence:p.label,sourcePatchId:r.sourcePatchId??null};
}
export function prepareMaterialBands(scene){for(const r of scene.registry){r.materialBands=[];if(r.caseId==='warehouse'&&r.sourcePatchId==='p024'&&r.geometryKind==='unsigned-shell-surface'){r.materialBands=[[56,120],[170,258],[310,403],[454,543],[596,685],[740,828],[880,972],[1025,1116],[1170,1258],[1310,1400]].map(([a,b])=>[-1000,1000,(1440-b)/1440*34.07299805,(1440-a)/1440*34.07299805]).sort((a,b)=>a[2]-b[2]);r.materialFrame=[0,0,0,0];continue;}if(r.caseId==='warehouse'&&r.sourcePatchId==='p012'&&r.geometryKind==='unsigned-shell-surface'){r.materialBands=[[27,57],[77,129],[149,201],[222,274],[295,346],[368,419],[441,491],[513,565],[585,636],[657,710]].map(([a,b])=>[-1000,1000,(734-b)/734*34.07299805,(734-a)/734*34.07299805]).sort((a,b)=>a[2]-b[2]);r.materialFrame=[0,0,0,0];continue;}if(r.caseId!=='kcc'||r.geometryKind!=='unsigned-shell-surface'||r.classKey!=='wall')continue;const p=scene.source.patches.find(p=>p.caseId==='kcc'&&p.localSourcePatchId===r.sourcePatchId);if(!p)continue;r.materialFrame=[p.origin[0],p.origin[2],p.u[0],p.u[2]];for(const a of scene.model.hostedComponents.apertures){if(a.caseId!=='kcc'||a.host.sourcePatchId!==p.sourcePatchId)continue;const width=a.config?.width??a.bounds.max[0]-a.bounds.min[0],height=a.config?.height??1.2,center=a.host.origin,at=(center[0]-p.origin[0])*p.u[0]+(center[2]-p.origin[2])*p.u[2];r.materialBands.push([at-width*.5,at+width*.5,center[1]-height*.5-.60,center[1]-height*.5-.04]);}r.materialBands.sort((a,b)=>a[2]-b[2]);if(r.materialBands.length>44)throw Error('Material band registry capacity');}return scene;}
