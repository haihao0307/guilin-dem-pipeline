"""Apply visually required R03 corrections to readable authoring sources only.
Exact anchors fail on drift. No R02/R04 source or old preview is changed.
"""
from pathlib import Path
P=Path(__file__).resolve().parent
def sub(s,a,b,n=1):
 assert s.count(a)==n,(a[:80],s.count(a),n)
 return s.replace(a,b)
p=P/'SurfaceContact.mjs';s=p.read_text()
if 'R03 neutral wrist prop frame' not in s:
 s=sub(s,'.067-halfExtents[2]','.067-halfExtents[1]')
 s=sub(s,'halfExtentsNative:[halfExtents[0],halfExtents[2],halfExtents[1]]','halfExtentsNative:halfExtents.slice()')
 s='// R03 neutral wrist prop frame: palm-forward axis aligns with object depth.\n'+s;p.write_text(s)
p=P/'InteractionRig.mjs';s=p.read_text()
if 'R03 inspected wrist and original prop dimensions' not in s:
 s=sub(s,'const {add,sub,scale,norm,unit,','const {add,sub,scale,dot,cross,norm,unit,')
 s=sub(s,'radius:this.H*.021','radius:this.H*.015',2)
 s=sub(s,'[this.H*.085,this.H*.062,this.H*.064]','[this.H*.23/3.4,this.H*.16/3.4,this.H*.18/3.4]',2)
 s=sub(s,'this.palmCalibration=this.surface.report;',"for(const side of ['L','R']){const t=this.surface.fit(side,'sphere',{radius:this.H*.021});this.surface.path(side,t);this.templates[side+'pickup']=t;}this.palmCalibration=this.surface.report;")
 s=sub(s,'h*(.44-.15*q)','h*(.44-.09*q)')
 s=sub(s,"[0,-.12,-1],[-sign,0,0]","unit(lerp([0,-.12,-1],[0,-1,-.15],q)),unit(lerp([-sign,0,0],[0,.15,-1],q))")
 s=sub(s,"shape==='sphere'?this.H*.075", "['sphere','pickup'].includes(shape)?this.H*.075")
 old="const solved=r.solveLimb(l,target,add(shoulder,[sign*this.H*.15,this.H*.045,-this.H*.27]),.999);r.orientSkin(l.c,wanted);return{"
 new="const pole=lerp(add(shoulder,[sign*this.H*.15,this.H*.045,-this.H*.27]),sub(target,scale(F,l.lower)),reach);const solved=r.solveLimb(l,target,pole,.999);const elbow=pos(r.posedMatrices[l.b]),D=unit(sub(pos(r.posedMatrices[l.c]),elbow)),oldN=mv(rotation(r.skinMatrices[l.c]),g.N),desiredN=mv(wanted,g.N),aN=unit(sub(oldN,scale(D,dot(oldN,D)))),bN=unit(sub(desiredN,scale(D,dot(desiredN,D)))),roll=Math.atan2(dot(D,cross(aN,bN)),dot(aN,bN));r.rotateSubtree(l.b,axisRotation(D,roll),elbow);r.orientSkin(l.c,wanted);const wristBendDegrees=Math.acos(clamp(dot(D,unit(mv(wanted,g.F))),-1,1))*180/Math.PI;return{wristBendDegrees,"
 s=sub(s,old,new)
 s=sub(s,"obj=this.object('sphere',C);contacts.push(this.grip(r,side,'sphere',C,unit(lerp([0,-1,0],[0,0,1],lift)),unit(lerp([0,0,-1],[0,-1,0],lift))", "obj=this.object('sphere',C,{radius:h*.021});contacts.push(this.grip(r,side,'pickup',C,unit(lerp([0,-1,0],[0,-.98,.2],lift)),unit(lerp([0,0,-1],[-sgn,0,0],lift))")
 s=sub(s,"box?[0,0,-1]:[0,0,1],box?[-sign,0,0]:[0,-1,0]", "box?[0,-1,0]:[0,-.98,.2],[-sign,0,0]")
 s=sub(s,"'box',C,[0,0,-1]","'box',C,[0,-1,0]")
 s=sub(s,"'box',local,[0,0,-1]","'box',local,[0,-1,0]")
 s=sub(s,'reachErrorM:c.reachErrorM,','wristBendDegrees:c.wristBendDegrees,reachErrorM:c.reachErrorM,',2)
 s='// R03 inspected wrist and original prop dimensions: current source geometry retained.\n'+s;p.write_text(s)
