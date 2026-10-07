import * as THREE from '../garments-r04/vendor/three.module.js';
import {OrbitControls} from '../garments-r04/vendor/OrbitControls.js';

export class PpfViewer {
  constructor(canvas, container) {
    this.canvas=canvas;this.container=container;this.disposed=false;this.meshes=[];this.dirty=true;
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.2;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#19252d');
    this.scene.add(new THREE.HemisphereLight(0xdbedf7,0x69604e,2.1));
    this.key=new THREE.DirectionalLight(0xffebcf,3);this.key.position.set(-3,5,4);
    this.key.castShadow=true;this.key.shadow.mapSize.set(2048,2048);
    Object.assign(this.key.shadow.camera,{left:-3,right:3,top:3,bottom:-3,near:.1,far:20});
    this.key.shadow.bias=-.00012;this.key.shadow.normalBias=.0015;this.scene.add(this.key);
    const rim=new THREE.DirectionalLight(0x9ccfe8,2);rim.position.set(3,1,-3);this.scene.add(rim);
    this.camera=new THREE.PerspectiveCamera(34,1,.01,40);
    this.orbit=new OrbitControls(this.camera,canvas);this.orbit.enableDamping=true;
    this.orbit.minDistance=.1;this.orbit.maxDistance=15;
    this.onOrbit=()=>this.dirty=true;this.orbit.addEventListener('change',this.onOrbit);
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(container);
    this.onResize=()=>this.resize();window.addEventListener('resize',this.onResize);
    this.renderCount=0;this.raf=0;this.tick=()=>{
      this.raf=0;if(this.disposed)return;this.orbit.update();
      if(this.dirty&&!document.hidden){this.renderer.render(this.scene,this.camera);this.renderCount++;this.dirty=false;}
      this.raf=requestAnimationFrame(this.tick);
    };this.raf=requestAnimationFrame(this.tick);this.resize();
  }
  resize(){if(this.disposed)return;const r=this.container.getBoundingClientRect();if(r.width<=0||r.height<=0)return;this.renderer.setSize(r.width,r.height,false);this.camera.aspect=r.width/r.height;this.camera.updateProjectionMatrix();this.dirty=true;}
  load(manifest, bytes){
    this.manifest=manifest;const types={'<u4':Uint32Array,'<f4':Float32Array,'<f8':Float64Array};
    const section=name=>{const s=manifest.topology.sections[name];return s?new types[s.dtype](bytes.buffer,bytes.byteOffset+s.offset,s.count):null;};
    const tris=section('tri'),ids=section('object_vert'),colors=section('color');this.restBasis=section('rest_basis').slice();this.displayMode='cloth';
    for(const obj of manifest.objects){
      const g=new THREE.BufferGeometry();let color;
      if(obj.kind==='STATIC'){
        const p=section('static_vert'),t=section('static_tri'),map=section('static_vert_dmap'),displacement=section('displacement');if(!p||!t)continue;
        // Upstream static vertices are local: apply their authored displacement
        // group exactly as the official scene compiler/solver does.
        const world=new Float32Array(p.length);for(let i=0;i<p.length;i++)world[i]=p[i]+displacement[map[Math.floor(i/3)]*3+i%3];
        g.setAttribute('position',new THREE.BufferAttribute(world,3));g.setIndex(new THREE.BufferAttribute(t.slice(),1));color=new THREE.Color('#9caeb8');
      }else{
        const indices=[],triangleIds=[];for(let i=0;i<tris.length;i+=3)if(ids[tris[i]]===obj.id){
          if(ids[tris[i+1]]!==obj.id||ids[tris[i+2]]!==obj.id)throw Error('Triangle crosses official objects');
          indices.push(tris[i]-obj.firstVertex,tris[i+1]-obj.firstVertex,tris[i+2]-obj.firstVertex);triangleIds.push(i/3);
        }
        g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(obj.vertexCount*3),3));g.setIndex(indices);g.userData.triangleIds=new Uint32Array(triangleIds);
        color=new THREE.Color().fromArray(colors,obj.firstVertex*3);
      }
      const material=new THREE.MeshStandardMaterial({color,roughness:.83,metalness:obj.kind==='STATIC'?.12:0,side:THREE.DoubleSide});
      const mesh=new THREE.Mesh(g,material);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.object=obj;mesh.userData.originalColor=color.clone();
      if(obj.kind==='STATIC')g.computeVertexNormals();this.meshes.push(mesh);this.scene.add(mesh);
    }
    const min=new THREE.Vector3(...manifest.bounds[0]),max=new THREE.Vector3(...manifest.bounds[1]);
    this.target=min.clone().add(max).multiplyScalar(.5);this.radius=Math.max(.5,min.distanceTo(max)*.5);
    const floorY=Math.min(min.y-.07,manifest.case==='drape'?-1.15:-1.6);
    this.floor=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshStandardMaterial({color:'#26363f',roughness:1}));
    this.floor.rotation.x=-Math.PI/2;this.floor.position.y=floorY;this.floor.receiveShadow=true;this.scene.add(this.floor);
    this.cameraView('angle');
  }
  update(positions,statistics){this.current=positions;this.statistics=statistics;for(const m of this.meshes){const o=m.userData.object;if(o.kind==='STATIC')continue;m.geometry.attributes.position.array.set(positions.subarray(o.firstVertex*3,(o.firstVertex+o.vertexCount)*3));m.geometry.attributes.position.needsUpdate=true;m.geometry.computeVertexNormals();m.geometry.computeBoundingSphere();}this.mode(this.displayMode);this.dirty=true;}
  cameraView(kind){if(!this.target)return;const directions={angle:[1,.6,1.8],front:[0,.05,2],side:[2,.1,0],top:[0,2,.001]};const d=new THREE.Vector3(...directions[kind]).normalize().multiplyScalar(this.radius*2.4);this.camera.position.copy(this.target).add(d);this.orbit.target.copy(this.target);this.orbit.update();this.dirty=true;}
  visible(id,value){const m=this.meshes.find(m=>m.userData.object.id===id);if(m)m.visible=value;this.dirty=true;}
  mode(mode){
    this.displayMode=mode;const maxContact=Math.max(1,...(this.statistics||[]).map(o=>o.contact_count));this.maximumStretch=1;
    for(const m of this.meshes){
      m.material.wireframe=mode==='wire';m.material.flatShading=mode==='facets';m.material.vertexColors=false;m.material.color.copy(m.userData.originalColor);
      if(mode==='contacts'){
        const n=this.statistics?.find(o=>o.object_index===m.userData.object.id)?.contact_count||0;
        m.material.color.setHSL(.52*(1-Math.log1p(n)/Math.log1p(maxContact)),.75,.5);
      }
      if(mode==='strain'&&this.current&&m.userData.object.kind!=='STATIC')this.colorStrain(m);
      m.material.needsUpdate=true;
    }this.dirty=true;
  }
  colorStrain(mesh){
    const g=mesh.geometry,p=g.attributes.position.array,ids=g.index.array,triIds=g.userData.triangleIds,basis=this.restBasis;
    const sums=new Float64Array(p.length/3),weights=new Float64Array(p.length/3);
    for(let i=0;i<ids.length;i+=3){
      const u=triIds[i/3]*3,ax=basis[u],ay=0,bx=basis[u+1],by=basis[u+2],det=ax*by;
      let aa=0,bb=0,ab=0;for(let k=0;k<3;k++){const e1=p[ids[i+1]*3+k]-p[ids[i]*3+k],e2=p[ids[i+2]*3+k]-p[ids[i]*3+k];const f1=(e1*by-e2*ay)/det,f2=(-e1*bx+e2*ax)/det;aa+=f1*f1;bb+=f2*f2;ab+=f1*f2;}
      const stretch=Math.sqrt(Math.max(0,(aa+bb+Math.hypot(aa-bb,2*ab))/2));this.maximumStretch=Math.max(this.maximumStretch,stretch);
      const a=Math.abs(det)/2;for(let k=0;k<3;k++){sums[ids[i+k]]+=Math.max(0,stretch-1)*a;weights[ids[i+k]]+=a;}
    }
    let attr=g.attributes.color;if(!attr){attr=new THREE.BufferAttribute(new Float32Array(p.length),3);g.setAttribute('color',attr);}
    const color=new THREE.Color();for(let i=0;i<sums.length;i++){color.setHSL(.52*(1-Math.min(1,sums[i]/Math.max(1e-20,weights[i])/.06)),.78,.48);color.toArray(attr.array,i*3);}
    attr.needsUpdate=true;mesh.material.vertexColors=true;mesh.material.color.set('#ffffff');
  }
  dispose(){if(this.disposed)return;this.disposed=true;cancelAnimationFrame(this.raf);this.raf=0;this.observer.disconnect();window.removeEventListener('resize',this.onResize);this.orbit.removeEventListener('change',this.onOrbit);this.orbit.dispose();this.scene.traverse(o=>{o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])m.dispose();});this.key.shadow.map?.dispose();this.scene.clear();this.renderer.renderLists.dispose();this.renderer.forceContextLoss();this.renderer.dispose();this.current=this.manifest=this.restBasis=this.statistics=null;this.meshes=[];this.scene=this.camera=this.orbit=this.renderer=this.floor=this.key=null;}
}
