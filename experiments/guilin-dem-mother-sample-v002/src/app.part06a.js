/* v0.2.1 visual convergence. All overrides stay inside the actual WebGL2 runtime. */
setupWebGL=function(){
  const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,depth:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
  assert(gl,'当前浏览器未提供 WebGL2');
  state.gl=gl;
  state.programs={
    terrain:createProgram(gl,TERRAIN_VS,TERRAIN_FS_V21),
    water:createProgram(gl,WATER_VS,WATER_FS),
    skirt:createProgram(gl,SKIRT_VS,SKIRT_FS)
  };
  state.uniforms={
    terrain:{
      viewProjection:gl.getUniformLocation(state.programs.terrain,'uViewProjection'),
      karst:gl.getUniformLocation(state.programs.terrain,'uKarstStrength'),
      field:gl.getUniformLocation(state.programs.terrain,'uFieldStrength'),
      mode:gl.getUniformLocation(state.programs.terrain,'uMode'),
      minimum:gl.getUniformLocation(state.programs.terrain,'uMinElevation'),
      maximum:gl.getUniformLocation(state.programs.terrain,'uMaxElevation'),
      detail:gl.getUniformLocation(state.programs.terrain,'uDetailStrength'),
      color:gl.getUniformLocation(state.programs.terrain,'uColorStrength'),
      eye:gl.getUniformLocation(state.programs.terrain,'uEye')
    },
    water:{
      viewProjection:gl.getUniformLocation(state.programs.water,'uViewProjection'),
      eye:gl.getUniformLocation(state.programs.water,'uEye'),
      time:gl.getUniformLocation(state.programs.water,'uTime')
    },
    skirt:{viewProjection:gl.getUniformLocation(state.programs.skirt,'uViewProjection')}
  };
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.frontFace(gl.CCW);gl.clearColor(.018,.032,.028,1);
};

