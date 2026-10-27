/* R32 own analytic functional schematic, installed in the retained whole train.
 * Official relations, NOT measured A4/60009 geometry. One independent simplified
 * superheater return element; element count and all added dimensions are inferred.
 * No meshes, second time, CFD, heat/pressure solve or invented exhaust collector. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./steam-path'));else root.UPSTREAM_STEAM=factory(root.STEAM_PATH);})(typeof globalThis!=='undefined'?globalThis:this,function(SP){'use strict';
if(!SP)throw Error('Load retained steam-path generator first');
const P=Object.freeze({revision:'R32-upstream-superheater-functional-schematic-01',units:'m',dimensions:'functional schematic; NOT measured historical dimensions',
 regulator:{center:[0,3.30,-1.65],rear:-1.80,front:-1.50,seatFront:-1.72,discThickness:.016,discRadius:.040,lift:.060,bodyRadius:.090,chamberRadius:.070,bore:.026},
 main:{points:[[0,3.30,-1.50],[0,3.30,3.31]],inner:.026,outer:.038,bend:.015},
 element:{points:[[-.25,3.30,3.30],[-.25,3.30,3.19],[0,3.045,3.19],[0,3.045,-1.85],[0,3.115,-1.85],[0,3.115,3.19],[.25,3.05,3.52],[.25,3.30,3.52],[.25,3.30,3.385]],inner:.012,outer:.018,bend:.030,count:1,countVerified:false},
 interface:{tubeplateRear:3.09505,tubeplateFront:3.13005,headerRear:3.26,neckEnd:3.257,flangeOuter:.065},
 evidence:['https://www.sirnigelgresley.org.uk/eng-reports/eng-22.shtml','https://blog.railwaymuseum.org.uk/sir-nigel-gresley-overhaul-update-43/','https://kesr-mic.org.uk/resources/Superheaters.pdf']});
const cyl=(a,b,r)=>({op:'cylinder',a,b,r}),box=(c,h)=>({op:'box',c,h}),uni=(...nodes)=>({op:'union',nodes}),diff=(a,b)=>({op:'subtract',a,b}),path=(points,r,bend=.015)=>({op:'path',points,r,bend});
const F=n=>{if(!Number.isFinite(n))throw Error('Nonfinite geometry');const s=String(n);return /[.eE]/.test(s)?s:s+'.0';},V=a=>'vec3('+a.map(F).join(',')+')';
function emit(n,p='p'){
 if(n.op==='cylinder')return`spCylinder(${p},${V(n.a)},${V(n.b)},${F(n.r)})`;
 if(n.op==='box')return`spBox(${p},${V(n.c)},${V(n.h)})`;
 if(n.op==='subtract')return`max(${emit(n.a,p)},-(${emit(n.b,p)}))`;
 if(n.op==='union')return n.nodes.map(x=>emit(x,p)).reduce((a,b)=>`min(${a},${b})`);
 if(n.op==='path'||n.op==='tube'){
  const pts=n.points.map(V),d=`upPath${pts.length}(${p},${pts.join(',')},${F(n.bend)})`;
  if(n.op==='path')return`(${d}-${F(n.r)})`;
  return`max(max(${d}-${F(n.ro)},${F(n.ri)}-${d}),max(-dot(${p}-${pts[0]},normalize(${pts[1]}-${pts[0]})),dot(${p}-${pts.at(-1)},normalize(${pts.at(-1)}-${pts.at(-2)}))))`;
 }
 throw Error('Unsupported upstream AST '+n.op);
}
function pathHelpers(max){let code='float upPath2(vec3 p,vec3 a0,vec3 a1,float bend){return spSegment(p,a0,a1);}\n';
 for(let n=3;n<=max;n++){let s=`float upPath${n}(vec3 p,${Array.from({length:n},(_,i)=>'vec3 a'+i).join(',')},float bend){`;for(let i=1;i<n-1;i++)s+=`SPFillet f${i}=spFillet(a${i-1},a${i},a${i+1},bend);`;s+='float d=1e10;';for(let i=0;i<n-1;i++)s+=`d=min(d,spSegment(p,${i===0?'a0':`f${i}.end`},${i===n-2?`a${n-1}`:`f${i+1}.start`}));`;for(let i=1;i<n-1;i++)s+=`d=min(d,spArcDistance(p,f${i}));`;code+=s+'return d;}\n';}return code;
}
function create(legacy){
 if(!legacy?.graph||!legacy?.domains)throw Error('Retained R31 steam candidate is required');
 const R=P.regulator,M=P.main,E=P.element,I=P.interface,parts=[],byId={},routes=[],domains={},ports=[],hostCuts={};
 function part(name,ast,role,preset='steel',extra={}){const id='upstream_steam/'+name,b=SP.bounds(ast),p={id,source:'upstreamSteam',group:'upstream_steam',glsl_function:'up_'+name,ast,role,status:'functional schematic; added dimensions and exact arrangement unverified',lipschitz:1.000002,aabb_min:b[0].map(v=>v-1e-6),aabb_max:b[1].map(v=>v+1e-6),materialDescriptor:{preset,basis:'explicit schematic role; not historic material determination',finish:'retained analytic material; no displacement'},...extra};parts.push(p);byId[id]=p;return id;}
 function route(name,def){
 // A returning element cannot use the retained straight-tube global end planes:
 // those planes would annihilate both legs. Its outer rounded swept envelope is
 // bored by the same inner path extended beyond each mouth, yielding open round
 // lips. Extensions do not alter any interior fillet (asserted by regression).
 const pts=def.points,extend=(a,b)=>{const d=a.map((v,i)=>v-b[i]),n=Math.hypot(...d);return a.map((v,i)=>v+d[i]/n*def.outer*2);},innerPoints=[extend(pts[0],pts[1]),...pts.slice(1,-1),extend(pts.at(-1),pts.at(-2))];
 const ast=name==='superheater_element'?diff(path(pts,def.outer,def.bend),path(innerPoints,def.inner,def.bend)):{op:'tube',points:pts,ri:def.inner,ro:def.outer,bend:def.bend},id=part(name,ast,name==='superheater_element'?'Independent hollow superheater out-and-return element inside retained large flue; one simplified element':'Boiler internal hollow main steam pipe');const lumen=path(def.points,def.inner,def.bend),envelope=path(def.points,def.outer,def.bend);domains['lumen/'+name]=lumen;routes.push({id:name,partId:id,points:def.points,innerRadius:def.inner,outerRadius:def.outer,bend:def.bend,lumenDomain:'lumen/'+name,ast,envelope,openEndConstruction:name==='superheater_element'?'rounded envelope minus extended bore':'straight planar mouths'});return{id,ast,lumen,envelope};}
 const axis=(z)=>[0,R.center[1],z];
 const bodyEnvelope=cyl(axis(R.rear),axis(R.front),R.bodyRadius);
 const bore=cyl(axis(R.rear-.002),axis(R.front+.002),R.bore);
 const chamber=cyl(axis(R.seatFront),axis(R.front-.016),R.chamberRadius);
 part('regulator_body_and_seat',diff(bodyEnvelope,uni(bore,chamber)),'Simplified regulator pressure body and seat; actual A4 main/pilot valve arrangement NOT reconstructed','neutral');
 const discAST=cyl(axis(R.seatFront),axis(R.seatFront+R.discThickness),R.discRadius);
 part('regulator_valve_disc',discAST,'Functional lift-disc schematic: closed seat blocks inlet; lift permits annular passage, not an A4 valve-event model','steel',{upstreamMotion:'regulatorLift'});
 domains['regulator/chamber']=uni(bore,chamber);
 const main=route('main_steam_pipe',M),element=route('superheater_element',E);
 part('tubeplate_flange_neck',diff(cyl([0,3.30,I.tubeplateFront],[0,3.30,I.neckEnd],I.flangeOuter),cyl([0,3.30,I.tubeplateFront-.002],[0,3.30,I.neckEnd+.002],M.outer)),'Schematic finite tubeplate flange/neck, physically meets retained tubeplate and header gasket');
 part('header_joint_gasket',diff(cyl([0,3.30,I.neckEnd],[0,3.30,I.headerRear],I.flangeOuter),cyl([0,3.30,I.neckEnd-.002],[0,3.30,I.headerRear+.002],M.outer)),'Documented copper-gasket relationship, inferred dimensions','copper');
 const regClamp=diff(cyl(axis(-1.675),axis(-1.625),.100),cyl(axis(-1.677),axis(-1.623),R.bodyRadius));
 part('regulator_suspension_clamp',regClamp,'Schematic regulator suspension contact; not drawing-derived hardware');
 part('regulator_suspension_beam',cyl([-.76,3.41,-1.65],[.76,3.41,-1.65],.012),'Schematic suspension beam engaging retained boiler wall; support relation documented, placement and strength unknown');
 part('main_pipe_support_clamp',diff(cyl([0,3.30,.775],[0,3.30,.825],.050),cyl([0,3.30,.773],[0,3.30,.827],M.outer)),'Documented intermediate support relationship; ring form and location schematic');
 part('main_pipe_support_hanger',box([0,(3.347+3.728325)/2,.8],[.010,(3.728325-3.347)/2,.018]),'Schematic hanger to retained boiler shell, not a verified real bracket');
 const tubeplateCut=cyl([0,3.30,I.tubeplateRear-.003],[0,3.30,I.tubeplateFront+.003],M.outer);
 hostCuts['boiler/outer_steel_shell']={ast:tubeplateCut,glsl_function:'up_cut_boiler_front_tubeplate',reason:'Main-pipe aperture in actual visible front-tubeplate host; never modify fire tubes/frame/axles'};
 hostCuts['smokebox/superheater_header']={ast:uni(cyl([0,3.30,3.255],[0,3.30,3.315],M.outer),element.envelope),glsl_function:'up_cut_header_interfaces',reason:'Finite main inlet and independent element out/return sockets; separator untouched'};
 ports.push({id:'boiler/upper_takeoff',position:axis(R.rear-.004),direction:[0,0,-1],radius:R.bore,host:'boiler/outer_steel_shell',kind:'upper boiler common water-or-steam domain; no verified phase boundary'},
  {id:'regulator/outlet',position:axis(R.front),direction:[0,0,1],radius:M.inner,host:'upstream_steam/regulator_body_and_seat'},
  {id:'tubeplate/main_pipe',position:[0,3.30,(I.tubeplateRear+I.tubeplateFront)/2],direction:[0,0,1],radius:M.inner,host:'boiler/outer_steel_shell'},
  {id:'header/main_inlet',position:M.points.at(-1),direction:[0,0,1],radius:M.inner,host:'smokebox/superheater_header',domain:'header/pre_superheat'},
  {id:'header/element_out',position:E.points[0],direction:[0,0,-1],radius:E.inner,host:'smokebox/superheater_header',domain:'header/pre_superheat'},
  {id:'header/element_return',position:E.points.at(-1),direction:[0,0,-1],radius:E.inner,host:'smokebox/superheater_header',domain:'header/post_superheat'});
 const expectedContacts=[['upstream_steam/regulator_body_and_seat',main.id],['upstream_steam/regulator_valve_disc','upstream_steam/regulator_body_and_seat'],['upstream_steam/tubeplate_flange_neck','boiler/outer_steel_shell'],['upstream_steam/tubeplate_flange_neck','upstream_steam/header_joint_gasket'],['upstream_steam/header_joint_gasket','smokebox/superheater_header'],['upstream_steam/regulator_suspension_clamp','upstream_steam/regulator_body_and_seat'],['upstream_steam/regulator_suspension_clamp','upstream_steam/regulator_suspension_beam'],['upstream_steam/regulator_suspension_beam','boiler/outer_steel_shell'],['upstream_steam/main_pipe_support_clamp',main.id],['upstream_steam/main_pipe_support_clamp','upstream_steam/main_pipe_support_hanger'],['upstream_steam/main_pipe_support_hanger','boiler/outer_steel_shell']];
 const envelopes=uni(bodyEnvelope,main.envelope,element.envelope,...parts.filter(p=>!p.upstreamMotion).map(p=>p.ast)),environmentExclusions={pr_boiler_water_or_steam_space:envelopes,pr_boiler_tube_hot:envelopes,pr_smokebox_combustion_gas_domain:envelopes};
 const maxPathPoints=Math.max(...routes.map(r=>r.points.length));
 const commonSource='uniform int upstreamCandidate;\nuniform float regulatorOpen;\n'+pathHelpers(maxPathPoints)+'vec3 upRegulatorInverse(vec3 p){return p-vec3(0.,0.,regulatorOpen*'+F(R.lift)+');}\n'+Object.values(hostCuts).map(c=>'float '+c.glsl_function+'(vec3 p){return '+emit(c.ast)+';}').join('\n');
 const source=parts.map(p=>'float '+p.glsl_function+'(vec3 p){return '+emit(p.ast)+';}').join('\n');
 function enabled(s){return s.mode==='candidate'&&s.steamRevision==='r32';}
 function check(s){if(!s||!Number.isFinite(s.regulatorOpen)||s.regulatorOpen<0||s.regulatorOpen>1)throw Error('Explicit regulatorOpen [0,1] in same installation snapshot required');}
 function referenceScalar(id,p){if(!byId[id])throw Error('Unknown upstream part');return SP.scalar(byId[id].ast,p);}
 function worldScalar(id,p,theta,s){check(s);if(!Number.isFinite(theta))throw Error('Same mechanical Time required');if(!enabled(s))return Infinity;const q=byId[id]?.upstreamMotion?p.map((v,i)=>v-(i===2?s.regulatorOpen*R.lift:0)):p;return referenceScalar(id,q);}
 function domainScalar(id,p,theta,s){check(s);if(!enabled(s))return Infinity;if(!domains[id])throw Error('Unknown upstream domain');let v=SP.scalar(domains[id],p);if(id==='regulator/chamber')v=Math.max(v,-worldScalar('upstream_steam/regulator_valve_disc',p,theta,s));return v;}
 function clipExistingDomain(id,value,p,theta,s){check(s);if(!Number.isFinite(value))throw Error('Finite retained domain value required');return enabled(s)&&environmentExclusions[id]?Math.max(value,-SP.scalar(environmentExclusions[id],p)):value;}
 function network(theta,s){check(s);const on=enabled(s),open=s.regulatorOpen>0;const replaced=new Set(['boiler_water_or_steam→regulator','regulator→main_steam_pipe','main_steam_pipe→header/pre_superheat','header/pre_superheat→superheater_elements','superheater_elements→header/post_superheat']);
  const missing=on?legacy.graph.missingEdges.filter(e=>!replaced.has(e.from+'→'+e.to)):legacy.graph.missingEdges.slice();
  const additions=on?[{from:'boiler_water_or_steam',to:'regulator',via:['upstream_steam/regulator_body_and_seat']},{from:'regulator',to:'main_steam_pipe',via:['upstream_steam/regulator_valve_disc',main.id],state:open?'connected_schematic':'closed_by_regulator'},{from:'main_steam_pipe',to:'header/pre_superheat',via:[main.id,'upstream_steam/tubeplate_flange_neck','upstream_steam/header_joint_gasket']},{from:'header/pre_superheat',to:'superheater_elements',via:[element.id]},{from:'superheater_elements',to:'header/post_superheat',via:[element.id]}].map(e=>({state:'connected_schematic',dimensions:'inferred functional schematic',...e})):[];
  return{theta,installation:{...s},enabled:on,regulatorOpen:s.regulatorOpen,upstreamGeometricallyBuilt:on,superheaterElementGeometricallyBuilt:on,supplyReachability:on&&open?'geometric candidate path to three supply branches; valve events unverified':'closed or retained R31 break',connections:[...legacy.graph.connections,...additions],missingEdges:missing,conditionalEdges:legacy.graph.conditionalEdges,forbiddenEdges:legacy.graph.forbiddenEdges,completeSteamCycle:false,historicalValveEventsVerified:false,actualElementCountVerified:false,dimensionsVerified:false,CFD:false};
 }
 return{parameters:P,parts,byId,routes,domains,hostCuts,ports,expectedContacts,environmentExclusions,maxPathPoints,source,commonSource,referenceScalar,worldScalar,domainScalar,clipExistingDomain,network,enabled,emit,scalar:SP.scalar};
}
return{parameters:P,create,emit};
});
