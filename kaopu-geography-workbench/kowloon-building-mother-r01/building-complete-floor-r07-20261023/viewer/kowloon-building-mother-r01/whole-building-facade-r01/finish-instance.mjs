/** Instance-scoped coating palette receiver. The R06 field, coverage weights,
 * F0, roughness, height and existing licences remain unchanged. Only the four
 * observed group's intact coating diffuse color is approximated. */
export const OBSERVED_FRAME_COAT_LINEAR=Object.freeze([.58,.61,.57]);
export function isObservedFacadeFrame(id){const n=Math.floor((id-4000)/8);return(n>=200&&n<=202)||(n>=210&&n<=212)||(n>=220&&n<=222)||(n>=230&&n<=234);}
export function buildObservedFacadeMaterialGLSL(source){
 const changes=[
 ['FloorMaterialSample fmMetal(vec3 p,vec3 n,float fp){','FloorMaterialSample fmMetal(vec3 p,vec3 n,float fp,float stableObjectId){'],
 ['(vec3(0.035,0.043,0.041)-vec3(.085,.12,.105))*m.layers.x','(observedFacadeCoat(stableObjectId)-vec3(.085,.12,.105))*m.layers.x'],
 ['return fmMetal(localMetres,localNormal,fp);','return fmMetal(localMetres,localNormal,fp,stableObjectId);']
 ];
 for(const[a,b]of changes){if(source.split(a).length!==2)throw Error('R06 receiver source contract changed: '+a);source=source.replace(a,b);}
 return `uniform vec3 uObservedFrameCoat;
 vec3 observedFacadeCoat(float objectId){int n=int(floor((objectId-4000.)/8.));bool selected=(n>=200&&n<=202)||(n>=210&&n<=212)||(n>=220&&n<=222)||(n>=230&&n<=234);return selected?uObservedFrameCoat:vec3(.035,.043,.041);}
 `+source;
}
