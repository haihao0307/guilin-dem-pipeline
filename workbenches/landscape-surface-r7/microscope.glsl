// Surface-only adaptation of the 17-octave logarithmic microscope field.
// The derivative of each band is evaluated before amplitude compression.
// Pixel-footprint integration is antialiasing of one fixed field, not geometry LOD.
vec4 mmNoiseD(vec3 p){
    vec3 i=floor(p),f=fract(p),u=f*f*(3.-2.*f),du=6.*f*(1.-f);
    float a=bmH(i),b=bmH(i+vec3(1,0,0)),c=bmH(i+vec3(0,1,0)),d=bmH(i+vec3(1,1,0));
    float e=bmH(i+vec3(0,0,1)),ff=bmH(i+vec3(1,0,1)),g=bmH(i+vec3(0,1,1)),h=bmH(i+vec3(1,1,1));
    float lo=mix(mix(a,b,u.x),mix(c,d,u.x),u.y),hi=mix(mix(e,ff,u.x),mix(g,h,u.x),u.y);
    return vec4(mix(lo,hi,u.z),
        du.x*mix(mix(b-a,d-c,u.y),mix(ff-e,h-g,u.y),u.z),
        du.y*mix(mix(c-a,d-b,u.x),mix(g-e,h-ff,u.x),u.z),du.z*(hi-lo));
}
vec3 mmRow(mat3 J,int i){return vec3(J[0][i],J[1][i],J[2][i]);}
void mmRotateD(inout vec3 q,inout mat3 J,vec3 center,vec3 axis,float angle,vec3 da){
    axis=normalize(axis);vec3 v=mmRot(q-center,axis,angle),tangent=cross(axis,v);
    J=mat3(mmRot(J[0],axis,angle)+tangent*da.x,mmRot(J[1],axis,angle)+tangent*da.y,mmRot(J[2],axis,angle)+tangent*da.z);
    q=center+v;
}
void mmFrameD(vec3 rawQ,out vec3 q,out mat3 J){
    q=rawQ*.155+vec3(5.7,-3.9,2.6);J=mat3(.155);
    float R=max(length(q),1e-5),lr=log2(R);vec3 dlr=.155*q/(R*R*.69314718056);
    vec4 wx=mmNoiseD(q*.41+vec3(3.1,7.2,-2.4)),wy=mmNoiseD(q*.37+vec3(-8.3,2.7,4.6)),wz=mmNoiseD(q*.43+vec3(1.5,-6.4,9.1));
    q+=.38*(vec3(wx.x,wy.x,wz.x)-.5);
    J+=.38*transpose(mat3(wx.yzw*(.41*.155),wy.yzw*(.37*.155),wz.yzw*(.43*.155)));
    float t1=lr*2.15+q.y*.31,t2=q.z*.47-q.x*.29,a=.24*(.62*sin(t1)+.38*sin(t2));
    vec3 da=.24*(.62*cos(t1)*(2.15*dlr+.31*mmRow(J,1))+.38*cos(t2)*(.47*mmRow(J,2)-.29*mmRow(J,0)));
    mmRotateD(q,J,vec3(.8,-.4,.3),vec3(.31,.86,.39),a,da);
    float t3=lr*3.4+q.x*.21-q.z*.17,b=.10*sin(t3);
    vec3 db=.10*cos(t3)*(3.4*dlr+.21*mmRow(J,0)-.17*mmRow(J,2));
    mmRotateD(q,J,vec3(-1.2,.7,-.6),vec3(-.72,.18,.67),b,db);
}

vec4 mmRelief(vec3 rawQ){
    vec3 f;mat3 J;mmFrameD(rawQ,f,J);
    float R=max(length(f),1e-5),r2=R*R,xy2=max(dot(f.xy,f.xy),1e-5);
    const mat3 phase=mat3(.36,.48,-.80,-.80,.60,0.,.48,.64,.60);
    // A fixed spatial phase exposes sub-millimetre bands on the same rock.
    // It is independent of camera zoom, time, viewport, and frame number.
    vec3 z=vec3(log2(R)-2.2,-f.z/R-1.,atan(f.x,f.y))+.47*phase*rawQ;
    vec3 j0=transpose(J)*(f/(r2*.69314718056))+.47*mmRow(phase,0);
    vec3 j1=transpose(J)*(f.z*f/(r2*R)-vec3(0.,0.,1./R))+.47*mmRow(phase,1);
    vec3 j2=transpose(J)*(vec3(f.y,-f.x,0.)/xy2)+.47*mmRow(phase,2);
    vec3 fx=dFdx(rawQ),fy=dFdy(rawQ);
    vec3 zx=vec3(dot(j0,fx),dot(j1,fx),dot(j2,fx));
    vec3 zy=vec3(dot(j0,fy),dot(j1,fy),dot(j2,fy));
    float footprint2=max(dot(zx,zx),dot(zy,zy)),sc=1.,h=0.;
    vec3 grad=vec3(0.);
    for(int j=0;j<17;j++){
        vec3 c=cos(z*sc),sn=sin(z*sc);
        float v=c.z*c.x+c.y*c.y+c.y*c.x;
        float band=smoothstep(4.,6.,float(j))*pow(.96,max(0.,float(j)-6.));
        float integrated=exp(-.5*sc*sc*footprint2),w=band*integrated;
        h+=w*(cos(v)-.45)/sc;
        grad+=w*sin(v)*vec3(sn.x*(c.z+c.y),sn.y*(2.*c.y+c.x),sn.z*c.x);
        sc*=2.;
    }
    float bounded=tanh(h*.18/.018),chain=.18*(1.-bounded*bounded);
    return vec4(.018*bounded,chain*(grad.x*j0+grad.y*j1+grad.z*j2));
}

