import{I,mul,inv,sub,add,scale,norm,align,frame,position,point,vector}from'./math.mjs';
/** Semantic rest binding. Joint locations follow the current unposed Anny body.
 * MHR local Euler channels and procedural bones are preserved, without translating
 * them into Anny controls. Rotations align limbs/palms; mesh shape stays Anny. */
export function buildTargetBinding({sourceBind,jointNames,parents,annyBoneNames,annyRestHeads}){
 const mi=Object.fromEntries(jointNames.map((n,i)=>[n,i])),ai=Object.fromEntries(annyBoneNames.map((n,i)=>[n,i]));
 const sp=n=>position(sourceBind[mi[n]]),ap=n=>Array.from(annyRestHeads.slice(ai[n]*3,ai[n]*3+3));
 const targets=Array(jointNames.length),rotations=Array(jointNames.length),scales=Array(jointNames.length).fill(1),provenance=Array(jointNames.length);
 const set=(name,p,R=I(),s=1,note='semantic')=>{const j=mi[name];targets[j]=p;rotations[j]=R;scales[j]=s;provenance[j]=note;};
 const segment=(name,next,a,b)=>{const p=ap(a),q=ap(b),sv=sub(sp(next),sp(name)),tv=sub(q,p);set(name,p,align(sv,tv),norm(tv)/norm(sv),a+' → '+b);};
 const rootShift=sub(ap('root'),sp('root'));set('body_world',add(sp('body_world'),rootShift));set('root',ap('root'));
 segment('c_spine0','c_spine1','spine05','spine04');segment('c_spine1','c_spine2','spine04','spine03');segment('c_spine2','c_spine3','spine03','spine01');segment('c_spine3','c_neck','spine01','neck01');segment('c_neck','c_head','neck01','head');set('c_head',ap('head'));
 for(const [s,side]of[['l','L'],['r','R']]){
  segment(s+'_upleg',s+'_lowleg','upperleg01.'+side,'lowerleg01.'+side);segment(s+'_lowleg',s+'_foot','lowerleg01.'+side,'foot.'+side);segment(s+'_foot',s+'_ball','foot.'+side,'toe2-1.'+side);
  segment(s+'_clavicle',s+'_uparm','clavicle.'+side,'upperarm01.'+side);segment(s+'_uparm',s+'_lowarm','upperarm01.'+side,'lowerarm01.'+side);segment(s+'_lowarm',s+'_wrist','lowerarm01.'+side,'wrist.'+side);
  const sm=frame(sub(sp(s+'_middle1'),sp(s+'_wrist')),sub(sp(s+'_index1'),sp(s+'_pinky1'))),tm=frame(sub(ap('finger3-1.'+side),ap('wrist.'+side)),sub(ap('finger2-1.'+side),ap('finger5-1.'+side))),R=mul(tm,inv(sm)),length=norm(sub(ap('finger3-1.'+side),ap('wrist.'+side)))/norm(sub(sp(s+'_middle1'),sp(s+'_wrist')));
  set(s+'_wrist',ap('wrist.'+side),R,length,'wrist plus index/middle/pinky palm frame');set(s+'_wrist_twist',ap('wrist.'+side),rotations[mi[s+'_lowarm']],scales[mi[s+'_lowarm']],'coincident wrist pivot; forearm frame');
  for(const [finger,num]of[['index',2],['middle',3],['ring',4],['pinky',5],['thumb',1]]){
   for(let k=1;k<=3;k++){
    const name=s+'_'+finger+k,an='finger'+num+'-'+k+'.'+side;
    if(k<3)segment(name,s+'_'+finger+(k+1),an,'finger'+num+'-'+(k+1)+'.'+side);
    else{const prev=s+'_'+finger+2,prevAn='finger'+num+'-2.'+side,sv=sub(sp(name),sp(prev)),tv=sub(ap(an),ap(prevAn));set(name,ap(an),align(sv,tv),norm(tv)/norm(sv),an+' with preceding phalanx direction');}
   }
   const tip=s+'_'+finger+'_null',last=s+'_'+finger+3,j=mi[last];set(tip,add(targets[j],scale(vector(rotations[j],sub(sp(tip),sp(last))),scales[j])),rotations[j],scales[j],'terminal phalanx extension');
  }
  set(s+'_pinky0',ap('metacarpal4.'+side),R,length,'pinky metacarpal');
  set(s+'_thumb0',add(ap('wrist.'+side),scale(vector(R,sub(sp(s+'_thumb0'),sp(s+'_wrist'))),length)),R,length,'proximal thumb has no exact Anny counterpart; palm-frame offset');
  for(const region of['upleg','lowleg','uparm','lowarm']){
   const start=s+'_'+region,end=s+'_'+({upleg:'lowleg',lowleg:'foot',uparm:'lowarm',lowarm:'wrist'}[region]);
   for(let k=0;k<=4;k++){const name=start+'_twist'+k+'_proc';if(mi[name]===undefined)continue;const j=mi[start],u=norm(sub(sp(name),sp(start)))/norm(sub(sp(end),sp(start)));set(name,add(targets[j],scale(sub(targets[mi[end]],targets[j]),u)),rotations[j],scales[j],'procedural twist at source segment fraction '+u);}
  }
  for(const name of['talocrural','subtalar','transversetarsal','ball']){const j=mi[s+'_foot'],n=s+'_'+name;set(n,add(targets[j],scale(vector(rotations[j],sub(sp(n),sp(s+'_foot'))),scales[j])),rotations[j],scales[j],'foot-frame source offset; ball anchored to toe2-1');}
 }
 for(const name of ['c_neck_twist0_proc','c_neck_twist1_proc']){const j=mi.c_neck,u=norm(sub(sp(name),sp('c_neck')))/norm(sub(sp('c_head'),sp('c_neck')));set(name,add(targets[j],scale(sub(targets[mi.c_head],targets[j]),u)),rotations[j],scales[j],'neck segment fraction');}
 // Facial descendants are supplied for skeleton continuity only. Their geometry
 // belongs to the independent head adapter and is NOT claimed by this body map.
 for(let j=0;j<jointNames.length;j++)if(!targets[j]){const h=mi.c_head;set(jointNames[j],add(targets[h],sub(position(sourceBind[j]),sp('c_head'))),I(),1,'head-only provisional; parent adapter owns geometry');}
 const bind=sourceBind.map((m,j)=>{const out=mul(rotations[j],m);[out[3],out[7],out[11]]=targets[j];return out;}),local=bind.map((m,j)=>parents[j]<0?m:mul(inv(bind[parents[j]]),m));
 return{bind,local,scales,rotations,provenance};
}
