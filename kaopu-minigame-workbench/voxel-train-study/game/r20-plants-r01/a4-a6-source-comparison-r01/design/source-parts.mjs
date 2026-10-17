/** Audited EXTERIOR-only substitutions. All are optional reversible display changes.
 * Mixed hardware roots 55/74/303/307, unnamed parts, original piping, controls,
 * brakes, every wheel/axle, frame, bogie, coupler and hose stay visible.
 * Node identity is checked against the source schema; no name regex hides parts.
 */
export const SOURCE_SHELL_REPLACEMENTS=Object.freeze([
 {node:19,name:'Chiney_8',replacement:'two broad-base swept outlet skins',reason:'original exterior chimney'},
 {node:30,name:'Main Body_13',replacement:'continuous green A6 main shell and panoramic canopy',reason:'original main external body shell'},
 {node:37,name:'Window Frames_14',replacement:'finite panoramic glass with flush bows',reason:'original cab glazing/frame'},
 {node:40,name:'Hand Rails Side_15',replacement:'flush uninterrupted shoulder',reason:'external long body hand rails'},
 {node:45,name:'Body Bands_17',replacement:'unbroken C2 green exterior',reason:'original decorative body bands'},
 {node:49,name:'Roof Rivets_18',replacement:'rivet-free finish',reason:'external roof rivet rows'},
 {node:52,name:'Side Rivets_19',replacement:'rivet-free side finish',reason:'external side rivet rows'},
 {node:59,name:'More Rivets_21',replacement:'rivet-free nose top',reason:'external nose upper rivets'},
 {node:78,name:'Lamp Holders_28',replacement:'sealed flush lamp perimeter',reason:'old protruding lamp supports'},
 {node:80,name:'Lamp Holder Middle_29',replacement:'sealed flush lamps',reason:'old center lamp support'},
 {node:82,name:'Centre Rivet Front_30',replacement:'continuous flush nose',reason:'single exterior center nose rivet'},
 {node:86,name:'Roof Gutters_32',replacement:'flush canopy sill seals',reason:'original cab rain gutters'},
 {node:136,name:'Lamp Holders.001_65',replacement:'sealed flush lamps',reason:'old upper lamp support'},
 {node:183,name:'Text.005_83',replacement:'original Flying Hongkonger contour artwork',reason:'old Union of South Africa side nameplate'},
 {node:191,name:'Main Body.004_86',replacement:'matching oil-water tender exterior',reason:'original tender outer body'},
 {node:272,name:'Text_116',replacement:'88 foot-level identification',reason:'old frontal identification text'},
 {node:274,name:'Text.001_117',replacement:'88 foot-level identification',reason:'old frontal identification text'},
 {node:276,name:'Cube.001_118',replacement:'flush green nose',reason:'old front number board backing'},
 {node:278,name:'Text.002_119',replacement:'original 88 artwork',reason:'old front number board text'},
 {node:280,name:'Text.003_120',replacement:'original 88 under driver feet',reason:'old cab side identification number'},
 {node:282,name:'Main Body.006_121',replacement:'lowered original red flying contour',reason:'original BR tender logo'},
 {node:288,name:'Plane.001_123',replacement:'original company plaque behind 88',reason:'original exterior cab crest'},
 {node:327,name:'Canopy_137',replacement:'small matching-profile tender joint skin',reason:'old elevated cab-to-tender canvas canopy'},
 {node:329,name:'Brass Badge_138',replacement:'original company plaque',reason:'original exterior brass badge'}
].map(Object.freeze));
export const PROTECTED_MECHANICAL_ROOTS=Object.freeze([3,7,11,15,21,24,26,28,42,55,61,66,68,70,74,84,88,90,94,98,100,102,104,107,108,109,110,111,113,114,115,117,118,119,121,123,125,127,128,130,133,138,141,144,146,149,152,154,157,160,164,166,169,171,173,175,177,179,186,189,195,197,200,203,206,209,213,217,221,225,228,230,232,235,238,240,242,244,246,248,250,252,255,258,260,262,264,266,270,284,290,292,293,295,298,300,303,307,311,317,320,323,325]);
function descendants(nodes,index){return[index,...(nodes[index]?.children||[]).flatMap(i=>descendants(nodes,i))];}
export function buildSourceReplacementMapping(original){
 const nodes=original.g.nodes;
 const rows=SOURCE_SHELL_REPLACEMENTS.map(entry=>{
  if(nodes[entry.node]?.name!==entry.name)throw Error('A4_REPLACEMENT_NODE_IDENTITY_MISMATCH '+entry.node);
  const ids=descendants(nodes,entry.node);
  return{...entry,descendantNodeIds:ids,primitiveNodeIds:ids.filter(i=>nodes[i].mesh!==undefined)};
 });
 const replacedNodeIds=rows.flatMap(r=>r.descendantNodeIds),replacedPrimitiveNodeIds=rows.flatMap(r=>r.primitiveNodeIds);
 const protectedIds=new Set(PROTECTED_MECHANICAL_ROOTS.flatMap(i=>descendants(nodes,i)));
 if(replacedNodeIds.some(i=>protectedIds.has(i)))throw Error('EXTERIOR_REPLACEMENT_TOUCHES_PROTECTED_MECHANICAL_NODE');
 const replacedPrimitives=original.primitives.filter(p=>replacedPrimitiveNodeIds.includes(p.sourceNode));
 return{source:'a4',replacedRootNodeIds:rows.map(r=>r.node),replacedNodeIds,replacedPrimitiveNodeIds,
  replacedPrimitiveIds:replacedPrimitives.map(p=>`original-a4/node-${p.sourceNode}/primitive-${p.primitive}`),
  replacements:rows,protectedMechanicalRootIds:[...PROTECTED_MECHANICAL_ROOTS],originalDriveAxleNodeIds:[90,94,7]};
}
export function buildCompleteSourcePartMap(original){
 const mapping=buildSourceReplacementMapping(original),replacementByNode=new Map();
 mapping.replacements.forEach(r=>r.descendantNodeIds.forEach(i=>replacementByNode.set(i,r)));
 const parentByNode=new Map();original.g.nodes.forEach((n,i)=>(n.children||[]).forEach(j=>parentByNode.set(j,i)));
 return original.g.nodes.map((n,i)=>{const row=replacementByNode.get(i);return{
  sourceNode:i,sourceName:n.name||'',sourceMesh:n.mesh??null,parentSourceNode:parentByNode.get(i)??null,
  destinationId:`original-a4/node-${i}`,treatment:row?'RETAINED_INTACT_OPTIONAL_EXTERIOR_VISIBILITY_SUBSTITUTION':'RETAINED_INTACT_AND_VISIBLE',
  sourceDataChanged:false,sourceTransformChanged:false,sourceMaterialChanged:false,
  replacementRoot:row?.node??null,replacement:row?.replacement??null,
  animationChannels:(original.g.animations||[]).flatMap((a,ai)=>a.channels.flatMap((ch,ci)=>ch.target.node===i?[{animation:ai,channel:ci}]:[]))
 };});
}
export function createSourceVisibilityController(original,root){
 const mapping=buildSourceReplacementMapping(original),ids=new Set(mapping.replacedPrimitiveNodeIds);
 const primitives=original.primitives.filter(p=>ids.has(p.sourceNode));
 const baseline=new Map(primitives.map(p=>[p.object,p.object.visible]));
 let visible=false;root.visible=false;
 function setVisible(on){visible=Boolean(on);root.visible=visible;for(const p of primitives)p.object.visible=visible?false:baseline.get(p.object);return visible;}
 return{...mapping,setVisible,getVisible:()=>visible,sourcePartMap:buildCompleteSourcePartMap(original)};
}
