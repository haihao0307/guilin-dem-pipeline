/** Original, bounded animation reaction, NOT a Jolt rigid-body impulse solve.
 * Contacts must come from the collision engine. No scheduled fake hits.
 * Output is in Y-up world metres/radians for an upper-body pose compositor.
 */
export class ContactResponse {
 constructor(){this.actors=new Map();}
 state(id){if(!this.actors.has(id))this.actors.set(id,{offset:[0,0,0],velocity:[0,0,0],head:[0,0,0],headVelocity:[0,0,0],lastContact:null});return this.actors.get(id);}
 accept(event,{height=1.75}={}){
  if(!event.source?.startsWith('JoltPhysics.js/')||!event.contactPoint?.every(Number.isFinite)||!(event.closingSpeed>0))throw Error('A verified geometric hit event is required');
  const s=this.state(event.defenderId),strength=Math.min(event.closingSpeed,5)*.22*height/1.75;
  for(let k=0;k<3;k++)s.velocity[k]+=event.normal[k]*strength;
  if(event.bodyRegion==='head'){s.headVelocity[0]+=event.normal[2]*Math.min(event.closingSpeed,5)*.8;s.headVelocity[2]-=event.normal[0]*Math.min(event.closingSpeed,5)*.8;}
  s.lastContact=structuredClone(event);
 }
 step(dt){
  if(!(dt>0&&dt<=1/120+1e-9))throw Error('Response requires fixed dt <=1/120');
  const integrate=(x,v,k,d,max)=>{for(let i=0;i<3;i++){v[i]+=(-k*x[i]-d*v[i])*dt;x[i]+=v[i]*dt;}const n=Math.hypot(...x);if(n>max){for(let i=0;i<3;i++)x[i]*=max/n;const outward=v.reduce((s,a,i)=>s+a*x[i],0);if(outward>0)for(let i=0;i<3;i++)v[i]-=outward*x[i]/(max*max);}};
  for(const s of this.actors.values()){integrate(s.offset,s.velocity,95,19,.065);integrate(s.head,s.headVelocity,120,21,.2);}
 }
 reset(){this.actors.clear();}
}
