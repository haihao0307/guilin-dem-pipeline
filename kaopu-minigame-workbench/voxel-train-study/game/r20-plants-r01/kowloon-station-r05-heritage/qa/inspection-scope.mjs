// Diagnostic only. Extract whole unmodified component construction blocks.
// The underlying production field is complete; this scoped review never claims
// site/game integration, shadows from omitted buildings, or gameplay speed.
function body(source,name){const begin=source.indexOf('fn '+name+'('),start=source.indexOf('{',begin);if(begin<0||start<0)throw Error('Missing '+name);let at=start+1,depth=1;for(;depth&&at<source.length;at++){if(source[at]==='{')depth++;if(source[at]==='}')depth--;}if(depth)throw Error('Unclosed '+name);return{begin,start,end:at,text:source.slice(start+1,at-1)};}
export function inspectionScope(source,scope){
 if(!scope)return source;if(!['tower','hall'].includes(scope))throw Error('Unknown inspection scope');
 const b=body(source,'stationDomain'),s=b.text,reset=s.slice(0,s.indexOf('// Complete terminal source construction'));
 const towerStart=s.indexOf('// Heritage tower candidate'),towerEnd=s.indexOf('// Three continuous barrel canopies');
 const hallStart=s.indexOf('// Complete terminal source construction'),hallEnd=s.indexOf('// Preserve exact title anchor/tip;');
 if(Math.min(towerStart,towerEnd,hallStart,hallEnd)<0)throw Error('Component boundaries changed');
 const block=scope==='tower'?s.slice(towerStart,towerEnd):s.slice(hallStart,hallEnd);
 return source.slice(0,b.start+1)+reset+block+'return resolveCandidates(p);\n}'+source.slice(b.end);
}
