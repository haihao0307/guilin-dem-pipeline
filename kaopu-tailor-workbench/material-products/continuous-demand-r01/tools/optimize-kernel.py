from pathlib import Path
root=Path(__file__).resolve().parents[1]
src=(root/'baseline/cloth-kernel.c').read_text(encoding='utf-8')
cache='''
/* Bounded, revisioned triangle-coefficient cache. No contacts are omitted.
 * Queries share it only while the TARGET mesh is unchanged. All writes and
 * JS-driven refits invalidate it. Two-way pair projection uses the raw path. */
typedef struct {double*p;int*F;int nf;double*data;u32*stamp;u32 revision;} TC;
static TC tri_cache[8];static int tri_cache_count=0;static TC*active_tc=0;static int cache_enabled=1;
__attribute__((export_name("set_cache_enabled"))) void set_cache_enabled(int enabled){cache_enabled=enabled;}
static TC*find_tc(double*p,int*F){for(int i=0;i<tri_cache_count;i++)if(tri_cache[i].p==p&&tri_cache[i].F==F)return tri_cache+i;return 0;}
static void dirty(double*p){for(int i=0;i<tri_cache_count;i++)if(tri_cache[i].p==p)tri_cache[i].revision++;}
static void register_tc(double*p,int*F,int nf){TC*c=find_tc(p,F);if(c){c->revision++;return;}if(tri_cache_count>=8)return;c=tri_cache+tri_cache_count++;c->p=p;c->F=F;c->nf=nf;c->revision=1;c->data=(double*)alloc(nf*19*sizeof(double));c->stamp=(u32*)alloc(nf*sizeof(u32));memset(c->stamp,0,nf*sizeof(u32));}
static double*triangle_coefficients(double*p,int*F,int f){TC*c=active_tc;if(!c||c->p!=p||c->F!=F)return 0;int id=f/3;double*r=c->data+id*19;if(c->stamp[id]==c->revision)return r;
int a=F[f]*3,b=F[f+1]*3,d=F[f+2]*3;for(int k=0;k<3;k++){r[k]=p[a+k];r[3+k]=p[b+k]-p[a+k];r[6+k]=p[d+k]-p[a+k];r[13+k]=mn(p[a+k],mn(p[b+k],p[d+k]));r[16+k]=mx(p[a+k],mx(p[b+k],p[d+k]));}
r[9]=r[3]*r[3]+r[4]*r[4]+r[5]*r[5];r[10]=r[6]*r[6]+r[7]*r[7]+r[8]*r[8];r[11]=r[3]*r[6]+r[4]*r[7]+r[5]*r[8];r[12]=r[9]*r[10]-r[11]*r[11];c->stamp[id]=c->revision;return r;}
'''
anchor='__attribute__((export_name("predict")))'
src=src.replace(anchor,cache+'\n'+anchor)
src=src.replace('double damp,double g){for','double damp,double g){dirty(p);for')
src=src.replace('int n,double alpha){for(int i=0;i<n;i++)','int n,double alpha){dirty(p);for(int i=0;i<n;i++)')
src=src.replace('int n,double lo,double hi){for','int n,double lo,double hi){dirty(p);for')
src=src.replace('int n,double alpha){for(int j=0;j<n;j++)','int n,double alpha){dirty(p);for(int j=0;j<n;j++)')
old='double ax=p[ia],ay=p[ia+1],az=p[ia+2],ux=p[ib]-ax,uy=p[ib+1]-ay,uz=p[ib+2]-az,vx=p[ic]-ax,vy=p[ic+1]-ay,vz=p[ic+2]-az,wx=x-ax,wy=y-ay,wz=z-az,uu=ux*ux+uy*uy+uz*uz,vv=vx*vx+vy*vy+vz*vz,uv=ux*vx+uy*vy+uz*vz,wu=wx*ux+wy*uy+wz*uz,wv=wx*vx+wy*vy+wz*vz,den=uu*vv-uv*uv,'
new='double*rr=triangle_coefficients(p,F,f);double ax=rr?rr[0]:p[ia],ay=rr?rr[1]:p[ia+1],az=rr?rr[2]:p[ia+2],ux=rr?rr[3]:p[ib]-ax,uy=rr?rr[4]:p[ib+1]-ay,uz=rr?rr[5]:p[ib+2]-az,vx=rr?rr[6]:p[ic]-ax,vy=rr?rr[7]:p[ic+1]-ay,vz=rr?rr[8]:p[ic+2]-az,wx=x-ax,wy=y-ay,wz=z-az,uu=rr?rr[9]:ux*ux+uy*uy+uz*uz,vv=rr?rr[10]:vx*vx+vy*vy+vz*vz,uv=rr?rr[11]:ux*vx+uy*vy+uz*vz,wu=wx*ux+wy*uy+wz*uz,wv=wx*vx+wy*vy+wz*vz,den=rr?rr[12]:uu*vv-uv*uv,'
assert old in src
src=src.replace(old,new)
src=src.replace('active_tc=kind?find_tc(P,F):0;', 'active_tc=cache_enabled&&kind?find_tc(P,F):0;')
src=src.replace('active_tc=oneWay?find_tc(P,F):0;', 'active_tc=cache_enabled&&oneWay?find_tc(P,F):0;')
src=src.replace('int count){for(int i=0;i<count*3;i++)N[i]=0;','int count){register_tc(p,F,nFaces);for(int i=0;i<count*3;i++)N[i]=0;')
src=src.replace('int dense){int contacts=0;','int dense){dirty(p);active_tc=kind?find_tc(P,F):0;int contacts=0;')
src=src.replace('return contacts;}','active_tc=0;return contacts;}')
src=src.replace('int oneWay){int count=0;','int oneWay){dirty(p);if(!oneWay)dirty(P);active_tc=oneWay?find_tc(P,F):0;int count=0;')
src=src.replace('int oneWay){\n int count=0;','int oneWay){\n dirty(p);if(!oneWay)dirty(P);active_tc=oneWay?find_tc(P,F):0;int count=0;')
src=src.replace('return count;}', 'active_tc=0;return count;}').replace('return count;\n}', 'active_tc=0;return count;\n}')
# The lazy triangle bounds are valid under the same target revision.
old='int f=order[i];closest(p,F,f,x,y,z,tmp);'
new='int f=order[i];double*r=triangle_coefficients(p,F,f);if(r){double dx=mx(0,mx(r[13]-x,x-r[16])),dy=mx(0,mx(r[14]-y,y-r[17])),dz=mx(0,mx(r[15]-z,z-r[18]));if(dx*dx+dy*dy+dz*dz>best)continue;}closest(p,F,f,x,y,z,tmp);'
assert old in src
src=src.replace(old,new)
certificate='''
/* Query certificates are valid only at a fixed target-mesh revision.
 * A reused winner must stay closer than the lower bound on EVERY competing
 * triangle. Lipschitz distance bounds account for movement of the query. */
typedef struct {int*key;int count;double*data;u32*stamp;TC*target;} QC;
static QC query_caches[8];static int query_cache_count=0;static QC*active_qc=0;
static double nearest_second=1e30;static u32 exact_hits=0,certificate_hits=0,full_queries=0;
static QC*query_cache(int*key,int count,TC*target){if(!target)return 0;for(int i=0;i<query_cache_count;i++)if(query_caches[i].key==key)return query_caches+i;if(query_cache_count>=8)return 0;QC*c=query_caches+query_cache_count++;c->key=key;c->count=count;c->data=(double*)alloc(count*14*sizeof(double));c->stamp=(u32*)alloc(count*sizeof(u32));memset(c->stamp,0,count*sizeof(u32));c->target=target;return c;}
__attribute__((export_name("cache_exact_hits"))) u32 cache_exact_hits(){return exact_hits;}
__attribute__((export_name("cache_certificate_hits"))) u32 cache_certificate_hits(){return certificate_hits;}
__attribute__((export_name("cache_full_queries"))) u32 cache_full_queries(){return full_queries;}
'''
src=src.replace('static int nearest(',certificate+'\nstatic int nearest_base(')
src=src.replace('double best=maxd*maxd,tmp[7];','double best=maxd*maxd,tmp[7],second=1e30;')
src=src.replace('if(dx*dx+dy*dy+dz*dz>best)continue;', 'if(dx*dx+dy*dy+dz*dz>best){second=mn(second,dx*dx+dy*dy+dz*dz);continue;}')
src=src.replace('if(tmp[0]<best){best=tmp[0];winner=f;for(int k=0;k<7;k++)q[k]=tmp[k];}', 'if(tmp[0]<best){if(winner>=0&&winner!=f)second=mn(second,best);best=tmp[0];winner=f;for(int k=0;k<7;k++)q[k]=tmp[k];}else if(f!=winner)second=mn(second,tmp[0]);')
src=src.replace('return winner;}','nearest_second=second;return winner;}')
wrapper='''
static int certified_nearest(double*p,int*F,double*nodes,int*order,double x,double y,double z,double maxd,int seed,double*q,QC*c,int id){
if(c&&id>=0&&id<c->count&&c->target->p==p&&c->target->F==F&&c->stamp[id]==c->target->revision){double*r=c->data+id*14;int f=(int)r[3];double delta=len3(x-r[0],y-r[1],z-r[2]);
if(delta==0){exact_hits++;if(f>=0)for(int k=0;k<7;k++)q[k]=r[7+k];return f;}
if(f>=0&&__builtin_sqrt(r[4])+delta+1.e-9<__builtin_sqrt(r[5])-delta){certificate_hits++;closest(p,F,f,x,y,z,q);return f;}
if(f<0&&maxd+delta+1.e-9<__builtin_sqrt(r[5])){certificate_hits++;return -1;}}
full_queries++;int f=nearest_base(p,F,nodes,order,x,y,z,maxd,seed,q);
if(c&&id>=0&&id<c->count){double*r=c->data+id*14;r[0]=x;r[1]=y;r[2]=z;r[3]=f;r[4]=f>=0?q[0]:maxd*maxd;r[5]=nearest_second;r[6]=maxd;if(f>=0)for(int k=0;k<7;k++)r[7+k]=q[k];c->stamp[id]=c->target->revision;}return f;}
'''
src=src.replace('static void mesh_sample(',wrapper+'\nstatic void mesh_sample(')
src=src.replace('nearest(p,F,nodes,order,x,y,z,1e20,f,q)','certified_nearest(p,F,nodes,order,x,y,z,1e20,f,q,active_qc,active_qc?(int)(cache-active_qc->key):-1)')
src=src.replace('active_tc=kind?find_tc(P,F):0;int contacts=0;', 'active_tc=kind?find_tc(P,F):0;active_qc=query_cache(cache,count+ne+nf,active_tc);int contacts=0;')
project_start=src.index('__attribute__((export_name("pair_project")))')
project_end=src.index('__attribute__((export_name("query_mesh")))',project_start)
part=src[project_start:project_end].replace('active_tc=oneWay?find_tc(P,F):0;','active_tc=oneWay?find_tc(P,F):0;active_qc=query_cache(cache,n,active_tc);').replace('nearest(P,F,B,O,x,y,z,.045,f,q)','certified_nearest(P,F,B,O,x,y,z,.045,f,q,active_qc,i)')
src=src[:project_start]+part+src[project_end:]
project_start=src.index('__attribute__((export_name("pair_surface")))')
part=src[project_start:].replace('active_tc=oneWay?find_tc(P,F):0;','active_tc=oneWay?find_tc(P,F):0;active_qc=query_cache(cache,ne+nf,active_tc);').replace('nearest(P,F,B,O,x,y,z,.045,f,q)','certified_nearest(P,F,B,O,x,y,z,.045,f,q,active_qc,ci)')
src=src[:project_start]+part
src=src.replace('active_tc=0;return','active_tc=0;active_qc=0;return')
src+='''
/* Independently evaluated, unit-bearing stopping diagnostics. */
__attribute__((export_name("elastic_residual"))) double elastic_residual(double*p,double*e,int n,double alpha){double r=0;for(int i=0;i<n;i++){double*a=e+i*4;int A=(int)a[0]*3,B=(int)a[1]*3;double C=len3(p[A]-p[B],p[A+1]-p[B+1],p[A+2]-p[B+2])-a[2];r=mx(r,__builtin_fabs(C+alpha*a[3]));}return r;}
__attribute__((export_name("strain_residual"))) double strain_residual(double*p,double*e,int n,double lo,double hi){double r=0;for(int i=0;i<n;i++){double*a=e+i*4;int A=(int)a[0]*3,B=(int)a[1]*3;double L=len3(p[A]-p[B],p[A+1]-p[B+1],p[A+2]-p[B+2]);r=mx(r,mx(lo*a[2]-L,L-hi*a[2]));}return mx(0,r);}
__attribute__((export_name("bending_residual"))) double bending_residual(double*p,double*b,int n,double alpha){double worst=0;for(int j=0;j<n;j++){double*r=b+j*6;int a=(int)r[0]*3,c=(int)r[1]*3,d=(int)r[2]*3,e=(int)r[3]*3;double ex=p[c]-p[a],ey=p[c+1]-p[a+1],ez=p[c+2]-p[a+2],ux=p[d]-p[a],uy=p[d+1]-p[a+1],uz=p[d+2]-p[a+2],vx=p[e]-p[a],vy=p[e+1]-p[a+1],vz=p[e+2]-p[a+2],nx=ey*uz-ez*uy,ny=ez*ux-ex*uz,nz=ex*uy-ey*ux,mx0=vy*ez-vz*ey,my=vz*ex-vx*ez,mz=vx*ey-vy*ex,L=len3(ex,ey,ez);if(L<1e-12)continue;double C=atan2((ex*(ny*mz-nz*my)+ey*(nz*mx0-nx*mz)+ez*(nx*my-ny*mx0))/L,nx*mx0+ny*my+nz*mz)-r[5];worst=mx(worst,__builtin_fabs(C+alpha*r[4]));}return worst;}
'''
src=src.replace('active_tc=kind?find_tc(P,F):0;', 'active_tc=cache_enabled\u0026\u0026kind?find_tc(P,F):0;').replace('active_tc=oneWay?find_tc(P,F):0;', 'active_tc=cache_enabled\u0026\u0026oneWay?find_tc(P,F):0;')
(root/'candidate/cloth-kernel.c').write_text(src,encoding='utf-8')
