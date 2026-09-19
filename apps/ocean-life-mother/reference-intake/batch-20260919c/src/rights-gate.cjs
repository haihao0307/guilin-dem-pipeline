/* Additive admission check for a COMMERCIAL ADAPTED OUTPUT candidate.
 * A source's restrictions propagate through coefficients, residuals and recipes.
 * This checks declared lineage and reviewed records; it is not a legal verdict,
 * a rights-authentication service or a detector of deliberately omitted inputs.
 * It does not modify the existing KAOPU file format or published runtimes.
 */
'use strict';
const RightsGate=(()=>{
 const text=x=>typeof x==='string'&&x.trim().length>0;
 const sha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
 const permissive=new Set(['CC0-1.0','CC-BY-4.0']);
 function sourceRoute(s){
  if(!s||!text(s.id)||!sha(s.sha256))throw Error('Source identity/hash required');
  if(s.provenanceIssues?.length)return 'hold-provenance';
  if(permissive.has(s.license))return 'permissive-review';
  if(['CC-BY-NC-4.0','CC-BY-ND-4.0','CC-BY-NC-ND-4.0'].includes(s.license))return 'restricted-replace';
  return 'hold-license';
 }
 function mapById(rows,label){
  if(!Array.isArray(rows))throw Error(label+' list required');
  const m=new Map();for(const r of rows){if(!r||!text(r.id)||m.has(r.id))throw Error(label+' duplicate/invalid identity');m.set(r.id,r)}return m;
 }
 function evaluate(target,artifacts,sources,reviews=[]){
  const A=mapById(artifacts,'artifact'),S=mapById(sources,'source'),R=mapById(reviews,'review');
  const active=new Set(),seen=new Set(),roots=new Set(),reasons=[],credits=new Map();
  const add=(level,id,code)=>reasons.push({level,id,code});
  function inspectSource(id){
   const s=S.get(id);if(!s){add('blocked',id,'missing-source');return;}
   if(roots.has(id))return;roots.add(id);
   let route;try{route=sourceRoute(s)}catch(e){add('blocked',id,'invalid-source-identity');return;}
   if(route!=='permissive-review'){add('blocked',id,route);return;}
   // Only separate, source-hash-bound review records can advance admission.
   // A child recipe cannot replace source permissions with its own licence.
   const r=[...R.values()].find(x=>x.sourceId===id&&x.sourceSha256===s.sha256&&x.license===s.license&&x.status==='checked');
   if(!r||!text(r.authorityEvidence)||!text(r.permissionEvidence)){add('pending',id,'permission-and-authority-review-required');return;}
   if(s.license==='CC-BY-4.0'){
    const c=r.attribution;
    if(!c||!text(c.author)||!text(c.source)||!text(c.licenseUrl)||!text(c.changes)){add('pending',id,'attribution-and-change-record-required');return;}
    credits.set(id,{...c,sourceId:id});
   }
  }
  function visit(id){
   if(seen.has(id))return;
   if(active.has(id)){add('blocked',id,'cyclic-lineage');return;}
   const a=A.get(id);if(!a){add('blocked',id,'missing-artifact');return;}
   active.add(id);
   if(!Array.isArray(a.inputs)){add('blocked',id,'missing-input-declaration');active.delete(id);return;}
   if(a.inputs.length===0){
    // Independent work is a NEW root with its own retained creation evidence.
    // Calling a fitted source residual "original" never detaches its ancestry.
    const r=R.get(a.creationReviewId);
    if(a.origin!=='self-authored'||!r||r.status!=='checked'||r.artifactId!==id||!sha(a.contentSha256)||r.contentSha256!==a.contentSha256||!text(r.creationEvidence)||!text(r.independenceEvidence))add('pending',id,'independent-creation-evidence-required');
   }
   for(const x of a.inputs){
    if(!x||!text(x.id)||!['source','artifact'].includes(x.kind)){add('blocked',id,'invalid-input-reference');continue;}
    if(x.kind==='source')inspectSource(x.id);else visit(x.id);
   }
   active.delete(id);seen.add(id);
  }
  visit(target);
  const blocked=reasons.some(r=>r.level==='blocked'),pending=reasons.some(r=>r.level==='pending');
  return{policy:'ocean-life-commercial-adapted-candidate/20260919',target,status:blocked?'blocked':pending?'pending':'candidate-check-passed',sourceIds:[...roots],reasons,attribution:[...credits.values()],legalClearance:false,productionAcceptance:false};
 }
 return{sourceRoute,evaluate};
})();
if(typeof module!=='undefined')module.exports=RightsGate;
if(typeof window!=='undefined')window.RightsGate=RightsGate;
