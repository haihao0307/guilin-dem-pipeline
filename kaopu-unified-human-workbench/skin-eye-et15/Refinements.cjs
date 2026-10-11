const fs=require('fs'),path=require('path'),assert=require('assert/strict');
function patch(s,a,b){assert.equal(s.split(a).length,2,'Review correction anchor mismatch: '+a);return s.replace(a,()=>b);}
exports.apply=function(root,dir,overrides){
 const file=overrides.get(path.join(root,'skin-eye-et15/Runtime.mjs'));let s=fs.readFileSync(file,'utf8');
 s="import {installBodyOwnership} from './BodyOwnership.mjs';\n"+s;
 s=patch(s,'model.et15=api;return api;','installBodyOwnership(model,api);model.et15=api;return api;');
 s=patch(s,'geometryReplaced:false,filmQualityAccepted:false','bodyOwnership:api.bodyOwnership?.report(),geometryReplaced:false,filmQualityAccepted:false');
 s=patch(s,'api.disposed=true;api.listeners.clear();api.skins.clear();','api.disposed=true;api.bodyOwnership?.dispose();api.listeners.clear();api.skins.clear();');
 s=patch(s,'const nativePreset=controller.applyPreset.bind(controller);','const nativePreset=controller.applyPreset.bind(controller),nativeReset=controller.resetAll.bind(controller);controller.resetAll=()=>{api.cast=null;return nativeReset();};');
 s=patch(s,'controller.applyPreset=id=>byId.has(id)?apply(id):nativePreset(id);','controller.applyPreset=id=>{if(byId.has(id))return apply(id);api.cast=null;return nativePreset(id);};');
 s=patch(s,'controller.applyPreset=nativePreset;','controller.applyPreset=nativePreset;controller.resetAll=nativeReset;');
 s=patch(s,"function view(which){if(which==='eye')","function view(which){if(which==='forehead'){const a=model.eyeSurface.landmark(19),b=model.eyeSurface.landmark(24),c=a.map((v,i)=>(v+b[i])*.5),target=[c[0],c[2]+.020,-c[1]],d=.073/(2*Math.tan(viewer.camera.fov*Math.PI/360)*Math.min(1,viewer.camera.aspect));viewer.restoreCamera({position:[target[0],target[1],target[2]+d],target,zoom:1});}else if(which==='eye')");
 s=patch(s,'<button data-eview="nose">鼻颊微距</button>','<button data-eview="nose">鼻颊微距</button><button data-eview="forehead">额部纹理</button>');
 fs.writeFileSync(file,s);
 const eye=overrides.get(path.join(root,'skin-eye-et15/EyeSurface.mjs'));s=fs.readFileSync(eye,'utf8');
 s=patch(s,'float e15Rim=clamp(vE15Contact.z,0.,1.)*uE15Enabled*uE15Wetness;','float e15Rim=0.; // Do not put wet streaks on skin without an exact free-margin binding.');
 s=s.replace('眼表与睑缘湿润反射','眼表湿润反射').replace('tearMeniscusGeometry:false,lightDrivenSpecular:true','tearMeniscusGeometry:false,unboundSkinWetline:false,lightDrivenSpecular:true');
 fs.writeFileSync(eye,s);
};
