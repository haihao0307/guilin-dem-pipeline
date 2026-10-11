// Host bridge only. The source shaders, presets, source coordinates, geometry
// functions, materialFor and uniform expressions remain in original-core.mjs.
import * as Original from './original-core.mjs';
export function createTimberMember(THREE,recipe={}) {
 const {id='member',sourceId=id,seed=198107,length=1,height=.1,depth=.1,grainOffset=[0,0,0],presetId='yunnan_dark_aged_v2',position=[0,0,0],rotation=[0,0,0],tessellation={lengthSegments:12,crossSegments:2,endSegments:2}}=recipe;
 for(const n of [length,height,depth])if(!Number.isFinite(n)||n<=0)throw Error('Timber dimensions must be positive metres');
 const preset=Original.getYunnanTimberPreset(presetId);
 if(preset.id!==presetId)throw Error('Unknown original timber preset: '+presetId);
 const geometryData=Original.createSubdividedBoxGeometry(length,height,depth,{grainOffset,...tessellation});
 const geometry=new THREE.BufferGeometry();
 const attr=(key,values,size)=>geometry.setAttribute(key,new THREE.BufferAttribute(values,size));
 attr('position',geometryData.positions,3);attr('a_position',geometryData.positions,3);
 attr('normal',geometryData.normals,3);attr('a_normal',geometryData.normals,3);
 attr('a_grainPosition',geometryData.grainPositions,3);attr('a_grainNormal',geometryData.grainNormals??geometryData.normals,3);
 attr('a_surfaceClass',geometryData.surfaceClasses,1);geometry.setIndex(new THREE.BufferAttribute(geometryData.indices,1));
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
 const originalMaterial=Original.materialFor(sourceId,id,seed,preset), uniforms={};
 const names=[...new Set([...Original.vertexShaderSource.matchAll(/uniform\s+\w+\s+(\w+)\s*;/g),...Original.fragmentShaderSource.matchAll(/uniform\s+\w+\s+(\w+)\s*;/g)].map(m=>m[1]))];
 for(const n of names)uniforms[n]={value:0};
 const locations=Object.fromEntries(names.map(n=>[n,n]));
 const gl={uniform1f:(n,v)=>uniforms[n].value=v,uniform1i:(n,v)=>uniforms[n].value=v,uniform2fv:(n,v)=>uniforms[n].value=Array.from(v),uniform3fv:(n,v)=>uniforms[n].value=Array.from(v),uniformMatrix4fv:(n,_t,v)=>uniforms[n].value=Array.from(v)};
 const material=new THREE.RawShaderMaterial({vertexShader:Original.vertexShaderSource.replace(/^#version 300 es\n/,''),fragmentShader:Original.fragmentShaderSource.replace(/^#version 300 es\n/,''),glslVersion:THREE.GLSL3,uniforms,toneMapped:false});
 material.name='OriginalTimber-v3/'+presetId;
 const mesh=new THREE.Mesh(geometry,material);mesh.name='timber/'+id;mesh.position.fromArray(position);mesh.rotation.fromArray([...rotation,'XYZ']);
 const sourceMesh={id,kind:'wood',geometry:geometryData,material:originalMaterial,model:null};
 const state={settings:recipe.settings??{},lighting:recipe.lighting??{}};
 mesh.onBeforeRender=(_renderer,_scene,camera)=>{
  sourceMesh.model=mesh.matrixWorld.elements;
  Original.bindOriginalTimberUniforms(gl,locations,sourceMesh,{preset,settings:state.settings,view:camera.matrixWorldInverse.elements,projection:camera.projectionMatrix.elements,cameraPosition:new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld).toArray(),...state.lighting,debugMode:0});
  material.uniformsNeedUpdate=true;
 };
 const proof={source:'Library preview-standalone.html v3',sourceLibraryFileId:'libfile_76c3c196b2808191b995220a779dcd7f',preset:preset.id,originalShaderUnmodified:true,originalGeometryFunction:'createSubdividedBoxGeometry',originalMaterialFunction:'materialFor',originalUniformBinding:true,grainAxis:[1,0,0],grainOffset,seed:originalMaterial.seed,triangles:geometryData.indices.length/3,newImageTextures:0,gpuVerified:false};
 return {mesh,proof,preset,sourceMesh,state,dispose(){geometry.dispose();material.dispose();}};
}
export {Original};
