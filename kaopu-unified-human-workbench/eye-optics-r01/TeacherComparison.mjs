/** QA-only transfer of owned ET08 FittedEyes texture sampling to the current native mapping.
 * It is not enabled/imported by NativeEyeOptics and never supplies default production assets.
 * The comparison holds native geometry/camera/lights fixed, so this is not full ET08 optical reproduction.
 */
export async function attachET08PhotoReference(skin,{THREE}){
 const {EYE_PHOTO_DATA}=await import('./reference/EyePhotoData.js');
 const tex=await new THREE.TextureLoader().loadAsync(EYE_PHOTO_DATA);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;
 const m=skin.material,old=m.onBeforeCompile,key=m.customProgramCacheKey;
 m.onBeforeCompile=s=>{old.call(m,s);s.uniforms.uE1TeacherPhoto={value:tex};
  const token='vec3 fEyeColor()';if(!s.fragmentShader.includes(token))throw Error('ET08 photo comparison needs native eye shader');
  s.fragmentShader=s.fragmentShader.replace(token,'vec3 e1BeforeTeacherEyeColor()');
  const start=s.fragmentShader.indexOf('vec3 e1BeforeTeacherEyeColor()'),open=s.fragmentShader.indexOf('{',start);let end=open+1,depth=1;for(;depth&&end<s.fragmentShader.length;end++){if(s.fragmentShader[end]==='{')depth++;else if(s.fragmentShader[end]==='}')depth--;}
  const body=`
uniform sampler2D uE1TeacherPhoto;
vec3 fEyeColor(){
 float irisMM=mix(uE1IrisRadiusMM.x,uE1IrisRadiusMM.y,step(.5,vFEye.w));
 float pupilR=uE1PupilMM/(2.*irisMM),r=length(vFEye.xy),aa=max(fwidth(r),.0005);
 float expanded=clamp((r-pupilR)/max(.1,1.-pupilR),0.,1.),a=atan(vFEye.y,vFEye.x);
 vec2 center=vec2(723.,721.)/1024.;float photoR=(33.+82.*expanded)/1024.;
 vec3 photo=texture2D(uE1TeacherPhoto,center+vec2(cos(a),sin(a))*photoR).rgb;
 // ET08 FittedEyes blue palette and gain, reproduced without relighting the scene.
 vec3 iris=photo*vec3(.34,.46,.50)*.43;
 iris*=1.-smoothstep(.86,1.01,r)*.72;
 vec3 sclera=texture2D(uE1TeacherPhoto,center+vFEye.xy*.435*.255).rgb*vec3(.52,.46,.42);
 float im=1.-smoothstep(1.-aa,1.+aa,r),pm=1.-smoothstep(pupilR-aa,pupilR+aa,r);
 return mix(mix(sclera,iris,im),vec3(.00035,.00024,.00018),pm);
}
`;
  s.fragmentShader=s.fragmentShader.slice(0,end)+body+s.fragmentShader.slice(end);
 };m.customProgramCacheKey=()=>key.call(m)+'/ET08-photo-reference-only';m.needsUpdate=true;skin.viewer.render();
 return{source:'MakeHuman grey_eye.png CC0, ET08 FittedEyes sample lookup',refractionReproduced:false,textureSHA256:'ecb05613126036a3d017880fabbd570501c5f14032c186462d8f6e2d719f6c4f',dispose(){m.onBeforeCompile=old;m.customProgramCacheKey=key;m.needsUpdate=true;tex.dispose();skin.viewer.render();}};
}
