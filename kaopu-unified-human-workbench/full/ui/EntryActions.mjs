/** Explicit entry intent -> existing native workbench modes. No new motion solver. */
export const ENTRY_ACTIONS=Object.freeze({
 shape:{label:'人物与五官',mode:'shape',view:'face',play:false},
 perimeter:{label:'擂台对练',mode:'perimeter',view:'three',play:true,focus:'0'},
 outside:{label:'场外三人走跑跳',mode:'perimeter',view:'three',play:true,focus:'perimeter'},
 walk:{label:'原捕捉步行',mode:'activity',clip:'walk',view:'three',play:true},
 run:{label:'原捕捉跑步',mode:'activity',clip:'run',view:'three',play:true},
 jump:{label:'原捕捉小跳',mode:'activity',clip:'jump',view:'three',play:true},
 hand:{label:'原手部联动验证',mode:'hand',view:'hands',play:true},
 reaction:{label:'过去观测驱动侧闪验证',mode:'reaction',view:'three',play:true}
});
export async function activateEntry(studio,key,{isCurrent=()=>true}={}){
 const intent=ENTRY_ACTIONS[key];if(!intent)throw new RangeError('未知总台入口');
 if(!studio)throw new Error('动作模块尚未载入。原人物与五官参数仍可使用。');
 if(intent.clip){studio.activityClip=intent.clip;const select=studio.$?.('motion-clip');if(select)select.value=intent.clip;}
 const original=studio.controller?.archive?.();
 try{if(!(intent.mode==='perimeter'&&studio.mode==='perimeter'&&studio.crowd&&!studio.modeBusy))await studio.setMode(intent.mode);}
 catch(error){if(!isCurrent())return{applied:false,reason:'superseded'};if(!studio.destroyed){await studio.setMode('shape');if(!isCurrent()||studio.mode!=='shape'||studio.modeBusy)return{applied:false,reason:'superseded'};if(original)studio.controller.restore(original);}throw new Error('场景载入失败，已恢复原人物，可重新点击：'+error.message,{cause:error});}
 if(!isCurrent())return {applied:false,reason:'superseded'};
 if(studio.modeBusy)throw new Error('动作模块仍在载入；未开始播放');
 if(studio.mode!==intent.mode)throw new Error(studio.$?.('motion-status')?.textContent||'当前参数不满足此动作模式条件');
 if(intent.focus){const select=studio.$?.('motion-focus');if(select)select.value=intent.focus;}
 studio.view(intent.view);studio.setPlaying(intent.play);
 return {applied:true,key,mode:studio.mode,playing:studio.playing};
}
