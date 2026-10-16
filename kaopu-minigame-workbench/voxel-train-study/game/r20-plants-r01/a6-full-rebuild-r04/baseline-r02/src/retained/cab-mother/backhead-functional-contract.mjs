/** Independently authored FH88 systems, not a measured A4 pipe layout. */
export const BACKHEAD_SYSTEM_REVISION='FH88_BACKHEAD_FUNCTIONAL_R05';
export const BACKHEAD_SYSTEM_SOURCES=Object.freeze({
  NRM15:'https://blog.railwaymuseum.org.uk/sir-nigel-gresley-overhaul-update-15/',
  NRM17:'https://blog.railwaymuseum.org.uk/sir-nigel-gresley-overhaul-update-17/',
  NRM56:'https://blog.railwaymuseum.org.uk/sir-nigel-gresley-overhaul-update-56/',
  NRM58:'https://blog.railwaymuseum.org.uk/sir-nigel-gresley-overhaul-update-58/',
  SNG2022:'https://www.sirnigelgresley.org.uk/eng-reports/mob-eng-22.shtml',
  SNG2023:'https://www.sirnigelgresley.org.uk/eng-reports/eng-23-a.shtml',
  SNG2025:'https://www.sirnigelgresley.org.uk/eng-reports/mob-eng-25-a.shtml',
  FMES2024:'https://fmes.org.uk/wp-content/uploads/2023/03/drivers_manual_18_m.pdf'
});
const provenance=(sources,principle)=>({sources:sources.map(id=>({id,url:BACKHEAD_SYSTEM_SOURCES[id]})),principle,geometryBasis:'Independent FH88 layout and dimensions; no historical survey, source mesh, source texture or source animation',physicsValidation:false});
export const BACKHEAD_PRESSURE_BASIS=Object.freeze({
  inputUnit:'Pa',inputReference:'absolute',displayUnit:'bar ABS',displayReference:'absolute',pascalPerBar:100000,
  verifiedBy:'Frozen new88 driving-physics.mjs _engine: density = pc / (R * T); meanEffectivePressurePa uses pIn / pExhaust in polytropic expansion. These require absolute pressure.',
  sourceCommit:'bddecf6bf68acc23d218fef477b41a8442a28d02',
  sourceFiles:['physics/driving-physics.mjs','physics/parameters.mjs'],
  semanticsStatus:'Inferred from and numerically checked against retained equations; not an explicit historical gauge specification',
  sourceMaximumPressurePa:2500000,authoredDisplayRangeBar:[0,30],
  atmosphericPressurePa:null,subtractExhaustPressure:false,
  reason:'Exhaust back pressure is not atmospheric reference; no atmosphere state exists. An absolute labelled authored instrument avoids inventing a gauge conversion.'
});

