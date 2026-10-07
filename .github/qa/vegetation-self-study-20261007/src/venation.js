/* MIT: port of tsoding/leaf-venation main.c, commit 3d828c51d99be86c538769f19f715f919bba5456.
 * Original copyright 2026 Alexey Kutepov <reximkut@gmail.com>.
 * Full license in teachers/tsoding-leaf-venation/LICENSE.
 * Explicit differences: deterministic injected random source, parent indices added as metadata.
 * Growth order, unnormalized attraction sum, strict nearest comparison and unordered kill match C.
 */
const f=Math.fround;
const dist=(a,b)=>f(Math.sqrt(f(f(f(a.x-b.x)**2)+f(f(a.y-b.y)**2))));
export function lcg(seed=1707){let s=seed>>>0;return (lo,hi)=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return lo+s%(hi-lo+1);};}
export class TeacherVenation {
 constructor({width=800,height=600,seed=1707,auxinsRate=20,kill=30,step=10,root={x:400,y:400},accept=()=>true}={}){this.width=width;this.height=height;this.random=lcg(seed);this.auxinsRate=auxinsRate;this.kill=kill;this.step=step;this.accept=accept;this.auxins=[];this.veins=[{x:root.x,y:root.y,dx:0,dy:0,parent:-1}];this.frame=0;this.spray();this.killAuxins();}
 spray(){for(let i=0;i<this.auxinsRate;i++){const p={x:this.random(0,this.width),y:this.random(0,this.height)};if(this.accept(p))this.auxins.push(p);}}
 killAuxins(){const remove=[];for(let i=0;i<this.auxins.length;i++){for(const v of this.veins){if(dist(this.auxins[i],v)<=this.kill){remove.push(i);break;}}}while(remove.length){const idx=remove.pop();this.auxins[idx]=this.auxins[this.auxins.length-1];this.auxins.pop();}}
 directions(){for(const v of this.veins){v.dx=0;v.dy=0;}for(const a of this.auxins){let closest=this.veins[0];for(let i=1;i<this.veins.length;i++){if(dist(this.veins[i],a)<dist(closest,a))closest=this.veins[i];}closest.dx=f(closest.dx+f(a.x-closest.x));closest.dy=f(closest.dy+f(a.y-closest.y));}for(const v of this.veins){const len=f(Math.sqrt(f(f(v.dx*v.dx)+f(v.dy*v.dy))));if(len>0){const ilen=f(1/len);v.dx=f(v.dx*ilen);v.dy=f(v.dy*ilen);}}}
 grow(){const added=[];for(let i=0;i<this.veins.length;i++){const v=this.veins[i];if(v.dx===0&&v.dy===0)continue;added.push({x:f(v.x+f(f(v.dx*5)*(this.step/5))),y:f(v.y+f(f(v.dy*5)*(this.step/5))),dx:0,dy:0,parent:i});}this.veins.push(...added);}
 tick(){this.directions();this.grow();this.killAuxins();this.spray();this.killAuxins();this.frame++;return this;}
 snapshot(){return {frame:this.frame,auxins:this.auxins.map(a=>[a.x,a.y]),veins:this.veins.map(v=>[v.x,v.y,v.dx,v.dy])};}
}
export function leafWidth(t){return Math.pow(Math.max(0,Math.sin(Math.PI*t)),.78)*(.45+.16*t);}
export function makeLeafVeins({seed=706,steps=185}={}){
 const width=800,height=1200;const accept=p=>{const t=1-p.y/height;return Math.abs((p.x-width/2)/height)<leafWidth(t)*.68;};
 const v=new TeacherVenation({width,height,seed,root:{x:400,y:1200},kill:14,step:8,auxinsRate:80,accept});
 // Applied reconstruction: sparse arcing secondaries are authored before fine colonization.
 // This anatomically directed seed network is a declared departure from the one-root baseline.
 for(let i=1;i<=75;i++)v.veins.push({x:400,y:1200-i*15,dx:0,dy:0,parent:i-1});
 for(let row=0;row<11;row++){
  const rootIndex=6+row*6,baseY=v.veins[rootIndex].y,t=1-baseY/height;
  for(const side of [-1,1]){let parent=rootIndex;for(let k=1;k<=13;k++){const f=k/13,yt=baseY-(80+105*Math.sin(t*Math.PI))*Math.pow(f,1.08),half=leafWidth(1-yt/height)*height*.68*.91;
   v.veins.push({x:400+side*half*Math.sin(f*Math.PI*.48),y:yt,dx:0,dy:0,parent});parent=v.veins.length-1;
  }}
 }
 for(let i=0;i<steps;i++)v.tick();
 const weights=new Float32Array(v.veins.length).fill(1);for(let i=v.veins.length-1;i>0;i--)weights[v.veins[i].parent]+=weights[i];
 return {veins:v.veins,weights,width,height,seed,steps};
}