const deriveTerrainFieldsV20=deriveTerrainFields;
deriveTerrainFields=function(dense,segments){
  const fields=deriveTerrainFieldsV20(dense,segments);
  const broad=boxBlur(dense,RENDER_GRID,RENDER_GRID,34);
  const medium=boxBlur(dense,RENDER_GRID,RENDER_GRID,13);
  const elevationRange=Math.max(1,state.maximum-state.minimum);
  const ordered=state.peaks.slice().sort((a,b)=>{
    const scoreA=a.score-Math.hypot(a.x,a.z)*.035;
    const scoreB=b.score-Math.hypot(b.x,b.z)*.035;
    return scoreB-scoreA;
  });
  const central=ordered.filter(peak=>Math.abs(peak.x)<430&&Math.abs(peak.z)<430);
  state.peaks=(central.length>=6?central:ordered).slice(0,8);
  let karstMinimum=Infinity,karstMaximum=-Infinity,fieldMinimum=Infinity,fieldMaximum=-Infinity;

  for(let row=0;row<RENDER_GRID;row++){
    for(let column=0;column<RENDER_GRID;column++){
      const index=row*RENDER_GRID+column;
      const truth=dense[index];
      const x=column*RENDER_SPACING-SIDE_M*.5;
      const z=row*RENDER_SPACING-SIDE_M*.5;
      const easting=CENTER_E+x;
      const northing=CENTER_N-z;
      const relief=truth-broad[index];
      const mediumRelief=truth-medium[index];
      const slopeNorm=fields.slope[index];
      const slopeDegrees=slopeNorm*62;
      let strongest=-Infinity;
      let second=-Infinity;
      let towerInfluence=0;
      let wallInfluence=0;
      let footInfluence=0;

      for(const peak of state.peaks){
        const ca=Math.cos(peak.angle),sa=Math.sin(peak.angle);
        const dx=x-peak.x,dz=z-peak.z;
        const rx=(dx*ca+dz*sa)/peak.ellipse;
        const rz=(-dx*sa+dz*ca)*peak.ellipse;
        const theta=Math.atan2(rz,rx);
        const worldWarp=fbm2((easting+peak.phase*239)*.0052,(northing-peak.phase*313)*.0052,SEEDS.shape+Math.round(peak.phase*15000),3);
        const angularRadius=clamp(1+.17*Math.sin(theta*3+peak.phase*11)+.10*Math.sin(theta*5-peak.phase*17)+worldWarp*.13,.69,1.34);
        const radius=peak.radius*(.86+.14*peak.phase);
        const r=Math.hypot(rx,rz)/(radius*angularRadius);
        const body=Math.pow(Math.max(0,1-smoothstep(.24,1.0,r)),.30);
        const crown=Math.pow(Math.max(0,1-r/.30),.58);
        const crownNotch=Math.pow(Math.abs(Math.sin(theta*3+peak.phase*19)),7)*crown;
        const offsetA=Math.hypot(rx-radius*.10*Math.cos(peak.phase*23),rz-radius*.10*Math.sin(peak.phase*23))/radius;
        const offsetB=Math.hypot(rx+radius*.12*Math.cos(peak.phase*31),rz+radius*.12*Math.sin(peak.phase*31))/radius;
        const spireA=Math.pow(Math.max(0,1-offsetA/.24),.72);
        const spireB=Math.pow(Math.max(0,1-offsetB/.21),.76);
        const shoulderCut=Math.exp(-Math.pow((r-.58)/.15,2));
        const footCut=Math.exp(-Math.pow((r-.88)/.105,2));
        const grooves=Math.pow(Math.abs(Math.sin(theta*6+peak.phase*29+worldWarp*4.2)),8)*body;
        const realGate=smoothstep(2.5,18,relief+body*18);
        const amplitude=clamp(peak.amplitude*1.16,24,58);
        const local=realGate*(amplitude*(body*.66+crown*.28+spireA*.12+spireB*.09-crownNotch*.10-shoulderCut*.16-footCut*.22)-grooves*(2.2+amplitude*.055));
        if(local>strongest){second=strongest;strongest=local;}else if(local>second){second=local;}
        towerInfluence=Math.max(towerInfluence,body);
        wallInfluence=Math.max(wallInfluence,smoothstep(.27,.48,r)*(1-smoothstep(.76,1.03,r))*body*2.5);
        footInfluence=Math.max(footInfluence,smoothstep(.70,.82,r)*(1-smoothstep(.96,1.15,r)));
      }

      const realHill=smoothstep(5,25,relief);
      const profileCut=-9.5*Math.pow(Math.sin(clamp((relief+2)/Math.max(22,Math.abs(relief)+27),0,1)*Math.PI),2)*realHill*smoothstep(.08,.54,slopeNorm);
      const wallGroove=(ridged2(easting*.031,northing*.031,SEEDS.weather+71,4)-.54)*5.2*wallInfluence;
      const karstValue=clamp(Math.max(0,strongest)+Math.max(0,second)*.15+profileCut+wallGroove,-16,58);
      const karstLikelihood=clamp(Math.max(towerInfluence,smoothstep(6,27,relief)*smoothstep(.06,.60,slopeNorm)),0,1);
      const cliffValue=clamp(smoothstep(.25,.66,slopeNorm)*(.35+.65*karstLikelihood)+wallInfluence*.76+smoothstep(8,30,mediumRelief)*.16,0,1);
      const talusValue=clamp(footInfluence*smoothstep(.07,.45,slopeNorm)*(1-cliffValue*.50),0,1);

      const waterDistance=nearestWaterDistance(x,z,segments);
      const waterCore=1-smoothstep(6,25,waterDistance);
      const waterInfluence=Math.exp(-waterDistance/104);
      const elev=(truth-state.minimum)/elevationRange;
      const lowland=1-smoothstep(.10,.63,elev);
      const flat=1-smoothstep(3.5,15.5,slopeDegrees);
      const concavity=smoothstep(-.05,.55,-fields.curvature[index]);
      const wetness=clamp(waterInfluence*.62+lowland*.20+concavity*.18+smoothstep(.43,.82,fbm2(easting*.0031,northing*.0031,SEEDS.water+7,4))*.09,0,1);
      const parcel=parcelGrammar(easting,northing);
      const patch=fbm2(easting*.0025,northing*.0025,SEEDS.field+401,4)*.5+.5;
      const paddyBase=lowland*flat*(.54+.46*wetness)*(.72+.28*patch)*(1-waterCore*.94)*(1-cliffValue*.93)*(1-talusValue*.58);
      const paddyValue=Math.pow(clamp(paddyBase,0,1),.58);
      const bundValue=paddyValue*Math.pow(parcel.boundary,.70);
      const channelValue=paddyValue*parcel.channel*(1-parcel.boundary*.38);
      const terraceStep=.24+parcel.fieldSeed*.13;
      const terraceTarget=Math.round(truth/terraceStep)*terraceStep;
      const flatten=clamp((terraceTarget-truth)*.42,-.14,.14);
      const fieldValue=clamp(paddyValue*flatten+bundValue*(.34+parcel.fieldSeed*.20)-channelValue*(.22+parcel.fieldSeed*.15),-.38,.58);
      const rockValue=clamp(cliffValue*.83+karstLikelihood*.34+talusValue*.20,0,1);
      const flowValue=clamp(waterInfluence*.52+wetness*.29+channelValue*.58,0,1);

      fields.karst[index]=karstLikelihood;
      fields.cliff[index]=cliffValue;
      fields.talus[index]=talusValue;
      fields.rock[index]=rockValue;
      fields.paddy[index]=paddyValue;
      fields.wet[index]=wetness;
      fields.bund[index]=bundValue;
      fields.channel[index]=channelValue;
      fields.karstDelta[index]=karstValue;
      fields.fieldDelta[index]=fieldValue;
      fields.unitSeed[index]=parcel.fieldSeed;
      fields.flow[index]=flowValue;
      fields.terrace[index]=paddyValue*flat;
      fields.enhanced[index]=truth+karstValue+fieldValue;
      karstMinimum=Math.min(karstMinimum,karstValue);
      karstMaximum=Math.max(karstMaximum,karstValue);
      fieldMinimum=Math.min(fieldMinimum,fieldValue);
      fieldMaximum=Math.max(fieldMaximum,fieldValue);
    }
  }
  fields.enhancedNormals=buildNormalArray(fields.enhanced);
  state.karstRange=[karstMinimum,karstMaximum];
  state.fieldRange=[fieldMinimum,fieldMaximum];
  return fields;
};

