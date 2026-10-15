/** Reversible civil-date evidence policy. Frozen recipes and geometry are untouched.
 * A permit date is evidence of occupation, never an inferred construction year.
 * Valid ISO timestamps retain the civil calendar date written in that record;
 * converting an offset timestamp to UTC must not move a building across a year.
 */
export const DEFAULT_BUILDING_AGE_CUTOFF='1997-01-01';
const UNRELIABLE=new Set(['unknown','not_established','unverified','estimated','inferred','approximate','guess','invalid','not_applicable','relationship_query_pending','not_historical_evidence','unreliable']);
function calendarDate(value){
  if(typeof value!=='string')return null;
  const m=/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2}))?$/.exec(value);
  if(!m)return null;
  const [year,month,day]=m.slice(1,4).map(Number);
  if(year<1||month<1||month>12)return null;
  const leap=year%4===0&&(year%100!==0||year%400===0);
  const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  if(day<1||day>days[month-1])return null;
  if(m[4]!==undefined){
    if(+m[4]>23||+m[5]>59||+(m[6]??0)>59)return null;
    if(m[8]!=='Z'){const [h,n]=m[8].slice(1).split(':').map(Number);if(h>14||n>59||(h===14&&n!==0))return null;}
  }
  return `${m[1]}-${m[2]}-${m[3]}`;
}
function explicitlyUnreliable(record){
  return ['status','confidence'].some(k=>typeof record?.[k]==='string'&&UNRELIABLE.has(record[k].toLowerCase()));
}

/** Apply only separately verified corrections; never mutate the source score. */
export function mergeBuildingAgeEvidence(score,evidence){
  const id=score?.objectId??score?.id,entry=evidence?.overrides?.[id]??(evidence?.objectId===id?evidence:null);
  if(!entry)return score;
  if(entry.objectId!==id||entry.verification!=='verified_official_tower_structure_chain'||entry.mode!=='replace_occupation_records'||!Array.isArray(entry.records))throw new TypeError('Invalid or unverified age evidence override');
  if(entry.records.some(r=>!calendarDate(r.date)||typeof r.source!=='string'||!r.source.startsWith('https://')))throw new TypeError('Override record requires a valid date and official source URL');
  const records=entry.records.map(r=>({...r}));
  return {...score,temporal:{...score?.temporal,occupationPermit:{...score?.temporal?.occupationPermit,records,date:records.map(r=>calendarDate(r.date)).sort()[0]??null,source:records[0]?.source??null,status:records.length?'positive_records_available':'relationship_query_pending',confidence:records.length?'linked_official_record':'unknown'}},ageEvidenceOverride:{objectId:id,reason:entry.reason,source:entry.source,verification:entry.verification}};
}

export const applyAgeEvidence=mergeBuildingAgeEvidence;

