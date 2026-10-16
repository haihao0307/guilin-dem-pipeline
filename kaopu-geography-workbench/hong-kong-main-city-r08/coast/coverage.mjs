// The retained 30 m terrain draws only triangles whose three nodes are non-ocean.
// A nearest-node water clip is not its complement and exposes sky in mixed cells.
// Keep every source value, and make the ocean clip the exact triangle footprint.
export function triangleLand(mask,width,height,col,row,u,v){
 if(col<0||row<0||col>=width-1||row>=height-1)return false;
 const j=row*width+col,ids=u+v<=1?[j,j+width,j+1]:[j+1,j+width,j+width+1];
 return ids.every(i=>mask[i]!==0);
}
export const triangleCoverageGLSL=`
uniform bool uHKTriangleCoastEnabled;
bool hkTerrainTriangleCovered(vec2 uv){
 ivec2 sz=textureSize(uHKMask,0);
 vec2 node=uv*vec2(sz-1);
 ivec2 ij=clamp(ivec2(floor(node)),ivec2(0),sz-2);
 vec2 f=clamp(node-vec2(ij),vec2(0),vec2(1));
 float a=texelFetch(uHKMask,ij,0).r;
 float b=texelFetch(uHKMask,ij+ivec2(1,0),0).r;
 float c=texelFetch(uHKMask,ij+ivec2(0,1),0).r;
 float d=texelFetch(uHKMask,ij+ivec2(1,1),0).r;
 return f.x+f.y<=1.?min(a,min(b,c))>.001:min(b,min(c,d))>.001;
}
`;
export function patchCoastCoverageHost(html){
 const declaration='uniform sampler2D uHKMask,uOuterOceanMask;uniform vec4 uHKBbox;uniform vec2 uOuterNodeOrigin;\\nvoid main()';
 if(html.split(declaration).length!==2)throw Error('R06 ocean coverage declaration anchor');
 html=html.replace(declaration,declaration.replace('\\nvoid main()',triangleCoverageGLSL.replace(/\n/g,'\\n')+'\\nvoid main()'));
 const old='if(texture(uHKMask,uv).r>.001)discard;';
 if(html.split(old).length!==2)throw Error('R06 ocean land clip anchor');
 html=html.replace(old,'if(uHKTriangleCoastEnabled?hkTerrainTriangleCovered(uv):texture(uHKMask,uv).r>.001)discard;');
 const bind="window.HKOuterOcean.applySeaUniforms(gl,seaProgram,loc);";
 if(html.split(bind).length!==2)throw Error('R06 coast uniform anchor');
 html=html.replace(bind,bind+"window.HKCoastClosure.applySeaUniforms(gl,seaProgram,loc);");
 const mesh='const hkMeshData=hkMesh(hkClippedIncrement.positions,hkClippedIncrement.indices,7);';
 if(html.split(mesh).length!==2)throw Error('R06 coast display closure anchor');
 html=html.replace(mesh,'const hkCoastClosed=window.HKCoastClosure.append(hkClippedIncrement,hkV,hkI,HK,hkMask);const hkMeshData=hkMesh(hkCoastClosed.positions,hkCoastClosed.indices,7);');
 return html;
}
