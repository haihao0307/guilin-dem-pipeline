/* v0.2.2 field readability, water ribbon safety and close-view convergence. */
const TERRAIN_FS_V22=TERRAIN_FS_V21
  .replace("+(micro-.48)*.12+bund*.18-channel*.16","+(micro-.48)*.035+bund*.22-channel*.18")
  .replace("+micro*.07","+micro*.025")
  .replace("color=mix(color,vec3(.13,.085,.038),bund*.72)","color=mix(color,vec3(.115,.070,.028),bund*.86)");

setupWebGL=function(){
  const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,depth:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
  assert(gl,'当前浏览器未提供 WebGL2');
  state.gl=gl;
  state.programs={terrain:createProgram(gl,TERRAIN_VS,TERRAIN_FS_V22),water:createProgram(gl,WATER_VS,WATER_FS),skirt:createProgram(gl,SKIRT_VS,SKIRT_FS)};
  state.uniforms={
    terrain:{viewProjection:gl.getUniformLocation(state.programs.terrain,'uViewProjection'),karst:gl.getUniformLocation(state.programs.terrain,'uKarstStrength'),field:gl.getUniformLocation(state.programs.terrain,'uFieldStrength'),mode:gl.getUniformLocation(state.programs.terrain,'uMode'),minimum:gl.getUniformLocation(state.programs.terrain,'uMinElevation'),maximum:gl.getUniformLocation(state.programs.terrain,'uMaxElevation'),detail:gl.getUniformLocation(state.programs.terrain,'uDetailStrength'),color:gl.getUniformLocation(state.programs.terrain,'uColorStrength'),eye:gl.getUniformLocation(state.programs.terrain,'uEye')},
    water:{viewProjection:gl.getUniformLocation(state.programs.water,'uViewProjection'),eye:gl.getUniformLocation(state.programs.water,'uEye'),time:gl.getUniformLocation(state.programs.water,'uTime')},
    skirt:{viewProjection:gl.getUniformLocation(state.programs.skirt,'uViewProjection')}
  };
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.frontFace(gl.CCW);gl.clearColor(.018,.032,.028,1);
};

parcelGrammar=function(easting,northing){
  const warpX=fbm2(easting*.0019,northing*.0019,SEEDS.field+31,4)*27;
  const warpZ=fbm2(easting*.0019+7.4,northing*.0019-5.1,SEEDS.field+73,4)*27;
  const angle=.29+fbm2(easting*.00062,northing*.00062,SEEDS.field+91,3)*.20;
  const ca=Math.cos(angle),sa=Math.sin(angle);
  const rx=(easting+warpX)*ca+(northing+warpZ)*sa;
  const rz=-(easting+warpX)*sa+(northing+warpZ)*ca;
  const cellX=88,cellZ=66,gx=Math.floor(rx/cellX),gz=Math.floor(rz/cellZ);
  let first=Infinity,second=Infinity,nearestX=gx,nearestZ=gz;
  for(let oz=-1;oz<=1;oz++)for(let ox=-1;ox<=1;ox++){
    const cx=gx+ox,cz=gz+oz;
    const px=(cx+.13+hash2(cx,cz,SEEDS.field+149)*.74)*cellX;
    const pz=(cz+.13+hash2(cx,cz,SEEDS.field+193)*.74)*cellZ;
    const distance=Math.hypot(rx-px,rz-pz);
    if(distance<first){second=first;first=distance;nearestX=cx;nearestZ=cz;}else if(distance<second)second=distance;
  }
  const boundary=1-smoothstep(1.1,6.2,second-first);
  const fieldSeed=hash2(nearestX,nearestZ,SEEDS.field+277);
  const lineA=Math.abs(Math.sin((rx+fieldSeed*117)*.055));
  const lineB=Math.abs(Math.sin((rz-fieldSeed*89)*.069));
  const rowA=1-smoothstep(.00,.075,lineA);
  const rowB=1-smoothstep(.00,.064,lineB);
  const channel=Math.max(rowA,rowB*.62);
  return{boundary,fieldSeed,channel};
};