export function evaluateBuildingAge(score,{cutoff=DEFAULT_BUILDING_AGE_CUTOFF,enabled=true,evidence=null,evidenceOverride=null}={}){
  if(typeof cutoff!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(cutoff)||calendarDate(cutoff)!==cutoff)throw new TypeError('cutoff must be a valid YYYY-MM-DD civil date');
  const input=mergeBuildingAgeEvidence(score,evidenceOverride??evidence),filterEnabled=enabled!==false,temporal=input?.temporal??{},construction=temporal.construction;
  const records=Array.isArray(temporal.occupationPermit?.records)?temporal.occupationPermit.records:[],rejectedEvidence=[];
  function accepted(record,basis){
    if(record?.date===undefined||record?.date===null||record?.date==='')return null;
    const date=calendarDate(record.date);
    if(!date){rejectedEvidence.push({basis,reason:'invalid_or_ambiguous_date'});return null;}
    if(explicitlyUnreliable(record)){rejectedEvidence.push({basis,reason:'explicitly_unreliable_evidence'});return null;}
    return {date,record};
  }
  const con=accepted(construction,'construction.date'),constructionDate=con?.date??null;
  const occupation=records.map((r,i)=>accepted(r,`occupationPermit.records[${i}].date`)).filter(Boolean).sort((a,b)=>a.date.localeCompare(b.date));
  const firstOccupationDate=occupation[0]?.date??null,earlyOccupationDate=occupation.find(r=>r.date<cutoff)?.date??null;
  const boundary=d=>d>=cutoff&&d.slice(0,4)===cutoff.slice(0,4);
  const infrastructure=input?.modelType==='I'||input?.category==='infrastructure';
  const conflict=Boolean(constructionDate&&constructionDate>=cutoff&&earlyOccupationDate);
  let status,evidenceDate=null,basis,label,explanation,policyVisible=false;
  if(constructionDate&&constructionDate>=cutoff){
    evidenceDate=constructionDate;basis='construction.date';
    if(boundary(constructionDate)){status='boundary_pending';label=`${cutoff.slice(0,4)} 年建成日期边界待核：${constructionDate}｜默认离场`;explanation='截止日是排他边界；边界年份的明确建成日期不满足严格更早条件，暂不进入历史场景。';}
    else{status='hidden_late_construction';label=`晚期建成：${constructionDate}｜默认离场`;explanation='明确的截止年后建成日期优先隐藏，不用早期入伙记录覆盖该建成日期。';}
    if(conflict)label+='｜早期入伙证据冲突';
  }else if(constructionDate){
    status='eligible_prior_evidence';evidenceDate=constructionDate;basis='construction.date';policyVisible=true;
    label=`已有严格早于 ${cutoff} 的建成证据：${constructionDate}`;explanation='明确建成日期严格早于排他截止日；仍不证明当前外形当年相同。';
  }else if(earlyOccupationDate){
    status='eligible_prior_evidence';evidenceDate=earlyOccupationDate;basis='occupationPermit.records[].date';policyVisible=true;
    label=`已有严格早于 ${cutoff} 的入伙证据：${earlyOccupationDate}（非建成年）`;explanation='至少一条可用入伙记录严格早于排他截止日；不把入伙日期或当前几何当作建成年或历史外观证据。';
  }else if(firstOccupationDate){
    evidenceDate=firstOccupationDate;basis='occupationPermit.records[].date';
    if(boundary(firstOccupationDate)){status='boundary_pending';label=`${cutoff.slice(0,4)} 年入伙日期边界待核：${firstOccupationDate}｜默认离场`;explanation='最早可得入伙证据位于边界年份；未证明截止日前已经存在，暂不进入历史场景。';}
    else{status='hidden_late_occupation_candidate';label=`晚期入伙候选：${firstOccupationDate}｜仅最早可得证据，非建成年；关系完整性未确认`;explanation='缺严格截止日前证据；仅以最早可得有效入伙记录形成可逆隐藏候选，不认定真实首次入伙或建成年，不声称关系完整。';}
  }else{
    status='unknown_pending';basis='no_reliable_construction_or_occupation_evidence';
    label=infrastructure?'设施年代未知／入伙证据不适用｜待核，默认离场':'年代未知｜无可靠早期证据，待核，默认离场';
    explanation='未知对象不混入默认历史场景；不猜日期，数据修订、几何获取、照片或游戏时间不用于建成年过滤。';
  }
  const selected=basis==='construction.date'?(con?[con]:[]):occupation.filter(r=>r.date===evidenceDate);
  const evidenceRecords=selected.map(({date,record})=>({date,source:record.source??null,opNo:record.opNo??null,buildingStructureId:record.buildingStructureId??null,BuildingCSUID:record.BuildingCSUID??null,sourceRecordId:record.sourceRecordId??null}));
  const evidenceSources=[...new Set(evidenceRecords.map(r=>r.source).filter(s=>typeof s==='string'))];
  return {visible:!filterEnabled||policyVisible,status,evidenceDate,basis,label,unknown:status==='unknown_pending',conflict,cutoff,cutoffExclusive:cutoff,enabled:filterEnabled,policyVisible,hiddenByPolicy:filterEnabled&&!policyVisible,candidate:status==='hidden_late_occupation_candidate',boundaryPending:status==='boundary_pending',explanation,constructionDate,earliestAvailableOccupationDate:firstOccupationDate,occupationRecordsObserved:records.length,validOccupationDates:occupation.length,occupationRelationshipComplete:false,occupationRelationshipCompleteness:'not_asserted',occupationPermitSummaryDateUsed:false,constructionYearInferred:false,dateComparison:'exclusive_written_civil_date_no_UTC_shift',infrastructure,occupationEvidenceApplicability:infrastructure&&!occupation.length?'not_applicable_or_unknown':'available_building_evidence',conflictReasons:conflict?['non_prior_construction_with_early_occupation_evidence']:[],rejectedEvidence,ignoredDateFields:['datasetRevision','geometryAcquisition','photoCapture','gameTime','currentFormSince'],evidenceSources,evidenceRecords,evidenceOverrideApplied:Boolean(input?.ageEvidenceOverride),evidenceOverride:input?.ageEvidenceOverride??null,displayLabel:filterEnabled?label:`年代筛选已关闭，全部显示｜${label}`};
}
