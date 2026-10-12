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
export function stationGeometryGroupSource(source,index){
 const p=stationGeometryPartition(source);if(!Number.isInteger(index)||!p.groups[index])throw Error('Invalid group');
 const replacement=p.original.head+p.reset+p.groups[index]+'return resolveCandidates(p);\n}';
 return specializeLetterDispatch(source.slice(0,p.original.start)+replacement+source.slice(p.original.end));
}
// Original global overflow checks count recorded candidates BEFORE pruning.
export function mergePhysicalGroupSamples(samples,capacity=96){
 let raw=0,overflow=false,winner=null;
 for(const s of samples){raw+=s.rawCount;overflow ||= !!s.overflow;if(winner===null||s.hit.d<winner.d)winner=s.hit;}
 return{hit:overflow||raw>capacity?{d:0,id:999,q:[0,0,0],seed:0,baseD:0,extent:[1,1,1],sourceSeed:0}:winner,rawCount:raw,overflow:overflow||raw>capacity};
}
