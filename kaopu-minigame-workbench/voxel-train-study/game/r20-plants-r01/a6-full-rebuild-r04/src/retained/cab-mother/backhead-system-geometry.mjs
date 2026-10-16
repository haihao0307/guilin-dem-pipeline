import {createBackheadFunctionalContract,readBackheadPressureStates} from './backhead-functional-contract.mjs';

// Authored 5x7 strokes, not an imported font/texture. Glyphs become transient quads.
const FONT={
'0':['01110','10001','10011','10101','11001','10001','01110'],'1':['00100','01100','00100','00100','00100','00100','01110'],
'2':['01110','10001','00001','00010','00100','01000','11111'],'3':['11110','00001','00001','01110','00001','00001','11110'],
'4':['00010','00110','01010','10010','11111','00010','00010'],'5':['11111','10000','10000','11110','00001','00001','11110'],
'6':['01110','10000','10000','11110','10001','10001','01110'],'7':['11111','00001','00010','00100','01000','01000','01000'],
'8':['01110','10001','10001','01110','10001','10001','01110'],'9':['01110','10001','10001','01111','00001','00001','01110'],
'A':['01110','10001','10001','11111','10001','10001','10001'],'B':['11110','10001','10001','11110','10001','10001','11110'],
'C':['01111','10000','10000','10000','10000','10000','01111'],'D':['11110','10001','10001','10001','10001','10001','11110'],
'E':['11111','10000','10000','11110','10000','10000','11111'],'F':['11111','10000','10000','11110','10000','10000','10000'],
'G':['01111','10000','10000','10111','10001','10001','01111'],'H':['10001','10001','10001','11111','10001','10001','10001'],
'I':['11111','00100','00100','00100','00100','00100','11111'],'J':['00111','00010','00010','00010','10010','10010','01100'],
'K':['10001','10010','10100','11000','10100','10010','10001'],'L':['10000','10000','10000','10000','10000','10000','11111'],
'M':['10001','11011','10101','10101','10001','10001','10001'],'N':['10001','11001','10101','10011','10001','10001','10001'],
'O':['01110','10001','10001','10001','10001','10001','01110'],'P':['11110','10001','10001','11110','10000','10000','10000'],
'Q':['01110','10001','10001','10001','10101','10010','01101'],'R':['11110','10001','10001','11110','10100','10010','10001'],
'S':['01111','10000','10000','01110','00001','00001','11110'],'T':['11111','00100','00100','00100','00100','00100','00100'],
'U':['10001','10001','10001','10001','10001','10001','01110'],'V':['10001','10001','10001','10001','10001','01010','00100'],
'W':['10001','10001','10001','10101','10101','11011','10001'],'X':['10001','10001','01010','00100','01010','10001','10001'],
'Y':['10001','10001','01010','00100','00100','00100','00100'],'Z':['11111','00001','00010','00100','01000','10000','11111'],
'/':['00001','00010','00010','00100','01000','01000','10000'],'-':['00000','00000','00000','11111','00000','00000','00000'],
'.':['00000','00000','00000','00000','00000','00110','00110'],' ':['00000','00000','00000','00000','00000','00000','00000']};
const distance=(a,b)=>Math.hypot(...a.map((n,i)=>n-b[i]));

