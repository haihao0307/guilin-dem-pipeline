

// Original standalone XPBD implementation; compiled to embedded WebAssembly.
// Material parameters are browser-study values, not native Vellum presets.
#define EXPORT __attribute__((visibility("default")))
static float absf(float x){return x<0?-x:x;}
static float minf(float a,float b){return a<b?a:b;}
static float maxf(float a,float b){return a>b?a:b;}
static float clampf(float x,float a,float b){return minf(b,maxf(a,x));}
static float sqrtf_(float x){return __builtin_sqrtf(x);}
static float atan2_(float y,float x){float ax=absf(x),ay=absf(y),t=minf(ax,ay)/maxf(maxf(ax,ay),1e-30f),s=t*t;float r=(((((-.01172120f*s+.05265332f)*s-.11643287f)*s+.19354346f)*s-.33262347f)*s+.99997726f)*t;if(ay>ax)r=1.5707963267948966f-r;if(x<0)r=3.141592653589793f-r;return y<0?-r:r;}

// R04 native sparse-sheet adapter. Axial block solver adapted from project
// denim-workshop/r15/dynamics.js Cloth.rodBlock, commit 9a3dd9845266.
// No SideFX solver binaries. Metre positions. Engineering material parameters.
static float bodyv[32768], seg[24][16];
static int contacts, virtuals;static float maxdepth;
// Conservative capsule broadphase: cached per physical substep, exact narrowphase retained.
static unsigned capsule_grid[1600];
static float grid_x,grid_y;
static int query_count,candidate_count;
static int gridcoord(float x){int i=(int)x;return i-(x<i);}
static void grid_build(void){
 grid_x=seg[0][11];grid_y=seg[0][13];
 for(int j=1;j<24;j++){grid_x=minf(grid_x,seg[j][11]);grid_y=minf(grid_y,seg[j][13]);}
 for(int i=0;i<1600;i++)capsule_grid[i]=0;
 for(int j=0;j<24;j++){
  int x0=(int)clampf(gridcoord((seg[j][11]-grid_x)/.03f),0,39),x1=(int)clampf(gridcoord((seg[j][12]-grid_x)/.03f),0,39);
  int y0=(int)clampf(gridcoord((seg[j][13]-grid_y)/.03f),0,39),y1=(int)clampf(gridcoord((seg[j][14]-grid_y)/.03f),0,39);
  for(int y=y0;y<=y1;y++)for(int x=x0;x<=x1;x++)capsule_grid[y*40+x]|=1u<<j;
 }
}

