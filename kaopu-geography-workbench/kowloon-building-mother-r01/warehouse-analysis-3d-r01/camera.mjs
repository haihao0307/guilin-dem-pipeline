const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function createCamera(bounds){const target=bounds.min.map((v,i)=>(v+bounds.max[i])/2),radius=Math.hypot(...bounds.max.map((v,i)=>(v-bounds.min[i])/2));return{target,radius,yaw:-2.16,pitch:.32,distance:radius*3.4,fov:42};}
export function orbit(c,dx,dy){c.yaw-=dx*.007;c.pitch=clamp(c.pitch+dy*.007,-.8,1.35);}
export function zoom(c,factor){if(!Number.isFinite(factor)||factor<=0)return;c.distance=clamp(c.distance*factor,c.radius*1.4,c.radius*8);}
export function cameraEye(c){const h=c.distance*Math.cos(c.pitch);return[c.target[0]+h*Math.sin(c.yaw),c.target[1]+c.distance*Math.sin(c.pitch),c.target[2]+h*Math.cos(c.yaw)];}
const sub=(a,b)=>a.map((v,i)=>v-b[i]),norm=a=>{const n=Math.hypot(...a);return a.map(v=>v/n);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function cameraRay(c,x,y,aspect){const eye=cameraEye(c),forward=norm(sub(c.target,eye)),right=norm(cross(forward,[0,1,0])),up=cross(right,forward),t=Math.tan(c.fov*Math.PI/360);return{eye,direction:norm(forward.map((v,i)=>v+right[i]*x*t*aspect+up[i]*y*t))};}
// A gesture is a tap only when it stayed single-pointer and moved < 8 CSS px.
export function bindGestures(canvas,c,changed,picked,{signal}={}){const points=new Map;let tap=null;
 const distance=()=>{const [a,b]=[...points.values()];return Math.hypot(a.x-b.x,a.y-b.y);};
 canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;points.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture?.(e.pointerId);tap=points.size===1?{id:e.pointerId,x:e.clientX,y:e.clientY,valid:true}:null;},{signal});
 canvas.addEventListener('pointermove',e=>{const old=points.get(e.pointerId);if(!old)return;const before=points.size===2?distance():null,dx=e.clientX-old.x,dy=e.clientY-old.y;points.set(e.pointerId,{x:e.clientX,y:e.clientY});if(tap&&Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>=8)tap.valid=false;if(points.size===1)orbit(c,dx,dy);else if(points.size===2){tap=null;const after=distance();if(after>0&&before>0)zoom(c,before/after);}changed();},{signal});
 const end=(e,cancel=false)=>{if(!points.has(e.pointerId))return;const wasTap=!cancel&&points.size===1&&tap?.id===e.pointerId&&tap.valid&&Math.hypot(e.clientX-tap.x,e.clientY-tap.y)<8;points.delete(e.pointerId);tap=null;if(wasTap)picked(e.clientX,e.clientY);};
 canvas.addEventListener('pointerup',e=>end(e),{signal});canvas.addEventListener('pointercancel',e=>end(e,true),{signal});canvas.addEventListener('lostpointercapture',e=>end(e,true),{signal});canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(c,Math.exp(clamp(e.deltaY,-200,200)*.002));changed();},{passive:false,signal});
 return()=>{points.clear();tap=null;};}
