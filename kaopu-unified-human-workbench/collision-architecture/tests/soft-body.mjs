import assert from 'node:assert/strict';
import {CollisionWorld} from '../CollisionWorld.mjs';
/** Small original material-free solver fixture, inspired by the official
 * soft_body example. It is not a garment, fit, sewing or self-collision test.
 */
async function run(withCollider){
 const w=await CollisionWorld.create(),J=w.J,bi=w.world.GetPhysicsSystem().GetBodyInterface(),owned=[],own=x=>(owned.push(x),x),ids=[];
 const origin=own(new J.RVec3(0,0,0)),q=own(new J.Quat(0,0,0,1));
 if(withCollider){const shape=new J.SphereShape(.5),p=own(new J.RVec3(0,.5,0)),settings=own(new J.BodyCreationSettings(shape,p,q,J.EMotionType_Static,0)),body=bi.CreateBody(settings);bi.AddBody(body.GetID(),J.EActivation_DontActivate);ids.push(body.GetID());}
 const shared=new J.SoftBodySharedSettings(),vertex=own(new J.SoftBodySharedSettingsVertex()),N=9,spacing=.2;
 for(let z=0;z<N;z++)for(let x=0;x<N;x++){const p=own(new J.Float3((x-4)*spacing,1.15,(z-4)*spacing));vertex.mPosition=p;vertex.mInvMass=((x===0||x===N-1)&&(z===0||z===N-1))?0:1;shared.mVertices.push_back(vertex);}
 const face=own(new J.SoftBodySharedSettingsFace(0,0,0,0));
 for(let z=0;z<N-1;z++)for(let x=0;x<N-1;x++){const a=z*N+x,b=a+1,c=a+N,d=c+1;for(const tri of [[a,c,d],[a,d,b]]){tri.forEach((v,i)=>face.set_mVertex(i,v));shared.AddFace(face);}}
 const attrs=own(new J.SoftBodySharedSettingsVertexAttributes());attrs.mCompliance=.0001;attrs.mShearCompliance=.0001;shared.CreateConstraints(attrs,1);shared.Optimize();
 const settings=own(new J.SoftBodyCreationSettings(shared,origin,q,0));settings.mUpdatePosition=false;settings.mVertexRadius=.01;settings.mNumIterations=8;settings.mAllowSleeping=false;
 const body=bi.CreateSoftBody(settings);bi.AddBody(body.GetID(),J.EActivation_Activate);ids.push(body.GetID());const motion=J.castObject(body.GetMotionProperties(),J.SoftBodyMotionProperties),vertices=motion.GetVertices();
 let minimumDistance=Infinity;for(let frame=0;frame<360;frame++){w.world.Step(1/120,1);for(let i=0;i<vertices.size();i++){const p=vertices.at(i).mPosition,d=Math.hypot(p.GetX(),p.GetY()-.5,p.GetZ());if(!Number.isFinite(d))throw Error('Non-finite soft body');minimumDistance=Math.min(minimumDistance,d);}}
 const center=vertices.at(40).mPosition,result={withCollider,center:[center.GetX(),center.GetY(),center.GetZ()],minimumSphereDistance:minimumDistance,particles:vertices.size(),steps:360};
 for(const id of ids){bi.RemoveBody(id);bi.DestroyBody(id);}for(let i=owned.length-1;i>=0;i--)J.destroy(owned[i]);w.dispose();return result;
}
const collider=await run(true),control=await run(false);assert(collider.minimumSphereDistance>control.minimumSphereDistance+.1);assert(collider.minimumSphereDistance>=.49);console.log(JSON.stringify({passed:true,solver:'Jolt WASM soft-body dynamics',collider,control,garmentFitCertified:false,skinnedConstraintsRuntimeTested:false,selfCollision:false,interSoftBodyCollision:false},null,2));
