import crypto from'node:crypto';
// Narrow execution-only experiment. This digest binds the exact verified
// terminal group's one if/else: near records one completed hall winner, far
// records one id0 bound. Neither path loops or invokes another recorder.
export const PROVEN_TERMINAL_DOMAIN_SHA='88698380c05f8d3363ba94ebe5ce0c6f57f92170226f857e9452f99d15ced6cd';
function functions(source){const s=source.replace(/\/\/[^\n]*/g,'').replace(/\/\*[\s\S]*?\*\//g,''),out=new Map(),re=/\bfn\s+(\w+)\s*\(/g;let m;while((m=re.exec(s))){const o=s.indexOf('{',re.lastIndex);let d=1,e=o+1;for(;d&&e<s.length;e++){if(s[e]==='{')d++;if(s[e]==='}')d--;}if(d)throw Error('Unclosed function');out.set(m[1],s.slice(m.index,e));re.lastIndex=e;}return out;}
export function specializeTerminalStorage(source){
 const fns=functions(source),domain=fns.get('stationDomain');if(!domain)throw Error('Terminal domain absent');
 const digest=crypto.createHash('sha256').update(domain.replace(/\s+/g,'')).digest('hex');if(digest!==PROVEN_TERMINAL_DOMAIN_SHA)throw Error('One-candidate terminal proof is stale');
 if(!/const STATION_CANDIDATE_CAPACITY\s*:\s*u32\s*=\s*96u?\s*;/.test(source))throw Error('Global overflow threshold changed');
 const record=fns.get('recordPart').replace(/\s+/g,'');if(record!=='fnrecordPart(p:vec3<f32>,d:f32,id:u32,q:vec3<f32>,seed:f32){recordCandidate(HitField(d,id,q,seed,d,vec3<f32>(1.),0.));}')throw Error('recordPart cardinality changed');
 const visited=new Set();function visit(name){if(visited.has(name))return;visited.add(name);const body=fns.get(name);if(!body)throw Error('Missing reachable helper '+name);if(/\bstationCandidates\b|\bstationRawCandidateCount\b|\brecordCandidate\s*\(|\brecordPart\s*\(/.test(body))throw Error('Nested recorder/state access invalidates single slot: '+name);for(const m of body.matchAll(/\b(\w+)\s*\(/g))if(fns.has(m[1])&&m[1]!==name)visit(m[1]);}
 visit('completeTerminalHall');visit('terminalHallRawWinner');
 const pattern=/struct StationCandidates\s*\{count:u32,items:array<HitField,96>,\}/g;if([...source.matchAll(pattern)].length!==1)throw Error('Candidate payload interface changed');
 const lowered=source.replace(pattern,'struct StationCandidates {count:u32,items:array<HitField,1>,}');
 return{source:lowered,proof:{group:0,maximumEnqueuedCandidates:1,physicalPayloadSlots:1,globalOverflowThreshold:96,domainSHA256:digest,verifiedPureHelperCount:visited.size,axis:'storage only, no hierarchy or field changes'}};
}
