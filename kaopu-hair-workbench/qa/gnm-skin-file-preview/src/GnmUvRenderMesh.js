import * as THREE from 'three';
/** Official UV split is a render-only indirection. The solver/scalp geometry
 * remains the original 17,821 vertices, with its original Three-computed
 * normals. Mapping those already welded source normals to every duplicate is
 * exactly equivalent at every original triangle corner and avoids seams. */
export function createGnmUvRenderGeometry(model,sourceGeometry){
 if(!model.hasUvs||!model.vertexUvs||!model.uvSource||!model.uvTriangles)throw Error('Official GNM UV sidecar not attached');
 if(sourceGeometry.attributes.position.count!==model.numVertices)throw Error('Source geometry must retain original topology');
 const n=model.numRenderVertices,g=new THREE.BufferGeometry();
 const p=new Float32Array(n*3),normal=new Float32Array(n*3);
 g.setAttribute('position',new THREE.BufferAttribute(p,3).setUsage(THREE.DynamicDrawUsage));g.setAttribute('normal',new THREE.BufferAttribute(normal,3).setUsage(THREE.DynamicDrawUsage));g.setAttribute('uv',new THREE.BufferAttribute(model.vertexUvs.slice(),2));g.setIndex(new THREE.BufferAttribute(model.uvTriangles.slice(),1));
 let cornerMismatch=0;for(let i=0;i<model.triangles.length;i++)if(model.uvSource[model.uvTriangles[i]]!==model.triangles[i])cornerMismatch++;if(cornerMismatch)throw Error('Official UV corner topology mismatch');
 function update(){const sourceP=sourceGeometry.attributes.position.array,sourceN=sourceGeometry.attributes.normal.array;for(let v=0;v<n;v++){const s=model.uvSource[v];p.set(sourceP.subarray(s*3,s*3+3),v*3);normal.set(sourceN.subarray(s*3,s*3+3),v*3);}g.attributes.position.needsUpdate=true;g.attributes.normal.needsUpdate=true;g.computeBoundingSphere();}
 function diagnostics(){let positionError=0,normalError=0;const sp=sourceGeometry.attributes.position.array,sn=sourceGeometry.attributes.normal.array;for(let v=0;v<n;v++){const s=model.uvSource[v];for(let k=0;k<3;k++){positionError=Math.max(positionError,Math.abs(p[v*3+k]-sp[s*3+k]));normalError=Math.max(normalError,Math.abs(normal[v*3+k]-sn[s*3+k]));}}return{sourceVertices:model.numVertices,renderVertices:n,duplicates:n-model.numVertices,triangleCornerMismatch:cornerMismatch,maxPositionError:positionError,maxNormalError:normalError,normalMethod:'duplicate exact original topology vertex normals',uvFlipped:false,finite:p.every(Number.isFinite)&&normal.every(Number.isFinite)&&model.vertexUvs.every(Number.isFinite)};}
 update();return {geometry:g,update,diagnostics,dispose(){g.dispose();}};
}
