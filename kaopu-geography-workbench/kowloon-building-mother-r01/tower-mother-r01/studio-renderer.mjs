import{StudioRenderer as PreviousStudio}from'../building-mother-workbench-r05/studio-renderer.mjs';
import{GROUP_SHADOW_GLSL,groupRounds}from'./round-groups.mjs';
import{STUDIO_UNIFORMS,STUDIO_LIGHT_GLSL}from'../building-mother-workbench/shared-studio/studio-shade.mjs';
import{roundShader}from'../building-mother-workbench-r05/round-display.mjs';
import{WholeRenderer}from'../building-rule-sketch-r06/kowloon-building-mother-r01/whole-building-facade-r01/semantic-renderer.mjs';
import{STUDIO_SHADE as BASE_SHADE,withSolidSectionCaps}from'../building-mother-workbench-r02/studio-renderer.mjs';
import{packShadowPrisms,SHADOW_GLSL}from'../building-mother-workbench-r05/analytic-shadows.mjs';
const from=BASE_SHADE.indexOf('float visibility('),to=BASE_SHADE.indexOf('float hash(');if(from<0||to<from)throw Error('Review inherited lighting contract');
const SHADE=BASE_SHADE.slice(0,from)+GROUP_SHADOW_GLSL+SHADOW_GLSL.replace('int count=int(shadowRecord(0).x);','if(roundShadow(ro,d,limit))return 0.;int count=int(shadowRecord(0).x);')+BASE_SHADE.slice(to);
export const STUDIO_SHADE=SHADE.replace('float hash(',STUDIO_UNIFORMS+STUDIO_LIGHT_GLSL+'\nfloat hash(').replace('vec3 k=vec3(-5.,9.,-6.),f=vec3(9.,7.,4.),','vec3 k=studioKeyLight(),f=studioFillLight(),').replace('float t=(-.82-uCameraEye.y)/rd.y;','float t=(uStudioMin.y-.02*studioScale()-uCameraEye.y)/rd.y;').replace('smoothstep(10.,22.,distance(p.xz,vec2(2,2.5)))','smoothstep(2.*studioScale(),4.4*studioScale(),distance(p.xz,(uStudioMin.xz+uStudioMax.xz)*.5))');
export class StudioRenderer extends WholeRenderer{
 compile(name,source){return super.compile(name,name==='assembly'?withSolidSectionCaps(source):name==='continuous-rail'?roundShader(source):source);}
 setModel(model,source){
  // Validate before replacing the previous usable model; never silently truncate.
  const rounds=model.roundMembers??[],grouped=groupRounds(rounds),packed=packShadowPrisms(model);
  super.setModel(model,source);this.roundCount=rounds.length;this.roundGroupCount=grouped.groups.length;
  this.roundTexture=this.texture(grouped.packed);this.roundGroupTexture=this.texture(grouped.bounds);
  this.railGroups=grouped.groups.map((g,i)=>({id:'tower-round-'+i,template:g.template,texture:this.texture(g.packed),instances:[{id:'tower-round-'+i,floorId:g.floorId,toFloorId:g.floorId,origin:[0,0,0],xAxis:[1,0,0],zAxis:[0,0,1],objectId:0}]}));
  this.semanticRegistry.push(...rounds.map(p=>({objectId:p.objectId+10000,nodeId:p.nodeId,classKey:'handrail',floorId:p.floorId})));
  this.semanticRegistry.sort((a,b)=>a.objectId-b.objectId);
  for(let i=1;i<this.semanticRegistry.length;i++)if(this.semanticRegistry[i].objectId===this.semanticRegistry[i-1].objectId)throw Error('Tower display object ID collision');
  this.shadowPrismTexture=this.texture(packed);this.shadowPrismCount=packed.count;
  const nodes=new Map(model.graph.nodes.map(n=>[n.id,n]));for(const r of this.semanticRegistry)r.floorId=nodes.get(r.nodeId)?.floorId??r.floorId??null;
  this.setColorMode(this.colorMode??false);
  if(!this.studioShadeProgram)this.studioShadeProgram=this.compile('tower-two-light-exact-shadow',STUDIO_SHADE);this.shadeProgram=this.studioShadeProgram;
 }
 setColorMode(enabled){return PreviousStudio.prototype.setColorMode.call(this,enabled);}
 camera(program,w,h,options){const L=super.camera(program,w,h,options);if(program===this.studioShadeProgram&&this.shadowPrismTexture){this.bindTexture(program,'uShadowPrisms',7,this.shadowPrismTexture);this.gl.uniform1i(L('uRoundCount'),this.roundCount??0);this.gl.uniform1i(L('uRoundGroupCount'),this.roundGroupCount??0);this.bindTexture(program,'uRoundGroups',9,this.roundGroupTexture);this.gl.uniform3fv(L('uStudioMin'),this.model.bounds.min);this.gl.uniform3fv(L('uStudioMax'),this.model.bounds.max);if(this.roundTexture)this.bindTexture(program,'uRoundRails',8,this.roundTexture);this.gl.uniform1i(L('uShadowClip'),options.cut?1:0);this.gl.uniform3fv(L('uShadowClipNormal'),options.clipNormal);this.gl.uniform1f(L('uShadowClipOffset'),options.clipOffset);}return L;}
}
