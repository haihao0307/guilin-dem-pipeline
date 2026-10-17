export const PROFILE_FIELDS=['ScalpDomain','AnatomicalZoneField','CandidateRootField','ActiveRootMask','FollicleDensityField','RootDirectionField','RootLiftField','PartingCurves','WhorlField','HairlineProfile','RegionalLengthField','CutField','GuideGroom','ClumpGraph','ChildStrandProfile','StrandMaterialField','RestShape','PhysicsProfile'];
export function assertProfile(p){
 if(p?.schema!=='kaopu/hair-style-profile@1')throw Error('Unsupported HairStyleProfile');
 for(const name of PROFILE_FIELDS)if(!p[name])throw Error('Missing profile field: '+name);
 const zones=p.AnatomicalZoneField.zones;if(zones.length!==10||new Set(zones.map(z=>z.id)).size!==10)throw Error('Ten distinct anatomical zones required');
 for(const {id}of zones){const length=p.RegionalLengthField.regions[id],cut=p.CutField.regions[id];if(!length||!cut||!(length.minArc>0)||!(length.maxArc>length.minArc)||!Number.isFinite(cut.hem)||length===cut)throw Error('Independent regional arc length and spatial cut required: '+id);}
 if(p.ScalpDomain.policy!=='approved-source-only'||p.ScalpDomain.sourceLock!=='F02.1@ee3c7fac9f187dd9e5dc81d1363c4814b9a015a3'||p.ScalpDomain.postProjectionClip!==false||p.ScalpDomain.lowerHairline)throw Error('Approved scalp boundary cannot be overridden by a second clip');
 if(p.CandidateRootField.resample!==false)throw Error('Candidate follicles must preserve stable binding');
 for(const part of p.PartingCurves){if(part.points.length<2||part.points.some(q=>q.length!==3||q.some(x=>!Number.isFinite(x))))throw Error('Invalid parting curve');}
 for(const w of p.WhorlField)if(!(w.radius>0)||w.strength<0||w.strength>1||!(w.coreRadius>0)||w.coreRadius>=w.radius)throw Error('Invalid whorl');
 if(p.GuideGroom.samples<33||p.GuideGroom.highFrequency!==false)throw Error('Phase one requires complete low-frequency guides');
 if(p.ClumpGraph.levels.join('/')!=='macro/mid/micro'||p.ClumpGraph.crossPart!==false)throw Error('Explicit hierarchical groups required');
 if(p.ChildStrandProfile.enabled||p.StrandMaterialField.enabled||p.PhysicsProfile.enabled)throw Error('Phase two is locked until static structure acceptance');
 return true;
}
export function assertStructure(lab,roots){assertProfile(lab.profile);if(lab.schema!=='kaopu/hair-structure-lab@1'||roots.length!==lab.rootCount*lab.stride)throw Error('Structure payload mismatch');
 if(lab.stride!==26||!Array.isArray(lab.activeMask)||lab.activeMask.length!==lab.rootCount)throw Error('Root record layout/mask mismatch');
 for(let i=0;i<roots.length;i++)if(!Number.isFinite(roots[i]))throw Error('Non-finite root record');
 for(let i=0;i<lab.rootCount;i++){const active=roots[i*lab.stride+25];if((active!==0&&active!==1)||typeof lab.activeMask[i]!=='boolean'||lab.activeMask[i]!==Boolean(active))throw Error('Active mask disagrees with root buffer');}
 if(lab.sourceDomain?.sourceLock!==lab.profile.ScalpDomain.sourceLock||lab.sourceDomain.postProjectionClip!==false)throw Error('Applied source authority mismatch');
 if(lab.profile.ScalpDomain.policy==='approved-source-only'){if(lab.profile.ScalpDomain.sourceLock!=='F02.1@ee3c7fac9f187dd9e5dc81d1363c4814b9a015a3'||lab.profile.ScalpDomain.postProjectionClip!==false||lab.profile.ScalpDomain.lowerHairline||lab.sourceDomain?.eligibleMask?.length!==lab.rootCount)throw Error('Approved scalp authority was overridden');for(let i=0;i<lab.rootCount;i++)if(roots[i*lab.stride+25]&&!lab.sourceDomain.eligibleMask[i])throw Error('Active root outside approved scalp');}

 const groups=new Map(lab.clumpGraph.map(g=>[g.id,g])),ids=new Set(lab.guides.map(g=>g.id));if(groups.size!==lab.clumpGraph.length)throw Error('Duplicate clump identity');if(ids.size!==lab.guides.length)throw Error('Duplicate guide identity');
 for(const g of lab.guides){if(g.rootId<0||g.rootId>=lab.rootCount||roots[g.rootId*lab.stride+25]!==1)throw Error('Guide attached to inactive or missing root');const offset=g.rootId*lab.stride;if(g.zone!==roots[offset+23]||g.root.triangleId!==roots[offset]||g.root.barycentric.some((x,k)=>Math.abs(x-roots[offset+1+k])>1e-6))throw Error('Guide/native follicle identity mismatch');if(g.points.length!==lab.profile.GuideGroom.samples*3||g.points.some(x=>!Number.isFinite(x))||g.frames.length!==g.points.length*3||g.frames.some(x=>!Number.isFinite(x)))throw Error('Incomplete guide');if(g.arcLengths.length!==g.points.length/3||Math.abs(g.length-g.arcLengths.at(-1))>1e-9)throw Error('Arc length/sample mismatch');if(g.arcLengths[0]!==0||g.arcLengths.some((s,i,a)=>i&&s<=a[i-1]))throw Error('Invalid guide arc lengths');for(let n=0;n<g.frames.length;n+=9){const f=g.frames.slice(n,n+9),dot=(a,b)=>f[a]*f[b]+f[a+1]*f[b+1]+f[a+2]*f[b+2];if([0,3,6].some(a=>Math.abs(dot(a,a)-1)>1e-6)||Math.abs(dot(0,3))+Math.abs(dot(0,6))+Math.abs(dot(3,6))>1e-6)throw Error('Invalid transported frame');}const range=lab.profile.RegionalLengthField.regions[lab.profile.AnatomicalZoneField.zones[g.zone].id];if(g.length<range.minArc||g.length>range.maxArc)throw Error('Guide exceeds its regional arc-length field');if(groups.get(g.micro)?.parent!==g.mid||groups.get(g.mid)?.parent!==g.macro||groups.get(g.macro)?.parent!==null)throw Error('Broken clump ancestry');}
 // Validate geometric meaning, not only lengths, monotonicity or orthogonality.
 // 0.1 micrometre accommodates serialized metre positions and Float32 roots.
 const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k])),dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 for(const g of lab.guides){
  const N=g.points.length/3,at=n=>g.points.slice(n*3,n*3+3),offset=g.rootId*lab.stride,root=Array.from(roots.subarray(offset+4,offset+7));
  if(distance(at(0),root)>1e-7)throw Error('Guide first point detached from bound root');
  if(!g.cut||!Number.isFinite(g.cut.hem)||!Array.isArray(g.cut.endpoint)||g.cut.endpoint.length!==3||g.cut.endpoint.some(v=>!Number.isFinite(v))||distance(at(N-1),g.cut.endpoint)>1e-7||Math.abs(at(N-1)[1]-g.cut.hem)>1e-7)throw Error('Cut metadata disagrees with actual guide tip');
  let arc=0;for(let n=0;n<N;n++){
   if(n)arc+=distance(at(n),at(n-1));if(!Number.isFinite(g.arcLengths[n])||Math.abs(g.arcLengths[n]-arc)>1e-7)throw Error('Stored arc lengths disagree with actual curve');
   const delta=at(Math.min(N-1,n+1)).map((v,k)=>v-at(Math.max(0,n-1))[k]),length=Math.hypot(...delta),t=g.frames.slice(n*9,n*9+3),normal=g.frames.slice(n*9+3,n*9+6),binormal=g.frames.slice(n*9+6,n*9+9);
   if(length<1e-12||dot(delta.map(v=>v/length),t)<1-1e-7)throw Error('Transport tangent disagrees with guide direction');
   if(dot(cross(t,normal),binormal)<1-1e-6)throw Error('Transport frame has wrong handedness');
  }
 }
 for(const g of lab.clumpGraph){if(!['macro','mid','micro'].includes(g.level)||!g.guides.length||!g.guides.includes(g.representativeGuide)||g.guides.some(id=>!ids.has(id)))throw Error('Clump refers to nonexistent guide');if(g.parent&&!groups.has(g.parent))throw Error('Clump missing parent');const parent=g.parent&&groups.get(g.parent);if(parent&&(parent.zone!==g.zone||g.guides.some(id=>!parent.guides.includes(id))||parent.level!==({mid:'macro',micro:'mid'})[g.level]))throw Error('Clump members escape parent/zone');if(g.guides.some(id=>{const guide=lab.guides.find(x=>x.id===id);return guide[g.level]!==g.id||guide.zone!==g.zone;}))throw Error('Clump membership disagrees with guide');}
 if(lab.acceptance.phaseTwo!=='locked'||lab.acceptance.physics||lab.acceptance.denseHair)throw Error('Phase gate bypass');return true;
}
