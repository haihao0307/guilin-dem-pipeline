/** Wide skirts start at the lower-body envelope, not in front of the hands.
 * Only rigid starting transforms change. Full body collisions remain active. */
export function stageLowerBodyPanels(spec,body){
 const changes=[];
 for(const p of spec.panels){
  if(!/^skirt_(front|back)(?:_\d+)?$/.test(p.id))continue;
  const b=p.placement.rigidBasis,t=p.placement.translationMm;
  if(Math.abs(b[2])+Math.abs(b[5])+Math.abs(b[6])+Math.abs(b[7])>1e-8)continue;
  const xy=p.uvMm.map(([u,v])=>[b[0]*u+b[1]*v+t[0],b[3]*u+b[4]*v+t[1]]);
  const lo=Math.min(...xy.map(v=>v[1])),hi=Math.max(...xy.map(v=>v[1]));
  const sample=body.positionsMm.filter(v=>v[1]>=lo-20&&v[1]<=hi+20&&Math.abs(v[0])<300);
  if(sample.length<16)throw Error('LOWER_BODY_STAGING_SECTION_MISSING');
  const before=[...t],z=sample.map(v=>v[2]);
  t[2]=p.source.bodySide==='back'?Math.min(...z)-12:Math.max(...z)+12;
  changes.push({panelId:p.id,before,after:[...t],sampleCount:sample.length});
 }
 spec.source.lowerBodyStagingR0433={changes,rigidOnly:true,fullBodyCollisionUnchanged:true,restMaterialUnchanged:true};
 return changes;
}
