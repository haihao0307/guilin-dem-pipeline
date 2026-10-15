// Draw-range cache only: no score, model coordinate or triangle is changed.
export function visibleModelRanges(models,predicate){
 const ranges=[];let range=null;
 for(const model of models){
  if(!predicate(model)){range=null;continue;}
  if(!Number.isInteger(model.start)||!Number.isInteger(model.count)||model.start<0||model.count<0||model.count%3)throw Error('Invalid triangle draw range');
  if(!model.count)continue;
  if(range&&range.start+range.count===model.start){range.count+=model.count;range.models.push(model);}
  else{range={start:model.start,count:model.count,models:[model]};ranges.push(range);}
 }
 return ranges;
}
export function submittedEvidence(model,chunkId){
 const t=model.score.temporal||{},a=model.age;
 return {objectId:model.score.objectId,chunkId,status:a.status,evidenceDate:a.evidenceDate,basis:a.basis,unknown:a.unknown,conflict:a.conflict,constructionDate:a.constructionDate,earliestAvailableOccupationDate:a.earliestAvailableOccupationDate,source:a.evidenceSource||((a.basis||'').startsWith('construction')?t.construction?.source:(t.occupationPermit?.records||[]).find(r=>r.date?.slice(0,10)===a.evidenceDate)?.source)||null,currentFormSince:t.currentFormSince?.date||null,currentFormAtEvidenceDateVerified:false,sourceCategory:model.classification.category};
}