p=P/'InteractionRig.mjs';s=p.read_text()
if 'unused crouch hands follow thigh region' not in s:
 fix="""  // unused crouch hands follow thigh region; no object-contact chain is changed.
  if(q>0)for(const s of ['L','R'])if(!contacts.some(c=>c.side===s)){
   const sign=s==='L'?1:-1,l=r.limbs['arm'+s],knee=pos(r.posedMatrices[r.limbs['leg'+s].b]),shoulder=pos(r.posedMatrices[l.a]),target=lerp(pos(r.posedMatrices[l.c]),add(knee,[sign*h*.04,h*.01,h*.075]),smooth(q));
   r.solveLimb(l,target,add(shoulder,[sign*h*.18,h*.025,-h*(.25*(1-q)+.01*q)]),.995);
   const elbow=pos(r.posedMatrices[l.b]),D=unit(sub(pos(r.posedMatrices[l.c]),elbow)),oldR=rotation(r.skinMatrices[l.c]),g=r.hand[s],goal=basisRotation(g.forward,g.palm,D,[0,0,-1]),wanted=blendR(oldR,goal,smooth(q)),oldN=mv(oldR,g.palm),wantN=mv(wanted,g.palm),a=unit(sub(oldN,scale(D,dot(oldN,D)))),b=unit(sub(wantN,scale(D,dot(wantN,D)))),roll=Math.atan2(dot(D,cross(a,b)),dot(a,b));r.rotateSubtree(l.b,axisRotation(D,roll),elbow);r.orientSkin(l.c,wanted);
  }
"""
 s=sub(s,'  let contactMetrics=[],peerMetrics=[];',fix+'  let contactMetrics=[],peerMetrics=[];');p.write_text(s)
p=P/'Runtime.mjs';s=p.read_text()
if 'interaction framing includes floor object' not in s:
 old="frameCamera(which){if(!this.peer?.mesh.visible||!['three','front','side'].includes(which))return false;"
 new="""frameCamera(which){
  // interaction framing includes floor object and views box hands from outside.
  const r0=this.review,v0=this.viewer,h0=r0.binding.height;
  if(r0.clip?.row.kind==='interaction'&&['handL','handR'].includes(which)&&r0.clip.objects.some(o=>o?.shape==='box')){const side=which==='handL'?'L':'R',m=this.current?.metrics.contactMetrics.find(x=>x.side===side);if(m){const t=new THREE.Vector3(m.palm[0],m.palm[2],-m.palm[1]);v0.orbit.target.copy(t);v0.camera.position.copy(t).add(new THREE.Vector3((side==='L'?1:-1)*h0*.22,h0*.09,h0*.17));v0.camera.updateProjectionMatrix();v0.orbit.update();r0.render();return true;}}
  if(!this.peer?.mesh.visible){if(r0.clip?.row.kind!=='interaction'||!['three','front','side','rear'].includes(which))return false;const target=new THREE.Vector3(0,-r0.binding.floorOffset+h0*.48,h0*.03),f=Math.tan(v0.camera.fov*Math.PI/360),dist=Math.max(h0/(2*f)*1.35,h0/(Math.max(.45,v0.camera.aspect)*2*f)*.78),angle=which==='front'?0:which==='side'?Math.PI/2:which==='rear'?Math.PI:.48;v0.orbit.target.copy(target);v0.camera.position.copy(target).add(new THREE.Vector3(Math.sin(angle)*dist,h0*.12,Math.cos(angle)*dist));v0.camera.updateProjectionMatrix();v0.orbit.update();r0.lastRoot=null;r0.render();return true;}
  if(!['three','front','side'].includes(which))return false;"""
 s=sub(s,old,new);p.write_text(s)
p=P/'verify.cjs';s=p.read_text()
if 'original prop dimensions regression' not in s:
 s=sub(s,'const catalogue=await page.evaluate(()=>motionReviewCatalogue);',"""// original prop dimensions regression
 const dimensions=await page.evaluate(()=>{const r=motionReview,h=r.binding.height,g=r.interactions.pose('grasp',4).object,b=r.interactions.pose('carry',4).object;return{sphereError:Math.abs(g.radius-h*.015),boxError:Math.max(...b.halfExtentsNative.map((x,k)=>Math.abs(x-h*[.23,.16,.18][k]/3.4))),sphereDiameterM:g.radius*2,boxDimensionsM:b.halfExtentsNative.map(x=>x*2)};});check('original small ball and box sizes retained',dimensions.sphereError<1e-9&&dimensions.boxError<1e-9,dimensions);
 const catalogue=await page.evaluate(()=>motionReviewCatalogue);""")
 s=sub(s,'bone=0,qmin=1,qmax=0','bone=0,wrist=0,qmin=1,qmax=0')
 s=sub(s,"if(h.reach>.999&&h.close>.999){maxHeldContactGap", "if(h.reach>.999&&h.close>.999){wrist=Math.max(wrist,h.wristBendDegrees||0);maxHeldContactGap")
 s=sub(s,'maxHeldReach,bone,qmin,qmax','maxHeldReach,bone,wrist,qmin,qmax')
 s=sub(s,'d.bone<1e-6,d);','d.bone<1e-6&&d.wrist<65,d);');p.write_text(s)
print('Inspected contact/wrist/free-hand/camera corrections present; previous runtimes untouched')
