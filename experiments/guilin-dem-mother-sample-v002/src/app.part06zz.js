/* v0.2.8 final visual pass: irregular paddies, thin real waterways, sharper karst crowns and richer correlated color. */
const TERRAIN_FS_V28=TERRAIN_FS_V24
  .replace("macro*.20+meso*.12+seed*.54+wet*.14","macro*.12+meso*.08+seed*.62+wet*.18")
  .replace("vec3(.10,.13,.035),vec3(.25,.31,.065),vec3(.45,.49,.10),vec3(.64,.58,.15),vec3(.79,.70,.27)","vec3(.105,.12,.035),vec3(.28,.30,.055),vec3(.48,.46,.085),vec3(.66,.56,.13),vec3(.75,.66,.24)")
  .replace("vec3(.115,.070,.028),bund*.86","vec3(.22,.13,.048),bund*.62")
  .replace("vec3(.055,.057,.054),vec3(.17,.19,.19),vec3(.33,.35,.34),vec3(.52,.52,.47),vec3(.76,.74,.65)","vec3(.065,.067,.063),vec3(.20,.22,.22),vec3(.39,.40,.38),vec3(.59,.58,.52),vec3(.80,.78,.69)")
  .replace("color*(.23+.59*wrap+.18*sky)","color*(.29+.55*wrap+.16*sky)");

setupWebGL=function(){
  const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,depth:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
  assert(gl,'当前浏览器未提供 WebGL2');
  state.gl=gl;
  state.programs={terrain:createProgram(gl,TERRAIN_VS,TERRAIN_FS_V28),water:createProgram(gl,WATER_VS,WATER_FS),skirt:createProgram(gl,SKIRT_VS,SKIRT_FS)};
  state.uniforms={
    terrain:{viewProjection:gl.getUniformLocation(state.programs.terrain,'uViewProjection'),karst:gl.getUniformLocation(state.programs.terrain,'uKarstStrength'),field:gl.getUniformLocation(state.programs.terrain,'uFieldStrength'),mode:gl.getUniformLocation(state.programs.terrain,'uMode'),minimum:gl.getUniformLocation(state.programs.terrain,'uMinElevation'),maximum:gl.getUniformLocation(state.programs.terrain,'uMaxElevation'),detail:gl.getUniformLocation(state.programs.terrain,'uDetailStrength'),color:gl.getUniformLocation(state.programs.terrain,'uColorStrength'),eye:gl.getUniformLocation(state.programs.terrain,'uEye')},
    water:{viewProjection:gl.getUniformLocation(state.programs.water,'uViewProjection'),eye:gl.getUniformLocation(state.programs.water,'uEye'),time:gl.getUniformLocation(state.programs.water,'uTime')},
    skirt:{viewProjection:gl.getUniformLocation(state.programs.skirt,'uViewProjection')}
  };
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.frontFace(gl.CCW);gl.clearColor(.018,.032,.028,1);
};

function nearestCell(x,z,cellX,cellZ,seed,jitter=.72){
  const gx=Math.floor(x/cellX),gz=Math.floor(z/cellZ);
  let first=Infinity,second=Infinity,nearestX=gx,nearestZ=gz;
  for(let oz=-1;oz<=1;oz++)for(let ox=-1;ox<=1;ox++){
    const cx=gx+ox,cz=gz+oz;
    const px=(cx+.5+(hash2(cx,cz,seed)-.5)*jitter)*cellX;
    const pz=(cz+.5+(hash2(cx,cz,seed+47)-.5)*jitter)*cellZ;
    const distance=Math.hypot(x-px,z-pz);
    if(distance<first){second=first;first=distance;nearestX=cx;nearestZ=cz;}else if(distance<second)second=distance;
  }
  return{first,second,gx:nearestX,gz:nearestZ};
}

