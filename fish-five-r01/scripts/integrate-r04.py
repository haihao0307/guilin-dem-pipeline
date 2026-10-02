from pathlib import Path
root=Path(__file__).resolve().parents[1]
p=root/'src/app.js'
s=p.read_text(encoding='utf-8')
def swap(a,b):
 global s
 if s.count(a)!=1: raise RuntimeError('Expected one R03 source anchor: '+a[:90])
 s=s.replace(a,b)
swap("import {mountSpecimenCatalog} from './specimen-catalog.js';", "import {mountSpecimenCatalog} from './specimen-catalog.js';\nimport * as Ocular from './ocular-r04.js';\nimport * as Oral from './oral-r04.js';\nimport oralMetadata from '../data/oral-runtime-r04.json';")
swap('attribute float actorAddress; attribute vec2 finInfo; attribute vec3 finGradient;', '''attribute float actorAddress; attribute vec2 finInfo; attribute vec3 finGradient;
attribute float oralWeight; attribute vec3 oralGradient; uniform vec3 oralPivot,oralAxis;
float jawAngle(){return texture2D(fishFinAngles,vec2(.5/16.0,(actorAddress+.5)/fishCount)).x;}''')
swap('// Source material address stays attached to its original spine section.', '''vec3 oralPoint(vec3 p){float a=jawAngle();return p+oralWeight*(oralPivot+rotateAxis(p-oralPivot,oralAxis,a)-p);}
void oralJacobian(vec3 p,out vec3 X,out vec3 Y,out vec3 Z){float a=jawAngle();vec3 d=oralPivot+rotateAxis(p-oralPivot,oralAxis,a)-p;X=mix(vec3(1,0,0),rotateAxis(vec3(1,0,0),oralAxis,a),oralWeight)+d*oralGradient.x;Y=mix(vec3(0,1,0),rotateAxis(vec3(0,1,0),oralAxis,a),oralWeight)+d*oralGradient.y;Z=mix(vec3(0,0,1),rotateAxis(vec3(0,0,1),oralAxis,a),oralWeight)+d*oralGradient.z;}
// Source material address stays attached to its original spine section.''')
swap('vec3 q=finPoint(p),c,s;spineAt(p.x,c,s);','vec3 q=finPoint(oralPoint(p)),c,s;spineAt(p.x,c,s);')
swap('vec3 q=finPoint(p),Jx=vec3(1,0,0),Jy=vec3(0,1,0),Jz=vec3(0,0,1);int id=int(finInfo.x+.5);','vec3 q=finPoint(oralPoint(p)),Jx,Jy,Jz;oralJacobian(p,Jx,Jy,Jz);int id=int(finInfo.x+.5);')
swap('Jx=rotateAxis(Jx,a,angle)+angular*da.x;Jy=rotateAxis(Jy,a,angle)+angular*da.y;Jz=rotateAxis(Jz,a,angle)+angular*da.z;', 'Jx=rotateAxis(Jx,a,angle)+angular*da.x;Jy=rotateAxis(Jy,a,angle)+angular*da.y;Jz=rotateAxis(Jz,a,angle)+angular*da.z;')
swap("'FISH_SOURCE_MATERIAL_JACOBIAN_R02'", "'FISH_SOURCE_MATERIAL_ORAL_JACOBIAN_R04'")
swap('const uniforms={finRoots:{value:roots},finAxes:{value:axes}};data.primitives.forEach(p=>{', '''const oral=oralMetadata.specimens.find(s=>s.id===data.id),rec=oral?.productionRecommendation;
const uniforms={finRoots:{value:roots},finAxes:{value:axes},oralPivot:{value:new THREE.Vector3().fromArray(rec?.pivotCanonical||[0,0,0])},oralAxis:{value:new THREE.Vector3().fromArray(rec?.axisCanonical||[0,0,1])}};data.primitives.forEach((p,primitiveIndex)=>{''')
swap("geometry.setAttribute('actorAddress',new THREE.InstancedBufferAttribute(Float32Array.from({length:count},(_,i)=>i),1));geometry.computeBoundingSphere();", '''const oralWeight=new Float32Array(positions.length/3),oralGradient=new Float32Array(positions.length),binding=rec?.bindings.find(b=>b.primitive===primitiveIndex);if(binding){binding.indices.forEach((v,j)=>{oralWeight[v]=binding.constrainedSubtreeWeight[j];oralGradient.set(binding.constrainedGradient.slice(j*3,j*3+3),v*3);});}
geometry.setAttribute('oralWeight',new THREE.BufferAttribute(oralWeight,1));geometry.setAttribute('oralGradient',new THREE.BufferAttribute(oralGradient,3));geometry.setAttribute('actorAddress',new THREE.InstancedBufferAttribute(Float32Array.from({length:count},(_,i)=>i),1));geometry.computeBoundingSphere();''')
swap('entry.objects.push({eye,globe,gaze,pupil,normal,baseQ,displayCenter});','entry.objects.push({eye,globe,gaze,pupil,normal,baseQ,displayCenter,opticAxis:opticAxis.clone(),localRadii});')
swap('makePoseTextures(behavior.actors.length);makeBody(data,textures);makeEyes(data);makeBones();', '''makePoseTextures(behavior.actors.length);makeBody(data,textures);makeEyes(data);makeBones();
   const measured=eyes[0].objects.map(item=>{const axes=[new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1)].map(v=>v.applyQuaternion(item.baseQ).toArray()),optic=item.opticAxis.clone().multiply(new THREE.Vector3().fromArray(item.localRadii)).normalize();return {...item.eye,sourceFrame:{x:axes[0],y:axes[1],normal:axes[2]},opticAxis:optic.toArray()};});
   const rec=oralMetadata.specimens.find(s=>s.id===id)?.productionRecommendation;for(const actor of behavior.actors){actor.ocularR04=Ocular.create(id,2601002,actor.index,measured);actor.oralR04=Oral.create(id,2601002,actor.index,rec?.signedMaxAngleRad||0);}
''')
swap('const s=Behavior.sampleSpine(a,state.selected,65);', 'const s=Behavior.sampleSpine(a,state.selected,65);angles[(i*16)*4]=a.oralR04.output.lower;')
old="item.gaze.rotation.set(clamp(a.eyes?.pitch||0,-(item.eye.gazePitchLimit||.023),item.eye.gazePitchLimit||.023),clamp((item.eye.side===-1?a.eyes?.leftYaw:a.eyes?.rightYaw)||0,-(item.eye.gazeYawLimit||.047),item.eye.gazeYawLimit||.047),0);"
new="const b=Ocular.eyeBasis(a.ocularR04,item.eye.side),g=Ocular.angles(a.ocularR04,item.eye.side),dir=new THREE.Vector3().fromArray(b.localOptic).multiplyScalar(Math.cos(g.yaw)*Math.cos(g.pitch)).addScaledVector(new THREE.Vector3().fromArray(b.localAnterior),Math.sin(g.yaw)*Math.cos(g.pitch)).addScaledVector(new THREE.Vector3().fromArray(b.localUp),Math.sin(g.pitch));dir.divide(new THREE.Vector3().fromArray(item.localRadii)).normalize();item.gaze.quaternion.setFromUnitVectors(item.opticAxis,dir);"
swap(old,new)
swap('Behavior.update(behavior,dt,{mode:state.mode,pointer:state.pointer,centered:!state.group});state.time+=dt;', '''Behavior.update(behavior,dt,{mode:state.mode,pointer:state.pointer,centered:!state.group});for(const actor of behavior.actors){const scan=Ocular.update(actor.ocularR04,dt,{mode:state.mode,turnRate:actor.turnRate}),mouth=Oral.update(actor.oralR04,dt,{mode:state.mode,effort:actor.threat});actor.cranialR04={eye:scan,oral:mouth};}state.time+=dt;''')
swap('Behavior.reset(behavior);state.orbit=', "Behavior.reset(behavior);const measured=eyes[0].objects.map(item=>{const axes=[new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1)].map(v=>v.applyQuaternion(item.baseQ).toArray()),optic=item.opticAxis.clone().multiply(new THREE.Vector3().fromArray(item.localRadii)).normalize();return {...item.eye,sourceFrame:{x:axes[0],y:axes[1],normal:axes[2]},opticAxis:optic.toArray()};});const rec=oralMetadata.specimens.find(s=>s.id===state.selected)?.productionRecommendation;for(const actor of behavior.actors){actor.ocularR04=Ocular.create(state.selected,2601002,actor.index,measured);actor.oralR04=Oral.create(state.selected,2601002,actor.index,rec?.signedMaxAngleRad||0);}state.orbit=")
swap('renderer,camera,scene,Behavior,DEFORM_GLSL,THREE,sourcePositions,', 'renderer,camera,scene,Behavior,Ocular,Oral,oralMetadata,DEFORM_GLSL,THREE,sourcePositions,')
swap('本轮眼睛保持既有版本。','原眼球几何保留，扫视更清晰；沿既有下颌与鳃盖绑定表现通气。')
p.write_text(s,encoding='utf-8')
print('R04 cranial integration source written; original behavior/scores/R14 remain unchanged')