const deriveTerrainFieldsV21=deriveTerrainFields;
deriveTerrainFields=function(dense,segments){
  const fields=deriveTerrainFieldsV21(dense,segments);
  const elevationRange=Math.max(1,state.maximum-state.minimum);
  let fieldMinimum=Infinity,fieldMaximum=-Infinity,paddySum=0,bundSum=0,channelSum=0;
  for(let row=0;row<RENDER_GRID;row++){
    for(let column=0;column<RENDER_GRID;column++){
      const index=row*RENDER_GRID+column;
      const truth=dense[index];
      const x=column*RENDER_SPACING-SIDE_M*.5,z=row*RENDER_SPACING-SIDE_M*.5;
      const easting=CENTER_E+x,northing=CENTER_N-z;
      const slopeDegrees=fields.slope[index]*62;
      const elev=(truth-state.minimum)/elevationRange;
      const lowland=1-smoothstep(.10,.61,elev);
      const flat=1-smoothstep(3.2,14.8,slopeDegrees);
      const waterDistance=nearestWaterDistance(x,z,segments);
      const waterCore=1-smoothstep(7,26,waterDistance);
      const patch=fbm2(easting*.0022,northing*.0022,SEEDS.field+401,4)*.5+.5;
      const patchGate=.42+.58*smoothstep(.20,.78,patch);
      const base=lowland*flat*(.48+.52*fields.wet[index])*patchGate*(1-waterCore*.94)*(1-fields.cliff[index]*.94)*(1-fields.talus[index]*.56);
      const paddyValue=smoothstep(.13,.58,base);
      const parcel=parcelGrammar(easting,northing);
      const bundValue=paddyValue*Math.pow(parcel.boundary,.58);
      const channelValue=paddyValue*parcel.channel*(1-parcel.boundary*.50);
      const terraceStep=.25+parcel.fieldSeed*.14;
      const terraceTarget=Math.round(truth/terraceStep)*terraceStep;
      const flatten=clamp((terraceTarget-truth)*.43,-.14,.14);
      const fieldValue=clamp(paddyValue*flatten+bundValue*(.38+parcel.fieldSeed*.21)-channelValue*(.25+parcel.fieldSeed*.15),-.40,.62);
      fields.paddy[index]=paddyValue;
      fields.bund[index]=bundValue;
      fields.channel[index]=channelValue;
      fields.fieldDelta[index]=fieldValue;
      fields.unitSeed[index]=parcel.fieldSeed;
      fields.flow[index]=clamp(fields.flow[index]+channelValue*.52,0,1);
      fields.terrace[index]=paddyValue*flat;
      fields.enhanced[index]=truth+fields.karstDelta[index]+fieldValue;
      fieldMinimum=Math.min(fieldMinimum,fieldValue);fieldMaximum=Math.max(fieldMaximum,fieldValue);
      paddySum+=paddyValue;bundSum+=bundValue;channelSum+=channelValue;
    }
  }
  fields.enhancedNormals=buildNormalArray(fields.enhanced);
  state.fieldRange=[fieldMinimum,fieldMaximum];
  state.fieldStats={paddyFraction:paddySum/fields.paddy.length,bundMean:bundSum/fields.bund.length,channelMean:channelSum/fields.channel.length};
  return fields;
};

buildWaterMesh=function(){
  const gl=state.gl,vertices=[],indices=[];
  const add=(x,y,z,c)=>{vertices.push(x,y,z,c);return vertices.length/4-1;};
  for(const segment of state.segments){
    const dx=segment.x1-segment.x0,dz=segment.z1-segment.z0,length=Math.hypot(dx,dz);
    if(length<3.5)continue;
    const nx=-dz/length,nz=dx/length;
    const base=segment.classValue===0?5.2:(segment.classValue===1?2.0:1.2);
    const requestedHalf=Math.max(base*.65,segment.sourceWidth*.50);
    const halfWidth=clamp(Math.min(requestedHalf,length*.18,26),.65,26);
    if(length<18&&halfWidth>length*.22)continue;
    const y0=segment.y0-state.minimum+.38,y1=segment.y1-state.minimum+.38;
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

function bestFieldPoint(){
  let best={score:-Infinity,x:0,z:0};
  for(let row=8;row<RENDER_GRID-8;row+=3){
    for(let column=8;column<RENDER_GRID-8;column+=3){
      const index=row*RENDER_GRID+column;
      const x=column*RENDER_SPACING-SIDE_M*.5,z=row*RENDER_SPACING-SIDE_M*.5;
      const waterDistance=nearestWaterDistance(x,z,state.segments);
      const desiredWater=1-Math.min(1,Math.abs(waterDistance-82)/110);
      const centerPenalty=Math.hypot(x,z)/900;
      const score=state.fields.paddy[index]*1.30+state.fields.bund[index]*.28+desiredWater*.22-state.fields.channel[index]*.25-centerPenalty*.14;
      if(score>best.score)best={score,x,z};
    }
  }
  return[best.x,best.z];
}

setView=function(name){
  const relief=state.maximum-state.minimum;
  if(name==='top'){
    state.camera.target=[0,relief*.18,0];state.camera.yaw=-.05;state.camera.pitch=1.485;state.camera.distance=1320;
  }else if(name==='karst'){
    const peak=highestPeak();const localHeight=denseTruthAtWorld(peak.x,peak.z)-state.minimum;
    state.camera.target=[peak.x,localHeight+peak.amplitude*.46,peak.z];state.camera.yaw=-1.00;state.camera.pitch=.38;state.camera.distance=540;
  }else if(name==='field'){
    const c=bestFieldPoint();const localHeight=denseTruthAtWorld(c[0],c[1])-state.minimum;
    state.camera.target=[c[0],localHeight+4.5,c[1]];state.camera.yaw=-.70;state.camera.pitch=.55;state.camera.distance=430;
  }else{
    state.camera.target=[0,relief*.24,0];state.camera.yaw=-.78;state.camera.pitch=.55;state.camera.distance=1450;
  }
  state.dirty=true;
};
