// Explicit inferred finite-thickness assembly. Original fields and baseline unchanged.
(function(){const D=DYNAMIC,G=D.gresleySolver,S=STACK_CANDIDATE,hidden=new Set(S.suppress);
SCENE.sources.stack=S.source;SCENE.parts.push(...S.parts);
D.visible=(part,installation)=>part.source==='stack'?installation.mode==='candidate':!(installation.mode==='candidate'&&hidden.has(part.id));
const oldArg=D.argument,oldBounds=D.bounds,oldFrame=D.gresleyFrame;
D.argument=(part,p='p')=>part.source==='stack'?`dynGresley(${p})`:oldArg(part,p);
D.gresleyFrame=(part,theta,installation=D.snapshot())=>part.source==='stack'?G.transformFor(part.frameSourceId,theta):oldFrame(part,theta,installation);
D.bounds=function(part,theta,installation=D.snapshot()){if(part.source!=='stack')return oldBounds(part,theta,installation);const f=D.gresleyFrame(part,theta,installation),pts=Array.from({length:8},(_,i)=>G.transformPoint([0,1,2].map(j=>i&(1<<j)?part.aabb_max[j]:part.aabb_min[j]),f));return [[0,1,2].map(j=>Math.min(...pts.map(p=>p[j]))-1e-6),[0,1,2].map(j=>Math.max(...pts.map(p=>p[j]))+1e-6)];};
})();
