/** Self-authored paired boxing choreography. No neural model is run here.
 * seconds is ONE shared canonical clock; the controller owns playback speed.
 * Eighteen composed programs, not eighteen primitives or random phase variants.
 * All responses below are planned choreography, not detected physical contacts.
 */
export const BOXING_CYCLE_SECONDS=16;
export const BOXING_PAIR_COUNT=18;
export const RECOMMENDED_PLAYBACK_SPEEDS=Object.freeze({quicker:1.14,original:1,slow:.55});
export const PRIMITIVE_ACTIONS=Object.freeze(['guard','jab','cross','hook','block','slip','duck','retreat','step-in','lateral-step','pivot-step','reset-distance']);
export const BOXING_MOTION_PROVENANCE=Object.freeze({author:'Self-authored paired choreography and native analytic FK/IK',sourceKind:'self-authored-procedural',neuralInferenceExecuted:false,captureSource:null,version:'boxing-motion-r03',units:'metres',upAxis:'Z',nativeForward:'-Y',rotationProtocol:'Anny local-ref rotation-vector degrees',pairCount:18,programCount:18,primitiveCount:PRIMITIVE_ACTIONS.length,childMode:'light non-contact target practice'});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const mod=(x,n)=>((x%n)+n)%n;
export const smooth=x=>{x=clamp(x,0,1);return x*x*x*(x*(x*6-15)+10);};
export function pulse(t,start,end,peak=.43){if(t<=start||t>=end)return 0;const k=(t-start)/(end-start);return k<peak?smooth(k/peak):1-smooth((k-peak)/(1-peak));}
const mix=(a,b,t)=>a+(b-a)*t;
const labels={guard:'守架',jab:'刺拳',cross:'后手直拳',hook:'前手短钩',block:'双手格挡',slip:'横向侧闪',duck:'屈膝下潜',retreat:'撤步让拳','step-in':'滑步进距','lateral-step':'横移换线','pivot-step':'转步换角','reset-distance':'重置距离',recover:'回收守架','counter-jab':'刺拳反击','counter-cross':'直拳反击','counter-hook':'短钩反击'};
// Attack tuples: [canonical start, actor, punch, planned defence, direction, counter].
// Duration varies by primitive for readable jab/cross/hook mechanics, not by shape.
const attackDuration={jab:.78,cross:.9,hook:.96};
// Authored phrase timings differ within each program: no global phase shift,
// seed jitter or per-character speed is used to simulate semantic diversity.
const phraseTimes=[
 [1.75,2.62,4.23,5.41,8.45,9.31,11.10],
 [2.4,3.15,4.7,5.7,8.0,8.7,10.4],
 [1.9,2.61,3.4,5.25,9.1,9.81,10.6,12.2],
 [1.4,2.3,4.1,5.18,8.35,9.2,11.3,12.35],
 [2.65,3.8,5.05,5.94,8.3,9.47,11.45],
 [1.65,2.61,4.3,5.4,9.4,10.37,11.75],
 [2.9,3.64,4.9,5.87,8.2,8.95,10.5],
 [1.55,2.74,4.45,9.0,10.19,13.55],
 [2.25,3.13,4.03,5.51,8.6,9.48,10.38,11.87],
 [1.65,2.51,3.62,5.1,9.3,10.16,11.27,12.4],
 [2.8,3.88,4.75,6.0,8.15,9.25,10.13],
 [1.45,2.5,3.62,4.84,8.75,9.8,10.92,13.2],
 [2.55,3.42,4.16,5.68,8.05,8.92,9.66,11.18],
 [1.7,2.65,4.04,5.25,9.2,10.15,11.4,12.48],
 [2.9,4.55,6.0,8.1,10.1,14.3],
 [2.15,3.27,4.64,5.88,8.3,9.4,10.76,12.0],
 [1.4,2.27,3.08,4.62,9.25,10.12,10.93,12.37],
 [2.5,3.64,4.45,5.97,8.25,9.39,10.2,11.73],
];
let authoredProgramIndex=0;
function program(id,label,description,attacks,travel){
 const pi=authoredProgramIndex++,times=phraseTimes[pi];
 const events=attacks.map(([,actor,kind,response,direction=1,counter=false],i)=>{const start=times[i];return Object.freeze({id:`${id}:attack-${i+1}`,start,end:start+attackDuration[kind],actor,kind,response,direction,counter,responseStart:start+.065,responseEnd:start+attackDuration[kind]+.19,responseSource:'planned-choreography'});});
 const movements=[];
 // Travel is actor-specific. Each two-foot shuffle has non-overlapping swing
 // windows and an explicit landing. Negative Y means advancing toward partner.
 for(let actor=0;actor<2;actor++){
  let p={x:0,y:0,yaw:0};
  for(const [start,end,kind,x,y,yaw=0]of travel[actor]){const to={x,y,yaw},lead=(kind==='retreat'||y>p.y)?'R':'L',other=lead==='L'?'R':'L',half=(end-start)/2,gap=.04;
   for(const [side,a,b]of [[lead,start,start+half-gap],[other,start+half+gap,end]])movements.push(Object.freeze({id:`${id}:step-${movements.length+1}`,actor,side,start:a,end:b,kind,from:{...p},to:{...to}}));p=to;
  }
  // Reset closes every foot trajectory with C2 position continuity. There is
  // at least one planted foot throughout, including at loop and round seams.
  for(const [side,start,end]of [['R',13.35+(pi%4)*.12,14.1+(pi%4)*.12],['L',14.25+(pi%4)*.12,15.1+(pi%4)*.12]])movements.push(Object.freeze({id:`${id}:reset-${actor}-${side}`,actor,side,start,end,kind:'reset-distance',from:{...p},to:{x:0,y:0,yaw:0}}));
 }
 return Object.freeze({id,semanticMotionId:`boxing.r03.${id}`,takeId:`boxing.r03.${id}.authored-take-01`,label,description,durationSeconds:BOXING_CYCLE_SECONDS,events:Object.freeze(events),movements:Object.freeze(movements),source:BOXING_MOTION_PROVENANCE,qualityStatus:'numeric-review-pending',semanticReviewStatus:'authored-distinct-program; visual-review-required'});
}
const E=(...x)=>x;const T=(...x)=>x;
export const BOXING_PROGRAMS=Object.freeze([
 program('double-jab-slip-return','双刺拳 · 两次侧闪回刺','进距双刺拳，两次交替侧闪后回刺；双方换角换手。',
 [E(2,0,'jab','slip',1),E(2.86,0,'jab','slip',-1),E(4.1,1,'jab','block',1,true),E(5.12,0,'cross','retreat'),E(8.65,1,'jab','slip',-1),E(9.52,1,'jab','slip',1),E(10.8,0,'jab','block',1,true)],
 [T([.15,1.6,'step-in',0,-.027],[6.65,8.1,'lateral-step',.038,-.015]),T([.2,1.7,'lateral-step',-.025,.008],[6.65,8.1,'step-in',0,-.023])]),
 program('one-two-high-shell','一二连击 · 高位格挡','刺拳接后手直拳，以高位双臂格挡，回直拳后重新建立距离。',
 [E(2,0,'jab','block'),E(2.69,0,'cross','block'),E(4.05,1,'cross','block',1,true),E(5.22,1,'jab','slip',-1),E(8.65,1,'jab','block'),E(9.34,1,'cross','block'),E(10.8,0,'cross','block',1,true)],
 [T([.1,1.65,'step-in',0,-.024],[6.55,8.1,'retreat',0,.018]),T([.15,1.7,'retreat',0,.018],[6.6,8.2,'step-in',0,-.024])]),
 program('jab-cross-hook-roll','一二三 · 下潜绕钩','三拳不同轨迹，直拳侧闪后屈膝穿过短钩，另一方以同组合接替。',
 [E(2,0,'jab','block'),E(2.68,0,'cross','slip',1),E(3.43,0,'hook','duck'),E(5.05,1,'cross','block',1,true),E(8.65,1,'jab','block'),E(9.33,1,'cross','slip',-1),E(10.08,1,'hook','duck'),E(11.7,0,'cross','block',1,true)],
 [T([.1,1.6,'step-in',.008,-.022],[6.7,8.25,'retreat',0,.023]),T([.1,1.6,'pivot-step',-.028,.012,-6],[6.7,8.25,'step-in',-.01,-.022])]),
 program('slip-cross-counter','外侧闪 · 直拳反击','以外侧头部位移让开刺拳，后手反击发生在对方回收窗口。',
 [E(2,0,'jab','slip',1),E(2.82,1,'cross','block',1,true),E(4.27,0,'cross','slip',-1),E(5.2,1,'jab','block',1,true),E(8.65,1,'jab','slip',-1),E(9.47,0,'cross','block',1,true),E(11,1,'cross','slip',1),E(11.95,0,'jab','block',1,true)],
 [T([.2,1.65,'step-in',0,-.018],[6.6,8.1,'lateral-step',-.035,.012]),T([.2,1.65,'lateral-step',.035,.012],[6.6,8.1,'step-in',0,-.018])]),
 program('duck-hook-counter','下潜避钩 · 短钩反击','钩拳来时屈膝降重心，起身时以前手钩回应，手套始终回守。',
 [E(2,0,'hook','duck'),E(3.14,1,'hook','block',1,true),E(4.6,0,'jab','block'),E(5.46,0,'hook','duck'),E(8.65,1,'hook','duck'),E(9.79,0,'hook','block',1,true),E(11.24,1,'cross','retreat')],
 [T([.1,1.6,'step-in',.012,-.02],[6.7,8.2,'pivot-step',-.028,.008,-7]),T([.1,1.6,'pivot-step',.026,.005,7],[6.7,8.2,'step-in',-.01,-.02])]),
 program('retreat-draw-cross','后撤诱拳 · 直拳迎击','前压刺拳被撤步拉空，再在对方回收时用后手迎击；第二轮交换追退角色。',
 [E(2,0,'jab','retreat'),E(2.93,0,'cross','retreat'),E(4.23,1,'cross','slip',1,true),E(5.28,1,'jab','block'),E(8.8,1,'jab','retreat'),E(9.73,1,'cross','retreat'),E(11.04,0,'cross','slip',-1,true)],
 [T([.2,1.65,'step-in',0,-.025],[6.6,8.25,'retreat',0,.032]),T([.2,1.65,'retreat',0,.032],[6.6,8.25,'step-in',0,-.025])]),
 program('lateral-jab-cross','横移换线 · 刺直组合','先横向滑步改变进攻线，再刺直组合；伙伴格挡与反向侧闪。',
 [E(2,0,'jab','block'),E(2.72,0,'cross','slip',-1),E(4.2,1,'jab','slip',1,true),E(5.18,1,'hook','block'),E(8.65,1,'jab','block'),E(9.37,1,'cross','slip',1),E(10.88,0,'hook','duck',1,true)],
 [T([.1,1.6,'lateral-step',.045,-.012],[6.6,8.15,'lateral-step',-.02,.012]),T([.1,1.6,'lateral-step',-.02,.012],[6.6,8.15,'lateral-step',-.045,-.012])]),
 program('pivot-hook-exit','转步短钩 · 退出重置','有支撑的转步带动髋肩短钩，以刺拳退出，再让另一方改变角度。',
 [E(2,0,'hook','block'),E(3.12,0,'jab','retreat'),E(4.65,1,'cross','slip',1,true),E(8.65,1,'hook','block'),E(9.77,1,'jab','retreat'),E(11.3,0,'cross','slip',-1,true)],
 [T([.15,1.7,'pivot-step',.035,-.015,9],[6.65,8.2,'retreat',.005,.026]),T([.15,1.7,'retreat',-.005,.026],[6.65,8.2,'pivot-step',-.035,-.015,-9])]),
 program('triple-jab-pressure','三刺推进 · 格挡侧闪','三次刺拳依次逼出格挡、外闪和内闪，守方以后手单次回击。',
 [E(1.9,0,'jab','block'),E(2.78,0,'jab','slip',1),E(3.66,0,'jab','slip',-1),E(5,1,'cross','block',1,true),E(8.65,1,'jab','block'),E(9.53,1,'jab','slip',-1),E(10.41,1,'jab','slip',1),E(11.74,0,'cross','block',1,true)],
 [T([.1,1.55,'step-in',0,-.035],[6.65,8.2,'retreat',0,.027]),T([.1,1.55,'retreat',0,.027],[6.65,8.2,'step-in',0,-.035])]),
 program('cross-hook-jab','直钩刺 · 三线转换','以后手起动、短钩横向收拢，再以刺拳结束，守方依次侧闪、下潜、格挡。',
 [E(2,0,'cross','slip',1),E(2.8,0,'hook','duck'),E(3.86,0,'jab','block'),E(5.13,1,'jab','retreat',1,true),E(8.65,1,'cross','slip',-1),E(9.45,1,'hook','duck'),E(10.51,1,'jab','block'),E(11.78,0,'jab','retreat',1,true)],
 [T([.15,1.7,'pivot-step',.025,-.019,6],[6.7,8.2,'lateral-step',-.022,.015]),T([.15,1.7,'lateral-step',.022,.015],[6.7,8.2,'pivot-step',-.025,-.019,-6])]),
 program('block-cross-hook','接拳护头 · 直钩回击','接住单刺后用后手与前钩的两段反击；反击者成为下一轮进攻者。',
 [E(2,0,'jab','block'),E(3,1,'cross','slip',1,true),E(3.82,1,'hook','duck',1,true),E(5.25,0,'jab','block'),E(8.65,1,'jab','block'),E(9.65,0,'cross','slip',-1,true),E(10.47,0,'hook','duck',1,true)],
 [T([.15,1.7,'step-in',.009,-.018],[6.6,8.15,'retreat',-.008,.024]),T([.15,1.7,'retreat',-.008,.024],[6.6,8.15,'step-in',.009,-.018])]),
 program('alternating-single-probes','交替试探 · 单拳换权','双方刺拳与后手交替，短攻短守反复交换主动，先试探再重置。',
 [E(2,0,'jab','slip',1),E(3,1,'jab','block',1,true),E(4,0,'cross','duck'),E(5.14,1,'cross','slip',-1,true),E(8.65,1,'jab','slip',-1),E(9.65,0,'jab','block',1,true),E(10.65,1,'cross','duck'),E(11.79,0,'cross','slip',1,true)],
 [T([.15,1.7,'lateral-step',.026,-.01],[6.65,8.2,'lateral-step',-.026,.01]),T([.15,1.7,'lateral-step',-.026,.01],[6.65,8.2,'lateral-step',.026,-.01])]),
 program('double-jab-cross-exit','双刺接直 · 后撤离线','双刺后接后手长线拳，守方封挡后侧闪；撤步期间交换压力。',
 [E(2,0,'jab','block'),E(2.87,0,'jab','block'),E(3.57,0,'cross','slip',1),E(5.02,1,'hook','duck',1,true),E(8.65,1,'jab','block'),E(9.52,1,'jab','block'),E(10.22,1,'cross','slip',-1),E(11.67,0,'hook','duck',1,true)],
 [T([.1,1.65,'step-in',-.012,-.028],[6.65,8.2,'retreat',.026,.03]),T([.1,1.65,'retreat',-.026,.03],[6.65,8.2,'step-in',.012,-.028])]),
 program('hook-cross-roll-counter','钩直接续 · 下潜直返','先用横向短钩压守，再后手直拳；防守者由下潜接侧闪并返直拳。',
 [E(2,0,'hook','duck'),E(2.88,0,'cross','slip',1),E(4.15,1,'cross','block',1,true),E(5.29,1,'hook','duck',1,true),E(8.65,1,'hook','duck'),E(9.53,1,'cross','slip',-1),E(10.8,0,'cross','block',1,true),E(11.94,0,'hook','duck',1,true)],
 [T([.1,1.65,'pivot-step',.031,-.016,8],[6.65,8.2,'pivot-step',-.018,.018,-5]),T([.1,1.65,'pivot-step',.018,.018,5],[6.65,8.2,'pivot-step',-.031,-.016,-8])]),
 program('long-jab-retreat-reset','长刺试距 · 退进重置','单次长刺与撤步让拳之间保留观察窗口，进退脚序清晰，双方轮流测试距离。',
 [E(2.1,0,'jab','retreat'),E(3.65,0,'jab','retreat'),E(5.1,1,'jab','block',1,true),E(8.8,1,'jab','retreat'),E(10.35,1,'jab','retreat'),E(11.8,0,'jab','block',1,true)],
 [T([.1,1.75,'step-in',0,-.032],[6.6,8.25,'retreat',0,.04]),T([.1,1.75,'retreat',0,.04],[6.6,8.25,'step-in',0,-.032])]),
 program('lateral-slip-hook-return','移位侧闪 · 短钩返身','刺拳引发侧闪与换线，钩拳反击配合髋肩；下一轮镜向交换。',
 [E(2,0,'jab','slip',-1),E(3.02,1,'hook','block',1,true),E(4.28,0,'cross','slip',1),E(5.42,1,'hook','duck',1,true),E(8.65,1,'jab','slip',1),E(9.67,0,'hook','block',1,true),E(10.93,1,'cross','slip',-1),E(12.07,0,'jab','block',1,true)],
 [T([.1,1.7,'lateral-step',-.038,-.015],[6.65,8.2,'lateral-step',.032,.018]),T([.1,1.7,'lateral-step',-.032,.018],[6.65,8.2,'lateral-step',.038,-.015])]),
 program('cross-jab-cross','直刺直 · 节奏换手','后手、前手、后手三段连击，守方封挡、側闪、撤步，随后以前钩反击。',
 [E(2,0,'cross','block'),E(2.82,0,'jab','slip',1),E(3.56,0,'cross','retreat'),E(5.02,1,'hook','block',1,true),E(8.65,1,'cross','block'),E(9.47,1,'jab','slip',-1),E(10.21,1,'cross','retreat'),E(11.67,0,'hook','block',1,true)],
 [T([.15,1.7,'step-in',.012,-.023],[6.65,8.2,'retreat',-.018,.031]),T([.15,1.7,'retreat',.018,.031],[6.65,8.2,'step-in',-.012,-.023])]),
 program('guard-counter-role-exchange','守反两轮 · 攻防换权','守方先格挡直拳再回刺直；另一方以钩拳重新取得主动，整轮有明确角色交接。',
 [E(2,1,'cross','block'),E(3.1,0,'jab','slip',1,true),E(3.84,0,'cross','retreat',1,true),E(5.26,1,'hook','duck'),E(8.65,0,'cross','block'),E(9.75,1,'jab','slip',-1,true),E(10.49,1,'cross','retreat',1,true),E(11.91,0,'hook','duck')],
 [T([.15,1.7,'retreat',-.014,.028],[6.65,8.2,'step-in',.014,-.022]),T([.15,1.7,'step-in',-.014,-.022],[6.65,8.2,'retreat',.014,.028])]),
]);
// Legacy UI compatibility; these are now the 18 composed programs.
export const BOXING_VARIANTS=BOXING_PROGRAMS;
export const BOXING_EVENTS=BOXING_PROGRAMS[0].events;
export function resolveBoxingProgram(pairIndex=0,{programId,programIndex,roundIndex=0}={}){
 if(!Number.isFinite(pairIndex))throw Error('pairIndex must be finite');
 if(programIndex!==undefined&&!Number.isInteger(programIndex))throw Error('programIndex must be an integer');
 if(programId!==undefined){const p=BOXING_PROGRAMS.find(p=>p.id===programId||p.semanticMotionId===programId);if(!p)throw Error('Unknown boxing semantic program: '+programId);return p;}
 if(!Number.isInteger(roundIndex)||roundIndex<0)throw Error('roundIndex must be a nonnegative integer');
 return BOXING_PROGRAMS[mod(programIndex===undefined?Math.floor(pairIndex)+roundIndex:Math.floor(programIndex),18)];
}
export function sampleFootwork(program,t,fighter,side,{child=false}={}){
 let x=0,y=0,yaw=0;for(const e of program.movements){if(e.actor!==fighter||e.side!==side||t<e.start)continue;
  if(t<e.end){const u=(t-e.start)/(e.end-e.start),v=smooth(u),k=child?.68:1;return {x:mix(e.from.x,e.to.x,v)*k,y:mix(e.from.y,e.to.y,v)*k,yaw:mix(e.from.yaw,e.to.yaw,v),lift:Math.sin(Math.PI*u)**4*(child?.009:.014),contact:false,swing:u,kind:e.kind,eventId:e.id};}
  x=e.to.x;y=e.to.y;yaw=e.to.yaw;
 }return {x:x*(child?.68:1),y:y*(child?.68:1),yaw,lift:0,contact:true,swing:0,kind:'guard',eventId:null};
}
export function sampleBoxingPair(seconds,pairIndex=0,options={}){
 if(!Number.isFinite(seconds))throw Error('Boxing time must be finite');
 const {child=false,roundIndex=0}=options,program=resolveBoxingProgram(pairIndex,options),t=mod(seconds,BOXING_CYCLE_SECONDS),rolePass=Math.floor(roundIndex/18)%2;
 const actors=[0,1].map(fighter=>({fighter,authoredRole:fighter^rolePass,jab:0,cross:0,hook:0,slip:0,duck:0,block:0,retreat:0,windup:0,counter:false,phase:'guard',attackPhase:'guard',defensePhase:'guard',opponentAction:'guard',activeAttackId:null,plannedResponses:[]}));
 for(const e of program.events){const p=pulse(t,e.start,e.end),q=pulse(t,e.responseStart,e.responseEnd,.49),a=actors[e.actor^rolePass],d=actors[(1-e.actor)^rolePass];
  a[e.kind]=1-(1-a[e.kind])*(1-p);a.windup+=pulse(t,e.start-.20,e.start+.06)*.10;
  if(p>0){a.counter ||= e.counter;a.phase=(e.counter?'counter-':'')+e.kind;a.attackPhase=t<e.start+(e.end-e.start)*.43?'extension':'recovery';a.activeAttackId=e.id;d.opponentAction=e.kind;}
  if(e.response==='slip')d.slip+=q*e.direction;else d[e.response]=1-(1-d[e.response])*(1-q);
  if(q>0){d.defensePhase=e.response;d.plannedResponses.push({causedByAttackId:e.id,source:'planned-choreography',kind:e.response,weight:q});if(d.jab+d.cross+d.hook<.03)d.phase=e.response;}
 }
 for(const a of actors){a.attack=Math.max(a.jab,a.cross,a.hook);a.footwork={L:sampleFootwork(program,t,a.authoredRole,'L',{child}),R:sampleFootwork(program,t,a.authoredRole,'R',{child})};if(a.phase==='guard'){const step=Object.values(a.footwork).find(s=>!s.contact);a.phase=step?.kind||'guard';}a.breath=Math.sin(t*Math.PI/2+a.fighter*.65);a.child=child;a.label=labels[a.phase]||a.phase;a.variant=program.label;a.variantId=program.id;a.variantIndex=BOXING_PROGRAMS.indexOf(program);a.semanticMotionId=program.semanticMotionId;a.takeId=program.takeId;}
 return {schema:'boxing-authored-pair-state/3',time:t,canonicalSeconds:seconds,cycle:BOXING_CYCLE_SECONDS,pairIndex:mod(Math.floor(pairIndex),18),phaseOffset:0,speed:1,actors,child,program,semanticMotionId:program.semanticMotionId,takeId:program.takeId,variant:program.label,variantId:program.id,variantIndex:BOXING_PROGRAMS.indexOf(program),roundIndex,rolePass,responseMeaning:'planned evasions are not physical contacts'};
}
/** Data-only runtime allocation. This is not the reviewed native-bake planner. */
export function createProgramRound(roundIndex=0){return {schema:'boxing-live-authored-round/3',roundIndex,rolePass:Math.floor(roundIndex/18)%2,clock:'one shared canonical time; no phase offsets',arenas:Array.from({length:18},(_,pairIndex)=>{const p=resolveBoxingProgram(pairIndex,{roundIndex});return {pairIndex,programIndex:BOXING_PROGRAMS.indexOf(p),semanticMotionId:p.semanticMotionId,takeId:p.takeId};})};}
