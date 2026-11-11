import {canonical} from './Expressions.mjs';
// A bounded exact-input record, shared by display backends. Callers declare the
// complete dependencies of the evaluated fields; presentation inputs stay apart.
export class DisplayRecordCache{
 constructor(dependencies){if(!Array.isArray(dependencies)||!dependencies.length||new Set(dependencies).size!==dependencies.length||dependencies.some(x=>typeof x!=='string'||!x))throw Error('Exact display dependencies required');this.dependencies=[...dependencies].sort();this.key=null;this.payload=null;this.probes=0;this.commits=0;this.invalidations=0;}
 probe(inputs){if(!inputs||Object.keys(inputs).sort().join('\0')!==this.dependencies.join('\0'))throw Error('Display record dependency set mismatch');const key=canonical(inputs);this.probes++;return{key,reusable:key===this.key,payload:key===this.key?this.payload:null};}
 commit(key,payload){if(typeof key!=='string')throw Error('Invalid display record key');this.key=key;this.payload=payload;this.commits++;}
 invalidate(){this.key=null;this.payload=null;this.invalidations++;}
 report(){return{capacity:1,probes:this.probes,commits:this.commits,invalidations:this.invalidations,exactInputKey:true,dependencies:this.dependencies};}
}
