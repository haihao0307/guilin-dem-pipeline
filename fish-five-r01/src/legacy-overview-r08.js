// Camera coverage only. The source habitat, accepted trajectories, body/fin
// fields and original projection/interaction implementation stay authoritative.
export function fitLegacyOverview(api){
 const r=api.renderer,c=r.camera,draw=r.draw.bind(r),setView=c.setView.bind(c),setSchool=r.setSchool.bind(r),resetAll=r.resetAll.bind(r);
 let enabled=true,fitted=null,lastTime=null;
 function reset(){enabled=true;fitted=null;lastTime=null;if(r.state.school){c.zoom=1;c.distance=5.5;}}
 function manual(){if(r.state.school)enabled=false;}
 function pan(e){if(e.button===2||e.shiftKey)manual();}
 r.canvas.addEventListener('wheel',manual,{capture:true,passive:true});
 r.canvas.addEventListener('pointerdown',pan,{capture:true,passive:true});
 c.setView=(...args)=>{const result=setView(...args);reset();return result;};
 r.setSchool=(...args)=>{const result=setSchool(...args);reset();return result;};
 r.resetAll=(...args)=>{const result=resetAll(...args);reset();return result;};
 r.draw=(...args)=>{
  if(r.state.school&&enabled){
   const cp=Math.cos(c.pitch),zx=cp*Math.sin(c.yaw),zy=Math.sin(c.pitch),zz=cp*Math.cos(c.yaw);
   // Exact lookAt basis, including the original top/bottom up conventions.
   const uz=c.upMode==='NEG_Z'?-1:c.upMode==='POS_Z'?1:0,uy=uz?0:1;
   let xx=uy*zz-uz*zy,xy=uz*zx,xz=-uy*zx;const inverse=1/Math.max(1e-12,Math.hypot(xx,xy,xz));xx*=inverse;xy*=inverse;xz*=inverse;
   const yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;
   const tanH=Math.tan(62*Math.PI/360/c.zoom),tanV=tanH*Math.max(.05,r.canvas.height/Math.max(1,r.canvas.width));
   const views=api.schoolR08.views;let required=5.5;
   // uploadPoses has installed the actual interpolated display position here.
   // A sphere encloses all eight corners of the unmodified animated source OBB.
   for(let i=0;i<r.school.fish.length;i++){
    const p=r.school.fish[i].p,dx=p[0]-c.target[0],dy=p[1]-c.target[1],dz=p[2]-c.target[2],radius=Math.hypot(...views[i].half);
    const depth=dx*zx+dy*zy+dz*zz,right=dx*xx+dy*xy+dz*xz,up=dx*yx+dy*yy+dz*yz;
    required=Math.max(required,depth+radius+(Math.abs(right)+radius)/tanH,depth+radius+(Math.abs(up)+radius)/tanV);
   }
   const time=r.school.time,dt=lastTime===null?1/60:Math.max(0,Math.min(.1,time-lastTime));lastTime=time;
   const goal=required*1.08;
   fitted=fitted===null?goal:Math.max(goal,fitted+(goal-fitted)*(1-Math.exp(-dt*4)));
   c.distance=fitted;
  }
  return draw(...args);
 };
 const result={get enabled(){return enabled;},get fittedDistance(){return fitted;},reset,
  dispose(){r.draw=draw;c.setView=setView;r.setSchool=setSchool;r.resetAll=resetAll;r.canvas.removeEventListener('wheel',manual,true);r.canvas.removeEventListener('pointerdown',pan,true);}};
 api.schoolOverviewR08=result;return result;
}