static void prepare(float*r,float*o,float dt){for(int j=0;j<24;j++){int a=j*3,b=a+3;float*s=seg[j],ex=r[b]-r[a],ey=r[b+1]-r[a+1],ox=o[b]-o[a],oy=o[b+1]-o[a+1];s[0]=r[a];s[1]=r[a+1];s[2]=ex;s[3]=ey;s[4]=1/maxf(ex*ex+ey*ey,1e-12f);s[5]=.066f-.004f*((j+.5f)/24);s[6]=(r[a]-o[a])/dt;s[7]=(r[a+1]-o[a+1])/dt;s[8]=(ex-ox)/dt;s[9]=(ey-oy)/dt;s[10]=atan2_(ox*ey-oy*ex,ox*ex+oy*ey)/dt;float m=s[5]+.008f;s[11]=minf(r[a],r[b])-m;s[12]=maxf(r[a],r[b])+m;s[13]=minf(r[a+1],r[b+1])-m;s[14]=maxf(r[a+1],r[b+1])+m;}}
// All 24 capsule segments are conservatively culled, not restricted by material index.
static int query(float x,float y,float z,float margin,float*out){float best=0;int hit=-1;
int gx=gridcoord((x-grid_x)/.03f),gy=gridcoord((y-grid_y)/.03f);
unsigned mask=(gx>=0&&gx<40&&gy>=0&&gy<40)?capsule_grid[gy*40+gx]:0x00ffffffu;
query_count++;
int hint=mask?(__builtin_ctz(mask)+31-__builtin_clz(mask))/2:-1;
if(hint>=0&&!(mask&(1u<<hint)))hint=__builtin_ctz(mask);
while(mask){int j=hint>=0?hint:__builtin_ctz(mask);hint=-1;mask&=~(1u<<j);candidate_count++;float*s=seg[j];if(x<s[11]||x>s[12]||y<s[13]||y>s[14]||absf(z)>s[5]+margin)continue;float t=clampf(((x-s[0])*s[2]+(y-s[1])*s[3])*s[4],0,1),cx=s[0]+t*s[2],cy=s[1]+t*s[3],dx=x-cx,dy=y-cy,d2=dx*dx+dy*dy+z*z,r=s[5]+margin;if(d2>=(r-best)*(r-best))continue;float d=sqrtf_(d2),dep=r-d;if(dep>best){best=dep;hit=j;float q=1/maxf(d,1e-8f);out[0]=dx*q;out[1]=dy*q;out[2]=z*q;if(d<1e-8f){out[0]=0;out[1]=0;out[2]=1;}out[3]=dep;out[4]=t;out[5]=cx;out[6]=cy;}}return hit;}
static void point_contact(float*p,float*tar,float*co,int n,float margin){for(int i=0;i<n;i++){int k=i*4;if(!p[k+3]){p[k]=tar[k];p[k+1]=tar[k+1];p[k+2]=tar[k+2];continue;}float q[7];int j=query(p[k],p[k+1],p[k+2],margin,q);if(j>=0){float*s=seg[j];p[k]+=q[0]*q[3];p[k+1]+=q[1]*q[3];p[k+2]+=q[2]*q[3];co[k]=q[0];co[k+1]=q[1];co[k+2]=q[2];co[k+3]=1;bodyv[k]=s[6]+q[4]*s[8]-s[10]*(p[k+1]-q[6]);bodyv[k+1]=s[7]+q[4]*s[9]+s[10]*(p[k]-q[5]);bodyv[k+2]=0;contacts++;maxdepth=maxf(maxdepth,q[3]);}}}
static void bary_contact(float*p,int a,int b,int c,float wa,float wb,float wc,float margin){a*=4;b*=4;c*=4;float q[7],w=p[a+3]*wa*wa+p[b+3]*wb*wb+p[c+3]*wc*wc;if(w<1e-12f)return;float x=p[a]*wa+p[b]*wb+p[c]*wc,y=p[a+1]*wa+p[b+1]*wb+p[c+1]*wc,z=p[a+2]*wa+p[b+2]*wb+p[c+2]*wc;if(query(x,y,z,margin,q)<0)return;float d=q[3]/w;for(int k=0;k<3;k++){p[a+k]+=q[k]*d*p[a+3]*wa;p[b+k]+=q[k]*d*p[b+3]*wb;p[c+k]+=q[k]*d*p[c+3]*wc;}virtuals++;}
// Same triangle centroids; each shared edge midpoint has one identity.
static void surface_contact(float*p,int*tri,int nt,int mids,int*edges,int nedges){
 for(int i=0;i<nt;i++)bary_contact(p,tri[i*3],tri[i*3+1],tri[i*3+2],.33333333f,.33333333f,.33333333f,.0024f);
 if(mids)for(int i=0;i<nedges;i++)bary_contact(p,edges[i*2],edges[i*2+1],edges[i*2+1],.5f,.5f,0,.002f);
}
// Finite-iteration safety bound. It is not a calibrated textile constitutive law.
// Let the sheet buckle through dihedral motion rather than collapse its edge metric.
static void metric_guard(float*p,float*e,int ne,float upper,int reverse){
 for(int ii=0;ii<ne;ii++){
 int i=reverse?ne-1-ii:ii,k=i*4;if(e[k+3]>1)continue;
 int a=(int)e[k]*4,b=(int)e[k+1]*4;float w=p[a+3]+p[b+3];if(w<=0)continue;
 float dx=p[a]-p[b],dy=p[a+1]-p[b+1],dz=p[a+2]-p[b+2],d2=dx*dx+dy*dy+dz*dz;
 float lo=e[k+2]*.88f,hi=e[k+2]*upper;
 if(d2>=lo*lo&&d2<=hi*hi)continue;
 float d=sqrtf_(maxf(d2,1e-14f));float target=clampf(d,lo,hi);
 float f=(target-d)/(d*w);p[a]+=dx*f*p[a+3];p[a+1]+=dy*f*p[a+3];p[a+2]+=dz*f*p[a+3];p[b]-=dx*f*p[b+3];p[b+1]-=dy*f*p[b+3];p[b+2]-=dz*f*p[b+3];
 }
}
// Coupled closed weft rows. Cyclic tridiagonal solve (Sherman-Morrison),
// sharing the same XPBD chain equations as the native axial rodBlock.
static int ring_ids[8192];
static float rw[128][12];
static void weft_blocks(float*p,float*e,float*l,int U,int V,float alpha){
for(int row=1;row<V;row++){
 for(int j=0;j<U;j++){int id=ring_ids[row*U+j],k=id*4,a=(int)e[k]*4,b=(int)e[k+1]*4;float dx=p[a]-p[b],dy=p[a+1]-p[b+1],dz=p[a+2]-p[b+2],len=maxf(1e-10f,sqrtf_(dx*dx+dy*dy+dz*dz));rw[j][0]=dx/len;rw[j][1]=dy/len;rw[j][2]=dz/len;rw[j][3]=p[a+3]+p[b+3]+alpha;rw[j][5]=-(len-e[k+2])-alpha*l[id];}
 for(int j=0;j<U;j++){int next=(j+1)%U,b=(int)e[ring_ids[row*U+j]*4+1]*4;rw[j][4]=-p[b+3]*(rw[j][0]*rw[next][0]+rw[j][1]*rw[next][1]+rw[j][2]*rw[next][2]);}
 float corner=rw[U-1][4],gamma=-rw[0][3];
 for(int j=0;j<U;j++){rw[j][7]=rw[j][3];rw[j][8]=rw[j][5];rw[j][9]=0;}
 rw[0][7]-=gamma;rw[U-1][7]-=corner*corner/gamma;rw[0][9]=gamma;rw[U-1][9]=corner;
 for(int j=1;j<U;j++){float q=rw[j-1][4]/maxf(1e-12f,rw[j-1][7]);rw[j][7]-=q*rw[j-1][4];rw[j][8]-=q*rw[j-1][8];rw[j][9]-=q*rw[j-1][9];}
 for(int j=U-1;j>=0;j--){rw[j][10]=(rw[j][8]-(j+1<U?rw[j][4]*rw[j+1][10]:0))/maxf(1e-12f,rw[j][7]);rw[j][11]=(rw[j][9]-(j+1<U?rw[j][4]*rw[j+1][11]:0))/maxf(1e-12f,rw[j][7]);}
 float fact=(rw[0][10]+corner*rw[U-1][10]/gamma)/(1+rw[0][11]+corner*rw[U-1][11]/gamma);
 for(int j=0;j<U;j++)rw[j][6]=rw[j][10]-fact*rw[j][11];
 float maxmove=0;for(int j=0;j<U;j++){int a=(int)e[ring_ids[row*U+j]*4]*4,pr=(j+U-1)%U;float dx=p[a+3]*(rw[j][0]*rw[j][6]-rw[pr][0]*rw[pr][6]),dy=p[a+3]*(rw[j][1]*rw[j][6]-rw[pr][1]*rw[pr][6]),dz=p[a+3]*(rw[j][2]*rw[j][6]-rw[pr][2]*rw[pr][6]);maxmove=maxf(maxmove,sqrtf_(dx*dx+dy*dy+dz*dz));}
 float trust=minf(1,.35f*e[ring_ids[row*U]*4+2]/maxf(1e-10f,maxmove));
 for(int j=0;j<U;j++){int id=ring_ids[row*U+j],a=(int)e[id*4]*4,b=(int)e[id*4+1]*4;float dl=rw[j][6]*trust;l[id]+=dl;for(int k=0;k<3;k++){p[a+k]+=p[a+3]*dl*rw[j][k];p[b+k]-=p[b+3]*dl*rw[j][k];}}
}}

