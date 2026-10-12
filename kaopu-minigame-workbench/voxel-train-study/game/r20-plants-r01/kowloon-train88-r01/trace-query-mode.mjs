// Execution routing only. There is one original complete field identity and one
// optional compact transport for stepping; the final geometry query is immutable.
export function createTraceExecution({fullQuery,fullAdvance,compactTrace=false,compactQuery=null,compactAdvance=null}={}){
 if(typeof compactTrace!=='boolean'||typeof fullQuery?.query!=='function'||!fullAdvance)throw Error('Original complete query and advance are required');
 if(compactTrace&&(typeof compactQuery?.query!=='function'||!compactAdvance))throw Error('Compact mode requires its paired query and advance');
 const original=Object.freeze({query:fullQuery,advance:fullAdvance});
 const selected=compactTrace?Object.freeze({query:compactQuery,advance:compactAdvance}):original;
 return Object.freeze({geometry:fullQuery,trace(referenceFull=false){if(typeof referenceFull!=='boolean')throw Error('Reference path must be explicit boolean');return referenceFull?original:selected;}});
}
