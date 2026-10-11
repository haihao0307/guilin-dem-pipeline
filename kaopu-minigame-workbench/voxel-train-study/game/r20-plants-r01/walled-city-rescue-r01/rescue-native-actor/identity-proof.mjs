export function originalGeometryProof({human,nativeRoot,sourceCommit,expectedCommit}={}){
 if(!human||human.N!==25417||human.faces?.length!==50624*3||human.names?.length!==104||human.rig?.source!=='anny'||!human.mesh?.uuid||!nativeRoot?.children?.includes(human.mesh)||human.mesh.parent!==nativeRoot||!sourceCommit||sourceCommit!==expectedCommit)throw Error('Original native geometry identity and ownership required');
 return Object.freeze({nativeGeometry:true,sourceCommit,vertices:human.N,triangles:human.faces.length/3,bones:human.names.length,meshIdentity:human.mesh.uuid});
}
