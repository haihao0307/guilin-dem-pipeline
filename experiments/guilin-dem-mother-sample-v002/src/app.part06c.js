/* v0.2.3 coherent parcel-scale geometry and short-segment water cleanup. */
parcelGrammar=function(easting,northing){
  const warpX=fbm2(easting*.00155,northing*.00155,SEEDS.field+31,4)*34;
  const warpZ=fbm2(easting*.00155+7.4,northing*.00155-5.1,SEEDS.field+73,4)*34;
  const angle=.27+fbm2(easting*.00052,northing*.00052,SEEDS.field+91,3)*.19;
  const ca=Math.cos(angle),sa=Math.sin(angle);
  const rx=(easting+warpX)*ca+(northing+warpZ)*sa;
  const rz=-(easting+warpX)*sa+(northing+warpZ)*ca;
  const cellX=120,cellZ=92,gx=Math.floor(rx/cellX),gz=Math.floor(rz/cellZ);
  let first=Infinity,second=Infinity,nearestX=gx,nearestZ=gz;
  for(let oz=-1;oz<=1;oz++)for(let ox=-1;ox<=1;ox++){
    const cx=gx+ox,cz=gz+oz;
    const px=(cx+.12+hash2(cx,cz,SEEDS.field+149)*.76)*cellX;
    const pz=(cz+.12+hash2(cx,cz,SEEDS.field+193)*.76)*cellZ;
    const distance=Math.hypot(rx-px,rz-pz);
    if(distance<first){second=first;first=distance;nearestX=cx;nearestZ=cz;}else if(distance<second)second=distance;
  }
  const boundary=1-smoothstep(1.8,13.0,second-first);
  const fieldSeed=hash2(nearestX,nearestZ,SEEDS.field+277);
  const lineA=Math.abs(Math.sin((rx+fieldSeed*141)*.039));
  const lineB=Math.abs(Math.sin((rz-fieldSeed*103)*.051));
  const rowA=1-smoothstep(.00,.28,lineA);
  const rowB=1-smoothstep(.00,.23,lineB);
  const channel=Math.max(rowA,rowB*.58);
  return{boundary,fieldSeed,channel};
};

const deriveTerrainFieldsV22=deriveTerrainFields;
deriveTerrainFields=function(dense,segments){
  const fields=deriveTerrainFieldsV22(dense,segments);
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
      const lowland=1-smoothstep(.09,.64,elev);
      const flat=1-smoothstep(3.0,15.8,slopeDegrees);
      const waterDistance=nearestWaterDistance(x,z,segments);
      const waterCore=1-smoothstep(7,27,waterDistance);
      const patch=fbm2(easting*.00185,northing*.00185,SEEDS.field+401,4)*.5+.5;
      const patchGate=.58+.42*smoothstep(.18,.80,patch);
      const base=lowland*flat*(.46+.54*fields.wet[index])*patchGate*(1-waterCore*.95)*(1-fields.cliff[index]*.95)*(1-fields.talus[index]*.55);
      const paddyValue=smoothstep(.065,.47,base);
      const parcel=parcelGrammar(easting,northing);
      const bundValue=paddyValue*Math.pow(parcel.boundary,.48);
      const channelValue=paddyValue*parcel.channel*(1-parcel.boundary*.56);
      const terraceStep=.25+parcel.fieldSeed*.15;
      const terraceTarget=Math.round(truth/terraceStep)*terraceStep;
      const flatten=clamp((terraceTarget-truth)*.45,-.15,.15);
      const fieldValue=clamp(paddyValue*flatten+bundValue*(.42+parcel.fieldSeed*.22)-channelValue*(.27+parcel.fieldSeed*.16),-.43,.68);
      fields.paddy[index]=paddyValue;
      fields.bund[index]=bundValue;
      fields.channel[index]=channelValue;
      fields.fieldDelta[index]=fieldValue;
      fields.unitSeed[index]=parcel.fieldSeed;
      fields.flow[index]=clamp(fields.flow[index]+channelValue*.44,0,1);
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
    const base=segment.classValue===0?5.0:(segment.classValue===1?1.9:1.1);
    const requestedHalf=Math.max(base*.60,segment.sourceWidth*.50);
    const shortSafe=length<58?Math.max(.65,length*.075):26;
    const halfWidth=clamp(Math.min(requestedHalf,shortSafe,26),.65,26);
    const y0=segment.y0-state.minimum+.36,y1=segment.y1-state.minimum+.36;
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

function bestCentralFieldPoint(){
  let best={score:-Infinity,x:0,z:0};
  for(let row=12;row<RENDER_GRID-12;row+=3){
    for(let column=12;column<RENDER_GRID-12;column+=3){
      const x=column*RENDER_SPACING-SIDE_M*.5,z=row*RENDER_SPACING-SIDE_M*.5;
      if(Math.abs(x)>315||Math.abs(z)>315)continue;
      const index=row*RENDER_GRID+column;
      const waterDistance=nearestWaterDistance(x,z,state.segments);
      const desiredWater=1-Math.min(1,Math.abs(waterDistance-90)/120);
      const centerPenalty=Math.hypot(x,z)/700;
      const score=state.fields.paddy[index]*1.45+state.fields.bund[index]*.26+desiredWater*.18-state.fields.channel[index]*.18-centerPenalty*.18;
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
    state.camera.target=[peak.x,localHeight+peak.amplitude*.46,peak.z];state.camera.yaw=-1.00;state.camera.pitch=.40;state.camera.distance=565;
  }else if(name==='field'){
    const c=bestCentralFieldPoint();const localHeight=denseTruthAtWorld(c[0],c[1])-state.minimum;
    state.camera.target=[c[0],localHeight+7,c[1]];state.camera.yaw=-.72;state.camera.pitch=.64;state.camera.distance=600;
  }else{
    state.camera.target=[0,relief*.24,0];state.camera.yaw=-.78;state.camera.pitch=.55;state.camera.distance=1450;
  }
  state.dirty=true;
};