static void shear_edges(float*p,float*e,float*l,int ne,float alpha0,int reverse){for(int ii=0;ii<ne;ii++){int i=reverse?ne-1-ii:ii,k=i*4; if(e[k+3]!=2)continue;int a=(int)e[k]*4,b=(int)e[k+1]*4;float w=p[a+3]+p[b+3];if(w==0)continue;float dx=p[a]-p[b],dy=p[a+1]-p[b+1],dz=p[a+2]-p[b+2],d=sqrtf_(dx*dx+dy*dy+dz*dz);if(d<1e-10f)continue;float alpha=alpha0*(e[k+3]==2?6.f:1.5f),dl=(-(d-e[k+2])-alpha*l[i])/(w+alpha);l[i]+=dl;float s=dl/d;p[a]+=dx*s*p[a+3];p[a+1]+=dy*s*p[a+3];p[a+2]+=dz*s*p[a+3];p[b]-=dx*s*p[b+3];p[b+1]-=dy*s*p[b+3];p[b+2]-=dz*s*p[b+3];}}
static float work[128][7];
static void axial_blocks(float*p,float*e,float*l,int*chain,int U,int V,float alpha){for(int i=0;i<U;i++){
for(int j=0;j<V;j++){int id=chain[i*V+j],k=id*4,a=(int)e[k]*4,b=(int)e[k+1]*4;float dx=p[a]-p[b],dy=p[a+1]-p[b+1],dz=p[a+2]-p[b+2],d=maxf(1e-10f,sqrtf_(dx*dx+dy*dy+dz*dz));work[j][0]=dx/d;work[j][1]=dy/d;work[j][2]=dz/d;work[j][3]=p[a+3]+p[b+3]+alpha;work[j][5]=-(d-e[k+2])-alpha*l[id];}
for(int j=0;j<V-1;j++){int shared=(int)e[chain[i*V+j]*4+1]*4;work[j][4]=-p[shared+3]*(work[j][0]*work[j+1][0]+work[j][1]*work[j+1][1]+work[j][2]*work[j+1][2]);}
for(int j=1;j<V;j++){float r=work[j-1][4]/maxf(work[j-1][3],1e-12f);work[j][3]-=r*work[j-1][4];work[j][5]-=r*work[j-1][5];}
for(int j=V-1;j>=0;j--)work[j][6]=(work[j][5]-(j+1<V?work[j][4]*work[j+1][6]:0))/maxf(1e-12f,work[j][3]);
float maxmove=0;for(int j=1;j<V;j++){int node=(int)e[chain[i*V+j]*4]*4;float dx=0,dy=0,dz=0;dx=p[node+3]*(work[j][0]*work[j][6]-work[j-1][0]*work[j-1][6]);dy=p[node+3]*(work[j][1]*work[j][6]-work[j-1][1]*work[j-1][6]);dz=p[node+3]*(work[j][2]*work[j][6]-work[j-1][2]*work[j-1][6]);maxmove=maxf(maxmove,sqrtf_(dx*dx+dy*dy+dz*dz));}float trust=minf(1,.18f*e[chain[i*V]*4+2]/maxf(maxmove,1e-10f));
for(int j=0;j<V;j++){int id=chain[i*V+j],k=id*4,a=(int)e[k]*4,b=(int)e[k+1]*4;float d=work[j][6]*trust;l[id]+=d;for(int q=0;q<3;q++){p[a+q]+=p[a+3]*work[j][q]*d;p[b+q]-=p[b+3]*work[j][q]*d;}}}}
static void bends(float *p,float *h,float *lambda,int count,float alpha){for(int k=0;k<count;k++){int z=k*6,a=(int)h[z]*4,b=(int)h[z+1]*4,c=(int)h[z+2]*4,d=(int)h[z+3]*4;float ex=p[b]-p[a],ey=p[b+1]-p[a+1],ez=p[b+2]-p[a+2],e2=ex*ex+ey*ey+ez*ez;if(e2<1e-12f)continue;float L=sqrtf_(e2),ux=p[c]-p[a],uy=p[c+1]-p[a+1],uz=p[c+2]-p[a+2],vx=p[d]-p[a],vy=p[d+1]-p[a+1],vz=p[d+2]-p[a+2];float nx=ey*uz-ez*uy,ny=ez*ux-ex*uz,nz=ex*uy-ey*ux,mx=vy*ez-vz*ey,my=vz*ex-vx*ez,mz=vx*ey-vy*ex;float n2=nx*nx+ny*ny+nz*nz,m2=mx*mx+my*my+mz*mz;if(n2<1e-16f||m2<1e-16f)continue;float ang=atan2_((ex*(ny*mz-nz*my)+ey*(nz*mx-nx*mz)+ez*(nx*my-ny*mx))/L,nx*mx+ny*my+nz*mz),C=ang-h[z+4];if(C>3.14159265f)C-=6.283185307f;if(C< -3.14159265f)C+=6.283185307f;float cx=-L*nx/n2,cy=-L*ny/n2,cz=-L*nz/n2,dx=-L*mx/m2,dy=-L*my/m2,dz=-L*mz/m2;float t=(ux*ex+uy*ey+uz*ez)/e2,v=(vx*ex+vy*ey+vz*ez)/e2,ax=(t-1)*cx+(v-1)*dx,ay=(t-1)*cy+(v-1)*dy,az=(t-1)*cz+(v-1)*dz,bx=-t*cx-v*dx,by=-t*cy-v*dy,bz=-t*cz-v*dz;float w0=p[a+3],w1=p[b+3],w2=p[c+3],w3=p[d+3],den=w0*(ax*ax+ay*ay+az*az)+w1*(bx*bx+by*by+bz*bz)+w2*(cx*cx+cy*cy+cz*cz)+w3*(dx*dx+dy*dy+dz*dz);float aa=alpha;if(absf(C)>1.45f){C-=C>0?1.45f:-1.45f;aa=minf(aa,500.f);}float dl=clampf((-C-aa*lambda[k])/(den+aa),-.00012f,.00012f);lambda[k]+=dl;p[a]+=w0*dl*ax;p[a+1]+=w0*dl*ay;p[a+2]+=w0*dl*az;p[b]+=w1*dl*bx;p[b+1]+=w1*dl*by;p[b+2]+=w1*dl*bz;p[c]+=w2*dl*cx;p[c+1]+=w2*dl*cy;p[c+2]+=w2*dl*cz;p[d]+=w3*dl*dx;p[d+1]+=w3*dl*dy;p[d+2]+=w3*dl*dz;}}

