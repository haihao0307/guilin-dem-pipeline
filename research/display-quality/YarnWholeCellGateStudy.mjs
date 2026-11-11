// Research only: reject a translated yarn cell when the camera/light ray
// cannot intersect the union of its ten original segment bounds. The actual
// source solver, roots, materials and noise are left untouched.
export function addYarnWholeCellGate(source){
 const anchor='vec3 offset=vec3(float(col)*uPitch,float(row)*uPitch*.5,0.);';
 if(source.split(anchor).length!==3)throw Error('Expected primary and shadow source-cell loops');
 const query=`vec3 cellRelative=ro-offset;float cellMargin=max(.01,5.e-6*length(cellRelative));vec2 cellSpan=boxSpan(cellRelative,rd,uYarnWholeLow-vec3(cellMargin),uYarnWholeHigh+vec3(cellMargin));if(cellSpan.x>cellSpan.y||cellSpan.y<0.||cellSpan.x>best+.01)continue;`;
 return 'uniform vec3 uYarnWholeLow,uYarnWholeHigh;\n'+source.replaceAll(anchor,anchor+query);
}
