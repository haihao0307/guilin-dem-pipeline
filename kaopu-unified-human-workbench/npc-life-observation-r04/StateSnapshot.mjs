/** Read-side data boundary. No source object is returned to an observer.
 * The world contains only JSON-style records at this boundary; typed numeric
 * views are expanded into ordinary arrays for a portable, plain DTO.
 * This intentionally does not freeze or edit the simulation's own objects. */
export function detachState(value, seen=new WeakMap()) {
  if(value===null||typeof value!=='object') {
    if(typeof value==='function'||typeof value==='symbol'||typeof value==='bigint')
      throw new TypeError('State snapshots require plain serializable data');
    return value;
  }
  if(seen.has(value))return seen.get(value);
  if(value instanceof Date)return value.toISOString();
  if(ArrayBuffer.isView(value))return Array.from(value);
  if(value instanceof ArrayBuffer)return Array.from(new Uint8Array(value));
  const copy=Array.isArray(value)?[]:{};seen.set(value,copy);
  for(const key of Object.keys(value)){
    const entry=detachState(value[key],seen);
    if(key==='__proto__')Object.defineProperty(copy,key,{value:entry,enumerable:true,writable:true,configurable:true});
    else copy[key]=entry;
  }
  return copy;
}

/** Counts describe retained diagnostics; they do not claim full replay history. */
export function summarizeAudit(audit,eventCount,eventLimit=10) {
  const summary={retained:{},eventsRetained:eventCount,
    eventsReturned:Math.min(eventCount,eventLimit),eventWindowLimit:eventLimit};
  for(const [key,value] of Object.entries(audit)) {
    if(Array.isArray(value))summary.retained[key]=value.length;
    else summary[key]=detachState(value);
  }
  return summary;
}
