/* v0.2.5 floodplain parent mask, parcel identity and globally continuous irrigation lines. */
parcelGrammar=function(easting,northing){
  const warpX=fbm2(easting*.00135,northing*.00135,SEEDS.field+31,4)*42;
  const warpZ=fbm2(easting*.00135+7.4,northing*.00135-5.1,SEEDS.field+73,4)*42;
  const angle=.23+fbm2(easting*.00044,northing*.00044,SEEDS.field+91,3)*.16;
  const ca=Math.cos(angle),sa=Math.sin(angle);
  const rx=(easting+warpX)*ca+(northing+warpZ)*sa;
  const rz=-(easting+warpX)*sa+(northing+warpZ)*ca;
  const cellX=132,cellZ=94;
  const gx=Math.floor(rx/cellX),gz=Math.floor(rz/cellZ);
  const fu=fract(rx/cellX),fv=fract(rz/cellZ);
  const edge=Math.min(fu,1-fu,fv,1-fv);
  const boundary=1-smoothstep(.016,.085,edge);
  const fieldSeed=hash2(gx,gz,SEEDS.field+277);
  const ditchWarp=fbm2(easting*.0027,northing*.0027,SEEDS.field+333,3)*13;
  const lineA=Math.abs(Math.sin((rx+ditchWarp)*.0122));
  const lineB=Math.abs(Math.sin((rz-ditchWarp)*.0155));
  const ditchA=1-smoothstep(.00,.145,lineA);
  const ditchB=1-smoothstep(.00,.120,lineB);
  const channel=Math.max(ditchA,ditchB*.58);
  return{boundary,fieldSeed,channel};
};

const deriveTerrainFieldsV24=deriveTerrainFields;
deriveTerrainFields=function(dense,segments){
  const fields=deriveTerrainFieldsV24(dense,segments);
  const elevationRange=Math.max(1,state.maximum-state.minimum);
  let minimum=Infinity,maximum=-Infinity,paddySum=0,bundSum=0,channelSum=0;
  for(let row=0;row<RENDER_GRID;row++){
    for(let column=0;column<RENDER_GRID;column++){
      const index=row*RENDER_GRID+column;
      const truth=dense[index];
      const x=column*RENDER_SPACING-SIDE_M*.5,z=row*RENDER_SPACING-SIDE_M*.5;
      const easting=CENTER_E+x,northing=CENTER_N-z;
      const slopeDegrees=fields.slope[index]*62;
      const elev=(truth-state.minimum)/elevationRange;
      const lowland=1-smoothstep(.085,.66,elev);
      const flat=1-smoothstep(3.2,15.5,slopeDegrees);
      const waterDistance=nearestWaterDistance(x,z,segments);
      const waterCore=1-smoothstep(8,28,waterDistance);
      const parentScore=lowland*flat*(.53+.47*fields.wet[index])*(1-waterCore*.96)*(1-fields.cliff[index]*.96)*(1-fields.talus[index]*.58);
      const parentMask=smoothstep(.075,.50,parentScore);
      const parcel=parcelGrammar(easting,northing);
      const parcelUse=smoothstep(.035,.17,parcel.fieldSeed);
      const paddy=parentMask*mix(.82,1.0,parcelUse);
      const bund=paddy*Math.pow(parcel.boundary,.58);
      const channel=paddy*parcel.channel*(1-parcel.boundary*.72);
      const terraceStep=.26+parcel.fieldSeed*.15;
      const target=Math.round(truth/terraceStep)*terraceStep;
      const flatten=clamp((target-truth)*.46,-.15,.15);
      const delta=clamp(paddy*flatten+bund*(.44+parcel.fieldSeed*.22)-channel*(.26+parcel.fieldSeed*.15),-.42,.69);
      fields.paddy[index]=paddy;
      fields.bund[index]=bund;
      fields.channel[index]=channel;
      fields.fieldDelta[index]=delta;
      fields.unitSeed[index]=parcel.fieldSeed;
      fields.flow[index]=clamp(fields.flow[index]+channel*.46,0,1);
      fields.terrace[index]=paddy*flat;
      fields.enhanced[index]=truth+fields.karstDelta[index]+delta;
      minimum=Math.min(minimum,delta);maximum=Math.max(maximum,delta);
      paddySum+=paddy;bundSum+=bund;channelSum+=channel;
    }
  }
  fields.enhancedNormals=buildNormalArray(fields.enhanced);
  state.fieldRange=[minimum,maximum];
  state.fieldStats={paddyFraction:paddySum/fields.paddy.length,bundMean:bundSum/fields.bund.length,channelMean:channelSum/fields.channel.length};
  return fields;
};

buildWaterMesh=function(){
  const gl=state.gl,vertices=[],indices=[];
  const add=(x,y,z,c)=>{vertices.push(x,y,z,c);return vertices.length/4-1;};
  for(const segment of state.segments){
    const dx=segment.x1-segment.x0,dz=segment.z1-segment.z0,length=Math.hypot(dx,dz);
    if(length<3.5)continue;
    if(length<60&&segment.sourceWidth>20)continue;
    const nx=-dz/length,nz=dx/length;
    const base=segment.classValue===0?4.8:(segment.classValue===1?1.8:1.0);
    const requestedHalf=Math.max(base*.60,segment.sourceWidth*.50);
    const shortSafe=length<58?Math.max(.60,length*.065):25;
    const halfWidth=clamp(Math.min(requestedHalf,shortSafe,25),.60,25);
    const y0=segment.y0-state.minimum+.34,y1=segment.y1-state.minimum+.34;
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
