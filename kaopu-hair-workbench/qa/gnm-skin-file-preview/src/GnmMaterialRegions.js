import * as THREE from 'three';
/** Official GNM material IDs, never inferred from a photo or painted UV mask.
 * This is component color separation, not photoreal skin or an eye texture.
 */
export function makeGnmMaterialColors(model,uvSource=null){
 const expected=['skin','teeth','gums','tongue','scleras','irises','pupils'];
 if(JSON.stringify(model.meta.materialNames)!==JSON.stringify(expected))throw Error('Unexpected GNM material ID order');
 const palette=['#b9b2aa','#f2eddc','#c4726b','#b44f48','#f4f2ec','#5d4630','#100e0d'].map(c=>new THREE.Color(c));
 const count=uvSource?.length||model.numVertices,colors=new Float32Array(count*3);
 for(let v=0;v<count;v++){const source=uvSource?uvSource[v]:v,id=model.materialId[source],c=palette[id];if(!c)throw Error('Invalid GNM material ID');colors[v*3]=c.r;colors[v*3+1]=c.g;colors[v*3+2]=c.b;}
 return colors;
}
