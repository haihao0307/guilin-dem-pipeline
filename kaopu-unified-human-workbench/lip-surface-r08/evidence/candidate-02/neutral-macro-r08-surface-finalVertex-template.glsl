uniform sampler2D uE6Packed;uniform int uE6Width;vec3 e6Fetch(int offset){int id=gl_VertexID*2+offset;return texelFetch(uE6Packed,ivec2(id%uE6Width,id/uE6Width),0).xyz;}varying vec3 vE6Direct,vE6Deep;varying float vE6Weight;
varying vec3 vCWorld,vCShadowNormal;
attribute vec4 eTissue;varying vec4 vETissue;varying vec3 vETPosition;
varying float vEWeight;
attribute vec4 l19State,l19Detail;varying vec4 vL19State,vL19Detail;
attribute vec3 fRest;attribute vec4 fA,fB,fEye;varying vec3 vFRest;varying vec4 vFA,vFB,vFEye;
attribute vec3 csRest;attribute vec4 csRegion,csExtra;varying vec3 vCSRest;varying vec4 vCSRegion,vCSExtra;varying float vCSType;
#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
vE6Direct=e6Fetch(0);vE6Deep=e6Fetch(1);vE6Weight=eTissue.z;
vETissue=eTissue;vETPosition=position;
vEWeight=eTissue.z;
vL19State=l19State;vL19Detail=l19Detail;
vFRest=fRest;vFA=fA;vFB=fB;vFEye=fEye;
vCSRest=csRest;vCSRegion=csRegion;vCSExtra=csExtra;vCSType=csExtra.w;
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
vCWorld=(modelMatrix*vec4(transformed,1.)).xyz;vCShadowNormal=inverseTransformDirection(transformedNormal,viewMatrix);
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}