function irregularParcelGrammar(x,z,easting,northing){
  const baseAngle=.23;
  const orientationNoise=fbm2(easting*.00072,northing*.00072,SEEDS.field+91,2)*.17;
  const angle=baseAngle+orientationNoise;
  const ca=Math.cos(angle),sa=Math.sin(angle);
  const warpX=fbm2(easting*.00155,northing*.00155,SEEDS.field+31,3)*31;
  const warpZ=fbm2(easting*.00155+7.4,northing*.00155-5.1,SEEDS.field+73,3)*31;
  const rx=(x+warpX)*ca+(z+warpZ)*sa;
  const rz=-(x+warpX)*sa+(z+warpZ)*ca;
  const parent=nearestCell(rx,rz,126,92,SEEDS.field+149,.76);
  const parentBoundary=1-smoothstep(2.0,8.5,parent.second-parent.first);
  const parentSeed=hash2(parent.gx,parent.gz,SEEDS.field+277);
  const childAngle=angle+.43+(parentSeed-.5)*.16;
  const cca=Math.cos(childAngle),csa=Math.sin(childAngle);
  const crx=(x+warpX*.45)*cca+(z+warpZ*.45)*csa;
  const crz=-(x+warpX*.45)*csa+(z+warpZ*.45)*cca;
  const child=nearestCell(crx,crz,62,47,SEEDS.field+509,.58);
  const childBoundary=1-smoothstep(1.7,6.3,child.second-child.first);
  const splitGate=smoothstep(.42,.72,parentSeed);
  const boundary=Math.max(parentBoundary,childBoundary*splitGate*.82);
  const childSeed=hash2(child.gx,child.gz,SEEDS.field+557);
  const fieldSeed=mix(parentSeed,childSeed,splitGate*.58);
  const regionalWarp=fbm2(easting*.0024,northing*.0024,SEEDS.field+333,2)*11;
  const longDrain=1-smoothstep(.0,.105,Math.abs(Math.sin((rx+regionalWarp)*.0115)));
  const crossDrain=1-smoothstep(.0,.080,Math.abs(Math.sin((rz-regionalWarp)*.0148)));
  const channel=Math.max(longDrain,crossDrain*.42*smoothstep(.58,.84,parentSeed));
  return{boundary,fieldSeed,channel};
}

