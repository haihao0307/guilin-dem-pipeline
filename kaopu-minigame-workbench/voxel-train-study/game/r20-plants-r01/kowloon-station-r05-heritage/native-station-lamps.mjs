// Accepted R02 lamp/sign construction, rebuilt as metric analytic functions.
// Frozen source: station-recipe.mjs @ f31df978916876205355664593b0299f027188ad.
// The proper rotation is old(x,y,z) -> station(z,y,-x). Its determinant is +1.
// Source beam cross-sections are evaluated before that rotation, never mirrored.
const add=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]);
const mul=(a,n)=>a.map(x=>x*n),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const sourceToStation=p=>[p[2],p[1],-p[0]];
export const stationToSource=p=>[-p[2],p[1],p[0]];
export function sourceBeamBasis(axis){const w=mul(axis,1/Math.hypot(...axis));const u=w[1]>-.999999?[1-w[0]*w[0]/(1+w[1]),-w[0],-w[2]*w[0]/(1+w[1])]:[-1,0,0];return[u,w,cross(u,w)];}
export function sourceShapeMember(id,shape,materialRole,feature,extras={}){
 const beam=shape.type==='beam',center=beam?mul(add(shape.a,shape.b),.5):shape.center;
 const sourceFrame=sourceBeamBasis(beam?sub(shape.b,shape.a):[0,1,0]);
 const radius=Math.max(shape.radius||0,shape.radiusTop||0);
 const extent=beam?[shape.width/2,Math.hypot(...sub(shape.b,shape.a))/2,shape.depth/2]:shape.type==='box'?shape.size.map(x=>x/2):[radius,shape.height/2,radius];
 return{id,type:shape.type,materialRole,feature,sourceShape:shape,sourceFrame,center:sourceToStation(center),extent,frame:sourceFrame.map(sourceToStation),...(beam?{a:sourceToStation(shape.a),b:sourceToStation(shape.b),width:shape.width,depth:shape.depth}:shape.type==='box'?{size:[shape.size[2],shape.size[1],shape.size[0]]}:{radius:shape.radius,topRadius:shape.radiusTop??shape.radius,height:shape.height,sides:shape.segments||20}),...extras};
}
export function stationMemberBounds(m){const r=[0,1,2].map(k=>m.frame.reduce((s,a,i)=>s+Math.abs(a[k])*m.extent[i],0));return{min:sub(m.center,r),max:add(m.center,r)};}
export function stationMemberPoint(m,q){return m.center.map((c,k)=>c+m.frame.reduce((s,a,i)=>s+a[k]*q[i],0));}
export function stationMemberSample(m,p){
 const q=m.frame.map(a=>dot(sub(p,m.center),a));let d;
 if(m.type==='box'||m.type==='beam'){const a=q.map((x,i)=>Math.abs(x)-m.extent[i]);d=Math.hypot(...a.map(x=>Math.max(x,0)))+Math.min(Math.max(...a),0);}
 else{const s=m.sourceShape,n=s.segments||20,ap=Math.cos(Math.PI/n),slope=((s.radiusTop??s.radius)-s.radius)*ap/s.height;d=Math.abs(q[1])-s.height/2;for(let k=0;k<n;k++){const a=(k+.5)*2*Math.PI/n;d=Math.max(d,(q[0]*Math.sin(a)+q[2]*Math.cos(a)-s.radius*ap-slope*(q[1]+s.height/2))/Math.hypot(1,slope));}}
 return{d,baseD:d,member:m.member??-1,id:m.materialRole==='lamp-glass'?7:m.materialRole==='sign-enamel'?9:3,q,extent:m.extent.slice(),frame:m.frame.map(a=>a.slice()),sourceId:m.id};
}
const finite=(n,label)=>{if(!Number.isFinite(n))throw Error('Invalid '+label);return n;};
export function stationLampMembers({deck=.85,lampHeight=3.9,signHeight=2.6,row=0}={}){
 for(const[k,n]of Object.entries({deck,lampHeight,signHeight,row}))finite(n,k);
 if(lampHeight<=.7||signHeight<=.3||!Number.isInteger(row)||row<0||row>3)throw Error('Invalid accepted lamp datums');
 const y=deck+lampHeight,parts=[],emit=(id,s,r,f,e)=>parts.push(sourceShapeMember(id,s,r,f,{member:parts.length,...e}));
 const beam=(id,a,b,width,depth,feature)=>emit(id,{type:'beam',a,b,width,depth},'cast-iron',feature);
 beam('arm',[0,y,0],[1.2,y,0],.035,.035,'lamp-bracket');
 beam('brace',[0,y-.55,0],[.80,y,0],.025,.028,'rolled-member');
 emit('stem',{type:'cylinder',center:[1.18,y-.18,0],radius:.025,height:.36,segments:20},'cast-iron','turned-cast-profile');
 emit('shade',{type:'cylinder',center:[1.18,y-.44,0],radius:.24,radiusTop:.095,height:.25,segments:24},'cast-iron','bell-lamp-shade');
 emit('bulb',{type:'cylinder',center:[1.18,y-.57,0],radius:.11,height:.08,segments:16},'lamp-glass','turned-cast-profile');
 emit('sign',{type:'box',center:[.72,deck+signHeight,.03],size:[1.12,.52,.045]},'sign-enamel','platform-sign-face',{lettering:{line1:'PLATFORM No.',line2:String(row+1),mode:'requires-native-outline-glyph-binding'}});
 return parts;
}
export const nativeFloat=n=>Math.abs(n)<1e-14?'0.':Number.isInteger(n)?n+'.':String(n);
export const nativeVec=a=>'vec3<f32>('+a.map(nativeFloat).join(',')+')';
// Each assembly has its own type/helper prefix: no duplicate WGSL symbols when
// independently generated lamp and bridge templates are concatenated.
export function stationAssemblySupportWGSL(prefix,{materialDistance=null}={}){
 if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(prefix)||materialDistance!==null&&!/^[A-Za-z][A-Za-z0-9_]*$/.test(materialDistance))throw Error('Invalid WGSL callback identifier');
 return `
struct ${prefix}Hit{d:f32,baseD:f32,member:f32,id:u32,q:vec3<f32>,extent:vec3<f32>,frame:mat3x3<f32>,}
fn ${prefix}Frame(axis:vec3<f32>)->mat3x3<f32>{let w=normalize(axis);var u=vec3<f32>(-1.,0.,0.);if(w.y>-.999999){u=vec3<f32>(1.-w.x*w.x/(1.+w.y),-w.x,-w.z*w.x/(1.+w.y));}let v=cross(u,w);return mat3x3<f32>(vec3<f32>(u.z,u.y,-u.x),vec3<f32>(w.z,w.y,-w.x),vec3<f32>(v.z,v.y,-v.x));}
fn ${prefix}Empty()->${prefix}Hit{return ${prefix}Hit(1e5,1e5,-1.,0u,vec3<f32>(0.),vec3<f32>(1.),mat3x3<f32>(vec3<f32>(1.,0.,0.),vec3<f32>(0.,1.,0.),vec3<f32>(0.,0.,1.)));}
fn ${prefix}Candidate(p:vec3<f32>,d:f32,q:vec3<f32>,extent:vec3<f32>,axis:vec3<f32>,member:f32,id:u32)->${prefix}Hit{var h=${prefix}Hit(d,d,member,id,q,extent,${prefix}Frame(axis));${materialDistance?`h.d=${materialDistance}(h,p);`:''}return h;}
fn ${prefix}Box(p:vec3<f32>,s:vec3<f32>,center:vec3<f32>,axis:vec3<f32>,extent:vec3<f32>,member:f32)->${prefix}Hit{let q=memberBeamFrame(s,center,axis);return ${prefix}Candidate(p,box(q,extent),q,extent,axis,member,3u);}
`;
}
export function stationLampWGSL(options={}){
 const parts=stationLampMembers(options),prefix='StationLampMember';
 let code=stationAssemblySupportWGSL(prefix,options)+`\n// p is station-local; origin is this source attachment's station-local (x,0,z).\nfn stationLampMemberAt(p:vec3<f32>,origin:vec3<f32>,member:u32)->${prefix}Hit{let offset=p-origin;let s=vec3<f32>(-offset.z,offset.y,offset.x);\n`;
 for(const m of parts){const shape=m.sourceShape,axis=shape.type==='beam'?sub(shape.b,shape.a):[0,1,0],center=shape.type==='beam'?mul(add(shape.a,shape.b),.5):shape.center;const q=`memberBeamFrame(s,${nativeVec(center)},${nativeVec(axis)})`;const d=shape.type==='cylinder'?`memberCone(q,${nativeFloat(shape.radius)},${nativeFloat(shape.radiusTop??shape.radius)},${nativeFloat(shape.height)},${shape.segments}u)`:`box(q,${nativeVec(m.extent)})`;const material=m.materialRole==='lamp-glass'?7:m.materialRole==='sign-enamel'?9:3;
 code+=`// ${m.id}: complete R02 ${m.materialRole} ${m.feature}\nif(member==${m.member}u){let q=${q};return ${prefix}Candidate(p,${d},q,${nativeVec(m.extent)},${nativeVec(axis)},${nativeFloat(m.member)},${material}u);}\n`;
 }
 code+=`return ${prefix}Empty();}\n// Invoke materialDistance per child BEFORE the internal union; or call\n// stationLampMemberAt for all six children and submit each to the shared queue.\nfn completeStationLamp(p:vec3<f32>,origin:vec3<f32>)->${prefix}Hit{var h=${prefix}Empty();for(var i=0u;i<6u;i++){let c=stationLampMemberAt(p,origin,i);if(c.d<h.d){h=c;}}return h;}\n`;
 return code;
}
export const STATION_LAMPS_WGSL=stationLampWGSL();
