/* v0.2.4 stable warped parcel grammar and material hierarchy cleanup. */
const TERRAIN_FS_V23=TERRAIN_FS_V22
  .replace("+(micro-.48)*.035+bund*.22-channel*.18","+(micro-.48)*.018*(.18+.82*rock)+bund*.22-channel*.18")
  .replace("meso*.42+seed*.38+wet*.20","macro*.20+meso*.12+seed*.54+wet*.14");

setupWebGL=function(){
  const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,depth:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
  assert(gl,'当前浏览器未提供 WebGL2');
  state.gl=gl;
  state.programs={terrain:createProgram(gl,TERRAIN_VS,TERRAIN_FS_V23),water:createProgram(gl,WATER_VS,WATER_FS),skirt:createProgram(gl,SKIRT_VS,SKIRT_FS)};
  state.uniforms={
    terrain:{viewProjection:gl.getUniformLocation(state.programs.terrain,'uViewProjection'),karst:gl.getUniformLocation(state.programs.terrain,'uKarstStrength'),field:gl.getUniformLocation(state.programs.terrain,'uFieldStrength'),mode:gl.getUniformLocation(state.programs.terrain,'uMode'),minimum:gl.getUniformLocation(state.programs.terrain,'uMinElevation'),maximum:gl.getUniformLocation(state.programs.terrain,'uMaxElevation'),detail:gl.getUniformLocation(state.programs.terrain,'uDetailStrength'),color:gl.getUniformLocation(state.programs.terrain,'uColorStrength'),eye:gl.getUniformLocation(state.programs.terrain,'uEye')},
    water:{viewProjection:gl.getUniformLocation(state.programs.water,'uViewProjection'),eye:gl.getUniformLocation(state.programs.water,'uEye'),time:gl.getUniformLocation(state.programs.water,'uTime')},
    skirt:{viewProjection:gl.getUniformLocation(state.programs.skirt,'uViewProjection')}
  };
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.frontFace(gl.CCW);gl.clearColor(.018,.032,.028,1);
};

parcelGrammar=function(easting,northing){
  const warpX=fbm2(easting*.00145,northing*.00145,SEEDS.field+31,4)*39;
  const warpZ=fbm2(easting*.00145+7.4,northing*.00145-5.1,SEEDS.field+73,4)*39;
  const angle=.24+fbm2(easting*.00048,northing*.00048,SEEDS.field+91,3)*.18;
  const ca=Math.cos(angle),sa=Math.sin(angle);
  const rx=(easting+warpX)*ca+(northing+warpZ)*sa;
  const rz=-(easting+warpX)*sa+(northing+warpZ)*ca;
  const cellX=126,cellZ=88;
  const gx=Math.floor(rx/cellX),gz=Math.floor(rz/cellZ);
  const fu=fract(rx/cellX),fv=fract(rz/cellZ);
  const edge=Math.min(fu,1-fu,fv,1-fv);
  const boundary=1-smoothstep(.018,.095,edge);
  const fieldSeed=hash2(gx,gz,SEEDS.field+277);
  const ditchWarp=fbm2(easting*.0036,northing*.0036,SEEDS.field+333,3)*10;
  const lineA=Math.abs(Math.sin((rx+ditchWarp+fieldSeed*83)*.018));
  const lineB=Math.abs(Math.sin((rz-ditchWarp-fieldSeed*61)*.022));
  const ditchA=1-smoothstep(.00,.115,lineA);
  const ditchB=1-smoothstep(.00,.095,lineB);
  const channel=fieldSeed>.67?Math.max(ditchA,ditchB*.62):ditchA;
  return{boundary,fieldSeed,channel};
};

const deriveTerrainFieldsV23=deriveTerrainFields;
deriveTerrainFields=function(dense,segments){
  const fields=deriveTerrainFieldsV23(dense,segments);
  let minimum=Infinity,maximum=-Infinity,paddySum=0,bundSum=0,channelSum=0;
  for(let row=0;row<RENDER_GRID;row++){
    for(let column=0;column<RENDER_GRID;column++){
      const index=row*RENDER_GRID+column;
      const truth=dense[index];
      const x=column*RENDER_SPACING-SIDE_M*.5,z=row*RENDER_SPACING-SIDE_M*.5;
      const easting=CENTER_E+x,northing=CENTER_N-z;
      const parcel=parcelGrammar(easting,northing);
      const paddy=fields.paddy[index];
      const bund=paddy*Math.pow(parcel.boundary,.62);
      const channel=paddy*parcel.channel*(1-parcel.boundary*.68);
      const terraceStep=.26+parcel.fieldSeed*.14;
      const target=Math.round(truth/terraceStep)*terraceStep;
      const flatten=clamp((target-truth)*.43,-.14,.14);
      const delta=clamp(paddy*flatten+bund*(.43+parcel.fieldSeed*.20)-channel*(.25+parcel.fieldSeed*.14),-.40,.66);
      fields.bund[index]=bund;
      fields.channel[index]=channel;
      fields.fieldDelta[index]=delta;
      fields.unitSeed[index]=parcel.fieldSeed;
      fields.flow[index]=clamp(fields.flow[index]+channel*.44,0,1);
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

const drawSkirtV24=drawSkirt;
drawSkirt=function(){if(state.mode===2&&state.camera.distance<760)return;drawSkirtV24();};
