// Independent mathematical examples for the fictional game. Not railway equipment control.
export const gameFrame={up:'Y',forward:'Z',across:'X',unit:'declared game unit; teacher scale not calibrated'};
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
export function transformPoint(m,p){const q=[...p,1],v=[0,0,0,0];for(let row=0;row<4;row++)for(let c=0;c<4;c++)v[row]+=m[c*4+row]*q[c];if(Math.abs(v[3])<1e-12)throw Error('Invalid homogeneous coordinate');return v.slice(0,3).map(x=>x/v[3]);}
export function anchorError(worldA,anchorA,worldB,anchorB){const a=transformPoint(worldA,anchorA),b=transformPoint(worldB,anchorB);return Math.hypot(...a.map((x,i)=>x-b[i]));}
export function crankPin({center,radius,phase,angle}){return[center[0],center[1]+radius*Math.sin(angle+phase),center[2]+radius*Math.cos(angle+phase)];}
export function sliderCrank({angle,phase=0,radius,rodLength}){if(!(rodLength>radius&&radius>=0))throw Error('Rod length must exceed crank radius');const a=angle+phase,y=radius*Math.sin(a);return radius*Math.cos(a)+Math.sqrt(rodLength*rodLength-y*y);}
export function overlaps(a,b){return a.min.every((v,i)=>v<=b.max[i]&&a.max[i]>=b.min[i]);}
export function placeBuilding({side,z,width,depth,height,railHalfWidth,clearance,setback=0,groundY=0,cameraVolumes=[]}){if(![-1,1].includes(side)||[width,depth,height].some(x=>!(x>0))||[railHalfWidth,clearance,setback].some(x=>x<0))throw Error('Invalid building layout');const inner=railHalfWidth+clearance+setback,center=[side*(inner+depth/2),groundY+height/2,z],half=[depth/2,height/2,width/2],box={min:center.map((v,i)=>v-half[i]),max:center.map((v,i)=>v+half[i])};return{center,frontNormal:[-side,0,0],bounds:box,cameraConflicts:cameraVolumes.map((b,i)=>overlaps(box,b)?i:null).filter(i=>i!==null)};}
export function facadeGrid({floors,bays,floorHeight,bayWidth,side,frontX,baseY=0,centerZ=0}){if(!Number.isInteger(floors)||!Number.isInteger(bays)||floors<1||bays<1||floorHeight<=0||bayWidth<=0||![-1,1].includes(side))throw Error('Invalid facade grid');return Array.from({length:floors*bays},(_,i)=>{const f=Math.floor(i/bays),b=i%bays;return{floor:f,bay:b,point:[frontX,baseY+(f+.5)*floorHeight,centerZ+(b-(bays-1)/2)*bayWidth],normal:[-side,0,0]}});}
export function crossingInitial(){return{worldTime:0,phase:'OPEN',gate:0,elapsed:0};}
export function stepCrossing(previous,input,dt,{warningSeconds=2,gateSeconds=4}={}){
 if(!Number.isFinite(dt)||dt<0||warningSeconds<=0||gateSeconds<=0)throw Error('Invalid world time');
 const s={...previous};s.worldTime+=dt;let left=dt;
 if(!input.powered||!input.roadClear){s.phase='FAULT';s.elapsed=0;return s}
 if(s.phase==='FAULT'){if(!input.reset||input.occupied)return s;s.phase='LOWERING';s.elapsed=0}
 if(input.occupied&&s.phase!=='CLOSED'&&s.phase!=='TRAIN_IN'){s.phase='FAULT';return s}
 if(s.phase==='CLOSED'&&input.occupied)s.phase='TRAIN_IN';
 if(s.phase==='TRAIN_IN'&&!input.occupied&&!input.request){s.phase='OPENING';s.elapsed=0}
 if(s.phase==='OPEN'&&input.request){s.phase='PREWARN';s.elapsed=0}
 if(s.phase==='OPENING'&&input.request){s.phase='LOWERING';s.elapsed=0}
 for(let i=0;i<8;i++){
  if(s.phase==='PREWARN'){const q=Math.min(left,warningSeconds-s.elapsed);s.elapsed+=q;left-=q;if(s.elapsed>=warningSeconds){s.phase='LOWERING';s.elapsed=0;continue}}
  else if(s.phase==='LOWERING'){const q=Math.min(left,(1-s.gate)*gateSeconds);s.gate=clamp(s.gate+q/gateSeconds,0,1);left-=q;if(s.gate>=1-1e-12){s.gate=1;s.phase='CLOSED';s.elapsed=0;continue}}
  else if(s.phase==='OPENING'){const q=Math.min(left,s.gate*gateSeconds);s.gate=clamp(s.gate-q/gateSeconds,0,1);left-=q;if(s.gate<=1e-12){s.gate=0;s.phase='OPEN';s.elapsed=0;continue}}
  break;
 }
 return s;
}
export function crossingOutputs(s,input){const fault=s.phase==='FAULT'||!input.powered||!input.roadClear,active=s.phase!=='OPEN',half=Math.floor(s.worldTime/.5)%2;return{roadProceed:!fault&&s.phase==='OPEN'&&s.gate===0&&!input.occupied,railProceed:!fault&&s.phase==='CLOSED'&&s.gate===1&&!input.occupied,gateAngleRadians:s.gate*Math.PI/2,redLampLeft:active&&half===0,redLampRight:active&&half===1,bell:active&&s.phase!=='FAULT',fault};}