// Broadphase particle self-contact, retained at sparse control level.
// This is NOT full triangle CCD. Local topological neighbours are excluded.
static int buckets[4096],nextnode[8192],cx[8192],cy[8192],cz[8192];
static int ihash(int x,int y,int z){return ((unsigned)x*73856093u^(unsigned)y*19349663u^(unsigned)z*83492791u)&4095;}
static int floor_(float x){int i=(int)x;return i-(x<i);}
static void self_contact(float*p,int U,int V){int n=U*(V+1);float cell=.015f,radius=.007f;for(int i=0;i<4096;i++)buckets[i]=-1;for(int i=0;i<n;i++){int k=i*4;cx[i]=floor_(p[k]/cell);cy[i]=floor_(p[k+1]/cell);cz[i]=floor_(p[k+2]/cell);int h=ihash(cx[i],cy[i],cz[i]);nextnode[i]=buckets[h];buckets[h]=i;}for(int i=0;i<n;i++){int a=i*4,ui=i%U,vi=i/U;for(int z=-1;z<=1;z++)for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){int xx=cx[i]+x,yy=cy[i]+y,zz=cz[i]+z;for(int j=buckets[ihash(xx,yy,zz)];j>=0;j=nextnode[j]){if(j<=i||cx[j]!=xx||cy[j]!=yy||cz[j]!=zz)continue;int du=ui-j%U;if(du<0)du=-du;if(du>U/2)du=U-du;int dv=vi-j/U;if(dv<0)dv=-dv;if(du<=1&&dv<=1)continue;int b=j*4;float w=p[a+3]+p[b+3];if(w==0)continue;float dx=p[a]-p[b],dy=p[a+1]-p[b+1],dz=p[a+2]-p[b+2],d2=dx*dx+dy*dy+dz*dz;if(d2<radius*radius&&d2>1e-14f){float d=sqrtf_(d2),s=(radius-d)/d/w;for(int k=0;k<3;k++){float q=k==0?dx:k==1?dy:dz;p[a+k]+=q*s*p[a+3];p[b+k]-=q*s*p[b+3];}}}}}}
EXPORT void solve(float*p,float*prev,float*vel,float*tar,float*co,float*e,float*el,float*h,float*bl,float*rig,float*oldrig,float*tugw,int*chain,int*tri,int*vedges,int nvedges,int U,int V,int ne,int nh,int nt,float dt,float stretch,float bend,float damping,float friction,float tug,int iterations,int self){
 int n=U*(V+1);contacts=virtuals=0;maxdepth=0;query_count=candidate_count=0;prepare(rig,oldrig,dt);grid_build();for(int ci=0,ri=0;ci<ne;ci++)if(e[ci*4+3]==0)ring_ids[ri++]=ci;for(int i=0;i<ne;i++)el[i]=0;for(int i=0;i<nh;i++)bl[i]=0;
 for(int i=0;i<n;i++){int k=i*4;prev[k]=p[k];prev[k+1]=p[k+1];prev[k+2]=p[k+2];co[k+3]=0;if(!p[k+3]){p[k]=tar[k];p[k+1]=tar[k+1];p[k+2]=tar[k+2];continue;}vel[k]*=damping;vel[k+1]=vel[k+1]*damping-9.81f*dt;vel[k+2]=vel[k+2]*damping+tug*tugw[i]*dt*5;p[k]+=vel[k]*dt;p[k+1]+=vel[k+1]*dt;p[k+2]+=vel[k+2]*dt;}
 for(int it=0;it<iterations;it++){if((it&1)==0)bends(p,h,bl,nh,bend/(dt*dt));shear_edges(p,e,el,ne,stretch/(dt*dt),it&1);axial_blocks(p,e,el,chain,U,V,stretch/(dt*dt));weft_blocks(p,e,el,U,V,stretch/(dt*dt));metric_guard(p,e,ne,stretch>1e-7f?1.25f:1.12f,it&1);point_contact(p,tar,co,n,.0026f);if(it==iterations-1)surface_contact(p,tri,nt,0,vedges,nvedges);}
 if(self)self_contact(p,U,V);
 // Virtual face-centre / edge samples return contact corrections to the same sparse DOFs.
 for(int it=0;it<2;it++){for(int q=0;q<3;q++)metric_guard(p,e,ne,stretch>1e-7f?1.25f:1.12f,(it+q)&1);surface_contact(p,tri,nt,1,vedges,nvedges);point_contact(p,tar,co,n,.0026f);}
 for(int i=0;i<n;i++){int k=i*4;if(!p[k+3]){vel[k]=vel[k+1]=vel[k+2]=0;continue;}float vx=(p[k]-prev[k])/dt,vy=(p[k+1]-prev[k+1])/dt,vz=(p[k+2]-prev[k+2])/dt;
 if(co[k+3]){vx-=bodyv[k];vy-=bodyv[k+1];vz-=bodyv[k+2];float vn=vx*co[k]+vy*co[k+1]+vz*co[k+2];vx=(vx-vn*co[k])*friction+maxf(0,vn)*co[k]+bodyv[k];vy=(vy-vn*co[k+1])*friction+maxf(0,vn)*co[k+1]+bodyv[k+1];vz=(vz-vn*co[k+2])*friction+maxf(0,vn)*co[k+2]+bodyv[k+2];}float speed=sqrtf_(vx*vx+vy*vy+vz*vz),cap=minf(1,3/maxf(speed,1e-8f));vel[k]=vx*cap;vel[k+1]=vy*cap;vel[k+2]=vz*cap;}}
EXPORT int contact_count(){return contacts;}
EXPORT int virtual_count(){return virtuals;}
EXPORT float max_depth(){return maxdepth;}

EXPORT int queries(){return query_count;}
EXPORT int candidates(){return candidate_count;}