const deriveTerrainFieldsV27=deriveTerrainFields;
deriveTerrainFields=function(dense,segments){
  const fields=deriveTerrainFieldsV27(dense,segments);
  let fieldMinimum=Infinity,fieldMaximum=-Infinity,karstMinimum=Infinity,karstMaximum=-Infinity,paddySum=0,bundSum=0,channelSum=0;
  for(let row=0;row<RENDER_GRID;row++){
    for(let column=0;column<RENDER_GRID;column++){
      const index=row*RENDER_GRID+column;
      const truth=dense[index];
      const x=column*RENDER_SPACING-SIDE_M*.5,z=row*RENDER_SPACING-SIDE_M*.5;
      const easting=CENTER_E+x,northing=CENTER_N-z;
      let crownExtra=0,wallCut=0;
      for(const peak of state.peaks){
        const ca=Math.cos(peak.angle),sa=Math.sin(peak.angle),dx=x-peak.x,dz=z-peak.z;
        const rx=(dx*ca+dz*sa)/peak.ellipse,rz=(-dx*sa+dz*ca)*peak.ellipse;
        const theta=Math.atan2(rz,rx),radius=peak.radius*(.86+.14*peak.phase),r=Math.hypot(rx,rz)/radius;
        const crown=Math.pow(Math.max(0,1-r/.31),.42);
        const subA=Math.pow(Math.max(0,1-Math.hypot(rx-radius*.085*Math.cos(peak.phase*23),rz-radius*.085*Math.sin(peak.phase*23))/(radius*.20)),.62);
        const subB=Math.pow(Math.max(0,1-Math.hypot(rx+radius*.10*Math.cos(peak.phase*31),rz+radius*.10*Math.sin(peak.phase*31))/(radius*.18)),.68);
        const notch=Math.pow(Math.abs(Math.sin(theta*4+peak.phase*17)),9)*crown;
        const shoulder=Math.exp(-Math.pow((r-.57)/.12,2));
        crownExtra+=clamp(peak.amplitude*.12*(crown+subA*.46+subB*.34-notch*.28)-shoulder*2.0, -3.2, 7.5);
        wallCut+=Math.pow(Math.abs(Math.sin(theta*7+peak.phase*29)),10)*Math.exp(-Math.pow((r-.66)/.24,2))*2.4;
      }
      const karstValue=clamp(fields.karstDelta[index]+crownExtra-wallCut*fields.cliff[index],-17,62);
      const parentMask=smoothstep(.08,.58,fields.paddy[index]);
      const parcel=irregularParcelGrammar(x,z,easting,northing);
      const paddyValue=parentMask*mix(.82,1.0,smoothstep(.08,.82,parcel.fieldSeed));
      const bundValue=paddyValue*Math.pow(parcel.boundary,.60);
      const channelValue=paddyValue*parcel.channel*(1-parcel.boundary*.68);
      const terraceStep=.27+parcel.fieldSeed*.14;
      const target=Math.round(truth/terraceStep)*terraceStep;
      const flatten=clamp((target-truth)*.38,-.12,.12);
      const fieldValue=clamp(paddyValue*flatten+bundValue*(.24+parcel.fieldSeed*.14)-channelValue*(.15+parcel.fieldSeed*.10),-.26,.40);
      fields.karstDelta[index]=karstValue;
      fields.paddy[index]=paddyValue;
      fields.bund[index]=bundValue;
      fields.channel[index]=channelValue;
      fields.fieldDelta[index]=fieldValue;
      fields.unitSeed[index]=parcel.fieldSeed;
      fields.flow[index]=clamp(fields.flow[index]+channelValue*.40,0,1);
      fields.rock[index]*=1-paddyValue*.98;
      fields.cliff[index]*=1-paddyValue*.99;
      fields.talus[index]*=1-paddyValue*.90;
      fields.enhanced[index]=truth+karstValue+fieldValue;
      fieldMinimum=Math.min(fieldMinimum,fieldValue);fieldMaximum=Math.max(fieldMaximum,fieldValue);karstMinimum=Math.min(karstMinimum,karstValue);karstMaximum=Math.max(karstMaximum,karstValue);paddySum+=paddyValue;bundSum+=bundValue;channelSum+=channelValue;
    }
  }
  fields.enhancedNormals=buildNormalArray(fields.enhanced);
  state.fieldRange=[fieldMinimum,fieldMaximum];state.karstRange=[karstMinimum,karstMaximum];state.fieldStats={paddyFraction:paddySum/fields.paddy.length,bundMean:bundSum/fields.bund.length,channelMean:channelSum/fields.channel.length};
  return fields;
};

buildWaterMesh=function(){
  const gl=state.gl,vertices=[],indices=[];
  const add=(x,y,z,c)=>{vertices.push(x,y,z,c);return vertices.length/4-1;};
  for(const segment of state.segments){
    const dx=segment.x1-segment.x0,dz=segment.z1-segment.z0,length=Math.hypot(dx,dz);
    if(length<11)continue;
    const nx=-dz/length,nz=dx/length;
    const halfWidth=segment.classValue===0?3.2:(segment.classValue===1?1.25:.85);
    const y0=segment.y0-state.minimum+.28,y1=segment.y1-state.minimum+.28;
    const a=add(segment.x0+nx*halfWidth,y0,segment.z0+nz*halfWidth,segment.classValue);
    const b=add(segment.x0-nx*halfWidth,y0,segment.z0-nz*halfWidth,segment.classValue);
    const c=add(segment.x1+nx*halfWidth,y1,segment.z1+nz*halfWidth,segment.classValue);
    const d=add(segment.x1-nx*halfWidth,y1,segment.z1-nz*halfWidth,segment.classValue);
    indices.push(a,b,c,c,b,d);
  }
  const vao=gl.createVertexArray(),vertexBuffer=gl.createBuffer(),indexBuffer=gl.createBuffer();
  gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,16,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,1,gl.FLOAT,false,16,12);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(indices),gl.STATIC_DRAW);gl.bindVertexArray(null);
  state.water={vao,vertexBuffer,indexBuffer,indexCount:indices.length};
};
