// Extend only the domain and categorical clipping of the existing R03 ocean.
// All wave, reflection, foam, light and material equations remain in the frozen mother.
export function patchOceanDomain(html){
 const rules=[
  ['uniform sampler2D uHKMask;uniform vec4 uHKBbox;\\nvoid main(){vec2 uv=(wPos.xz-uHKBbox.xy)/uHKBbox.zw;if(any(lessThan(uv,vec2(0)))||any(greaterThan(uv,vec2(1))))discard;if(texture(uHKMask,uv).r>.001)discard;',
   'uniform sampler2D uHKMask,uOuterOceanMask;uniform vec4 uHKBbox;uniform vec2 uOuterNodeOrigin;\\nvoid main(){vec2 uv=(wPos.xz-uHKBbox.xy)/uHKBbox.zw;if(all(greaterThanEqual(uv,vec2(0)))&&all(lessThanEqual(uv,vec2(1)))){if(texture(uHKMask,uv).r>.001)discard;}else{ivec2 ij=ivec2(floor((wPos.xz-uOuterNodeOrigin)/30.+.5));ivec2 sz=textureSize(uOuterOceanMask,0);if(any(lessThan(ij,ivec2(0)))||any(greaterThanEqual(ij,sz)))discard;if(abs(texelFetch(uOuterOceanMask,ij,0).r*255.-1.)>.1)discard;}'],
  ["'uniform vec4 uHKBbox;","'uniform vec4 uHKBbox,uSeaBbox;"],
  ['camera.y>1200.?uHKBbox.xy+grid*uHKBbox.zw','camera.y>1200.?uSeaBbox.xy+grid*uSeaBbox.zw'],
  ['camera.y>1200.?uHKBbox.w/gridRows','camera.y>1200.?uSeaBbox.w/gridRows'],
  ["v4(seaProgram,'uHKBbox',hkBox);gl.bindVertexArray(gridVao.vao);", "v4(seaProgram,'uHKBbox',hkBox);window.HKOuterOcean.applySeaUniforms(gl,seaProgram,loc);gl.bindVertexArray(gridVao.vao);"]
 ];
 for(const [a,b]of rules){if(html.split(a).length!==2)throw Error('Ocean domain anchor not unique: '+a.slice(0,70));html=html.replace(a,b);}return html;
}
const sha=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
export async function createOuterOcean(host){
 const {gl}=host,manifestURL=new URL('./mask-manifest.json',import.meta.url),r=await fetch(manifestURL);if(!r.ok)throw Error('Ocean mask metadata '+r.status);const m=await r.json();const response=await fetch(new URL(m.data,manifestURL));if(!response.ok)throw Error('Ocean mask '+response.status);const packed=await response.arrayBuffer();if(packed.byteLength!==m.gzipBytes||await sha(packed)!==m.sha256)throw Error('Ocean mask transport hash');const bytes=await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();if(bytes.byteLength!==m.decodedBytes||await sha(bytes)!==m.decodedSha256)throw Error('Ocean mask decoded hash');
 if(Math.max(...m.shapeRC)>gl.getParameter(gl.MAX_TEXTURE_SIZE))throw Error('Full 30m mask exceeds texture support; no downsampling fallback');
 const texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0+8);gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,m.shapeRC[1],m.shapeRC[0],0,gl.RED,gl.UNSIGNED_BYTE,new Uint8Array(bytes));
 const [E0,N0,E1,N1]=m.nodeBoundsEPSG2326,box=[E0-834000,827000-N1,E1-E0,N1-N0],origin=[m.nodeOriginEastingNorthing[0]-834000,827000-m.nodeOriginEastingNorthing[1]];
 const stats=()=>({ready:true,maskGPUBytes:m.decodedBytes,maskGzipBytes:m.gzipBytes,maskNodeStepM:30,oldMaskModified:false,materialMotherReplaced:false,boundsEPSG2326:m.nodeBoundsEPSG2326});host.qa.outerOcean=stats();
 return {stats,applySeaUniforms(gl,p,loc){gl.activeTexture(gl.TEXTURE0+8);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(loc(p,'uOuterOceanMask'),8);gl.uniform2fv(loc(p,'uOuterNodeOrigin'),origin);gl.uniform4fv(loc(p,'uSeaBbox'),box);},dispose(){gl.deleteTexture(texture);}};
}
