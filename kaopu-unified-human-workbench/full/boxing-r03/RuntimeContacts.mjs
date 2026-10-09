import {AnnyProxyAdapter} from '../../collision-architecture/AnnyProxyAdapter.mjs';
import {CollisionWorld} from '../../collision-architecture/CollisionWorld.mjs';
import {ContactResponse} from '../../collision-architecture/ContactResponse.mjs';
import {stepWithConservativePruning} from './CollisionPruning.mjs';
const pointKey=p=>`${p.actorId}:${p.bodyRegion||p.hand}`;
const lightActor=a=>['child','teen'].includes(a.preset.stage);
const punchActive=(actor,hand)=>{const s=actor.latest?.state;return !!s&&(hand==='L'?Math.max(s.jab||0,s.hook||0):s.cross||0)>.02;};

/** Engine/animation bridge. Planned dodges are never fabricated contact events.
 * Visual people stay complete; all adult hands retain separation re-arm checks.
 * Light child/teen programmes are deliberately outside the contact experiment.
 */
export class RuntimeContacts {
  static async create(actors){return new RuntimeContacts(actors,await AnnyProxyAdapter.create(actors),await CollisionWorld.create());}
  constructor(actors,adapter,world){this.actors=actors;this.adapter=adapter;this.world=world;this.response=new ContactResponse();this.previous=null;this.events=[];this.serial=0;this.potentialPairs=0;this.broadPhaseRejected=0;this.mode='safe';this.responseEnabled=true;}
  capture(){
    const s=this.adapter.capture();
    // Both defending fists are genuine blocking targets, not just the head behind them.
    for(const a of s.attacks)s.targets.push({pairId:a.pairId,actorId:a.actorId,bodyRegion:`glove.${a.hand}`,center:a.center.slice(),radius:a.radius,halfHeight:0,rotation:[0,0,0,1]});
    return s;
  }
  reset(){this.previous=null;this.events=[];this.serial=0;this.potentialPairs=0;this.broadPhaseRejected=0;this.response.reset();this.world.reset();}
  seed(){this.previous=this.capture();}
  integrateResponse(dt){this.response.step(dt);}
  step({time,dt,canonicalTime=time,canonicalStep=dt}){
    const current=this.capture(),previous=this.previous;this.previous=current;if(!previous)return [];
    const oldA=new Map(previous.attacks.map(p=>[pointKey(p),p])),oldT=new Map(previous.targets.map(p=>[pointKey(p),p]));
    const eligible=p=>!lightActor(this.actors[p.actorId]);
    const attacks=current.attacks.filter(eligible).map(p=>({...p,from:oldA.get(pointKey(p)).center,to:p.center}));
    const targets=current.targets.filter(eligible).map(p=>({...p,from:oldT.get(pointKey(p)).center,to:p.center,rotation:oldT.get(pointKey(p)).rotation}));
    const result=stepWithConservativePruning(this.world,{time,dt,attacks,targets});this.potentialPairs+=result.potentialPairs;this.broadPhaseRejected+=result.broadPhaseRejected;
    for(const e of result.events){
      e.eventId=`jolt-r03-${++this.serial}`;e.canonicalTime=canonicalTime-canonicalStep+canonicalStep*e.toi;e.attackIntent=punchActive(this.actors[e.attackerId],e.hand)?'active-punch':'incidental-contact';e.blockedByGlove=e.bodyRegion.startsWith('glove.');e.mode=this.mode;e.responseApplied=false;
      if(this.mode==='contact'&&this.responseEnabled&&e.attackIntent==='active-punch'&&!e.blockedByGlove){e.responseApplied=true;this.response.accept(e,{height:this.actors[e.defenderId].human.height});}
      this.events.push(e);
    }
    if(this.events.length>2048)this.events.splice(0,this.events.length-2048);
    return result.events;
  }
  diagnostics(){return {mode:this.mode,responseEnabled:this.responseEnabled,totalEvents:this.serial,storedEvents:this.events.length,lastEvent:this.events.at(-1)||null,potentialPairs:this.potentialPairs,broadPhaseRejected:this.broadPhaseRejected,engine:this.world.diagnostics(),shapeFingerprints:this.adapter.shapeFingerprints,lightModeActorsExcluded:this.actors.filter(lightActor).length,guardTargets:true,collisionGeometry:'neutral-shape-fitted capsule bands/head sphere and glove spheres',rotatingTargetCCD:false,rigidBodyDynamics:false};}
  dispose(){this.world.dispose();}
}
