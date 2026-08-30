/* v0.2.6 fix absolute-coordinate angle amplification and keep paddy interiors free of rock microrelief. */
const TERRAIN_FS_V24=TERRAIN_FS_V23.replace("(micro-.48)*.018*(.18+.82*rock)","(micro-.48)*.018*rock");

setupWebGL=function(){
  const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,depth:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
  assert(gl,'当前浏览器未提供 WebGL2');
  state.gl=gl;
  state.programs={terrain:createProgram(gl,TERRAIN_VS,TERRAIN_FS_V24),water:createProgram(gl,WATER_VS,WATER_FS),skirt:createProgram(gl,SKIRT_VS,SKIRT_FS)};
  state.uniforms={
    terrain:{viewProjection:gl.getUniformLocation(state.programs.terrain,'uViewProjection'),karst:gl.getUniformLocation(state.programs.terrain,'uKarstStrength'),field:gl.getUniformLocation(state.programs.terrain,'uFieldStrength'),mode:gl.getUniformLocation(state.programs.terrain,'uMode'),minimum:gl.getUniformLocation(state.programs.terrain,'uMinElevation'),maximum:gl.getUniformLocation(state.programs.terrain,'uMaxElevation'),detail:gl.getUniformLocation(state.programs.terrain,'uDetailStrength'),color:gl.getUniformLocation(state.programs.terrain,'uColorStrength'),eye:gl.getUniformLocation(state.programs.terrain,'uEye')},
    water:{viewProjection:gl.getUniformLocation(state.programs.water,'uViewProjection'),eye:gl.getUniformLocation(state.programs.water,'uEye'),time:gl.getUniformLocation(state.programs.water,'uTime')},
    skirt:{viewProjection:gl.getUniformLocation(state.programs.skirt,'uViewProjection')}
  };
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.frontFace(gl.CCW);gl.clearColor(.018,.032,.028,1);
};

parcelGrammar=function(easting,northing){
  const warpX=fbm2(easting*.00135,northing*.00135,SEEDS.field+31,4)*42;
  const warpZ=fbm2(easting*.00135+7.4,northing*.00135-5.1,SEEDS.field+73,4)*42;
  const angle=.27;
  const ca=Math.cos(angle),sa=Math.sin(angle);
  const rx=easting*ca+northing*sa+warpX;
  const rz=-easting*sa+northing*ca+warpZ;
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

const deriveTerrainFieldsV25=deriveTerrainFields;
deriveTerrainFields=function(dense,segments){
  const fields=deriveTerrainFieldsV25(dense,segments);
  for(let index=0;index<fields.paddy.length;index++){
    const paddy=fields.paddy[index];
    fields.rock[index]*=1-paddy*.97;
    fields.cliff[index]*=1-paddy*.98;
    fields.talus[index]*=1-paddy*.88;
  }
  return fields;
};
