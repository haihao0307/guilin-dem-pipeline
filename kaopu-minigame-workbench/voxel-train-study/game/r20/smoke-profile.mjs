// The classic 160-particle motion/density profile, kept renderer-independent for exact regression checks.
export const SMOKE_COUNT=160,LOWER_COUNT=84,PLATFORM_TOP=.82;
export function classicSmokeParticle(index,t){
  const lower=index<84,lifetime=lower?1.5:3,f=((t/lifetime+index*.618033989)%1+1)%1,side=index%2?1:-1,emit=lower?3.4-(index%12)*.75:.6-(index%8)*.78;
  const position=[emit-f*(lower?2.4:3.4),(lower?.58:1.4)+f*(lower?1.45:3.6)+.10*Math.sin(index*3+t*Math.PI*2/3),side*((lower?1.1:.75)+f*(lower?.24:.55))+.08*Math.sin(index+t*Math.PI/3)];
  const size=(lower?.78+f*1.5:1.15+f*1.9)*(1+(index%5)*.065);
  return{index,lower,f,side,position,size,opacity:Math.sin(Math.PI*f)*(lower?.91:.44),rotation:index+f*.8,upper:!lower,color:lower?0xffffff:0x8f9eab};
}
const smooth=(a,b,x)=>{const u=Math.max(0,Math.min(1,(x-a)/(b-a)));return u*u*(3-2*u);};
export function smokeFrameState(view,{tallExhaust=false}={}){
  const event=(view?.events||[]).filter(e=>e.type==='doors-opening'||e.type==='approach-steam').at(-1),burstAge=event?(view.tick-event.tick)/30:99,remaining=Number(view?.station?.remaining)||0;
  const near=remaining<55&&remaining>-10,draining=!!view&&near&&(Math.abs(view.velocity||0)<9||view.brake||view.door>0),burstActive=!!view&&near&&burstAge>=0&&burstAge<8;
  const burst=burstActive?Math.min(1,burstAge/.35)*(1-smooth(3.8,8,burstAge)):0;
  return{tallExhaust,starting:tallExhaust&&view?.throttle>0&&Math.abs(view?.velocity||0)<4.5,exhaustSpeed:Math.abs(view?.velocity||0),draining,burstAge,burstActive,burst,platformOffset:Math.max(-8,Math.min(8,remaining)),working:Math.abs(view?.velocity||0)>.3&&view?.throttle>0,profile:'classic-layered-160',roundBillboards:true,platformTop:PLATFORM_TOP,platformCentersAboveDeck:draining||burstActive};
}
export function smokeParticle(index,t,state={}){
  const p=classicSmokeParticle(index,t);
  if(!p.lower&&state.tallExhaust){
    const lift=state.starting?11.8:8.4,trail=2.5+Math.min(state.exhaustSpeed||0,14)*.24;
    p.position=[3.03-(index%8)*.40-p.f*trail,3.72+Math.max(0,p.f*lift+.15*Math.sin(index*3+t*2)),p.side*(.24+p.f*.55)];
    p.size*=state.starting?1.52:1.22;p.opacity*=state.starting?1.3:1.08;return p;
  }
  if(!p.lower||(!state.draining&&!state.burstActive))return p;
  const u=Math.floor(index/2)/41,front=p.side>0,spread=state.burstActive?Math.min(29,5+state.burstAge*13):29;
  // Drain vapour rolls ONTO the timber deck, then rises around passengers. Never flatten it below the boards.
  p.position=[3.45-u*spread+(state.platformOffset||0)-p.f*.35,PLATFORM_TOP+.58+p.f*1.18+.09*Math.sin(index*3+t*2),front?2.55+p.f*1.95:-1.15-p.f*.65];
  p.size*=front?1.30:1.06;
  p.opacity*=front?(state.burstActive?.78+.22*state.burst:.48):.65;
  return p;
}
