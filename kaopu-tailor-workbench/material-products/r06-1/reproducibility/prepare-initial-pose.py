from pathlib import Path
import sys
root=Path(sys.argv[1]);p=root/'new/SourcePhysics.mjs';s=p.read_text()
s=s.replace('actor:packet,settings,wasm})','actor:packet,settings,wasm,initialFrame=null})')
old='const actor=new SourceActor(packet),surface=new MeshContact(actor.positions,packet.faces),fitted=fitRows(rows,oldBody,actor,packet.faces);'
new='''const actor=new SourceActor(packet);if(initialFrame){actor.pending=initialFrame;actor.at();}
 const surface=new MeshContact(actor.positions,packet.faces),fitted=initialFrame?initialPoseRows(rows,oldBody,actor,packet.faces):fitRows(rows,oldBody,actor,packet.faces);'''
assert s.count(old)==1;s=s.replace(old,new)
s+='''\n/** One-time initial condition only; no cloth vertex is attached to this map during simulation. */
function initialPoseRows(rows,neutral,actor,faces){const old=new Float32Array(neutral.length);for(let i=0;i<old.length;i+=3)old.set([neutral[i],neutral[i+2],-neutral[i+1]],i);const mesh=new MeshContact(old,faces),q=new Float64Array(7);let maximum=0;
 const basis=(p,f)=>{const a=faces[f]*3,b=faces[f+1]*3,c=faces[f+2]*3,u=[0,1,2].map(k=>p[b+k]-p[a+k]),v=[0,1,2].map(k=>p[c+k]-p[a+k]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...u)||1,h=Math.hypot(...n)||1;for(let k=0;k<3;k++){u[k]/=l;n[k]/=h;}return[u,[n[1]*u[2]-n[2]*u[1],n[2]*u[0]-n[0]*u[2],n[0]*u[1]-n[1]*u[0]],n];};
 const out=rows.map(r=>{const p=Float32Array.from(r.positions);for(let i=0;i<p.length;i+=3){const f=mesh.nearest(p[i],p[i+1],p[i+2]);closestTriangle(old,mesh.faces,f,p[i],p[i+1],p[i+2],q);const A=basis(old,f),B=basis(actor.positions,f),local=A.map(axis=>axis.reduce((sum,x,k)=>sum+x*(p[i+k]-q[1+k]),0));for(let k=0;k<3;k++){let x=0;for(let j=0;j<3;j++)x+=actor.positions[faces[f+j]*3+k]*q[4+j]+B[j][k]*local[j];maximum=Math.max(maximum,Math.abs(x-p[i+k]));p[i+k]=x;}}return{...r,positions:p};});return{rows:out,maxTransferredCoordinateM:maximum,initializationOnly:true,ongoingClothSkinning:false};}
'''
p.write_text(s)
p=Path(__file__).resolve().parent/'bake.mjs';s=p.read_text().replace('const world=await makeSourceWorld','let world=await makeSourceWorld')
a=s.index(' // Initial alignment');b=s.index(' for(let i=0;i<data.poses.length;i++)',a)
s=s[:a]+''' // Construct the source clip's exact first pose without inventing an alignment motion.
 world=await makeSourceWorld({rows:input,oldBody:data.oldBody,actor:data.actor,settings,wasm:fs.readFileSync(path.join(root,'parent/cloth-kernel.wasm')),initialFrame:data.poses[0]});
 for(let i=0;i<8;i++)world.stepSource(data.poses[0],1/30);
'''+s[b:]
s=s.replace("sourceProtocol:'R05-native-original-motion/1'","sourceProtocol:'R05-native-original-motion/2'").replace('initialAlignmentSeconds:1','initialAlignmentSeconds:0,initialization:"one-time native first-pose rest fit, then actual static constraint solve; not animation"')
p.write_text(s)
print('First-pose initializer changed; original named motions and original dynamic constraints unchanged')
