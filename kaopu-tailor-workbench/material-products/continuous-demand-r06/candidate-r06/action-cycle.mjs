/** Advance demonstrations by committed simulation time, never by wall timers. */
export class ActionCycle{
 constructor({play,onChange,onError}){this.play=play;this.onChange=onChange;this.onError=onError;this.active=false;this.busy=false;this.index=0;this.cycles=0;this.sequence=[{id:'walk',seconds:6},{id:'run',seconds:6},{id:'jump',seconds:3.2}];}
 stop(){this.active=false;this.onChange?.(this);}
 async start(){if(this.busy)return;this.active=true;this.index=0;this.cycles=0;this.onChange?.(this);await this.advance(false);}
 async advance(next=true){if(!this.active||this.busy)return;this.busy=true;try{if(next){this.index=(this.index+1)%this.sequence.length;if(!this.index)this.cycles++;}await this.play(this.sequence[this.index].id);}catch(error){this.stop();this.onError?.(error);}finally{this.busy=false;this.onChange?.(this);}}
 update(audit){if(this.active&&!this.busy&&audit?.motion===this.sequence[this.index].id&&audit.motionTime>=this.sequence[this.index].seconds)void this.advance();}
 audit(){return{active:this.active,busy:this.busy,index:this.index,cycles:this.cycles,clock:'committed simulation time',cachedCloth:false};}
}