// Compact, isolated 3D pit cells. Their support stays inside the cell, so
// floor() cannot create tile seams. A second rotated field removes grid alignment.
float mmPits(vec3 v){
    vec3 cell=floor(v),local=fract(v);
    vec3 center=.34+.32*vec3(bmH(cell+vec3(17.,9.,2.)),bmH(cell+vec3(3.,23.,7.)),bmH(cell+vec3(8.,1.,31.)));
    float seed=bmH(cell+43.),radius=mix(.13,.29,bmH(cell+71.));
    vec3 axis=vec3(1.,.62+.33*bmH(cell+15.),.75+.22*bmH(cell+67.));
    float r=length((local-center)/(radius*axis));
    return (1.-smoothstep(.20,1.,r))*smoothstep(.32,.60,seed);
}

vec3 mmPoreLayers(vec3 q){
    const mat3 turn=mat3(.36,.48,-.80,-.80,.60,0.,.48,.64,.60);
    vec3 v=q*11.7+vec3(2.3,-1.7,4.9),v2=turn*q*27.3+vec3(13.1,7.9,-2.7);
    float footprint=max(length(dFdx(q)),length(dFdy(q)));
    float w=exp(-pow(footprint*11.7,2.)*3.),w2=exp(-pow(footprint*27.3,2.)*3.);
    float pits=mmPits(v)*w+.45*mmPits(v2)*w2;
    float crystal=bmN(turn*q*146.7+vec3(3.,7.,11.));
    crystal=mix(.5,crystal,exp(-pow(footprint*146.7,2.)*2.));
    float granules=bmN(q*53.1+vec3(37.,19.,5.));
    granules=mix(.5,granules,exp(-pow(footprint*53.1,2.)*2.));
    return vec3(pits,crystal,granules);
}

// Grain boundaries are finite surface etching, never new macro cracks.
// Nearest and second-nearest seed identity form a symmetric, stable pair.
vec3 mmGrainBoundary(vec3 q){
    const mat3 turn=mat3(.36,.48,-.80,-.80,.60,0.,.48,.64,.60);
    vec3 warp=vec3(bmN(q*12.1+3.),bmN(q*11.7+17.),bmN(q*13.3+31.))-.5;
    vec3 v=turn*q*63.7+warp*.65+vec3(7.1,19.3,-4.7),base=floor(v),local=fract(v);
    float d1=20.,d2=20.,id1=0.,id2=0.;
    for(int z=-1;z<=1;z++)for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
        vec3 offset=vec3(float(x),float(y),float(z)),cell=base+offset;
        vec3 seed=.20+.60*vec3(bmH(cell+vec3(13.,2.,7.)),bmH(cell+vec3(5.,17.,3.)),bmH(cell+vec3(1.,11.,29.)));
        vec3 dv=offset+seed-local;float dist=dot(dv,dv),id=bmH(cell+97.);
        if(dist<d1){d2=d1;id2=id1;d1=dist;id1=id;}
        else if(dist<d2){d2=dist;id2=id;}
    }
    float edge=sqrt(d2)-sqrt(d1),pair=fract(id1+id2);
    float footprint=max(length(dFdx(v)),length(dFdy(v)));
    float integrated=exp(-3.*footprint*footprint);
    float groove=(1.-smoothstep(.015,.09,edge))*smoothstep(.86,.98,pair);
    groove*=integrated;
    float crystal=smoothstep(.82,.97,id1)*smoothstep(.025,.18,edge)*integrated;
    float mineral=(bmN(turn*q*43.7+vec3(4.,11.,23.))-.5)*integrated;
    return vec3(groove,crystal,mineral);
}
