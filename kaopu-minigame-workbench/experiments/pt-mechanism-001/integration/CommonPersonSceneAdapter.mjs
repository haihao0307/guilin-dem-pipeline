/**
 * Original thin scene adapter for the user's EXISTING CommonPerson runtime.
 * Does not build a character, resample topology, retarget eyes or bake materials.
 * Pass a verified loaded model and the original CommonSkinLayer class.
 */
export function attachCommonPerson({THREE,scene,model,SkinLayer,skinSettings={},requestRender=()=>{},position=[0,0,0]}) {
  if(!model?.positions||!model?.faces||typeof model.compute!=='function')throw Error('A verified existing CommonPerson model is required');
  if(typeof SkinLayer!=='function')throw Error('The existing CommonSkinLayer is required; do not silently replace it with clay');
  const originalPositions=model.positions,originalFaces=model.faces;
  const display=new Float32Array(originalPositions.length),geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(display,3));
  geometry.setIndex(new THREE.BufferAttribute(originalFaces,1));
  const colors=new Float32Array(display.length),base=new THREE.Color(0xbab3a5);
  for(let i=0;i<colors.length;i+=3){colors[i]=base.r;colors[i+1]=base.g;colors[i+2]=base.b;}
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  const originalMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.72,metalness:0,side:THREE.FrontSide});
  const mesh=new THREE.Mesh(geometry,originalMaterial);mesh.name='Existing approved CommonPerson';mesh.castShadow=true;mesh.receiveShadow=true;
  const root=new THREE.Group();root.name='CommonPerson scene placement';root.position.fromArray(position);root.add(mesh);scene.add(root);
  const viewer={model,geometry,mesh,material:originalMaterial,wire:false,band:false,render:requestRender};
  let disposed=false,skin,groundOffset=0;
  function sync(){
    if(disposed)throw Error('Adapter disposed');
    if(model.positions!==originalPositions||model.faces!==originalFaces)throw Error('Canonical topology/buffer identity changed');
    // Exact convention already used by the approved workbench Viewer.mjs.
    for(let i=0;i<display.length;i+=3){display[i]=originalPositions[i];display[i+1]=originalPositions[i+2];display[i+2]=-originalPositions[i+1];}
    geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    // The original canonical solver is pelvis-centred, not floor-centred.
    // Place the exact evaluated mesh on the requested floor with a Group offset;
    // never rescale, remesh, or rewrite the source vertex/skin buffers.
    groundOffset=-geometry.boundingBox.min.y;
    root.position.y=position[1]+groundOffset;
    skin?.update();requestRender();
  }
  sync();skin=new SkinLayer(viewer,skinSettings);
  return {
    root,mesh,geometry,model,skin,
    sync,
    compute(state){model.compute(state);sync();return model.state;},
    restore(archive){model.restore(archive);sync();return model.state;},
    setSkin(values){return skin.set(values);},
    report(){return{ready:!disposed,vertices:originalPositions.length/3,triangles:originalFaces.length/3,positionBufferPreserved:model.positions===originalPositions,indexBufferPreserved:model.faces===originalFaces,displayPositionBytes:display.byteLength,groundOffset,worldMinY:geometry.boundingBox.min.y+root.position.y,worldMaxY:geometry.boundingBox.max.y+root.position.y,skin:skin.report(),newRendererCreated:false,newCharacterCreated:false};},
    dispose(){if(disposed)return;skin.dispose();root.removeFromParent();geometry.dispose();originalMaterial.dispose();disposed=true;}
  };
}
