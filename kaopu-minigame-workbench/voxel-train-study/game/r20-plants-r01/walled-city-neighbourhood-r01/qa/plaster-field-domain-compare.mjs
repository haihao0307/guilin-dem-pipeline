// Host-owned GPU QA only. This module never launches a browser or publishes.
// Frozen geometry is deliberate: the A/B must not include the new building plan.
import {makeBuildingRecipe} from '../versions/def55598/building-plan.mjs';
import {makeSurfacePlan} from '../versions/def55598/surface-plan.mjs';
import {createNativePlaster} from '../plaster-native/plaster-native.mjs';
import {makeMetricPlasterField} from '../plaster-native/metric-field-domain.mjs';

export async function runPlasterFieldDomainComparison({THREE,renderer,report=async()=>{}}={}) {
  if(!THREE || !renderer?.getContext) throw Error('Supply the host Three and renderer');
  const recipe=makeBuildingRecipe(), plan=makeSurfacePlan(recipe), gl=renderer.getContext();
  const size=renderer.getDrawingBufferSize(new THREE.Vector2());
  const camera=new THREE.PerspectiveCamera(43,size.x/size.y,.05,150);
  const shots=[], modes=[];
  const auditWall=recipe.walls.find(w=>w.id==='E8-right');
  if(!auditWall)throw Error('Frozen single-wall fixture changed');
  const middleY=auditWall.bottom+auditWall.height/2;
  const views=[
    {name:'wall-front',position:[10,middleY,-1.65],target:[3.7,middleY,-1.65]},
    {name:'wall-grazing',position:[6.8,middleY+.45,3.3],target:[3.7,middleY,-1.65]},
  ];
  const priorClear=renderer.getClearColor(new THREE.Color()), priorAlpha=renderer.getClearAlpha();
  const priorViewport=renderer.getViewport(new THREE.Vector4()),priorScissor=renderer.getScissorTest(),priorTarget=renderer.getRenderTarget();
  try {
    const logicalSize=renderer.getSize(new THREE.Vector2());
    renderer.setRenderTarget(null);renderer.setViewport(0,0,logicalSize.x,logicalSize.y);renderer.setScissorTest(false);
    renderer.setClearColor(0xaaaead,1);
    for(const mode of ['legacy-tall-domain','metric-1_8m']) {
      const scene=new THREE.Scene(), made=[];
      let buildMs=0;
      try {
        const start=performance.now();
        for(const wall of [auditWall]) for(const coat of plan.walls.find(p=>p.wallId===wall.id).coatings) {
          const params=mode==='legacy-tall-domain' ? coat.params : {
            ...coat.params,
            ...makeMetricPlasterField({center:coat.params.center,metresPerUnit:1.8}),
          };
          const m=createNativePlaster({THREE,parentWall:wall,...coat,params,name:coat.id});
          m.mesh.userData.auditWall=wall;
          scene.add(m.mesh);made.push(m);
        }
        scene.updateMatrixWorld(true);buildMs=performance.now()-start;
        const metrics=made.reduce((a,m)=>({objects:a.objects+1,triangles:a.triangles+m.proof.triangles,bufferBytes:a.bufferBytes+m.proof.bufferBytes}),{objects:0,triangles:0,bufferBytes:0});
        modes.push({mode,buildMs,metrics});
        for(const view of views) {
          camera.position.fromArray(view.position);camera.lookAt(...view.target);camera.updateMatrixWorld(true);
          const times=[];
          for(let frame=0;frame<3;frame++) {
            const t=performance.now();renderer.render(scene,camera);
            const pixels=new Uint8Array(size.x*size.y*4);
            gl.readPixels(0,0,size.x,size.y,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
            const error=gl.getError();
            times.push({frame,completedMs:performance.now()-t,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,glError:error});
            if(error)throw Error('Plaster field comparison GL error '+error);
          }
          const shot={name:`plaster-${mode}-${view.name}`,position:view.position,target:view.target,times,firstCompletedMs:times[0].completedMs,warmMeanCompletedMs:(times[1].completedMs+times[2].completedMs)/2,png:renderer.domElement.toDataURL()};
          shots.push(shot);await report({stage:'shot',...shot});
        }
      } finally {for(const m of made)m.dispose();}
    }
    return {baselineCommit:'def55598b6f6b9570365a50a718fa3faa3c742e3',fixtureWallId:auditWall.id,modes,shots,waterEnabled:false,otherMaterialsPresent:false,sourceFunctionsChanged:false,addedNoise:false,geometryRefinement:false,timingMeaning:'First completed frame may include program compilation; subsequent frames are warm readback timings. No hardware-GPU claim.',visualAcceptance:false};
  } finally {
    renderer.setClearColor(priorClear,priorAlpha);renderer.setRenderTarget(priorTarget);
    renderer.setViewport(priorViewport);renderer.setScissorTest(priorScissor);
  }
}
