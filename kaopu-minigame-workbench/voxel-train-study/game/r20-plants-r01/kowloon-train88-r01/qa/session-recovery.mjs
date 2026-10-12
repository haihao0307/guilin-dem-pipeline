// Diagnostic command sequence over the existing Session. Never constructs a
// Session, mutates its state fields, or starts a second physics integrator.
const snapshot=game=>structuredClone({...game.view(),actors:game.actors.map(a=>({...a,position:a.position.slice()}))});
export function runSessionRecovery(game,{driveTicks=30,brakeTicks=90}={}){
 for(const n of[driveTicks,brakeTicks])if(!Number.isInteger(n)||n<1||n>120)throw Error('Bounded Session tick count required');
 const before=snapshot(game);if(!before.started||!before.paused||before.phase==='summary')throw Error('Retained paused driving Session required');
 const commands=[];const command=(type,value)=>{const result=game.command(type,value);commands.push({tick:game.tick,type,value,result});if(!result.accepted)throw Error('Recovery command rejected: '+type);};
 command('pause',false);command('brake',false);for(let i=0;i<driveTicks;i++)game.advance(1/30);const driven=snapshot(game);
 command('brake',true);for(let i=0;i<brakeTicks;i++)game.advance(1/30);const braked=snapshot(game);
 command('pause',true);const paused=snapshot(game);
 return{before,driven,braked,paused,commands,requested:{driveTicks,brakeTicks,sessionStepS:1/30},scope:'actual original Session command/tick state; not wheel geometry quality, input-device or complete journey acceptance'};
}
export function validateSessionRecovery(result){
 const{before:a,driven:b,braked:c,paused:d,requested:q}=result;
 if(b.tick!==a.tick+q.driveTicks||c.tick!==b.tick+q.brakeTicks||d.tick!==c.tick)throw Error('Wrong original Session tick advancement');
 if(b.paused||c.paused||!d.paused)throw Error('Recovery pause sequence failed');
 if(!(b.distance>a.distance&&c.distance>b.distance&&d.distance===c.distance))throw Error('Original distance did not advance then pause');
 for(const [prev,next]of[[a,b],[b,c]]){if(!(next.physics.tick>prev.physics.tick&&next.physics.timeS>prev.physics.timeS&&next.physics.wheelAngleRad>prev.physics.wheelAngleRad))throw Error('Original physical wheel state did not advance');const ds=next.distance-prev.distance,dr=(next.physics.wheelAngleRad-prev.physics.wheelAngleRad)*next.physics.wheelRadiusM;if(Math.abs(ds-dr)>1e-8)throw Error('Wheel distance convention changed');}
 if(!c.brake||c.physics.controls.brake!==1||!(c.physics.brakeFraction>b.physics.brakeFraction&&c.physics.diagnostics.brakeForceN>b.physics.diagnostics.brakeForceN&&c.physics.ledger.brakeLossJ>b.physics.ledger.brakeLossJ&&c.velocity<b.velocity))throw Error('Original brake did not build force, dissipate energy and slow the train');
 const identities=s=>s.actors.map(a=>[a.id,a.appearance]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));for(const s of[b,c,d])if(JSON.stringify(identities(s))!==JSON.stringify(identities(a)))throw Error('Actor identity changed during bounded recovery');
 return{tickRange:[a.tick,d.tick],distanceRangeM:[a.distance,d.distance],wheelAngleRangeRad:[a.physics.wheelAngleRad,d.physics.wheelAngleRad],physicalTickRange:[a.physics.tick,d.physics.tick],speedMps:[a.velocity,b.velocity,c.velocity],brakeForceN:[b.physics.diagnostics.brakeForceN,c.physics.diagnostics.brakeForceN],brakeLossAddedJ:c.physics.ledger.brakeLossJ-b.physics.ledger.brakeLossJ,actorCount:d.actors.length,paused:d.paused,scope:result.scope};
}
