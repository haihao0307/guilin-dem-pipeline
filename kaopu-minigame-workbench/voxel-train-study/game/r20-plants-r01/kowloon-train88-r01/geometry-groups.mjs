// Split only contiguous original construction statements. Each group still
// resolves every retained candidate through its original physical material.
// Cross-group merge must retain this order, sum raw counts, and preserve overflow.
export const GEOMETRY_GROUP_NAMES=Object.freeze(['terminal','hall-lettering','hall-forecourt-and-tower','shed-roofs-trusses','shed-castings-lamps','shed-platforms','shed-rails','shed-benches','shed-footbridge','approaches-goods-walk','waterfront','host-transfer']);
function fn(source,name){const start=source.indexOf('fn '+name+'(');if(start<0)throw Error('Missing '+name);const open=source.indexOf('{',start);let end=open+1,depth=1;for(;depth&&end<source.length;end++){if(source[end]==='{')depth++;if(source[end]==='}')depth--;}if(depth)throw Error('Unclosed '+name);return{start,end,head:source.slice(start,open+1),body:source.slice(open+1,end-1)};}
function splitAt(text,markers){const cuts=markers.map(m=>{const n=text.indexOf(m);if(n<0)throw Error('Missing exact construction boundary '+m);return n;});if(cuts.some((n,i)=>i&&n<=cuts[i-1]))throw Error('Construction boundaries moved');return cuts.map((n,i)=>text.slice(n,cuts[i+1]??text.length));}
export function stationGeometryPartition(source){
 const original=fn(source,'stationDomain'),body=original.body;
 const first=body.indexOf('// Complete terminal source construction'),last=body.lastIndexOf('return resolveCandidates(p);');
 if(first<0||last<first)throw Error('Station domain reset/resolve contract changed');
 const reset=body.slice(0,first),construction=body.slice(first,last);
 const outer=splitAt(construction,['// Complete terminal source construction','// Preserve exact title anchor/tip;',' if(!skipFloor){recordPart(p,box(p-vec3<f32>(0.,.275,11.8)', '// Three continuous barrel canopies','// Landward running tracks continue','// Every quay, road, finite painted ingredient','// A 40m transfer truss']);
 const shed=outer[3],guard='if(shedBox<2.){',guardAt=shed.indexOf(guard),guardOpen=guardAt+guard.length;
 if(guardAt<0)throw Error('Original shed guard missing');
 let at=guardOpen,depth=1;for(;depth;at++){if(shed[at]==='{')depth++;if(shed[at]==='}')depth--;if(at>=shed.length)throw Error('Unclosed shed');}
 const inside=shed.slice(guardOpen,at-1),commonEnd=inside.indexOf('if(!skipRoof)'),common=inside.slice(0,commonEnd);
 const portions=splitAt(inside.slice(commonEnd),['if(!skipRoof)','let support=rep(p.x-10.','// Four islands, mineral copings','var railX=rep(p.x-5.','for(var bi=0;bi<4;bi++)','// Complete transverse footbridge']);
 const support='let support=rep(p.x-10.,20.,-2.,1.);';
 if(!portions[1].startsWith(support))throw Error('Shed support frame changed');
 const shedLead=shed.slice(0,guardAt),shedElse=shed.slice(at);
 const shedGroups=portions.map((p,i)=>shedLead+guard+common+(i===4?support+'\n':'')+p+'}'+(i===0?shedElse:''));
 const groups=[outer[0],outer[1],outer[2],...shedGroups,outer[4],outer[5],outer[6]];
 if(groups.length!==GEOMETRY_GROUP_NAMES.length)throw Error('Unexpected group count');
 // Exact reconstruction tests ensure all original statement slices occur once.
 return{original,reset,construction,outer,shed:{lead:shedLead,common,portions,tail:shedElse},groups,groupNames:GEOMETRY_GROUP_NAMES};
}
function specializeLetterDispatch(source){
 const hall=fn(source,'stationLetteringHall');
 const replacement=hall.head+hall.body.replace(/stationLetteringTemplate\((vec3<f32>\(offset\.z,offset\.y,-offset\.x\)),5u\)/,'stationLetteringWord5($1)')+'}';
 if(replacement===source.slice(hall.start,hall.end))throw Error('Hall lettering direct-call contract changed');
 source=source.slice(0,hall.start)+replacement+source.slice(hall.end);
 const template=fn(source,'stationLetteringTemplate');
 const text=source.slice(template.start,template.end),next=text.replace(/if\(index==5u\)\{return stationLetteringWord5\(q\);\}\s*/,'');
 if(text===next)throw Error('Platform dispatcher hall branch missing');
 return source.slice(0,template.start)+next+source.slice(template.end);
}

/** Execution-only lowering of native lettering's constant array indexing.
 * A source glyph loop keeps its original index interval and every operation.
 * Its table access becomes a glyph-local switch returning the ORIGINAL arc
 * constructor text. There is no dynamic array, new curve, resampling, material,
 * resource binding, candidate regrouping, or changed winding/distance loop.
 *
 * This addresses the common closure of the two observed all-zero WebGL groups;
 * it is a testable driver-lowering hypothesis, not proof of a GPU repair.
 * Both the original whole-station source and partitioned sources may use it.
 */