/** Pure, serializable graph. Null state means unavailable, never a default reading. */
export function createBackheadFunctionalContract(p){
  const sx=p.depthM/.40,sy=p.widthM/2.30,sz=p.heightM/1.90;
  const P=(x,y,z)=>[x*sx,y*sy,z*sz],components=[],ports=[],routes=[],internalLinks=[],instruments=[],externalInterfaces=[];
  const add=(id,family,kind,role,c,sources,extra={})=>{const a={id,family,kind,role,centerM:P(...c),parent:'backhead-frame',provenance:provenance(sources,role),fluidState:null,controlState:null,...extra};components.push(a);return a;};
  const port=(id,owner,xyz,dir,r,medium,role,nodeId=null,extra={})=>{const own=components.find(x=>x.id===owner);if(!own)throw Error('PORT_OWNER_MISSING:'+owner);const v={id,owner,positionM:P(...xyz),direction:dir,radiusM:r,medium,kind:'identified-authored-interface',functionIdentity:role,nodeId,fluidState:null,provenance:own.provenance,...extra};ports.push(v);return v;};
  const endpoint=(id,family,c,medium,nodeId,sources,mate,r=.008,dir=[1,0,0])=>{
    add(id,family,'boundary',mate,c,sources);const v=port(id+'.port',id,c,dir,r,medium,mate,nodeId,{external:true,externalMate:mate,externalBinding:null});externalInterfaces.push(v);return v.id;
  };
  const link=(id,from,to,role)=>internalLinks.push({id,from,to,role,conductance:null,status:'Declared component topology only; no solved fluid law'});
  const route=(id,from,to,coords=[],sources=['NRM58'],role='independently routed connection')=>{
    const a=ports.find(x=>x.id===from),b=ports.find(x=>x.id===to);if(!a||!b)throw Error('ROUTE_PORT_MISSING:'+id);if(a.radiusM!==b.radiusM||a.medium!==b.medium)throw Error('ROUTE_INTERFACE_MISMATCH:'+id);
    routes.push({id:'route.'+id,from,to,waypointsM:coords.map(c=>P(...c)),radiusM:a.radiusM,medium:a.medium,role,provenance:provenance(sources,role),fluidState:null});
  };
  const valve=(id,family,c,role,sources,r=.008,wheel=.043,extra={})=>{
    add(id,family,'valve',role,c,sources,{wheelRadiusM:wheel,axis:[0,0,1],...extra});
    port(id+'.in',id,[c[0],c[1],c[2]+.036],[0,0,1],r,'steam',role+' inlet');
    port(id+'.out',id,[c[0],c[1],c[2]-.036],[0,0,-1],r,'steam',role+' outlet');
    link(id+'.controlled-passage',id+'.in',id+'.out',role+'; actual opening and flow unavailable');
  };
  // Boiler steam enters one isolation valve and a common plenum. Every consumer
  // has its own branch valve; no branch is fed through another consumer valve.
  const auxTap=endpoint('boiler.auxiliary-takeoff','auxiliary-steam-distribution',[.025,0,1.855],'steam','boiler.steam-space',['NRM15','NRM17'],'Boiler auxiliary-steam takeoff pad',.010);
  valve('valve.auxiliary-main','auxiliary-steam-distribution',[-.120,0,1.780],'Auxiliary manifold main isolation',['NRM15'],.010,.050);
  add('auxiliary.manifold','auxiliary-steam-distribution','manifold','Common auxiliary-steam plenum',[-.095,0,1.655],['NRM15','NRM58'],{spanYM:[-.635*sy,.635*sy],bodyRadiusM:.027});
  port('auxiliary.manifold.in','auxiliary.manifold',[-.095,0,1.682],[0,0,1],.010,'steam','Manifold common inlet','auxiliary.plenum');
  route('auxiliary-takeoff',auxTap,'valve.auxiliary-main.in',[[-.050,0,1.855],[-.120,0,1.855]],['NRM15','NRM17'],'Boiler takeoff to main isolation');
  route('auxiliary-main','valve.auxiliary-main.out','auxiliary.manifold.in',[],['NRM15'],'Main isolation to common manifold');
  const branchDefinitions=[
    ['injector-left',-.60,'L INJ','injector-feed-pair'],['blower',-.36,'BLOW','auxiliary-steam-distribution'],
    ['ejector',-.12,'EJECT','vacuum-pressure-indication'],['whistle',.12,'WHIST','auxiliary-steam-distribution'],
    ['steam-heat',.36,'HEAT','steam-heat-indication'],['injector-right',.60,'R INJ','injector-feed-pair']
  ];
  for(const [name,y,label,family] of branchDefinitions){
    const id='valve.'+name;
    port('auxiliary.manifold.'+name,'auxiliary.manifold',[-.095,y,1.628],[0,0,-1],.008,'steam',name+' independent supply','auxiliary.plenum');
    link('manifold.'+name,'auxiliary.manifold.in','auxiliary.manifold.'+name,'Same manifold cavity; parallel outlet');
    valve(id,family,[-.140,y,1.505],name+' steam admission',['NRM15','NRM58','FMES2024'],.008,.042,{label,controlKind:name==='whistle'?'spring-return-lever':'handwheel'});
    route(name+'-supply','auxiliary.manifold.'+name,id+'.in',[],['NRM15','NRM58'],'Independent manifold branch to '+name+' valve');
    if(['blower','ejector','whistle'].includes(name)){
      const end=endpoint(name+'.steam-line','auxiliary-steam-distribution',[.025,y,1.365],'steam',name+'.steam-in',['NRM58','SNG2022'],name+' external delivery pipe; consumer not built');
      route(name+'-delivery',id+'.out',end,[[-.140,y,1.365]],['NRM58','SNG2022'],name+' isolated delivery to explicit external interface');
    }
  }
  const heat=endpoint('steam-heat.tender-line','steam-heat-indication',[-.070,.460,.075],'steam','coach-heat.supply',['NRM58','SNG2025'],'Tender/coach heating pipe; relief and heating-pressure model absent',.008,[0,0,-1]);
  route('steam-heat-delivery','valve.steam-heat.out',heat,[[-.070,.360,1.410],[-.070,.460,1.410],[-.070,.460,.180]],['NRM58'],'Separate heating branch, no invented 50 psi relief or dial');
  // These are two intentionally different pressure circuits and two dials only.
  const boilerTap=endpoint('boiler.instrument-tap','boiler-pressure-indication',[.025,-.745,1.615],'steam','boiler.steam-space',['NRM15'],'Boiler pressure takeoff, independent of auxiliary branch controls');
  valve('valve.boiler-gauge-isolation','boiler-pressure-indication',[-.110,-.745,1.485],'Boiler pressure instrument isolation',['NRM15'],.008,.035);
  route('boiler-gauge-takeoff',boilerTap,'valve.boiler-gauge-isolation.in',[[-.060,-.745,1.615],[-.110,-.745,1.615]],['NRM15'],'Dedicated boiler instrument pressure path');
  const chestTap=endpoint('steam-chest.sense-bulkhead','steam-chest-pressure-indication',[.025,.745,1.555],'steam','engine.steam-chest.cycle-averaged',['SNG2022','SNG2023'],'Engine steam-chest pressure takeoff continuation; external engine-side tube still required');
  add('instrument.chest-snubber','steam-chest-pressure-indication','snubber','Dedicated steam-chest sensing-line snubber',[-.105,.700,1.610],['SNG2023']);
  port('instrument.chest-snubber.in','instrument.chest-snubber',[-.105,.700,1.588],[0,0,-1],.008,'steam','Snubber pressure inlet');
  port('instrument.chest-snubber.out','instrument.chest-snubber',[-.105,.700,1.632],[0,0,1],.008,'steam','Snubber instrument outlet');
  link('snubber.passage','instrument.chest-snubber.in','instrument.chest-snubber.out','Sensing snubber; dynamics unavailable, no fabricated lag');
  route('chest-sense-inlet',chestTap,'instrument.chest-snubber.in',[[-.105,.745,1.555],[-.105,.700,1.555]],['SNG2022','SNG2023'],'Independent chest pressure inlet to snubber');
  for(const [name,y,state,tap,family,sources] of [
    ['boiler',-.410,'boilerPressurePa','boiler.instrument-tap.port','boiler-pressure-indication',['NRM15']],
    ['steam-chest',.410,'steamChestPressurePa','steam-chest.sense-bulkhead.port','steam-chest-pressure-indication',['SNG2022','SNG2023']]
  ]){
    const id='gauge.'+name,r=p.gaugeRadiusM;
    add(id,family,'pressure-gauge',name==='boiler'?'Boiler absolute pressure indication':'Steam-chest absolute pressure indication',[-.170,y,1.780],sources,{radiusM:r,label:name==='boiler'?'BOILER':'CHEST'});
    port(id+'.sense',id,[-.170,y,1.780-(r+.020)/sz],[0,0,-1],.008,'steam',name+' pressure instrument connection',null,{stateReader:state});
    const instrument={id,family,tapPort:tap,sensePort:id+'.sense',sourceStatePath:state,sourceNodeId:ports.find(x=>x.id===tap).nodeId,unit:'bar ABS',range:[0,30],majorMarks:[0,5,10,15,20,25,30],value:null,available:false,calibration:'Authored FH88 scale; not a surveyed historical instrument or certified calibration',pressureBasis:BACKHEAD_PRESSURE_BASIS,provenance:provenance(sources,'Independent pressure measurement family')};instruments.push(instrument);
  }
  route('boiler-pressure-sense','valve.boiler-gauge-isolation.out','gauge.boiler.sense',[[-.195,-.745,1.425],[-.195,-.520,1.425],[-.195,-.520,1.658],[-.170,-.520,1.658]],['NRM15'],'Boiler isolation outlet to its own gauge');
  route('chest-pressure-sense','instrument.chest-snubber.out','gauge.steam-chest.sense',[[-.105,.700,1.658],[-.170,.570,1.658]],['SNG2022','SNG2023'],'Chest snubber outlet to chest gauge, never the boiler manifold');
  // Each glass is independently connected to steam space, water space and drain.
  for(const [name,s] of [['left',-1],['right',1]]){
    const y=s*.790,id='water-glass.'+name;
    add(id,'boiler-water-level','water-glass','Independent boiler level glass with guard rods',[-.185,y,1.080],['FMES2024','SNG2025'],{topZM:1.220*sz,bottomZM:.940*sz,waterLevelM:null,displayStatus:'N/A: boiler phase/volume-height state not modeled'});
    port(id+'.top',id,[-.185,y,1.220],[0,0,1],.007,'water-gauge','Glass upper steam connection');
    port(id+'.bottom',id,[-.185,y,.940],[0,0,-1],.007,'water-gauge','Glass lower water connection');
    link(id+'.glass-column',id+'.top',id+'.bottom','Communicating gauge column; liquid interface unavailable');
    for(const [level,z,node] of [['top',1.270,'boiler.steam-space'],['bottom',.890,'boiler.water-space']]){
      const cid='cock.'+name+'-'+level;
      add(cid,'boiler-water-level','gauge-cock',level+' glass isolating cock with restrictive passage',[-.135,y,z],['FMES2024','SNG2025'],{wheelRadiusM:.032});
      const tap=endpoint('boiler.'+name+'-'+level+'-tap','boiler-water-level',[.025,y,z],'water-gauge',node,['FMES2024','SNG2025'],name+' gauge '+level+' direct boiler communication',.007);
      port(cid+'.boiler',cid,[-.090,y,z],[1,0,0],.007,'water-gauge','Direct boiler '+level+' communication',node);
      port(cid+'.glass',cid,[-.185,y,z],[0,0,level==='top'?-1:1],.007,'water-gauge',level+' connection to glass');
      link(cid+'.passage',cid+'.boiler',cid+'.glass','Isolating passage with uncalibrated flow restrictor');
      route(name+'-'+level+'-boiler',tap,cid+'.boiler',[],['FMES2024','SNG2025'],'Boiler '+level+' takeoff to independent gauge cock');
      route(name+'-'+level+'-glass',cid+'.glass',id+'.'+level,[],['FMES2024'],'Gauge cock to '+level+' glass union');
      if(level==='bottom'){
        port(cid+'.drain',cid,[-.135,y,z-.025],[0,0,-1],.007,'water-gauge','Lower cock drain branch');link(cid+'.drain-branch',cid+'.glass',cid+'.drain','Glass blowdown branch');
      }
    }
    const drain='cock.'+name+'-drain';
    add(drain,'boiler-water-level','drain-cock','Gauge-glass dedicated blowdown cock',[-.135,y,.795],['FMES2024'],{wheelRadiusM:.026});
    port(drain+'.in',drain,[-.135,y,.820],[0,0,1],.007,'water-gauge','Blowdown inlet');
    port(drain+'.out',drain,[-.135,y,.770],[0,0,-1],.007,'water-gauge','Blowdown outlet');link(drain+'.passage',drain+'.in',drain+'.out','Normally closed drain; actuation unavailable');
    route(name+'-glass-drain','cock.'+name+'-bottom.drain',drain+'.in',[],['FMES2024'],'Independent gauge-glass drain branch');
    const outlet=endpoint('water-glass.'+name+'-drain-exit','boiler-water-level',[-.135,s*.860,.065],'water-gauge','atmosphere.safe-underfloor-discharge',['FMES2024','SNG2025'],'Dedicated underfloor gauge drain continuation, no discharge inside cab',.007,[0,0,-1]);
    route(name+'-glass-blowdown',drain+'.out',outlet,[[-.135,s*.860,.710]],['FMES2024','SNG2025'],'Drain routed to underfloor interface; outlet safety unresolved externally');
    // Injector internals are honestly outside this shallow module. Four distinct
    // connections retain their roles; no cosmetic pipe joins delivery to supply.
    const injector='injector.'+name;
    add(injector,'injector-feed-pair','injector-boundary','Underfloor injector connection carrier; injector/mixing body not built',[-.070,s*.710,.065],['NRM56','FMES2024'],{externalBinding:null});
    for(const [type,yy,medium,r] of [['steam',.980,'steam',.008],['water',.930,'water',.009],['delivery',.655,'feed-water',.011],['overflow',.565,'overflow',.009]]){
      const v=port(injector+'.'+type,injector,[-.070,s*yy,.065],[0,0,-1],r,medium,'Underfloor injector '+type+' continuation',injector+'.'+type,{external:true,externalBinding:null,externalMate:injector+' '+type+' connection'});externalInterfaces.push(v);
    }
    route(name+'-injector-steam','valve.injector-'+name+'.out',injector+'.steam',[[-.055,s*.600,1.410],[-.055,s*.980,1.410],[-.055,s*.980,.190],[-.070,s*.980,.190]],['NRM56','FMES2024'],'Independent steam supply to '+name+' injector');
    const waterIn=endpoint('tender.'+name+'-water-feed','injector-feed-pair',[.025,s*.965,.665],'water','tender.water-space',['NRM56','FMES2024'],'Tender flexible water feed, external tender and hose absent',.009);
    const stop='valve.'+name+'-injector-water';
    add(stop,'injector-feed-pair','valve','Injector tender-water stop valve',[-.175,s*.965,.530],['FMES2024'],{wheelRadiusM:.037,label:'WATER'});
    port(stop+'.in',stop,[-.175,s*.965,.566],[0,0,1],.009,'water','Tender water supply');
    port(stop+'.out',stop,[-.175,s*.965,.494],[0,0,-1],.009,'water','Injector water admission');link(stop+'.passage',stop+'.in',stop+'.out','Water stop valve, no flow solution');
    route(name+'-tender-water',waterIn,stop+'.in',[[-.175,s*.965,.665]],['FMES2024','NRM56'],'Tender water to dedicated stop valve');
    route(name+'-injector-water',stop+'.out',injector+'.water',[[-.175,s*.965,.220],[-.175,s*.930,.220],[-.070,s*.930,.220]],['FMES2024','NRM56'],'Water stop valve to separate injector water inlet');
    const clack='clack.'+name;
    add(clack,'injector-feed-pair','clack','Boiler delivery non-return clack',[-.100,s*.655,.330],['NRM17','SNG2025','FMES2024']);
    port(clack+'.in',clack,[-.100,s*.655,.288],[0,0,-1],.011,'feed-water','Injector delivery to check seat');
    port(clack+'.out',clack,[-.045,s*.655,.330],[1,0,0],.011,'feed-water','Check-protected boiler feed');link(clack+'.check',clack+'.in',clack+'.out','One-way into boiler; pressure opening law not implemented');
    const boilerFeed=endpoint('boiler.'+name+'-feed-pad','injector-feed-pair',[.025,s*.655,.330],'feed-water','boiler.water-space',['NRM17','FMES2024'],'Boiler feed connection downstream of clack',.011);
    route(name+'-injector-delivery',injector+'.delivery',clack+'.in',[[-.100,s*.655,.145]],['FMES2024','NRM56'],'Injector delivery to clack, distinct from tender supply');
    route(name+'-clack-boiler',clack+'.out',boilerFeed,[],['NRM17','FMES2024'],'One-way clack discharge into boiler');
  }
  // Mechanical regulator controls are not steam pipes.
  add('regulator','regulator','regulator','Cross-shaft, gland/stuffing box, pinned crank and forward reach-rod interface',[-.140,0,1.040],['NRM17','NRM58'],{controlKind:'mechanical-rotation',controlWriter:null,available88Control:'controls.throttle',poseIsAuthoredPreview:true});
  port('regulator.reach-rod.exit','regulator',[.035,0,1.078],[1,0,0],.011,'mechanical','Regulator reach rod toward internal regulator valve',null,{external:true,externalBinding:null,externalMate:'Boiler regulator valve actuating rod'});externalInterfaces.push(ports.at(-1));
  const unavailable={boilerWaterLevelM:null,tenderWaterLevelM:null,injectorFlowKgS:null,heatingPressurePa:null,vacuumTrainPipePa:null,vacuumChamberPa:null,steamTemperatureK:null,regulatorValveTravelM:null};
  const result={revision:BACKHEAD_SYSTEM_REVISION,components,ports,routes,internalLinks,instruments,externalInterfaces,unavailable,pressureBasis:BACKHEAD_PRESSURE_BASIS,
    layoutStatus:'Independent FH88 functional-family design; not surveyed A4',physicalFluidNetworkCertified:false,physicalIntegrationComplete:false,
    missingSystems:['External boiler pressure vessel/taps beyond mating pads','External engine-to-cab chest sense pipe','Underfloor injector mixing bodies, overflow discharge, flexible tender hoses and mass split','Blower, whistle and vacuum ejector consumers and their external pipes','Vacuum chambers/actuators and actual pressure instrumentation','Heating relief, calibrated heating pressure and coach connection','Pyrometer element/capillary and dynamic temperature model','Internal regulator valve and complete reach rod','Cylinder drain system and full brake-force path belong to separate modules']};
  validateBackheadFunctionalContract(result);return result;
}
export function validateBackheadFunctionalContract(c){
  for(const key of ['components','ports','routes'])if(new Set(c[key].map(v=>v.id)).size!==c[key].length)throw Error('DUPLICATE_SYSTEM_ID:'+key);
  const owners=new Set(c.components.map(v=>v.id)),ports=new Map(c.ports.map(v=>[v.id,v]));
  for(const p of c.ports){if(!owners.has(p.owner)||!p.functionIdentity||!p.provenance.sources.length)throw Error('INVALID_FUNCTIONAL_PORT:'+p.id);for(const n of p.positionM)if(!Number.isFinite(n))throw Error('NONFINITE_SYSTEM_PORT:'+p.id);}
  for(const r of [...c.routes,...c.internalLinks])if(!ports.has(r.from)||!ports.has(r.to))throw Error('MISSING_SYSTEM_ROUTE_ENDPOINT:'+r.id);
  for(const i of c.instruments)if(!ports.has(i.tapPort)||!ports.has(i.sensePort)||!i.sourceNodeId)throw Error('MISSING_INSTRUMENT_IDENTITY:'+i.id);
  return true;
}

/** Read-only new88 adapter. No integrator write, no guessed unavailable values. */
export function readBackheadPressureStates(contract,physics){
  validateBackheadFunctionalContract(contract);
  const finite=v=>typeof v==='number'&&Number.isFinite(v);
  return contract.instruments.map(i=>{
    const raw=physics?.[i.sourceStatePath],available=finite(raw)&&raw>=0,value=available?raw/100000:null;
    const t=i.sourceStatePath==='steamChestPressurePa'?physics?.diagnostics?.pressureEvaluationTimeS:physics?.timeS;
    return {id:i.id,sourceStatePath:i.sourceStatePath,tapPort:i.tapPort,sourceNodeId:i.sourceNodeId,unit:'bar ABS',valuePa:available?raw:null,value,available,evaluationTimeS:finite(t)?t:null,tick:Number.isInteger(physics?.tick)?physics.tick:null,range:i.range.slice(),overrange:available&&(value<i.range[0]||value>i.range[1]),normalized:available?Math.max(0,Math.min(1,(value-i.range[0])/(i.range[1]-i.range[0]))):null,status:available?'RETAINED_STATE_READ_ONLY_PRESENTATION':'UNAVAILABLE',physicalCircuitSolved:false};
  });
}
