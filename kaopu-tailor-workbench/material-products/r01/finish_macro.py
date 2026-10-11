from pathlib import Path
P=Path(__file__).resolve().parent
f=P/'app.mjs';t=f.read_text()
old="const r=new THREE.Raycaster(new THREE.Vector3(center.x,center.y,box.max.z+2),new THREE.Vector3(0,0,-1)),hit=r.intersectObject(mesh,false)[0];point=hit?.point||center;"
new="let hit=null;const width=box.max.x-box.min.x;for(const dx of (role==='bottom'?[.22,-.22,0,.34,-.34]:[0,.18,-.18])){const r=new THREE.Raycaster(new THREE.Vector3(center.x+dx*width,center.y,box.max.z+2),new THREE.Vector3(0,0,-1));hit=r.intersectObject(mesh,false)[0];if(hit)break;}if(!hit){message('这个方向未命中服装表面，请双击需要观察的部位。',true);return;}point=hit.point;"
assert t.count(old)==1;t=t.replace(old,new)
old="viewer.camera.position.copy(point).add(new THREE.Vector3(.012,.012,.19));"
new="const info=materials.find(m=>m.id===items[role==='bottom'?1:0].materialID),d=info.family==='knit'?.19:info.family==='leather'?.10:.08;viewer.camera.position.copy(point).add(new THREE.Vector3(.004,.004,d));"
assert t.count(old)==1;t=t.replace(old,new)
f.write_text(t)
print('REAL_FABRIC_MACRO_TARGET_PATCHED')
