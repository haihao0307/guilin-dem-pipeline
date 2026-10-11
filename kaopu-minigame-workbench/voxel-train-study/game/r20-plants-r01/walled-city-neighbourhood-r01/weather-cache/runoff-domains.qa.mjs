// Host-owned, bounded same-camera material A/B; requires the integration option
// described in runoff-domains.integration.md. No browser launch or second RAF.
import {buildNeighbourhood} from '../neighbourhood.mjs';
import {makeBuildingRecipe} from '../building-plan.mjs';

export async function runRunoffDomainComparison({THREE,renderer,report=async()=>{},build=buildNeighbourhood}={}){
  if(!THREE||!renderer?.getContext)throw Error('Supply the host Three and renderer');
  const size=renderer.getDrawingBufferSize(new THREE.Vector2()),gl=renderer.getContext(),shots=[],modes=[];
  const clear=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha(),viewport=renderer.getViewport(new THREE.Vector4()),target=renderer.getRenderTarget(),scissor=renderer.getScissorTest();
  const recipe=makeBuildingRecipe(),camera=new THREE.PerspectiveCamera(43,size.x/size.y,.05,150);
  const views=[
    {name:'borrowed-door',position:[-.2,7,-8.6],target:[-2.2,6.55,-4.65],level:2},
    {name:'street-eye',position:[4,1.7,12],target:[0,8,-.2],level:-1},
  ];
  const windowWall=recipe.walls.find(w=>w.id==='W1-front'),window=windowWall?.openings.find(o=>o.kind==='window');
  if(window)views.push({name:'actual-sill',position:[window.center+.65,windowWall.bottom+1,windowWall.fixed+3.1],target:[window.center,windowWall.bottom+.85,windowWall.fixed],level:-1});
  try{
    const logical=renderer.getSize(new THREE.Vector2());renderer.setRenderTarget(null);renderer.setViewport(0,0,logical.x,logical.y);renderer.setScissorTest(false);renderer.setClearColor(0xaaaead,1);
    for(const runoff of [false,true]){
      let hood;
      try{
        const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xd8e5e7,0x666252,2));const light=new THREE.DirectionalLight(0xffeed9,2.5);light.position.set(-4,9,6);scene.add(light);
        const start=performance.now();hood=build({THREE,renderer,recipe,runoff});scene.add(hood.root);const buildMs=performance.now()-start;
        if(runoff&&!hood.surfacePlan.runoffProof)throw Error('Host ignored runoff=true; integrate the candidate before A/B');
        const materialSet=new Set();let missing=0;
        hood.root.traverse(mesh=>{for(const material of (Array.isArray(mesh.material)?mesh.material:[mesh.material]))if(material?.uniforms?.nativeWaterStrength){materialSet.add(material);if(runoff&&!material.uniforms.nativeRunoffCount)missing++;}});
        if(missing)throw Error('Candidate has '+missing+' unbound water materials');
        const mode=runoff?'finite-source-runoff':'legacy-building-domain';
        modes.push({mode,buildMs,metrics:hood.metrics(),runoffProof:hood.surfacePlan.runoffProof||null,runoffCacheMetrics:hood.proof.runoffCaches||null,waterMaterials:materialSet.size,sourceOrigins:runoff?hood.surfacePlan.walls.flatMap(w=>w.runoff.sources.map(s=>({wallId:w.wallId,...s}))):[]});
        for(const view of views){
          hood.setFocusLevel(view.level);if(view.level<0)hood.setCutaway(false);hood.setDoor('borrowed-gate',true);hood.update(14*3600);hood.setWaterEnabled(true);
          camera.position.fromArray(view.position);camera.lookAt(...view.target);camera.updateMatrixWorld(true);hood.updateVisibility(camera);
          const times=[];for(let frame=0;frame<2;frame++){
            const t=performance.now();renderer.render(scene,camera);const pixels=new Uint8Array(size.x*size.y*4);gl.readPixels(0,0,size.x,size.y,gl.RGBA,gl.UNSIGNED_BYTE,pixels);const error=gl.getError();
            times.push({frame,completedMs:performance.now()-t,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,glError:error});if(error)throw Error('Runoff A/B GL error '+error);
          }
          const shot={name:'runoff-'+mode+'-'+view.name,position:view.position,target:view.target,inspectionLevel:view.level,times,png:renderer.domElement.toDataURL()};shots.push(shot);await report({stage:'shot',...shot});
        }
      }finally{hood?.dispose();}
    }
    return {modes,shots,sameRecipe:true,sameCameras:true,wetStrengthUnchanged:true,sourceKernelChanged:false,newStochasticKernel:false,visualAcceptance:false};
  }finally{renderer.setClearColor(clear,alpha);renderer.setRenderTarget(target);renderer.setViewport(viewport);renderer.setScissorTest(scissor);}
}
