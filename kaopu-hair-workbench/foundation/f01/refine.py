"""F01 review patch: apply once; commit the resulting readable sources."""
from pathlib import Path
p=Path(__file__).resolve().parent

def change(s,a,b):
    if b in s:return s
    assert s.count(a)==1, a[:90]
    return s.replace(a,b)
f=p/'src/Foundation.mjs';s=f.read_text()
s=change(s,'[2.27,.277],[2.63,.266],[Math.PI,.264]','[2.27,.270],[2.63,.253],[Math.PI,.249]')
s=change(s,'head.positions[3*i+1]<.248','head.positions[3*i+1]<.228')
s=change(s,'this.prev.set(this.rest);this.v.fill(0);this.time=0;this.yaw=0;this.nod=0;','this.prev.set(this.rest);this.target.set(this.rest);this.v.fill(0);this.time=0;this.yaw=0;this.nod=0;this.maxError=0;this.contacts=0;')
s=change(s,'iter<9','iter<6')
s=change(s,'iter===2||iter===5||iter===8','iter===2||iter===5')
f.write_text(s)
f=p/'src/App.mjs';s=f.read_text()
s=change(s,"version='local';","version='local';let lastYaw=null,lastNod=null,geometryTimes=[],renderTimes=[];")
s=change(s,'function view(){camera.position.set(target.x+Math.sin(yaw)*Math.cos(pitch)*distance,target.y+Math.sin(pitch)*distance,target.z+Math.cos(yaw)*Math.cos(pitch)*distance);camera.lookAt(target);}', 'function view(){const d=distance*Math.max(1,.78/camera.aspect);camera.position.set(target.x+Math.sin(yaw)*Math.cos(pitch)*d,target.y+Math.sin(pitch)*d,target.z+Math.cos(yaw)*Math.cos(pitch)*d);camera.lookAt(target);}')
s=change(s,"function updateGeometry(){if(!solver)return;const y=solver.yaw,n=solver.nod,hp=headGeom.attributes.position.array;for", "function updateGeometry(force=false){if(!solver)return;const begin=performance.now(),y=solver.yaw,n=solver.nod,hp=headGeom.attributes.position.array,poseChanged=force||y!==lastYaw||n!==lastNod;lastYaw=y;lastNod=n;if(poseChanged){for")
s=change(s,"headGeom.attributes.position.needsUpdate=true;headGeom.computeVertexNormals();\n const N", "headGeom.attributes.position.needsUpdate=true;headGeom.computeVertexNormals();}\n const N")
s=change(s,"hairGeom.computeVertexNormals();const rp=", "hairGeom.computeVertexNormals();if(poseChanged&&(force||rootMesh.visible)){const rp=")
s=change(s,"rootMesh.geometry.attributes.position.needsUpdate=true;\n const bp", "rootMesh.geometry.attributes.position.needsUpdate=true;}\n if(poseChanged&&(force||boundaryMesh.visible)){const bp")
s=change(s,"boundaryMesh.geometry.attributes.position.needsUpdate=true;\n const dp", "boundaryMesh.geometry.attributes.position.needsUpdate=true;}\n if(poseChanged&&(force||domainMesh.visible)){const dp")
s=change(s,"domainMesh.geometry.attributes.position.needsUpdate=true;domainMesh.geometry.computeVertexNormals();\n}", "domainMesh.geometry.attributes.position.needsUpdate=true;const dn=domainMesh.geometry.attributes.normal.array;let ni=0;for(const c of domain.cells)for(const b of c.v){dn.set(point(head,c.f,b.b,headGeom.attributes.normal.array),ni);ni+=3;}domainMesh.geometry.attributes.normal.needsUpdate=true;}geometryTimes.push(performance.now()-begin);if(geometryTimes.length>240)geometryTimes.shift();\n}")
s=change(s,"domainMesh.visible=m==='domain';document.querySelectorAll", "domainMesh.visible=m==='domain';updateGeometry(true);document.querySelectorAll")
s=change(s,"function draw(){if(renderer&&!disposed&&!document.hidden)renderer.render(scene,camera);}","function draw(){if(renderer&&!disposed&&!document.hidden){const t=performance.now();renderer.render(scene,camera);renderTimes.push(performance.now()-t);if(renderTimes.length>240)renderTimes.shift();}}")
s=change(s,"camera.updateProjectionMatrix();draw();}","camera.updateProjectionMatrix();view();draw();}")
s=change(s,"if(patch.color!==undefined||patch.density!==undefined||patch.colored!==undefined)rebuildDisplay();", "if(patch.color!==undefined){$('colored').checked=false;updateColors();}if(patch.density!==undefined)updateGeometry(true);")
s=change(s,"$('colored').onchange=()=>rebuildDisplay();", "$('colored').onchange=()=>{updateColors();draw();};")
s=change(s,"function disposeMesh(m)", "function updateColors(){if(!hairGeom)return;const c=new THREE.Color(),a=hairGeom.attributes.color.array,N=solver.nodes;for(let g=0;g<groom.guides.length;g++){c.set($('colored').checked?PALETTE[groom.guides[g].region]:recipe.color);for(let i=0;i<N*4;i++)a.set([c.r,c.g,c.b],(g*N*4+i)*3);}hairGeom.attributes.color.needsUpdate=true;}\nfunction disposeMesh(m)")
s=change(s,'medianFrameMS:median(frameTimes),','medianFrameMS:median(frameTimes),medianGeometryMS:median(geometryTimes),medianRenderSubmitMS:median(renderTimes),')
f.write_text(s)
print('F01 review patch applied; readable sources are the tested outputs.')
