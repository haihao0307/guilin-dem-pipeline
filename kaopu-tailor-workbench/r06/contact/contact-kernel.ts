// Narrow phase only. JS retains swept broadphase and material adjacency filtering.
// Original XPBD/WASM cloth kernel is untouched. All geometry computations are f64.
let ps=new StaticArray<f64>(0),prev=new StaticArray<f64>(0),mass=new StaticArray<f64>(0),alias=new StaticArray<i32>(0),rows=new StaticArray<i32>(0);
let n:i32=0,capacity:i32=0;
export function setup(count:i32,pairCapacity:i32):void{n=count;capacity=pairCapacity;ps=new StaticArray<f64>(n*3);prev=new StaticArray<f64>(n*3);mass=new StaticArray<f64>(n);alias=new StaticArray<i32>(n);rows=new StaticArray<i32>(capacity*5);}
export function positions():usize{return changetype<usize>(ps);}export function previous():usize{return changetype<usize>(prev);}export function weights():usize{return changetype<usize>(mass);}export function aliases():usize{return changetype<usize>(alias);}export function pairs():usize{return changetype<usize>(rows);}
export let corrections:i32=0,sweptHits:i32=0,discreteHits:i32=0,unresolved:i32=0;
let px=new StaticArray<f64>(4),py=new StaticArray<f64>(4),pz=new StaticArray<f64>(4),ids=new StaticArray<i32>(4),ws=new StaticArray<f64>(4);
let qx:f64=0,qy:f64=0,qz:f64=0;
@inline function norm(x:f64,y:f64,z:f64):f64{return Math.sqrt(x*x+y*y+z*z);}
@inline function clamp(x:f64):f64{return Math.max(0,Math.min(1,x));}
function sample(t:f64,face:bool):bool{
 for(let i=0;i<4;i++){let id=ids[i],o=id*3,r=alias[id]*3;px[i]=prev[o]+t*(ps[r]-prev[o]);py[i]=prev[o+1]+t*(ps[r+1]-prev[o+1]);pz[i]=prev[o+2]+t*(ps[r+2]-prev[o+2]);}
 if(face){
 let abx=px[2]-px[1],aby=py[2]-py[1],abz=pz[2]-pz[1],acx=px[3]-px[1],acy=py[3]-py[1],acz=pz[3]-pz[1],apx=px[0]-px[1],apy=py[0]-py[1],apz=pz[0]-pz[1];
 let d1=abx*apx+aby*apy+abz*apz,d2=acx*apx+acy*apy+acz*apz,u:f64=0,v:f64=0,w:f64=0;
 if(d1<=0&&d2<=0)u=1;
 else{let bpx=px[0]-px[2],bpy=py[0]-py[2],bpz=pz[0]-pz[2],d3=abx*bpx+aby*bpy+abz*bpz,d4=acx*bpx+acy*bpy+acz*bpz;
 if(d3>=0&&d4<=d3)v=1;
 else{let vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){v=d1/(d1-d3);u=1-v;}
 else{let cpx=px[0]-px[3],cpy=py[0]-py[3],cpz=pz[0]-pz[3],d5=abx*cpx+aby*cpy+abz*cpz,d6=acx*cpx+acy*cpy+acz*cpz;
 if(d6>=0&&d5<=d6)w=1;
 else{let vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){w=d2/(d2-d6);u=1-w;}
 else{let va=d3*d6-d5*d4;if(va<=0&&d4>=d3&&d5>=d6){w=(d4-d3)/(d4-d3+d5-d6);v=1-w;}
 else{let den=va+vb+vc;if(Math.abs(den)<1e-24)return false;v=vb/den;w=vc/den;u=1-v-w;}}}}}}
 ws[0]=1;ws[1]=-u;ws[2]=-v;ws[3]=-w;
 }else{
 let ux=px[1]-px[0],uy=py[1]-py[0],uz=pz[1]-pz[0],vx=px[3]-px[2],vy=py[3]-py[2],vz=pz[3]-pz[2],wx=px[0]-px[2],wy=py[0]-py[2],wz=pz[0]-pz[2];
 let aa=ux*ux+uy*uy+uz*uz,bb=ux*vx+uy*vy+uz*vz,cc=vx*vx+vy*vy+vz*vz,dd=ux*wx+uy*wy+uz*wz,ee=vx*wx+vy*wy+vz*wz,s:f64=0,t:f64=0;
 if(aa<1e-24&&cc<1e-24)return false;
 if(aa<1e-24)t=clamp(ee/cc);else if(cc<1e-24)s=clamp(-dd/aa);
 else{let den=aa*cc-bb*bb;s=den>1e-24?clamp((bb*ee-cc*dd)/den):0;t=(bb*s+ee)/cc;if(t<0){t=0;s=clamp(-dd/aa);}else if(t>1){t=1;s=clamp((bb-dd)/aa);}}
 ws[0]=1-s;ws[1]=s;ws[2]=-(1-t);ws[3]=-t;
 }
 qx=qy=qz=0;for(let i=0;i<4;i++){qx+=ws[i]*px[i];qy+=ws[i]*py[i];qz+=ws[i]*pz[i];}return true;
}
function projectPair(o:i32,h:f64):void{
 let face=rows[o]!=0;for(let i=0;i<4;i++)ids[i]=rows[o+i+1];
 let speed0:f64=0,speed1:f64=0;
 for(let i=0;i<4;i++){let p=alias[ids[i]]*3,b=ids[i]*3,s=norm(ps[p]-prev[b],ps[p+1]-prev[b+1],ps[p+2]-prev[b+2]);if(face){if(i==0)speed0=s;else speed1=Math.max(speed1,s);}else{if(i<2)speed0=Math.max(speed0,s);else speed1=Math.max(speed1,s);}}
 let speed=speed0+speed1,t:f64=0,hit=false;
 for(let j=0;j<32;j++){if(!sample(t,face))break;let d=norm(qx,qy,qz);if(d<=h+1e-8){hit=true;break;}if(speed<1e-12)return;let step=.9*(d-h)/speed;if(t+step>1)return;t+=Math.max(step,1e-7);if(t>1)return;if(j==31)unresolved++;}
 if(!hit){if(!sample(1,face)||norm(qx,qy,qz)>=h)return;t=1;}
 let nx=qx,ny=qy,nz=qz,len=norm(nx,ny,nz);
 if(len<1e-12){let a=ids[face?2:1]*3,b=ids[face?1:0]*3,c=ids[3]*3,d=ids[face?1:2]*3,ux=prev[a]-prev[b],uy=prev[a+1]-prev[b+1],uz=prev[a+2]-prev[b+2],vx=prev[c]-prev[d],vy=prev[c+1]-prev[d+1],vz=prev[c+2]-prev[d+2];nx=uy*vz-uz*vy;ny=uz*vx-ux*vz;nz=ux*vy-uy*vx;len=norm(nx,ny,nz);if(len<1e-12)return;}
 nx/=len;ny/=len;nz/=len;
 let gap:f64=0;for(let i=0;i<4;i++){let p=alias[ids[i]]*3;gap+=ws[i]*(ps[p]*nx+ps[p+1]*ny+ps[p+2]*nz);}if(gap>=h)return;
 // Combine all identical solver aliases before computing mass-weighted response.
 for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)if(alias[ids[i]]==alias[ids[j]]){ws[i]+=ws[j];ws[j]=0;}
 let den:f64=0;for(let i=0;i<4;i++)den+=mass[alias[ids[i]]]*ws[i]*ws[i];if(den<1e-15)return;let dl=(h-gap)/den;
 for(let i=0;i<4;i++){let r=alias[ids[i]],p=r*3,f=mass[r]*ws[i]*dl;ps[p]+=f*nx;ps[p+1]+=f*ny;ps[p+2]+=f*nz;}
 corrections++;if(t<1&&speed>h)sweptHits++;else discreteHits++;
}
export function project(count:i32,h:f64):void{if(count>capacity)throw new Error('Contact pair capacity exceeded');corrections=sweptHits=discreteHits=unresolved=0;for(let i=0;i<count;i++)projectPair(i*5,h);}
