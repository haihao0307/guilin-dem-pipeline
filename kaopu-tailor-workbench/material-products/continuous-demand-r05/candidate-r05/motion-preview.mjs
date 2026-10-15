import {NativeMotion} from './native-motion.mjs';
/** Explicit native-person inspection. Garments are hidden while physics is paused. */
export class MotionPreview {
 constructor({actor,viewer,items,status}){this.motion=new NativeMotion(actor);this.viewer=viewer;this.items=items;this.status=status;this.active=false;this.running=false;this.time=0;this.id='walk';}
 show(){this.active=true;for(const item of this.items())item.solid.group.visible=false;this.viewer.mesh.visible=true;}
 play(id){if(!['walk','run','jump'].includes(id))throw Error('请选择走、跑、跳检查原生动作');this.pause();this.show();this.id=id;this.time=0;this.motion.evaluate({});this.motion.currentLocalPose=null;this.motion.beginMotion(id);this.running=true;this.last=performance.now();const tick=now=>{if(!this.running)return;this.time+=(now-this.last)/1000;this.last=now;this.motion.at(id,this.time);this.viewer.platformBinding.animate(this.motion.skin);this.viewer.render();this.status(`人物动作检查 · ${id==='walk'?'走路':id==='run'?'跑步':'跳跃'} ${this.time.toFixed(2)} 秒 · 衣物隐藏，物理暂停`);if(id==='jump'&&this.time>=this.motion.clips[id].duration){this.pause();return;}this.raf=requestAnimationFrame(tick);};this.raf=requestAnimationFrame(tick);}
 pause(){this.running=false;if(this.raf)cancelAnimationFrame(this.raf);this.raf=0;}
 hide(){this.pause();this.active=false;for(const item of this.items())item.solid.group.visible=true;}
 audit(){return{active:this.active,running:this.running,motion:this.id,wallTimeSeconds:this.time,clothVisible:!this.active,physicsSimulated:false};}
}
