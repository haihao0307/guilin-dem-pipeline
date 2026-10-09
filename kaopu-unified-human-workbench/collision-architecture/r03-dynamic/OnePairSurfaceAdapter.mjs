import {SurfaceNarrowPhase} from './SurfaceNarrowPhase.mjs';
import {snapshotGlove} from './MeshSurfaceContact.mjs';
import {FixedStepCollisionWorld} from './FixedStepCollisionWorld.mjs';

/** Experimental single-pair bridge, matching the existing boxing actor fields.
 * Run AFTER both complete rig poses and root transforms are updated at each
 * physical step. It updates the actual articulated glove geometry, but leaves
 * the human GPU upload to the render pass. No proxy/glove sphere is consulted.
 * This reports contact episodes; it does not apply forces, score punches, or
 * certify frame rate. Reset explicitly after any seek or shape replacement.
 */
export class OnePairSurfaceAdapter {
  constructor(actors, {fixedStepSeconds=1/120, geometryRevisions, separationSteps=2}={}) {
    if (actors.length!==2) throw Error('This adapter requires exactly two actors');
    if (!Array.isArray(geometryRevisions)||geometryRevisions.length!==2||geometryRevisions.some(x=>typeof x!=='string'||!x)) throw Error('Two actual shape/recipe revisions are required');
    if (!Number.isInteger(separationSteps)||separationSteps<1) throw Error('Invalid separation step count');
    this.actors=actors;
    this.revisions=[...geometryRevisions];
    this.fixedStepSeconds=fixedStepSeconds;
    this.separationSteps=separationSteps;
    this.world=new FixedStepCollisionWorld({fixedStepSeconds});
    this.surfaces=actors.map(actor=>new SurfaceNarrowPhase(actor.human));
    this.gates=new Map();
  }
  reset() { this.world.reset();this.gates.clear(); }
  advance({sampleTime,canonicalTime=null}) {
    const started=performance.now();
    const frames=this.actors.map((actor,i)=>{
      if (!actor.latest?.skinMatrices||!actor.latest?.posedMatrices||actor.gloves?.length!==2) throw Error('Actor is missing its complete current pose or actual glove meshes');
      if (actor.human!==this.surfaces[i].human) throw Error('Human replaced: rebuild the pair adapter');
      actor.group.updateWorldMatrix(true,false);
      for (const glove of actor.gloves) glove.updateFromPose(actor.latest.posedMatrices,actor.human.height);
      return {
        id:String(i),surface:this.surfaces[i],
        body:this.surfaces[i].snapshot(actor.latest.skinMatrices,actor.group.matrixWorld.elements),
        gloves:actor.gloves.map(snapshotGlove),geometryRevision:this.revisions[i],collisionGroup:'single-pair',
      };
    });
    const captureMs=performance.now()-started,queryStart=performance.now(),result=this.world.advance(frames,{sampleTime,canonicalTime}),queryMs=performance.now()-queryStart,events=[];
    for (const contact of result.contacts) {
      const key=contact.attacker+':'+contact.hand;
      const gate=this.gates.get(key)||{latched:false,separated:0};this.gates.set(key,gate);
      // Unknown geometry cannot reset the gate or confirm an impact.
      if (contact.unresolved) continue;
      if (!contact.hit) {
        if (++gate.separated>=this.separationSteps) gate.latched=false;
        continue;
      }
      gate.separated=0;
      if (gate.latched) continue;
      gate.latched=true;
      const target=contact.hit,hit=target.hit,relativeVelocity=hit.relativeDisplacement.map(x=>x/this.fixedStepSeconds),closingSpeed=relativeVelocity.reduce((sum,x,k)=>sum+x*hit.normal[k],0);
      events.push({
        schema:'actual-surface-contact-episode/1',attackerId:contact.attacker,defenderId:target.target,
        hand:this.actors[Number(contact.attacker)].gloves[contact.hand].side,kind:target.kind,
        bodyRegion:hit.bodyRegion,contactPoint:[...hit.contactPoint],normal:[...hit.normal],relativeVelocity,
        closingSpeed,toi:hit.toi,sampleTime,canonicalTime,
        initialOverlap:hit.initialOverlap,impactEligible:!hit.initialOverlap&&closingSpeed>.2,
        source:'full CSR skin / actual articulated glove continuous triangle geometry',
        triangleId:hit.triangleId,attackerTriangleId:hit.attackerTriangleId,
      });
    }
    return {...result,events,timing:{captureMs,queryMs,totalMs:performance.now()-started}};
  }
}
