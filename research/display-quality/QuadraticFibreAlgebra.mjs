// Algebra experiment, isolated from the accepted renderer. Reordered floating
// point Newton arithmetic is NOT assumed to reproduce the original iterations.
export function quadraticFibreAlgebra(source,mode='polynomial'){
 if(!['original','polynomial','projected'].includes(mode))throw Error('Unknown algebra experiment');if(mode==='original')return source;
 const start=source.indexOf('float best=1.e9,tbest=0.;'),end=source.indexOf('  vec3 p=path(a.xyz,b.xyz,c.xyz,d.xyz,b.w,tbest),q=p-ro;',start);if(start<0||end<0)throw Error('Quadratic algebra source anchors changed');
 const original=source.slice(start,end),body=original.slice(original.indexOf('for(int seed='));
 const next=mode==='polynomial'?`
 float c0=dot(q0,s),c1=dot(s,s)+2.*dot(q0,z),c2=3.*dot(s,z),c3=2.*dot(z,z);
 for(int seed=0;seed<3;seed++){float t=(float(seed)+.5)/3.;for(int j=0;j<6;j++){float num=((c3*t+c2)*t+c1)*t+c0,den=(3.*c3*t+2.*c2)*t+c1;if(abs(den)<1.e-10)break;float nextT=clamp(t-clamp(num/den,-.22,.22),0.,1.);if(uStopAtExactStall&&floatBitsToUint(nextT)==floatBitsToUint(t)){t=nextT;break;}t=nextT;}
 vec3 p=path(a.xyz,b.xyz,c.xyz,d.xyz,b.w,t),q=p-ro;float dist=length(q-rd*dot(q,rd));if(dist<best){best=dist;tbest=t;}}
 `:`
 for(int seed=0;seed<3;seed++){float t=(float(seed)+.5)/3.;for(int j=0;j<6;j++){vec3 p=path(a.xyz,b.xyz,c.xyz,d.xyz,b.w,t),q=p-ro,r=q-rd*dot(q,rd),dp=s+2.*z*t;float den=dot(dp,dp)+dot(r,2.*z);if(abs(den)<1.e-10)break;float nextT=clamp(t-clamp(dot(r,dp)/den,-.22,.22),0.,1.);if(uStopAtExactStall&&floatBitsToUint(nextT)==floatBitsToUint(t)){t=nextT;break;}t=nextT;}
 vec3 p=path(a.xyz,b.xyz,c.xyz,d.xyz,b.w,t),q=p-ro;float dist=length(q-rd*dot(q,rd));if(dist<best){best=dist;tbest=t;}}
 `;
 const replacement=`float best=1.e9,tbest=0.;if(uQuadraticFibre){vec3 q=a.xyz-ro,q0=q-rd*dot(q,rd),s=b.xyz-rd*dot(b.xyz,rd),z=c.xyz-rd*dot(c.xyz,rd);${next}}else{${body}}\n`;
 return source.slice(0,start)+replacement+source.slice(end);
}