export function adaptStationLettering(source) {
 if(typeof source!=='string')throw TypeError('Station lettering source must be a string');
 const declarations=[];
 const declarationPattern=/\bconst\s+(stationLetteringCurves([0-5]))\s*=\s*array\s*<\s*StationLetteringArc\s*,\s*(\d+)\s*>\s*\(/g;
 let match;
 while((match=declarationPattern.exec(source))){
  const bodyStart=declarationPattern.lastIndex;let end=bodyStart,depth=1;
  for(;depth&&end<source.length;end++){if(source[end]==='(')depth++;if(source[end]===')')depth--;}
  if(depth)throw Error('Unclosed native lettering table '+match[1]);
  const body=source.slice(bodyStart,end-1);let declarationEnd=end;
  while(/\s/.test(source[declarationEnd]||'')&&declarationEnd<source.length)declarationEnd++;
  if(source[declarationEnd]!==';')throw Error('Unexpected native lettering table terminator '+match[1]);
  declarationEnd++;
  const arcs=[];let position=0;
  while(position<body.length){
   while(position<body.length&&/[\s,]/.test(body[position]))position++;
   if(position===body.length)break;
   if(!body.startsWith('StationLetteringArc(',position))throw Error('Unexpected native lettering arc expression '+match[1]);
   const start=position;position+='StationLetteringArc('.length;let nesting=1;
   for(;nesting&&position<body.length;position++){if(body[position]==='(')nesting++;if(body[position]===')')nesting--;}
   if(nesting)throw Error('Unclosed native lettering arc '+match[1]);
   const literal=body.slice(start,position),flat=literal.replace(/\s+/g,'');
   const number='[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?';
   const pair='vec2<f32>\\('+number+','+number+'\\),';
   if(!new RegExp('^StationLetteringArc\\((?:'+pair+'){6}\\d+u,\\d+u\\)$').test(flat))throw Error('Native arc must contain exactly its original 12 float and two integer literals');
   arcs.push(literal);
  }
  if(arcs.length!==Number(match[3])||!arcs.length)throw Error('Native lettering table count mismatch '+match[1]);
  declarations.push({name:match[1],template:Number(match[2]),arcs,text:source.slice(match.index,declarationEnd)});
  declarationPattern.lastIndex=declarationEnd;
 }
 if(!declarations.length){
  if(/\bstationLetteringCurves[0-5]\b/.test(source.replace(/\/\/[^\n]*/g,'')))throw Error('Unrecognized native lettering array interface');
  return source; // Safe for material-only or already adapted sources.
 }
 if(new Set(declarations.map(item=>item.name)).size!==declarations.length)throw Error('Duplicate native lettering table');
 let output=source;
 for(const table of declarations){
  const loopPattern=new RegExp('\\bfor\\s*\\(\\s*var\\s+(\\w+)\\s*=\\s*(\\d+)u\\s*;\\s*\\1\\s*<\\s*(\\d+)u\\s*;\\s*\\1\\s*\\+\\+\\s*\\)\\s*\\{\\s*let\\s+arc\\s*=\\s*'+table.name+'\\s*\\[\\s*\\1\\s*\\]\\s*;','g');
  const loops=[...source.matchAll(loopPattern)];
  let cursor=0;const helpers=[];
  for(const [glyph,loop]of loops.entries()){
   const begin=Number(loop[2]),end=Number(loop[3]);
   if(begin!==cursor||end<=begin||end>table.arcs.length)throw Error('Native glyph intervals no longer cover the original arc table exactly: '+table.name);
   cursor=end;
   const helper=`stationLetteringArcWord${table.template}Glyph${glyph}`;
   if(new RegExp('\\bfn\\s+'+helper+'\\b').test(source))throw Error('Native lettering lookup name collision '+helper);
   let code=`// Exact source arcs [${begin},${end}); the original glyph loop proves the index range.\nfn ${helper}(index:u32)->StationLetteringArc{\nswitch index{\n`;
   for(let index=begin;index<end-1;index++)code+=`case ${index}u:{return ${table.arcs[index]};}\n`;
   // Default is the last valid source index. It is reached only for end-1:
   // the guarded, unmodified source loop traverses begin <= index < end.
   code+=`default:{return ${table.arcs[end-1]};}\n}\n}\n`;
   helpers.push(code);
   const access=new RegExp(table.name+'\\s*\\[\\s*'+loop[1]+'\\s*\\]');
   const replacement=loop[0].replace(access,`${helper}(${loop[1]})`);
   if(replacement===loop[0])throw Error('Native lettering access replacement failed');
   output=output.replace(loop[0],replacement);
  }
  if(cursor!==table.arcs.length)throw Error('Not every original native arc is traversed: '+table.name);
  output=output.replace(table.text,helpers.join(''));
 }
 if(/\bstationLetteringCurves[0-5]\b/.test(output.replace(/\/\/[^\n]*/g,'')))throw Error('A native lettering table reference remains outside the proven glyph loops');
 return output;
}
export function stationGeometryGroupSource(source,index){
 const p=stationGeometryPartition(source);if(!Number.isInteger(index)||!p.groups[index])throw Error('Invalid group');
 const replacement=p.original.head+p.reset+p.groups[index]+'return resolveCandidates(p);\n}';
 return adaptStationLettering(specializeLetterDispatch(source.slice(0,p.original.start)+replacement+source.slice(p.original.end)));
}
// Original global overflow checks count recorded candidates BEFORE pruning.
export function mergePhysicalGroupSamples(samples,capacity=96){
 let raw=0,overflow=false,winner=null;
 for(const s of samples){raw+=s.rawCount;overflow ||= !!s.overflow;if(winner===null||s.hit.d<winner.d)winner=s.hit;}
 return{hit:overflow||raw>capacity?{d:0,id:999,q:[0,0,0],seed:0,baseD:0,extent:[1,1,1],sourceSeed:0}:winner,rawCount:raw,overflow:overflow||raw>capacity};
}