buildWaterMesh=function(){
  const gl=state.gl,vertices=[],indices=[];
  const add=(x,y,z,c)=>{vertices.push(x,y,z,c);return vertices.length/4-1;};
  for(const segment of state.segments){
    const dx=segment.x1-segment.x0,dz=segment.z1-segment.z0,length=Math.hypot(dx,dz);
    if(length<.5)continue;
    if(length<7&&segment.sourceWidth>length*1.45)continue;
    const nx=-dz/length,nz=dx/length;
    const base=segment.classValue===0?5.5:(segment.classValue===1?2.2:1.35);
    const requestedHalf=Math.max(base,segment.sourceWidth*.50);
    const lengthSafeHalf=Math.max(base,length*.38);
    const halfWidth=clamp(Math.min(requestedHalf,lengthSafeHalf),base,28);
    const y0=segment.y0-state.minimum+.42,y1=segment.y1-state.minimum+.42;
    const a=add(segment.x0+nx*halfWidth,y0,segment.z0+nz*halfWidth,segment.classValue);
    const b=add(segment.x0-nx*halfWidth,y0,segment.z0-nz*halfWidth,segment.classValue);
    const c=add(segment.x1+nx*halfWidth,y1,segment.z1+nz*halfWidth,segment.classValue);
    const d=add(segment.x1-nx*halfWidth,y1,segment.z1-nz*halfWidth,segment.classValue);
    indices.push(a,b,c,c,b,d);
  }
  const vao=gl.createVertexArray(),vertexBuffer=gl.createBuffer(),indexBuffer=gl.createBuffer();
  gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,16,0);
  gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,1,gl.FLOAT,false,16,12);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(indices),gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  state.water={vao,vertexBuffer,indexBuffer,indexCount:indices.length};
};

highestPeak=function(){
  const candidates=state.peaks.filter(peak=>Math.abs(peak.x)<350&&Math.abs(peak.z)<350);
  const pool=candidates.length?candidates:state.peaks;
  if(!pool.length)return{x:0,z:0,h:state.maximum,amplitude:0};
  return pool.reduce((best,peak)=>{
    const score=peak.h+peak.amplitude-Math.hypot(peak.x,peak.z)*.075;
    const bestScore=best.h+best.amplitude-Math.hypot(best.x,best.z)*.075;
    return score>bestScore?peak:best;
  });
};

const drawSkirtV20=drawSkirt;
drawSkirt=function(){if(state.camera.distance<760)return;drawSkirtV20();};

setView=function(name){
  const relief=state.maximum-state.minimum;
  if(name==='top'){
    state.camera.target=[0,relief*.18,0];state.camera.yaw=-.05;state.camera.pitch=1.485;state.camera.distance=1320;
  }else if(name==='karst'){
    const peak=highestPeak();
    const localHeight=denseTruthAtWorld(peak.x,peak.z)-state.minimum;
    state.camera.target=[peak.x,localHeight+peak.amplitude*.48,peak.z];state.camera.yaw=-1.00;state.camera.pitch=.37;state.camera.distance=520;
  }else if(name==='field'){
    const c=paddyCentroid();
    const localHeight=denseTruthAtWorld(c[0],c[1])-state.minimum;
    state.camera.target=[c[0],localHeight+8,c[1]];state.camera.yaw=-.78;state.camera.pitch=.48;state.camera.distance=500;
  }else{
    state.camera.target=[0,relief*.24,0];state.camera.yaw=-.78;state.camera.pitch=.55;state.camera.distance=1450;
  }
  state.dirty=true;
};

loop=function(now){if(state.dirty)render(now);requestAnimationFrame(loop);};
