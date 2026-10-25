// Finite mathematical control closure in the RETAINED INFERRED horizontal placement.
// No middle chest or historic installation is supplied; original plate overlap remains.
(function(){const D=DYNAMIC,G=createGresleySolver(SCENE,D,D.outsideValveSolver);D.gresleySolver=G;
 D.isCentralControl=part=>G.classify(part.id).status==='moving';
 D.gresleyFrame=function(part,theta,installation=D.snapshot()){return installation.mode==='candidate'&&D.isCentralControl(part)?G.transformFor(part.id,theta):null;};
 const priorArgument=D.argument,priorBounds=D.bounds,priorState=D.state;
 D.argument=function(part,p='p'){return D.isCentralControl(part)?`dynGresley(${p})`:priorArgument(part,p);};
 D.bounds=function(part,theta,installation=D.snapshot()){const f=D.gresleyFrame(part,theta,installation);if(!f)return priorBounds(part,theta,installation);const pts=Array.from({length:8},(_,i)=>G.transformPoint([0,1,2].map(j=>i&(1<<j)?part.aabb_max[j]:part.aabb_min[j]),f));return [[0,1,2].map(j=>Math.min(...pts.map(p=>p[j]))-1e-6),[0,1,2].map(j=>Math.max(...pts.map(p=>p[j]))+1e-6)];};
 D.state=function(Time,Location={},ObjectState={}){const s=priorState(Time,Location,ObjectState);if(s.installation.mode==='candidate'){s.frozen=['trucks','connections'];s.middleControl='finite closure in retained inferred horizontal location; plate overlap known; no middle chest';}return s;};
 D.glsl+=`\nuniform vec3 gresleyInverseRow0,gresleyInverseRow1;\nvec3 dynGresley(vec3 p){vec3 q=vec3(p.xz,1.);p.xz=vec2(dot(gresleyInverseRow0,q),dot(gresleyInverseRow1,q));return p;}\n`;
})();