/** Uses the mother material/domain and geometry helpers unchanged. */
export function createBackheadSystemGeometry(T,p,h){
  const {root,parts,ports,components,connections,attachments,add,box,cylinder,ring,bolt,mount,roundedPath}=h;
  const contract=createBackheadFunctionalContract(p),sx=p.depthM/.40,sy=p.widthM/2.30,sz=p.heightM/1.90;
  const P=(x,y,z)=>[x*sx,y*sy,z*sz],V=a=>new T.Vector3(...a),R=n=>Math.max(4,Math.round(n*p.resolution));
  const get=id=>{const v=contract.ports.find(x=>x.id===id);if(!v)throw Error('MISSING_SYSTEM_PORT:'+id);return v;};
  components.push(...contract.components);ports.push(...contract.ports);
  const needles=new Map(),flags=new Map(),regulatorArms=[];
  function mark(id,text,c,cell,owner,material='ink'){
    const xyz=[],width=(text.length*6-1)*cell;
    for(let i=0;i<text.length;i++){const glyph=FONT[text[i]];if(!glyph)throw Error('UNSUPPORTED_NATIVE_GLYPH:'+text[i]);for(let row=0;row<7;row++)for(let col=0;col<5;col++)if(glyph[row][col]==='1'){
      const y=c[1]+width/2-(i*6+col)*cell,z=c[2]+3.5*cell-row*cell,s=cell*.90;
      // CCW as seen from the rear (-X), normal points toward the reader.
      xyz.push(c[0],y,z,c[0],y-s,z-s,c[0],y-s,z,c[0],y,z,c[0],y,z-s,c[0],y-s,z-s);
    }}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(xyz,3));const m=add(g,id,{material,type:'dial-mark',center:c,heatFactor:0},owner);m.userData.text=text;m.userData.nativeAuthoredGlyphs=true;return m;
  }
  function union(id,c,axis,r,owner){
    const u=V(axis).normalize(),a=V(c).addScaledVector(u,-.012),b=V(c).addScaledVector(u,.012),d={material:'brass',type:'coupling',center:c,crevice:.72},rr=r*1.65;
    cylinder(id+'.hex',a.toArray(),b.toArray(),rr,d,owner,rr,6);
    for(const t of [-1,1]){const q=V(c).addScaledVector(u,t*.017);cylinder(id+'.collar.'+t,q.clone().addScaledVector(u,-.003).toArray(),q.clone().addScaledVector(u,.003).toArray(),r*1.25,{...d,material:'copper'},owner,r*1.25,16);}
  }
  function wheel(c){
    const id=c.id,a=c.centerM,r=c.wheelRadiusM||.035,front=[-.270*sx,a[1],a[2]],d={material:'brass',type:'handwheel',center:front,radius:r,touch:.4,heatFactor:.35};
    cylinder(id+'.bonnet',[a[0],a[1],a[2]],[front[0]+.051*sx,a[1],a[2]],.018,{material:'brass',type:'valve',center:a,crevice:.65},id,.014,18);
    cylinder(id+'.spindle',[front[0]+.058*sx,a[1],a[2]],front,.006,{material:'steel',type:'spindle',touch:.8},id);
    if(c.controlKind==='spring-return-lever'){
      cylinder(id+'.spring-body',[front[0]+.024,a[1],a[2]-.027],[front[0]+.024,a[1],a[2]+.027],.012,{material:'steel',type:'valve',crevice:.5},id);
      cylinder(id+'.lever',front,[front[0],front[1]+r,front[2]+.012],.006,{material:'steel',type:'handle',touch:.6},id);
      cylinder(id+'.pull-grip',[front[0],front[1]+r,front[2]+.012],[front[0]-.032,front[1]+r,front[2]+.012],.010,{material:'ink',type:'handle',touch:1},id);
    }else{
      ring(id+'.rim',front,r,.006,d,id);
      cylinder(id+'.hub',[front[0]-.010,front[1],front[2]],[front[0]+.010,front[1],front[2]],.011,d,id,.011,16);
      for(let i=0;i<5;i++){const a=i/5*Math.PI*2;const end=[front[0],front[1]+Math.cos(a)*(r-.005),front[2]+Math.sin(a)*(r-.005)];cylinder(id+'.spoke.'+i,front,end,.004,d,id,.003,8);}
      bolt(id+'.hub-nut',[front[0]-.010,front[1],front[2]],id,.007);
    }
    mount(id+'.mount',a,id,.052);
    if(c.label){box(id+'.label-plate',[front[0]+.013,front[1],front[2]-r-.024],[.005,.068,.018],{material:'ivory',type:'mount',heatFactor:0},id);mark(id+'.label',c.label,[front[0]+.009,front[1],front[2]-r-.024],.00155,id);}
  }
  for(const c of contract.components){
    const id=c.id,a=c.centerM,d={material:'brass',type:c.kind,center:a,crevice:.45,heatFactor:.45};
    if(c.kind==='boundary'){
      const pp=contract.ports.find(v=>v.owner===id),axis=pp.direction,u=V(axis),q=V(a);
      // Boundary flange is a real attachment, not proof of a completed vessel.
      const pad=axis[0]?[.012,.054,.054]:[.052,.052,.012];
      box(id+'.flange',a,pad,{material:'steel',type:'mount',center:a,crevice:.5},id);
      cylinder(id+'.socket',q.clone().addScaledVector(u,-.018).toArray(),q.clone().addScaledVector(u,.012).toArray(),pp.radiusM*1.30,d,id,pp.radiusM*1.3,18);
      for(const s of [-1,1])bolt(id+'.flange-bolt.'+s,[a[0]-.010,a[1]+s*.020,a[2]],id,.004);
      if(a[0]<0)mount(id+'.support',a,id,.043);else attachments.push({id:id+'.flange-mount',owner:id,fromM:[0,a[1],a[2]],toM:a,role:'Bolted mating pad, external parent UNBOUND'});
    }else if(c.kind==='manifold'){
      cylinder(id+'.plenum',[a[0],c.spanYM[0],a[2]],[a[0],c.spanYM[1],a[2]],c.bodyRadiusM,d,id,c.bodyRadiusM,24);
      for(const s of [-1,1]){const q=[a[0],s*.59*sy,a[2]];mount(id+'.support.'+s,q,id,.065);cylinder(id+'.end-cover.'+s,[a[0],s*.637*sy,a[2]],[a[0],s*.646*sy,a[2]],.031,{...d,material:'steel'},id,.031,18);}
      for(const pp of contract.ports.filter(v=>v.owner===id)){cylinder(id+'.neck.'+pp.id,[a[0],pp.positionM[1],a[2]],pp.positionM,pp.radiusM*1.35,d,id);}
    }else if(['valve','drain-cock'].includes(c.kind)){
      const pin=get(id+'.in'),pout=get(id+'.out');
      cylinder(id+'.body',pin.positionM,pout.positionM,c.kind==='drain-cock'?.017:.024,d,id,c.kind==='drain-cock'?.017:.022,20);wheel(c);
    }else if(c.kind==='gauge-cock'){
      cylinder(id+'.body',get(id+'.boiler').positionM,get(id+'.glass').positionM,.023,d,id,.020,20);
      if(id.includes('bottom'))cylinder(id+'.drain-neck',a,get(id+'.drain').positionM,.011,d,id);
      cylinder(id+'.restrictor-housing',[a[0]+.016,a[1],a[2]],[a[0]+.035,a[1],a[2]],.014,{...d,material:'steel'},id,.014,16);
      wheel(c);
    }else if(c.kind==='snubber'){
      cylinder(id+'.body',get(id+'.in').positionM,get(id+'.out').positionM,.018,d,id,.018,6);mount(id+'.bracket',a,id,.049);
    }else if(c.kind==='clack'){
      cylinder(id+'.body',[a[0],a[1],a[2]-.041],[a[0],a[1],a[2]+.038],.035,d,id,.029,22);
      cylinder(id+'.outlet',a,get(id+'.out').positionM,.020,d,id);
      cylinder(id+'.service-cap',[a[0],a[1],a[2]+.037],[a[0],a[1],a[2]+.052],.032,{...d,material:'steel'},id,.032,6);
      mount(id+'.mount',a,id,.065);c.fluidState=null;c.checkValveDirection=[id+'.in',id+'.out'];
    }else if(c.kind==='injector-boundary'){
      const pp=contract.ports.filter(v=>v.owner===id);const ys=pp.map(v=>v.positionM[1]);
      box(id+'.carrier',[a[0]+.006,(Math.min(...ys)+Math.max(...ys))/2,a[2]+.019],[.050,Math.max(...ys)-Math.min(...ys)+.050,.012],{material:'paint',type:'mount',crevice:.5},id);
      for(const v of pp){union(id+'.'+v.id+'.terminal',v.positionM,[0,0,1],v.radiusM,id);mount(id+'.'+v.id+'.support',v.positionM,id,.031);}
    }else if(c.kind==='water-glass'){
      const top=get(id+'.top').positionM,bottom=get(id+'.bottom').positionM;
      box(id+'.sight-backing',[a[0]+.026,a[1],(top[2]+bottom[2])/2],[.018,.064,top[2]-bottom[2]+.030],{material:'ivory',type:'mount',heatFactor:.1},id);
      cylinder(id+'.glass-tube',bottom,top,.012,{material:'glass',type:'gauge',center:a,heatFactor:0},id,.012,22);
      for(const s of [-1,1])cylinder(id+'.guard-rod.'+s,[a[0]-.014,a[1]+s*.028,bottom[2]-.015],[a[0]-.014,a[1]+s*.028,top[2]+.015],.005,{material:'steel',type:'spindle',touch:.2},id);
      for(const [suffix,v] of [['top',top],['bottom',bottom]]){union(id+'.'+suffix+'-gland',v,[0,0,1],.010,id);mount(id+'.'+suffix+'-bracket',[a[0]+.021,a[1],v[2]],id,.048);}
      box(id+'.unavailable-plate',[a[0]-.023,a[1],a[2]],[.006,.052,.060],{material:'ivory',type:'gauge',heatFactor:0},id);
      mark(id+'.unavailable-label','N/A',[a[0]-.028,a[1],a[2]+.009],.0024,id,'red');mark(id+'.level-label','LEVEL',[a[0]-.028,a[1],a[2]-.012],.0014,id);
      // Deliberately no water fill/meniscus: inventory is not boiler level.
    }else if(c.kind==='pressure-gauge'){
      const r=c.radiusM,face=[-.225*sx,a[1],a[2]],gd={...d,type:'gauge',radius:r,heatFactor:.15},i=contract.instruments.find(v=>v.id===id);
      cylinder(id+'.case',[a[0]+.055*sx,a[1],a[2]],[a[0]-.045*sx,a[1],a[2]],r,gd,id,r*.97,44);
      cylinder(id+'.ivory-dial',[face[0]+.003,a[1],a[2]],[face[0]-.003,a[1],a[2]],r*.85,{...gd,material:'ivory'},id,r*.85,44);
      ring(id+'.bezel',[face[0]-.012,a[1],a[2]],r*.91,.009,gd,id);ring(id+'.bezel-inner',[face[0]-.014,a[1],a[2]],r*.826,.003,{...gd,material:'steel'},id);
      for(let k=0;k<=60;k++){const angle=(-.75+1.5*k/60)*Math.PI,major=k%10===0;const q=[face[0]-.009,a[1]-Math.sin(angle)*r*.75,a[2]+Math.cos(angle)*r*.75],b=[q[0],a[1]-Math.sin(angle)*r*(major?.63:.69),a[2]+Math.cos(angle)*r*(major?.63:.69)];cylinder(id+'.tick.'+k,q,b,major?.0013:.0006,{material:'ink',type:'dial-mark',heatFactor:0},id,major?.001:.0005,6);}
      for(let k=0;k<i.majorMarks.length;k++){const angle=(-.75+1.5*k/6)*Math.PI;mark(id+'.number.'+k,String(i.majorMarks[k]),[face[0]-.010,a[1]-Math.sin(angle)*r*.52,a[2]+Math.cos(angle)*r*.52],.00155,id);}
      mark(id+'.identity',c.label,[face[0]-.010,a[1],a[2]+r*.22],.00145,id);mark(id+'.units','BAR ABS',[face[0]-.010,a[1],a[2]-r*.20],.00140,id);mark(id+'.authorship','FH88',[face[0]-.010,a[1],a[2]-r*.35],.00115,id);
      const nc=[face[0]-.018,a[1],a[2]],needle=cylinder(id+'.needle',nc,[nc[0],nc[1],nc[2]+r*.64],.002,{material:'ink',type:'needle',heatFactor:0},id,.0008,8);
      needle.geometry.translate(-nc[0],-nc[1],-nc[2]);needle.position.set(...nc);needle.visible=false;needle.geometry.computeBoundingBox();needles.set(id,needle);
      cylinder(id+'.needle-pin',[face[0]-.018,a[1],a[2]],[face[0]-.024,a[1],a[2]],.0055,{material:'brass',type:'bolt',heatFactor:0},id,.0055,12);
      const flag=mark(id+'.unavailable','UNCONNECTED',[face[0]-.024,a[1],a[2]-.004],.00170,id,'red');flags.set(id,flag);
      cylinder(id+'.glass',[face[0]-.028,a[1],a[2]],[face[0]-.030,a[1],a[2]],r*.82,{material:'glass',type:'gauge',center:face,radius:r,heatFactor:0},id,r*.82,44);
      const sense=get(id+'.sense').positionM;cylinder(id+'.bottom-union',[a[0],a[1],a[2]-r+.005],sense,.014,d,id,.014,6);
      mount(id+'.bracket',[a[0]+.054*sx,a[1],a[2]],id,.082);
    }
  }
  // Cross-shaft is transverse. Its packed box contains the pinned crank, and
  // the reach-rod exits forward. External valve travel is not yet modeled.
  {
    const id='regulator',c=contract.components.find(v=>v.id===id),a=c.centerM,shaftLeft=P(-.140,-.49,1.040),shaftRight=P(-.140,.49,1.040),d={material:'brass',type:'spindle',center:a,crevice:.5};
    cylinder(id+'.cross-shaft',shaftLeft,shaftRight,.018,{...d,material:'steel'},id);
    box(id+'.stuffing-box',P(-.075,0,1.040),[.130*sx,.150*sy,.105*sz],d,id);
    box(id+'.gland-cover',P(-.145,0,1.040),[.018*sx,.160*sy,.112*sz],{...d,material:'steel'},id);
    for(const s of [-1,1]){cylinder(id+'.shaft-gland.'+s,P(-.140,s*.078,1.040),P(-.140,s*.092,1.040),.031,d,id,.031,20);bolt(id+'.cover-bolt.'+s,P(-.160,s*.050,1.074),id,.006);mount(id+'.shaft-bearing.'+s,P(-.140,s*.430,1.040),id,.070);}
    cylinder(id+'.crank-pin',P(-.140,-.030,1.078),P(-.140,.030,1.078),.010,{...d,material:'steel'},id);
    cylinder(id+'.crank-arm',P(-.140,0,1.040),P(-.140,0,1.078),.012,d,id);
    cylinder(id+'.reach-rod',P(-.140,0,1.078),get(id+'.reach-rod.exit').positionM,.011,{...d,material:'steel'},id);
    for(const s of [-1,1]){
      const pivot=P(-.140,s*.490,1.040),end=P(-.185,s*.490,1.260),arm=cylinder(id+'.lever.'+s,pivot,end,.012,{material:'steel',type:'handle',path:[pivot,end],touch:.6},id);
      const grip=cylinder(id+'.grip.'+s,end,P(-.308,s*.490,1.260),.014,{material:'ink',type:'handle',touch:1},id);
      const group=new T.Group();group.name=id+'.moving-handle.'+s;group.position.set(...pivot);root.add(group);
      for(const m of [arm,grip]){m.geometry.translate(-pivot[0],-pivot[1],-pivot[2]);m.geometry.computeBoundingBox();group.add(m);}
      group.rotation.y=p.regulatorAngleRad*.24;regulatorArms.push(group);
      const q=Array.from({length:33},(_,k)=>{const angle=-.40+k/32*.80;return[pivot[0]+Math.sin(angle)*.095,pivot[1],pivot[2]+Math.cos(angle)*.170];});
      add(new T.TubeGeometry(roundedPath(T,q,.001),R(40),.007,R(8),false),id+'.quadrant.'+s,{material:'brass',type:'mount',path:q,touch:.4},id);
      mount(id+'.quadrant-support.'+s,[pivot[0],pivot[1],pivot[2]+.170],id,.050);
    }
  }
  // A route is authored from the same ports used for the system graph.
  for(const r of contract.routes){
    const start=get(r.from),end=get(r.to),coords=[start.positionM,...r.waypointsM,end.positionM].filter((c,i,a)=>i===0||distance(c,a[i-1])>1e-8);
    const curve=roundedPath(T,coords,p.bendRadiusM),length=curve.getLength(),samples=curve.getPoints(Math.max(12,Math.ceil(length/.012))).map(v=>v.toArray());
    components.push({id:r.id,role:r.role,parent:'backhead-frame',family:'identified-tube-route',provenance:r.provenance});
    const material=r.medium==='feed-water'?'copper':r.medium==='water'?'copper':'copper';
    const mesh=add(new T.TubeGeometry(curve,Math.max(10,Math.ceil(length/.018*p.resolution)),r.radiusM,R(10),false),r.id+'.tube',{material,type:'pipe',path:samples,radius:r.radiusM,heatFactor:r.medium==='steam'?.60:.22},r.id);
    mesh.userData.route={startPort:r.from,endPort:r.to,centerlineM:coords,sampledLengthM:length};mesh.userData.provenance=r.provenance;
    connections.push({...r,lengthM:length,startM:curve.getPoint(0).toArray(),endM:curve.getPoint(1).toArray(),physicalIntegrationComplete:false});
    union(r.id+'.union.start',start.positionM,curve.getTangent(0).toArray(),r.radiusM,r.id);union(r.id+'.union.end',end.positionM,curve.getTangent(1).toArray(),r.radiusM,r.id);
    // Short pipes are supported by their two mounted fittings. Long runs get
    // real saddles; clamp placement stays clear of endpoint union hexes.
    const ts=length>.32?[.28,.72]:length>.13?[.5]:[];
    for(const [j,t] of ts.entries()){const v=curve.getPointAt(t),axis=curve.getTangentAt(t),c=v.toArray();ring(r.id+'.clamp.'+j,c,r.radiusM+.003,.0035,{material:'steel',type:'mount',center:c,crevice:.55},r.id,axis.toArray());mount(r.id+'.clamp-foot.'+j,c,r.id,.034);}
  }
  // Attach complete per-function provenance to every new render part.
  const owners=new Map(components.map(v=>[v.id,v]));for(const m of parts){const c=owners.get(m.userData.functionalParent);if(c?.provenance)m.userData.provenance=c.provenance;}
  const updateFromPhysics=physics=>{
    const readings=readBackheadPressureStates(contract,physics);
    for(const r of readings){const needle=needles.get(r.id);needle.visible=r.available;flags.get(r.id).visible=!r.available;if(r.available)needle.rotation.x=(-.75+1.5*r.normalized)*Math.PI;const instrument=contract.instruments.find(i=>i.id===r.id);Object.assign(instrument,{available:r.available,value:r.value,status:r.status});}
    const command=physics?.controls?.throttle,commandAvailable=typeof command==='number'&&Number.isFinite(command)&&command>=0&&command<=1;
    for(const arm of regulatorArms)arm.rotation.y=commandAvailable?(command-.5)*.16:p.regulatorAngleRad*.24;
    root.userData.regulatorCommand={fraction:commandAvailable?command:null,source:commandAvailable?'retained controls.throttle command, not valve travel':'UNAVAILABLE; authored parked pose',valveTravelM:null};
    root.userData.instrumentReadings=readings;root.userData.physicalStateBindings=readings.filter(r=>r.available).map(r=>({instrument:r.id,source:r.sourceStatePath,tapPort:r.tapPort,kind:'read-only retained-state presentation',physicalCircuitSolved:false}));
    root.updateMatrixWorld(true);return readings;
  };
  const setRegulatorFraction=(fraction,writeControls)=>{
    if(typeof fraction!=='number'||!Number.isFinite(fraction)||fraction<0||fraction>1)throw Error('REGULATOR_FRACTION_OUT_OF_RANGE');
    if(typeof writeControls!=='function')throw Error('EXPLICIT_RETAINED_CONTROL_WRITER_REQUIRED');
    // Callback owns the unchanged retained integrator. Update visual command
    // position only after it accepts the command; this is not solved valve travel.
    const result=writeControls({throttle:fraction});if(result===false)throw Error('REGULATOR_COMMAND_REJECTED');
    if(result&&typeof result.then==='function')throw Error('SYNCHRONOUS_RETAINED_CONTROL_WRITER_REQUIRED');
    for(const arm of regulatorArms)arm.rotation.y=(fraction-.5)*.16;
    root.userData.regulatorCommand={fraction,source:'explicit retained controls.throttle writer',valveTravelM:null};root.updateMatrixWorld(true);return result;
  };
  return {contract,updateFromPhysics,setRegulatorFraction,setRegulator:setRegulatorFraction};
}
