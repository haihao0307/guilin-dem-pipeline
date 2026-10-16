// This is the old rectangular data-domain overlay, not any physical rail.
const draw="gl.disable(gl.DEPTH_TEST);common(routeProgram,now,s,e,c);v3(routeProgram,'color',[.9,.72,.36]);gl.bindVertexArray(boundaryMesh.vao);gl.drawElements(gl.TRIANGLES,boundaryMesh.count,gl.UNSIGNED_INT,0);gl.enable(gl.DEPTH_TEST);";
export function patchRemoveDomainLine(html){
 if(html.split(draw).length!==2)throw Error('R07 old yellow data-domain draw is not unique');
 return html.replace(draw,'qa.legacyDomainBoundaryDrawn=false;');
}
