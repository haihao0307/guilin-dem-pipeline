// Focus on an intersection with the actual rendered triangles. No substitute mesh.
let activeFocus=null;
function surfaceHit(clientX,clientY){
    const rect=canvas.getBoundingClientRect(),asp=canvas.width/canvas.height;
    const E=eyePos(),forward=norm(sub(state.target,E)),right=norm(cross(forward,[0,1,0])),up=cross(right,forward);
    const tangent=Math.tan((innerWidth<640?.75:.61)/2);
    const sx=((clientX-rect.left)/rect.width*2-1)*tangent*asp,sy=(1-(clientY-rect.top)/rect.height*2)*tangent;
    const D=norm(add(forward,add(mul(right,sx),mul(up,sy))));
    let nearest=Infinity,hit=null;
    for(const part of parts){
        if(part.cap||part.kind>2)continue;
        const a=part.vertices,I=part.indices,stride=part.stride||16;
        for(let i=0;i<I.length;i+=3){
            const i0=I[i]*stride,i1=I[i+1]*stride,i2=I[i+2]*stride;
            const x=a[i0],y=a[i0+1],z=a[i0+2];
            const e1x=a[i1]-x,e1y=a[i1+1]-y,e1z=a[i1+2]-z,e2x=a[i2]-x,e2y=a[i2+1]-y,e2z=a[i2+2]-z;
            const px=D[1]*e2z-D[2]*e2y,py=D[2]*e2x-D[0]*e2z,pz=D[0]*e2y-D[1]*e2x;
            const det=e1x*px+e1y*py+e1z*pz;if(Math.abs(det)<1e-10)continue;
            const inv=1/det,tx=E[0]-x,ty=E[1]-y,tz=E[2]-z,u=(tx*px+ty*py+tz*pz)*inv;if(u<0||u>1)continue;
            const qx=ty*e1z-tz*e1y,qy=tz*e1x-tx*e1z,qz=tx*e1y-ty*e1x,v=(D[0]*qx+D[1]*qy+D[2]*qz)*inv;if(v<0||u+v>1)continue;
            const t=(e2x*qx+e2y*qy+e2z*qz)*inv;if(t<=.001||t>=nearest)continue;
            nearest=t;let N=norm([e1y*e2z-e1z*e2y,e1z*e2x-e1x*e2z,e1x*e2y-e1y*e2x]);if(dot(N,D)>0)N=mul(N,-1);
            hit={point:add(E,mul(D,t)),normal:N,part:part.name,triangle:i/3,rayDistance:t,viewDirection:mul(D,-1)};
        }
    }
    return hit;
}
function focusSurface(clientX=innerWidth/2,clientY=innerHeight/2,distance=1.8){
    const hit=surfaceHit(clientX,clientY);if(!hit){toast('请双击可见的岩石表面');return false;}
    activeFocus=hit;viewName='micro';state.section=false;state.selected=0;
    setCamera(add(hit.point,mul(hit.viewDirection,distance)),hit.point);
    views.micro=[eyePos(),hit.point.slice()];sync();
    $$('[data-view]').forEach(e=>e.classList.toggle('active',e.dataset.view==='micro'));
    return true;
}
function guardFocus(){
    if(viewName!=='micro'||!activeFocus)return;
    const v=norm(sub(eyePos(),state.target)),N=activeFocus.normal,d=dot(v,N);
    if(d<.24){const tangent=sub(v,mul(N,d)),safe=norm(add(tangent,mul(N,.30)));setCamera(add(state.target,mul(safe,state.radius)),state.target);}
}
