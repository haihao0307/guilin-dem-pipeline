// Transitive source selection. Equations remain unchanged. Two frozen local
// identifiers are alpha-renamed because Naga/WGSL reserves `handle`.
export const SOURCE_ALPHA_RENAMES=Object.freeze({sashWindow:Object.freeze({handle:'bureauWindowHandle'}),mechanicalBag:Object.freeze({handle:'bureauBagHandle'})});
export function alphaRenameFunction(name,body){
 const mapping=SOURCE_ALPHA_RENAMES[name];if(!mapping)return body;
 let result=body;for(const[from,to]of Object.entries(mapping)){
  const word=new RegExp('\\b'+from+'\\b','g');
  if(new RegExp('\\b'+to+'\\b').test(body))throw Error('Alpha-rename target collision: '+name+'.'+to);
  if(!new RegExp('\\blet\\s+'+from+'\\s*=').test(body)||(body.match(word)||[]).length!==2)throw Error('Frozen local rename contract changed: '+name+'.'+from);
  result=result.replace(word,to);
 }return result;
}
export function extractSource(source){
 const src=source.replace(/\/\/[^\n]*/g,'').replace(/\/\*[\s\S]*?\*\//g,'');
 function blocks(keyword){const map=new Map(),re=new RegExp('\\b'+keyword+'\\s+(\\w+)\\s*','g');let m;while((m=re.exec(src))){const open=src.indexOf('{',re.lastIndex);if(open<0)throw Error('Missing '+m[1]);let depth=1,end=open+1;for(;depth;end++){if(src[end]==='{')depth++;if(src[end]==='}')depth--;if(end>=src.length)throw Error('Unclosed '+m[1]);}map.set(m[1],src.slice(m.index,end));re.lastIndex=end;}return map;}
 const fns=blocks('fn'),structs=blocks('struct'),constants=new Map([...src.matchAll(/\bconst\s+(\w+)\s*(?::[^=;]+)?=[^;]+;/g)].map(m=>[m[1],m[0]]));
 const emittedFns=new Map([...fns].map(([name,body])=>[name,alphaRenameFunction(name,body)]));
 const privateGlobals=[...src.matchAll(/\bvar<private>\s+\w+\s*:[^;]+;/g)].map(m=>m[0]);
 function closure(roots,extra=''){const chosen=new Set();function add(n){if(chosen.has(n))return;if(!fns.has(n))throw Error('Missing '+n);chosen.add(n);for(const m of fns.get(n).matchAll(/\b(\w+)\s*\(/g))if(fns.has(m[1])&&m[1]!==n)add(m[1]);}roots.forEach(add);const bodies=[...emittedFns].filter(([n])=>chosen.has(n)).map(([,s])=>s).join('\n');const types=new Set(),usedConstants=new Set();function scan(s){for(const m of s.matchAll(/\b[A-Za-z_]\w*\b/g)){const n=m[0];if(structs.has(n)&&!types.has(n)){types.add(n);scan(structs.get(n));}if(constants.has(n)&&!usedConstants.has(n)){usedConstants.add(n);scan(constants.get(n));}}}scan(bodies+extra+privateGlobals.join('\n'));types.add('Params');types.add('ItemRecord');return{source:[...structs].filter(([n])=>types.has(n)).map(([,s])=>s).join('\n')+'\n'+[...constants].filter(([n])=>usedConstants.has(n)).map(([,s])=>s).join('\n')+'\n'+privateGlobals.join('\n')+'\n@group(0)@binding(0)var<uniform>u:Params;\nvar<private>items:array<ItemRecord,128>;\n'+bodies,functionNames:[...chosen].sort()};}
 return{closure,functionBodies:fns,emittedFunctionBodies:emittedFns};
}
