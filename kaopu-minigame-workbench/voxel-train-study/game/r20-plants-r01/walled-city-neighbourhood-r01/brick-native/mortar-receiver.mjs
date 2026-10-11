import {soilSource} from './source-soil.mjs';
import {originalPrefix} from './shaders.mjs';
const noVersion=s=>s.replace(/^#version 300 es\n/,'');
export function mortarVertex(){return `#version 300 es
precision highp float;precision highp int;
uniform mat4 uViewProj;uniform mat4 modelMatrix;in vec3 position;in vec3 normal;out vec3 vBoxPoint;out vec3 receiverNormal;
void main(){vec4 world=modelMatrix*vec4(position,1.);vBoxPoint=world.xyz;receiverNormal=mat3(transpose(inverse(modelMatrix)))*normal;gl_Position=uViewProj*world;}`;}
export function mortarFragment(){return originalPrefix(soilSource.soilFS)+`
in vec3 receiverNormal;
void main(){vec3 p=vBoxPoint,rd=uOrtho==1?normalize(uViewDir):normalize(p-uCamera);vec3 n=normalize(receiverNormal),col=shadeSoil(p,n,rd,0);col=pow(max(col/(1.+col),0.),vec3(1./2.2));frag=vec4(col,1.);}`;}
export function createMortarReceiver({THREE,color='#77736b',colorVariation=0,micro=.0}={}){
 if(!/^#[0-9a-f]{6}$/i.test(color)||!Number.isFinite(colorVariation)||colorVariation<0||colorVariation>2||!Number.isFinite(micro)||micro<0||micro>.003)throw Error('Invalid source mortar color parameters');
 const rgb=[1,3,5].map(i=>Math.pow(parseInt(color.slice(i,i+2),16)/255,2.2)),uniforms={uViewProj:{value:new THREE.Matrix4()},uCamera:{value:new THREE.Vector3()},uViewDir:{value:new THREE.Vector3()},uOrtho:{value:0},uSoilColor:{value:colorVariation},uCoreMicro:{value:micro},uLayerColor:{value:Array.from({length:5},()=>new THREE.Vector3(...rgb))}};
 const material=new THREE.RawShaderMaterial({glslVersion:THREE.GLSL3,vertexShader:noVersion(mortarVertex()),fragmentShader:noVersion(mortarFragment()),uniforms,side:THREE.FrontSide,depthTest:true,depthWrite:true,toneMapped:false});material.name='Original soil shade on recipe geometry';const proof={sourceSha256:soilSource.sourceSha256,originalShadeSoil:true,normal:'receiver geometry; original shader perturbation retained',layerId:0,traceOrExactNormalCalls:false,capOrPortalDiscard:false,geometricEquivalenceToSourceSDF:false,shaderCompiles:0};material.onBeforeCompile=()=>proof.shaderCompiles++;
 function updateCamera(camera){camera.updateWorldMatrix(true,false);uniforms.uViewProj.value.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);camera.getWorldPosition(uniforms.uCamera.value);camera.getWorldDirection(uniforms.uViewDir.value);uniforms.uOrtho.value=camera.isOrthographicCamera?1:0;}
 return {material,proof,updateCamera,dispose(){material.dispose();}};
}
