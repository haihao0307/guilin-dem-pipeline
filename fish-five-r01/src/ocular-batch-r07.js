// R06 ocular topology, physical material and fragment domains, shared per source
// eye. Diagnostic Object3D trees are retained outside the rendering scene.
export const VERSION='R07_OCULAR_BATCH_1';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
const AXES=Object.freeze(['X','Y','Z']);
export function deformInto(out,point,spine){
  const u=clamp(point[0]+.5,0,1)*(spine.centers.length-1),i=Math.min(spine.centers.length-2,Math.floor(u)),t=u-i;
  const a=spine.tangents[i],b=spine.tangents[i+1];
  let tx=mix(a[0],b[0],t),ty=mix(a[1],b[1],t),tz=mix(a[2],b[2],t);
  const length=Math.hypot(tx,ty,tz);if(length>1e-10){tx/=length;ty/=length;tz/=length;}else tx=ty=tz=0;
  const extension=point[0]<-.5?point[0]+.5:point[0]>.5?point[0]-.5:0,c=spine.centers[i],d=spine.centers[i+1];
  return out.set(mix(c[0],d[0],t)+tx*extension-tz*point[2],mix(c[1],d[1],t)+ty*extension+point[1],mix(c[2],d[2],t)+tz*extension+tx*point[2]);
}
export function createOcularBatch({THREE:T,data,count,palette}){
  const eyes=[],batches=[],sources=[];
  const up=new T.Vector3(0,1,0),dir=new T.Vector3(),spineQ=new T.Quaternion(),normalMatrix=new T.Matrix3();
  for(const eye of data.eyes||[]){
    if(!eye.center||!(eye.radius>0))continue;
    const normal=new T.Vector3().fromArray(eye.normal||eye.outward||[0,0,eye.center[2]<0?-1:1]).normalize(),baseQ=new T.Quaternion();
    if(eye.sourceFrame)baseQ.setFromRotationMatrix(new T.Matrix4().makeBasis(new T.Vector3().fromArray(eye.sourceFrame.x),new T.Vector3().fromArray(eye.sourceFrame.y),new T.Vector3().fromArray(eye.sourceFrame.normal)));
    else baseQ.setFromUnitVectors(new T.Vector3(0,0,1),normal);
    const R=eye.radius,localRadii=eye.localRadii||[R,R,R],opticAxis=new T.Vector3(0,0,1);
    if(Math.max(...localRadii)/Math.min(...localRadii)<1.2&&eye.sourceFrame){
      const opposite=data.eyes.find(e=>e.side!==eye.side),outward=new T.Vector3().fromArray(eye.center).sub(new T.Vector3().fromArray(opposite.center)).normalize();
      opticAxis.set(outward.dot(new T.Vector3().fromArray(eye.sourceFrame.x)),outward.dot(new T.Vector3().fromArray(eye.sourceFrame.y)),outward.dot(new T.Vector3().fromArray(eye.sourceFrame.normal))).normalize();
    }
    const material=new T.MeshPhysicalMaterial({color:0xffffff,roughness:.18,metalness:.04,clearcoat:1,clearcoatRoughness:.04});
    const oldInstanceNormal='mat3 im = mat3( instanceMatrix );\n\ttransformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );\n\ttransformedNormal = im * transformedNormal;';
    if(!T.ShaderChunk.defaultnormal_vertex.includes(oldInstanceNormal))throw Error('R07 instance normal shader contract changed');
    const exactNormal=T.ShaderChunk.defaultnormal_vertex.replace(oldInstanceNormal,'mat3 im = mat3( instanceMatrix );\n\ttransformedNormal = mat3(instanceNormalX,instanceNormalY,instanceNormalZ) * transformedNormal;');
    material.onBeforeCompile=s=>{s.uniforms.eyeOptic={value:opticAxis};s.uniforms.eyeIris={value:new T.Color(eye.irisColor||palette[data.id])};s.vertexShader='attribute vec3 instanceNormalX;attribute vec3 instanceNormalY;attribute vec3 instanceNormalZ;\nvarying vec3 eyeAddress;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <defaultnormal_vertex>',exactNormal).replace('#include <begin_vertex>','#include <begin_vertex>\neyeAddress=normalize(position);');s.fragmentShader='varying vec3 eyeAddress;uniform vec3 eyeIris;uniform vec3 eyeOptic;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
vec3 E=normalize(eyeAddress);float opticZ=dot(E,eyeOptic);float r=sqrt(max(0.0,1.0-opticZ*opticZ));float front=step(0.0,opticZ);float pupil=front*(1.0-smoothstep(.45,.48,r));float iris=front*(1.0-smoothstep(.78,.81,r));float theta=atan(E.y,E.x);float fibers=.87+.10*sin(theta*54.0+r*37.0)+.03*sin(theta*91.0-r*53.0);vec3 ocular=mix(vec3(.24,.29,.26),eyeIris*fibers,iris);ocular=mix(ocular,vec3(.002,.004,.006),pupil);ocular*=1.0-.32*front*smoothstep(.68,.79,r)*(1.0-smoothstep(.79,.82,r));diffuseColor.rgb*=ocular;`);};
    material.customProgramCacheKey=()=> 'MEASURED_KFE_DOMAINS_EXACT_INSTANCE_NORMAL_R07';
    const geometry=new T.SphereGeometry(R,36,24),batch=new T.InstancedMesh(geometry,material,count);
    for(const axis of AXES)geometry.setAttribute('instanceNormal'+axis,new T.InstancedBufferAttribute(new Float32Array(count*3),3).setUsage(T.DynamicDrawUsage));
    batch.name='source-eye-batch-'+data.id+'-'+eye.side;batch.frustumCulled=false;batch.instanceMatrix.setUsage(T.DynamicDrawUsage);
    const embed=eye.recommendedEmbedAlongNormal??eye.embedAlongNormal??0,normalArray=normal.toArray(),displayCenter=eye.center.map((v,k)=>v+normalArray[k]*embed);
    batches.push(batch);sources.push({eye,normal,baseQ,opticAxis,localRadii,displayCenter,geometry,material,batch,normalArrays:AXES.map(axis=>geometry.attributes['instanceNormal'+axis].array)});
  }
  for(let actor=0;actor<count;actor++){
    const head=new T.Group(),entry={actor,head,objects:[]};
    for(const source of sources){
      const {eye,geometry,material,batch}=source,globe=new T.Group(),gaze=new T.Group(),pupil=new T.Mesh(geometry,material);
      globe.position.fromArray(eye.center);globe.quaternion.copy(source.baseQ);globe.scale.fromArray(source.localRadii.map(v=>v/eye.radius));
      gaze.add(pupil);globe.add(gaze);head.add(globe);
      entry.objects.push({eye,globe,gaze,pupil,normal:source.normal.clone(),baseQ:source.baseQ.clone(),displayCenter:source.displayCenter.slice(),opticAxis:source.opticAxis.clone(),localRadii:source.localRadii,batch,normalArrays:source.normalArrays});
    }eyes.push(entry);
  }
  return {eyes,batches,
    updateActor(entry,actor,spine,id,ocular,matrix){
      entry.head.matrixAutoUpdate=false;entry.head.matrix.copy(matrix);entry.head.matrixWorldNeedsUpdate=true;
      for(const item of entry.objects){
        deformInto(item.globe.position,item.displayCenter,spine);
        const j=Math.floor(clamp(item.eye.center[0]+.5,0,1)*64),side=spine.binormals[Math.min(j,64)],theta=Math.atan2(side[0],side[2]);
        item.globe.quaternion.copy(spineQ.setFromAxisAngle(up,theta)).multiply(item.baseQ);
        const b=ocular.eyeBasis(actor.ocularR04,item.eye.side),e=actor.ocularR04.eyes[item.eye.side===-1?0:1],cy=Math.cos(e.yaw)*Math.cos(e.pitch),sy=Math.sin(e.yaw)*Math.cos(e.pitch),sp=Math.sin(e.pitch);
        // Keep R06 arithmetic order: vector scale, anterior add, then up add.
        dir.fromArray(b.localOptic).multiplyScalar(cy);
        dir.x+=b.localAnterior[0]*sy;dir.y+=b.localAnterior[1]*sy;dir.z+=b.localAnterior[2]*sy;
        dir.x+=b.localUp[0]*sp;dir.y+=b.localUp[1]*sp;dir.z+=b.localUp[2]*sp;
        dir.x/=item.localRadii[0];dir.y/=item.localRadii[1];dir.z/=item.localRadii[2];dir.normalize();
        item.gaze.quaternion.setFromUnitVectors(item.opticAxis,dir);
      }
      entry.head.updateMatrixWorld(true);
      for(const item of entry.objects){
        item.batch.setMatrixAt(entry.actor,item.pupil.matrixWorld);normalMatrix.getNormalMatrix(item.pupil.matrixWorld);
        const e=normalMatrix.elements,k=entry.actor*3;
        for(let axis=0;axis<3;axis++){const array=item.normalArrays[axis];array[k]=e[axis*3];array[k+1]=e[axis*3+1];array[k+2]=e[axis*3+2];}
      }
    },
    flush(visible=true){for(const batch of batches){batch.visible=visible;batch.instanceMatrix.needsUpdate=true;for(const axis of AXES)batch.geometry.attributes['instanceNormal'+axis].needsUpdate=true;}for(const e of eyes)e.head.visible=visible;},
    setVisible(visible){for(const batch of batches)batch.visible=visible;for(const e of eyes)e.head.visible=visible;},
    dispose(){for(const batch of batches){batch.removeFromParent();batch.dispose();batch.geometry.dispose();batch.material.dispose();}eyes.length=0;batches.length=0;}
  };
}
