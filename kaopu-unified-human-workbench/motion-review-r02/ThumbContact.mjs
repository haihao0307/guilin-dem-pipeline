import {NativeRig,math,solveTwoBone} from '../full/hand-body-r01/NativeRig.mjs';
const {add,sub,scale,dot,norm,unit,lerp,pos,rotation,mv,smooth}=math;
const point=(m,p)=>add(mv(rotation(m),p),pos(m));
/** Current hand-frame correction: independent basal opposition, MCP/IP flexion
 * and external pad target. Estimated skin pad centers, not captured thumb data
 * or a force/contact solver. Only thumb descendants are modified. */
export class ThumbContact {
 constructor(human){this.human=human;this.rig=new NativeRig({...human.rig,stature:human.height});this.thumb={};this.last=[];for(const s of ['L','R']){
  const r=this.rig,ids=[1,2,3].map(k=>r.index.get(`finger1-${k}.${s}`)),P=ids.map(i=>r.restP[i]),dir=unit(sub(P[2],P[1])),rows=[];
  for(let i=0;i<human.N;i++){let w=0;for(let n=0;n<human.range[i*2+1];n++){const o=(human.range[i*2]+n)*8;if(human.packed[o+3]===ids[2])w+=human.packed[o+4];}if(w>.55){const p=Array.from(human.positions.slice(i*3,i*3+3));rows.push(dot(sub(p,P[2]),dir));}}
  rows.sort((a,b)=>a-b);const tipLength=rows.length?rows[Math.floor((rows.length-1)*.96)]:norm(sub(P[2],P[1]))*.72;
  this.thumb[s]={ids,tip:add(P[2],scale(dir,tipLength)),lengths:[norm(sub(P[1],P[0])),norm(sub(P[2],P[1])),tipLength]};
 }}
 setFrame(frame){const r=this.rig;for(let j=0;j<r.count;j++){const m=frame.posedMatrices[j],inv=r.inverseRest[j],out=r.skinMatrices[j];r.posedMatrices[j].set(m);for(let a=0;a<3;a++){for(let b=0;b<3;b++)out[a*4+b]=m[a*4]*inv[b]+m[a*4+1]*inv[4+b]+m[a*4+2]*inv[8+b];out[a*4+3]=m[a*4]*inv[3]+m[a*4+1]*inv[7]+m[a*4+2]*inv[11]+m[a*4+3];}}}
 repair(frame,row,time,{enabled=true}={}){
  this.setFrame(frame);const r=this.rig,box=['boxing','excerpt'].includes(row.kind),fist=row.kind==='hand'&&row.task==='fist';this.last=[];
  if(enabled&&(box||fist)){const closure=box?1:(frame.state?.closure??1);for(const s of box?['L','R']:[row.handSide||'L'])this.wrap(s,closure,row.tension==='loose'?.8:1);}
  return {...frame,posedMatrices:r.posedMatrices,skinMatrices:r.skinMatrices,thumbReport:this.last};
 }
 wrap(s,closure,tension=1){if(closure<1e-5)return;const r=this.rig,{ids,tip,lengths}=this.thumb[s],get=n=>pos(r.posedMatrices[r.index.get(n+'.'+s)]),w=r.index.get('wrist.'+s),wr=rotation(r.skinMatrices[w]),F=unit(mv(wr,r.hand[s].forward)),N=unit(mv(wr,r.hand[s].palm)),U=unit(sub(get('finger2-1'),get('finger5-1'))),base=pos(r.posedMatrices[ids[0]]);
  // Remove only the erroneous inherited thumb rotation; wrist/other fingers stay.
  for(const j of ids)r.orientSkin(j,wr);
  const neutralTip=point(r.skinMatrices[ids[2]],tip),neutralIP=pos(r.posedMatrices[ids[2]]),neutralDir=unit(sub(neutralTip,neutralIP));
  const shaft=lerp(get('finger2-2'),get('finger2-3'),.55),gap=this.human.height*.0108,goal=add(add(shaft,scale(N,gap)),scale(U,-this.human.height*.010));
  const amount=smooth(closure)*tension,distal=unit(lerp(neutralDir,unit(add(add(scale(U,-1),scale(F,.22)),scale(N,-.12))),amount));
  const tipTarget=lerp(neutralTip,goal,amount),ipTarget=sub(tipTarget,scale(distal,lengths[2])),pole=add(base,add(scale(U,.08),add(scale(F,.015),scale(N,.008))));
  const solved=solveTwoBone(base,ipTarget,pole,lengths[0],lengths[1],{extension:.9995});
  r.rotateSubtree(ids[0],math.shortestArc(sub(pos(r.posedMatrices[ids[1]]),base),sub(solved.joint,base)),base);
  const mcp=pos(r.posedMatrices[ids[1]]);r.rotateSubtree(ids[1],math.shortestArc(sub(pos(r.posedMatrices[ids[2]]),mcp),sub(solved.endpoint,mcp)),mcp);
  const ip=pos(r.posedMatrices[ids[2]]),before=point(r.skinMatrices[ids[2]],tip);r.rotateSubtree(ids[2],math.shortestArc(sub(before,ip),distal),ip);
  const actual=point(r.skinMatrices[ids[2]],tip);this.last.push({side:s,closure,target:tipTarget,tip:actual,ip:pos(r.posedMatrices[ids[2]]),mcp:pos(r.posedMatrices[ids[1]]),goalErrorM:norm(sub(actual,tipTarget)),outsideOffsetM:dot(sub(actual,shaft),N),towardMiddleM:-dot(sub(actual,shaft),U),ikClamped:solved.clamped,source:'authored anatomical hand-frame thumb; not captured fingers',limits:'estimated pad centers, no force or exhaustive skin collision'});
 }
}
