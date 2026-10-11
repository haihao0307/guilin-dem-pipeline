/** R03 authored construction state. Geometry and original PBR consume the same
 * resolved values. This bounded artistic model is not calibrated corrosion. */
export const FABRIC_REVISION='KOWLOON_FABRIC_R03';
export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
export function partBounds(part){const s=part.shape;if(s.center){const h=s.size?s.size.map(v=>v/2):s.type==='fluted-column'||s.type==='cylinder'||s.type==='hollow-pipe'?[Math.max(s.radius,s.radiusTop||0),s.height/2,Math.max(s.radius,s.radiusTop||0)]:s.type==='triangle-prism'?[s.width/2,s.rise,s.depth/2]:[s.radius||.5,s.radius||.5,s.radius||.5];return{min:s.center.map((v,i)=>v-h[i]),max:s.center.map((v,i)=>v+h[i])};}const ps=s.corners||[s.a,s.b];return{min:[0,1,2].map(i=>Math.min(...ps.map(p=>p[i]))-(s.width||.05)/2),max:[0,1,2].map(i=>Math.max(...ps.map(p=>p[i]))+(s.width||.05)/2)};}
export function boxWeight(p,box,feather=.08){return p.reduce((v,x,i)=>v*smooth(box.min[i]-feather,box.min[i]+feather,x)*(1-smooth(box.max[i]-feather,box.max[i]+feather,x)),1);}
/** All locations derive from actual station members, never synthetic tiling. */
export function createStationFabricRecipe(plan,parts,config={}){
 const c={authoredAge:.64,currentWetness:.07,marineExposure:.6,maintenance:.75,...config};for(const[k,v]of Object.entries(c))if(!Number.isFinite(v)||v<0||v>1)throw Error('Bounded fabric '+k+' required');
 const sources=[],repairs=[];for(const row of [0,3])for(let bay=0;bay<=plan.score.shed.bays;bay+=2){const x=plan.back+bay*plan.score.shed.pitch,z=plan.supportRows[row];sources.push({id:'roof-outlet-'+bay+'-'+row,evidenceIds:['derived:gutter-'+row,'derived:downpipe-'+bay+'-'+row],position:[x,plan.score.shed.eave-.12,z],radius:.24,fallLength:bay===4?2.6:.48,strength:bay===4?.80:.28});}
 for(const part of parts.filter(p=>p.surface.feature.includes('cornice')||p.id.includes('cornice-'))){const b=partBounds(part),axis=b.max[0]-b.min[0]>b.max[2]-b.min[2]?0:2,other=axis===0?2:0;for(let a=b.min[axis]+1.2;a<b.max[axis];a+=5.2){const p=[(b.min[0]+b.max[0])/2,b.min[1],(b.min[2]+b.max[2])/2];p[axis]=a;p[other]=b.max[other];sources.push({id:part.id+'-joint-'+a,evidenceIds:['derived:'+part.id],position:p,radius:.16,fallLength:1.3,strength:.35});}}
 repairs.push({id:'column-recoat',evidenceIds:['design:maintenance-2026-r03-not-history'],bounds:{min:[plan.back+23.4,1.1,plan.supportRows[1]-.6],max:[plan.back+24.6,3.0,plan.supportRows[1]+.6]},strength:c.maintenance});
 repairs.push({id:'entrance-stone-repair',evidenceIds:['design:maintenance-2026-r03-not-history'],bounds:{min:[plan.hall.min[0]+2.0,1.0,plan.hall.max[2]-.7],max:[plan.hall.min[0]+4.5,3.2,plan.hall.max[2]+.8]},strength:c.maintenance});
 const copingZ=plan.platforms[1].bounds.max[2]-.14;repairs.push({id:'live-platform-coping-renewal',evidenceIds:['design:two-replaced-copings-r03-not-history'],bounds:{min:[-71.5,.8,copingZ-.3],max:[-69.2,1.4,copingZ+.3]},strength:c.maintenance});
 return freeze({schema:'kaopu.station.fabric/1',revision:FABRIC_REVISION,constructionPhase:'fictional-original-plus-local-maintenance',config:c,sources,repairs,units:'metre',ageUnit:'authored 0..1, not historical years',sourceContract:'original material identity retained; source maps locked separately',limits:{metalSectionLossM:.0008,stoneWearM:.004,woodWearM:.0012}});
}
export function resolveMemberFabric(recipe,part){
 const b=partBounds(part),role=part.surface.role,id=part.id,f=part.surface.feature||'',metal=/iron|metal|copper|brass|enamel/.test(role),stone=/stone|masonry/.test(role),wood=role==='aged-wood',roof=/roof|gutter/.test(id),ground=/foot|plinth|base|bollard/.test(id),hand=/handrail|bridge-rail.*1.08|bench.*arm/.test(id),tread=/tread|entry-step|coping/.test(id),walking=/deck|floor|concourse|promenade|quay-ground|pier-slab/.test(f+' '+id);
 const exposure=roof?.92:/wave|sea-quay|seawall/.test(f)?.88:/tower/.test(id)?.76:/sea-|entrance|portico/.test(id)?.57:/rail-|hall/.test(id)?.24:.18;
 const relevant=recipe.sources.filter(s=>s.position[0]>=b.min[0]-1&&s.position[0]<=b.max[0]+1&&s.position[2]>=b.min[2]-1&&s.position[2]<=b.max[2]+1&&s.position[1]>=b.min[1]&&s.position[1]-s.fallLength<=b.max[1]);
 const repairs=recipe.repairs.filter(e=>[0,1,2].every(i=>e.bounds.max[i]>=b.min[i]&&e.bounds.min[i]<=b.max[i]));
 const centre=b.min.map((v,i)=>(v+b.max[i])/2),extent=b.max.map((v,i)=>Math.max(.001,v-b.min[i]));
 function sample(p,n=[0,1,0]){
  const repair=1-repairs.reduce((v,e)=>v*(1-boxWeight(p,e.bounds)*e.strength),1);let runoff=0;
  for(const src of relevant){const dy=src.position[1]-p[1];if(dy<0||dy>src.fallLength)continue;const dist=Math.hypot(p[0]-src.position[0],p[2]-src.position[2]),wet=(1-smooth(src.radius*.25,src.radius,dist))*(1-smooth(src.fallLength*.25,src.fallLength,dy))*src.strength;runoff=1-(1-runoff)*(1-wet);}
  const base=(ground||stone||wood)?(1-smooth(1.12,1.72,p[1]))*.58:0;
  const seam=part.shape.a?Math.max(1-smooth(0,.15,Math.hypot(...p.map((v,i)=>v-part.shape.a[i]))),1-smooth(0,.15,Math.hypot(...p.map((v,i)=>v-part.shape.b[i])))):/collar|bolt|base|plinth|foot|drain|gutter/.test(id)?1:roof?Math.max(1-smooth(0,.12,p[0]-b.min[0]),1-smooth(0,.12,b.max[0]-p[0])):.08;
  const history=clamp((base+runoff+exposure*.15+seam*exposure*.23)*(1-repair*.9)),moisture=history*recipe.config.currentWetness;
  const along=part.shape.a?Math.min(1,Math.hypot(...p.map((v,i)=>v-part.shape.a[i]))/Math.max(.01,Math.hypot(...part.shape.b.map((v,i)=>v-part.shape.a[i])))):(p[0]-b.min[0])/extent[0];
  const use=hand?(.72+.28*Math.sin(Math.PI*clamp(along)))*smooth(-.2,.5,n[1]):tread?smooth(.25,.8,n[1])*(1-smooth(.25,.46,Math.abs((p[2]-centre[2])/extent[2]))):wood&&/seat/.test(id)?smooth(.3,.8,n[1])*(1-smooth(.33,.5,Math.abs((p[0]-centre[0])/extent[0]))):walking?smooth(.4,.9,n[1])*.18:0;
  const contactPolish=clamp(use*recipe.config.authoredAge*(1-repair*.65)),oxidation=metal?clamp(recipe.config.authoredAge*(history*.78+seam*exposure*.28)*(1-repair))*(1-contactPolish*.9):0;
  const damage=clamp(recipe.config.authoredAge*(.08+history*.65+exposure*.12)*(1-repair));
  const sectionLoss=metal?recipe.limits.metalSectionLossM*oxidation:stone?(tread?recipe.limits.stoneWearM*contactPolish:Math.min(.0013,damage*.0013)):wood?recipe.limits.woodWearM*contactPolish:0;
  return{moisture,history,damage,contactPolish,repair,oxidation,sectionLoss,roughnessDelta:damage*.07+oxidation*.23-contactPolish*.32-moisture*.18};
 }
 return Object.freeze({recipe,partId:id,role,bounds:freeze(b),metal,stone,wood,roof,ground,hand,tread,exposure,constructionPhase:recipe.constructionPhase,authoredAge:recipe.config.authoredAge,sourceIdentity:part.surface.sourceIdentity||role,sample,proof:{sharedGeometryPBR:true,newArtisticBridge:true,physicalCorrosionCalibration:false,sourceEvents:relevant.map(s=>s.id),repairEvents:repairs.map(e=>e.id)}});
}
/** No second wear skin. Actual receiver vertices and their PBR attributes are
 * resolved together before constructing a Three mesh. Structural footprint only shrinks. */
export function applyFabricGeometry(T,g,part,state){
 const p=g.attributes.position,n=g.attributes.normal,a=new Float32Array(p.count*4),d=new Float32Array(p.count*2);let maxLoss=0,changed=0;
 for(let i=0;i<p.count;i++){const q=[p.getX(i),p.getY(i),p.getZ(i)],v=[n.getX(i),n.getY(i),n.getZ(i)],s=state.sample(q,v);a.set([s.moisture,s.damage,s.contactPolish,s.repair],i*4);d.set([s.oxidation,s.history],i*2);const loss=s.sectionLoss;if(loss>1e-8){p.setXYZ(i,q[0]-v[0]*loss,q[1]-v[1]*loss,q[2]-v[2]*loss);changed++;maxLoss=Math.max(maxLoss,loss);}}
 g.setAttribute('fabricState',new T.BufferAttribute(a,4));g.setAttribute('fabricDetail',new T.BufferAttribute(d,2));p.needsUpdate=true;g.computeBoundingBox();g.computeBoundingSphere();g.userData.fabric={revision:FABRIC_REVISION,part:part.id,vertices:p.count,changedVertices:changed,maxSectionLossM:maxLoss,stateBeforeGeometry:true};return g;
}
