// Segment boxes schedule the original function solver. They are never object
// faces: every covered sample still solves the original yarn with all3 seeds.
export function yarnSegmentQueryShaders(source){
 const vertex=`#version 300 es
 precision highp float;precision highp int;uniform vec2 uSize;uniform vec3 uEye,uTarget;uniform vec3 uBoundsLow[10],uBoundsHigh[10];uniform float uPitch;uniform ivec2 uGrid;flat out ivec3 segmentCell;
 void main(){int id=gl_InstanceID,seg=id%10,col=(id/10)%uGrid.x,row=id/(10*uGrid.x);segmentCell=ivec3(col,row,seg);vec3 shift=vec3(-float(uGrid.x)*uPitch*.5,-float(uGrid.y)*uPitch*.25,0.),offset=vec3(float(col)*uPitch,float(row)*uPitch*.5,0.)+shift;
 vec3 f=normalize(uTarget-uEye),r=normalize(cross(f,vec3(0.,1.,0.))),up=cross(r,f);vec2 lo=vec2(1.e20),hi=vec2(-1.e20);float nearZ=1.e20,farZ=-1.e20;
 for(int k=0;k<8;k++){vec3 p=mix(uBoundsLow[seg],uBoundsHigh[seg],bvec3((k&1)!=0,(k&2)!=0,(k&4)!=0))+offset-uEye;float z=dot(p,f);nearZ=min(nearZ,z);farZ=max(farZ,z);vec2 q=vec2(dot(p,r)/(max(.000001,z)*.34*uSize.x/uSize.y),dot(p,up)/(max(.000001,z)*.34));lo=min(lo,q);hi=max(hi,q);}
 lo-=vec2(2.)/uSize;hi+=vec2(2.)/uSize;if(nearZ<=.001){lo=vec2(-1.);hi=vec2(1.);}if(farZ<=0.||lo.x>1.||hi.x< -1.||lo.y>1.||hi.y< -1.){gl_Position=vec4(2.,2.,0.,1.);return;}
 int n=gl_VertexID;vec2 corner=vec2((n==1||n==2||n==4)?1.:0.,(n==2||n==4||n==5)?1.:0.);gl_Position=vec4(mix(max(lo,vec2(-1.)),min(hi,vec2(1.)),corner),0.,1.);}
 `;
 const fragment=`#version 300 es
 precision highp float;precision highp int;uniform vec2 uSize;uniform vec3 uEye,uTarget;flat in ivec3 segmentCell;layout(location=0)out vec4 outColor;layout(location=1)out vec4 outDepth;
 ${source}
 void main(){vec3 f=normalize(uTarget-uEye),r=normalize(cross(f,vec3(0.,1.,0.))),up=cross(r,f);vec2 q=(gl_FragCoord.xy/uSize*2.-1.)*vec2(uSize.x/uSize.y,1.);vec3 rd=normalize(f+(r*q.x+up*q.y)*.34),ro=uEye-vec3(-float(uGrid.x)*uPitch*.5,-float(uGrid.y)*uPitch*.25,0.);
 vec3 lo=vec3(-uRadius,-uPitch*.5-uRadius,-uPitch*.3-uRadius*1.15),hi=vec3(float(uGrid.x)*uPitch+uRadius,float(uGrid.y)*uPitch*.5+uPitch*.7+uRadius,uPitch*.3+uRadius*1.15);vec2 span=boxSpan(ro,rd,lo,hi);if(span.x>span.y||span.y<0.)discard;
 vec3 a=ro+rd*max(0.,span.x),b=ro+rd*span.y;ivec2 low=max(ivec2(0),ivec2(floor(min(a.xy,b.xy)/vec2(uPitch,uPitch*.5)))-ivec2(1,2)),high=min(uGrid-1,ivec2(floor(max(a.xy,b.xy)/vec2(uPitch,uPitch*.5)))+ivec2(1,2));
 int col=segmentCell.x,row=segmentCell.y,seg=segmentCell.z;if(col<low.x||col>high.x||row<low.y||row>high.y||col-low.x>=12||row-low.y>=16)discard;
 vec3 offset=vec3(float(col)*uPitch,float(row)*uPitch*.5,0.);vec2 box=boxSpan(ro,rd,offset+uBoundsLow[seg],offset+uBoundsHigh[seg]);if(box.x>box.y||box.y<0.)discard;
 float best=1.e9,lower=float(col)+float(seg)*.1,upper=lower+.1;vec3 hit=vec3(0.);for(int trial=0;trial<3;trial++){vec3 h;if(solveYarnInView(ro,rd,float(row),lower,upper,trial==0?.5:trial==1?.12:.88,h)&&h.z<best){best=h.z;hit=h;}}
 if(best>1.e8)discard;vec3 colour=shadeYarn(ro,rd,hit,float(row));outColor=vec4(colour,1.);outDepth=vec4(best);gl_FragDepth=clamp(best/1.e6,0.,1.);}
 `;
 const resolve=`#version 300 es
 precision highp float;precision highp int;uniform sampler2D uQueryColour,uQueryDepth;layout(location=0)out vec4 outColor;layout(location=1)out vec4 outDepth;
 void main(){ivec2 p=ivec2(gl_FragCoord.xy)*2;vec3 c=vec3(0.);float depth=1.e9;for(int i=0;i<4;i++){ivec2 q=p+ivec2(i&1,i>>1);c+=texelFetch(uQueryColour,q,0).rgb*.25;depth=min(depth,texelFetch(uQueryDepth,q,0).r);}if(depth>=1.e8)discard;outColor=vec4(c,1.);outDepth=vec4(depth);gl_FragDepth=clamp(depth/1.e6,0.,1.);}
 `;
 return{vertex,fragment,resolve};
}
