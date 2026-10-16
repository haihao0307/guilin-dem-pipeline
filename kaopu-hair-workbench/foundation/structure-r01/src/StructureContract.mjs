export const PROFILE_FIELDS=['ScalpDomain','AnatomicalZoneField','CandidateRootField','ActiveRootMask','FollicleDensityField','RootDirectionField','RootLiftField','PartingCurves','WhorlField','HairlineProfile','RegionalLengthField','CutField','GuideGroom','ClumpGraph','ChildStrandProfile','StrandMaterialField','RestShape','PhysicsProfile'];
export function assertProfile(p){
 if(p?.schema!=='kaopu/hair-style-profile@1')throw Error('Unsupported HairStyleProfile');
 for(const name of PROFILE_FIELDS)if(!p[name])throw Error('Missing profile field: '+name);
 const zones=p.AnatomicalZoneField.zones;if(zones.length!==10||new Set(zones.map(z=>z.id)).size!==10)throw Error('Ten distinct anatomical zones required');
 for(const {id}of zones){const length=p.RegionalLengthField.regions[id],cut=p.CutField.regions[id];if(!length||!cut||!(length.minArc>0)||!(length.maxArc>length.minArc)||!Number.isFinite(cut.hem)||length===cut)throw Error('Independent regional arc length and spatial cut required: '+id);}
 if(p.CandidateRootField.resample!==false)throw Error('Candidate follicles must preserve stable binding');
 for(const part of p.PartingCurves){if(part.points.length<2||part.points.some(q=>q.length!==3||q.some(x=>!Number.isFinite(x))))throw Error('Invalid parting curve');}
 for(const w of p.WhorlField)if(!(w.radius>0)||w.strength<0||w.strength>1||!(w.coreRadius>0)||w.coreRadius>=w.radius)throw Error('Invalid whorl');
 if(p.GuideGroom.samples<33||p.GuideGroom.highFrequency!==false)throw Error('Phase one requires complete low-frequency guides');
 if(p.ClumpGraph.levels.join('/')!=='macro/mid/micro'||p.ClumpGraph.crossPart!==false)throw Error('Explicit hierarchical groups required');
 if(p.ChildStrandProfile.enabled||p.StrandMaterialField.enabled||p.PhysicsProfile.enabled)throw Error('Phase two is locked until static structure acceptance');
 return true;
}
export function assertStructure(lab,roots){assertProfile(lab.profile);if(lab.schema!=='kaopu/hair-structure-lab@1'||roots.length!==lab.rootCount*lab.stride)throw Error('Structure payload mismatch');
 const groups=new Map(lab.clumpGraph.map(g=>[g.id,g])),ids=new Set(lab.guides.map(g=>g.id));if(ids.size!==lab.guides.length)throw Error('Duplicate guide identity');
 for(const g of lab.guides){if(g.rootId<0||g.rootId>=lab.rootCount||roots[g.rootId*lab.stride+25]!==1)throw Error('Guide attached to inactive or missing root');if(g.points.length!==lab.profile.GuideGroom.samples*3||g.points.some(x=>!Number.isFinite(x))||g.frames.length!==g.points.length*3)throw Error('Incomplete guide');if(g.arcLengths[0]!==0||g.arcLengths.some((s,i,a)=>i&&s<=a[i-1]))throw Error('Invalid guide arc lengths');const range=lab.profile.RegionalLengthField.regions[lab.profile.AnatomicalZoneField.zones[g.zone].id];if(g.length<range.minArc||g.length>range.maxArc)throw Error('Guide exceeds its regional arc-length field');if(groups.get(g.micro)?.parent!==g.mid||groups.get(g.mid)?.parent!==g.macro||groups.get(g.macro)?.parent!==null)throw Error('Broken clump ancestry');}
 for(const g of lab.clumpGraph){if(!ids.has(g.representativeGuide)||g.guides.some(id=>!ids.has(id)))throw Error('Clump refers to nonexistent guide');if(g.parent&&!groups.has(g.parent))throw Error('Clump missing parent');}
 if(lab.acceptance.phaseTwo!=='locked'||lab.acceptance.physics||lab.acceptance.denseHair)throw Error('Phase gate bypass');return true;
}
