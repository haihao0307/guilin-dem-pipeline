float mMax3(float a,float b,float c) { return max(max(a,b),c); }
float mMax4(float a,float b,float c,float d) { return max(max(a,b),max(c,d)); }

float mCapsule(vec3 p,vec3 a,vec3 b,float r) {
    vec3 d=b-a; float den=dot(d,d);
    if(den<=1e-20) return length(p-a)-r;
    float t=clamp(dot(p-a,d)/den,0.0,1.0);
    return length(p-a-d*t)-r;
}

float mFlatRod(vec3 p,vec3 a,vec3 b,int axis,vec3 extra,bool hasExtra,float width,float eye,float bore,float halfThickness) {
    vec3 q=p;float axial;
    if(axis==0){q.x=a.x;axial=abs(p.x-a.x)-halfThickness;}
    else {q.y=a.y;axial=abs(p.y-a.y)-halfThickness;}
    float body=mCapsule(q,a,b,width);
    body=min(body,min(length(q-a)-eye,length(q-b)-eye));
    float holes=min(length(q-a)-bore,length(q-b)-bore);
    if(hasExtra){body=min(body,length(q-extra)-eye);holes=min(holes,length(q-extra)-bore);}
    return mMax3(body,-holes,axial);
}

float mDisc(vec3 p,vec3 c,int axis,float r,float h){vec3 q=p-c;vec2 v=axis==0?q.yz:axis==1?q.xz:q.xy;return max(length(v)-r,abs(q[axis])-h);}

float mPV(vec3 p,float q,float rearSpindle,float frontSpindle,int part) {
    float r=.1143;float rl=.1263;float rg=.1513;float ro=.1693;float H=.43;
    float wr=mPVWindow(p,-.22);float wf=mPVWindow(p,.22);
    float cr=mAnnulusZ(p,rl-.001,rg,-.252,-.188);float cf=mAnnulusZ(p,rl-.001,rg,.188,.252);
    float lr=mCylY(p,.018,-.215,-rl,-.22);float lf=mCylY(p,.018,-.215,-rl,.22);
    float supply=mCylY(p,.026,0.0,.215,0.0);
    float er=mCylY(p,.020,0.0,.215,-.385);float ef=mCylY(p,.020,0.0,.215,.385);
    float workr=min(min(wr,cr),lr);float workf=min(min(wf,cf),lf);
    float holes=min(min(min(supply,er),ef),min(workr,workf));
    float mainholes=min(min(min(supply,er),ef),min(wr,wf));
    if(part==0)return max(mAnnulusZ(p,rl,ro,-H,H),-holes);
    if(part==1)return max(mAnnulusZ(p,r,rl,-H,H),-mainholes);
    if(part==2)return mAnnulusZ(p,.026,ro,-.452,-.43);
    if(part==3)return mAnnulusZ(p,.026,ro,.43,.452);
    if(part==4)return mAnnulusZ(p,.016,.026,-.452,-.43);
    if(part==5)return mAnnulusZ(p,.016,.026,.43,.452);
    if(part==6)return mCylZ(p,.100,-.24+q,-.16+q);
    if(part==7)return mCylZ(p,.100,.16+q,.24+q);
    if(part==8)return mAnnulusZ(p,.100,r,-.24+q,-.16+q);
    if(part==9)return mAnnulusZ(p,.100,r,.16+q,.24+q);
    if(part==10)return mCylZ(p,.016,rearSpindle,frontSpindle);
    float allvoid=min(mCylZ(p,r,-H,H),holes);
    if(part==11)return max(mCylY(p,.038,0.0,.215,0.0),-allvoid);
    if(part==12)return max(mCylY(p,.032,0.0,.215,-.385),-allvoid);
    if(part==13)return max(mCylY(p,.032,0.0,.215,.385),-allvoid);
    if(part==14)return max(mCylY(p,.030,-.215,-rl,-.22),-allvoid);
    return max(mCylY(p,.030,-.215,-rl,.22),-allvoid);
}

float mPVWindow(vec3 p,float z) {
    // Angular discontinuity at rho=0 is inactive behind the annular lower bound.
    float r=.1143;float period=2.0*3.14159265358979323846/8.0;
    float ann=mAnnulusZ(p,.1133,.1273,z-.020,z+.020);
    if(length(vec2(p.x,p.y))<.09) return ann; // Proven inactive angle, exact field value.
    float angle=atan(p.y,p.x);
    float err=mod(angle+period*.5,period)-period*.5;
    return max(ann,(abs(err)-.21)*r);
}

float mInterval(float z,float lo,float hi) {
    if(hi<=lo)return 1e6;
    return max(lo-z,z-hi);
}

float mAnnulusZ(vec3 p,float ri,float ro,float lo,float hi) {
    float rr=length(vec2(p.x,p.y));return mMax3(ri-rr,rr-ro,mInterval(p.z,lo,hi));
}

float mCylZ(vec3 p,float r,float lo,float hi) { return max(length(vec2(p.x,p.y))-r,mInterval(p.z,lo,hi)); }

float mCylY(vec3 p,float r,float lo,float hi,float z) {
    return max(length(vec2(p.x,p.z-z))-r,mInterval(p.y,lo,hi));
}

vec3 mLocal(vec3 p,float s,float c) { return vec3(p.x,c*p.y-s*p.z,s*p.y+c*p.z); }

float mFlat(vec3 p,vec2 a,vec2 b,float x,float h,float r) {
    vec2 w=vec2(p.y,p.z)-a; vec2 d=b-a;
    float t=clamp(dot(w,d)/dot(d,d),0.0,1.0);
    return max(length(w-d*t)-r,abs(p.x-x)-h);
}

float mBox(vec3 p,vec3 c,vec3 h) {
    vec3 d=abs(p-c)-h;
    return length(max(d,vec3(0.0)))+min(max(max(d.x,d.y),d.z),0.0);
}

float mCylX(vec3 p,vec2 yz,float x,float h,float r) {
    return max(length(vec2(p.y,p.z)-yz)-r,abs(p.x-x)-h);
}

float mBoxInf(vec3 p,vec3 c,vec3 h){vec3 q=abs(p-c)-h;return max(max(q.x,q.y),q.z);}

float stackRingY(vec3 p, vec2 c, float lo, float hi, float ri, float ro) { float rr=length(p.xz-c); float radial=rr-ro; if(ri>0.0)radial=max(radial,ri-rr); return max(radial,max(lo-p.y,p.y-hi)); }
