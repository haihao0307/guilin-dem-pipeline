const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),unit=a=>a.map(v=>v/Math.hypot(...a)),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
// Camera culling changes display query coverage, never world/physics state.
// Near-plane crossings remain conservative full-viewport queries.
export function projectCameraQueryBounds({eye,target,position,bounds,width,height,basis,tanHalfFov=.34,pixelPad=2,numericMargin=0,relativeMargin=0,pixelConeHalfWidth=0}){
 const f=basis?.f||unit(sub(target,eye)),r=basis?.r||unit(cross(f,[0,1,0])),up=basis?.up||cross(r,f),points=[],corners=[];let minZ=Infinity,maxZ=-Infinity,maxDistance=0;
 for(let i=0;i<8;i++){const p=[0,1,2].map(k=>(i&(1<<k)?bounds.high[k]:bounds.low[k])+position[k]),q=sub(p,eye),z=dot(q,f);corners.push({q,z});minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);maxDistance=Math.max(maxDistance,Math.hypot(...q));}
 const margin=Math.max(numericMargin,relativeMargin*maxDistance);if(maxZ<-margin)return{x:0,y:0,w:0,h:0,fullyVisible:false,classification:'behind-camera'};
 const support=4*(margin+Math.max(0,maxZ)*2*tanHalfFov*pixelConeHalfWidth/height),horizontal=tanHalfFov*width/height;
 for(const [axis,sign,scale]of [[r,1,horizontal],[r,-1,horizontal],[up,1,tanHalfFov],[up,-1,tanHalfFov]])if(corners.every(({q,z})=>sign*dot(q,axis)-scale*z>support))return{x:0,y:0,w:0,h:0,fullyVisible:false,classification:'outside-frustum'};
 if(minZ<=margin)return{x:0,y:0,w:width,h:height,fullyVisible:false,classification:'camera-crossing-conservative'};
 for(const {q,z}of corners)points.push([(dot(q,r)/z/tanHalfFov/(width/height)*.5+.5)*width,(dot(q,up)/z/tanHalfFov*.5+.5)*height]);
 const x0=Math.floor(Math.min(...points.map(p=>p[0]))-pixelPad),y0=Math.floor(Math.min(...points.map(p=>p[1]))-pixelPad),x1=Math.ceil(Math.max(...points.map(p=>p[0]))+pixelPad),y1=Math.ceil(Math.max(...points.map(p=>p[1]))+pixelPad);return{x:Math.max(0,x0),y:Math.max(0,y0),w:Math.max(0,Math.min(width,x1)-Math.max(0,x0)),h:Math.max(0,Math.min(height,y1)-Math.max(0,y0)),fullyVisible:x0>=0&&y0>=0&&x1<=width&&y1<=height,classification:'projected'};
}
