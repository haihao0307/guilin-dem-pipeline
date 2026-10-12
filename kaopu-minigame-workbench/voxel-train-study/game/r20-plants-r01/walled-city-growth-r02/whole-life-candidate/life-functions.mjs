/** Authored functional assemblies, ordinary metre-scale joinery. No meshes or sampled fields. */
export const LIFE_FUNCTIONS=String.raw`
fn('life_member','hh:GeoHit,x:f32,y:f32,z:f32,hx:f32,hy:f32,hz:f32,axis:i32,m:u32,b:u32,c:u32,s:u32','GeoHit',\`
 var q=vec3f(x,y,z);if(axis==1){q=vec3f(y,x,z);}if(axis==2){q=vec3f(z,y,x);}
 var d=geo_box(q.x,q.y,q.z,hx-0.002,hy-0.002,hz-0.002)-0.002;var n=geo_axis(q.x,q.y,q.z,hx,hy,hz);
 if(axis==1){n=vec3f(n.y,n.x,n.z);}if(axis==2){n=vec3f(n.z,n.y,n.x);}return geo_take(hh,d,m,b,c,s,q,n);
\`);
fn('life_bed','hh:GeoHit,x:f32,y:f32,z:f32,b:u32,c:u32,s:u32','GeoHit',\`
 var h=hh;var bounds=geo_box(x,y-0.50,z,0.50,0.52,1.01);if(bounds>h.d){return h;}
 // Four continuous posts. Head posts are taller; source +X is each real member's long axis.
 for(var k=0;k<4;k=k+1){var xx=select(-0.43,0.43,k%2==1);var zz=select(-0.94,0.94,k>=2);var hhg=select(0.46,0.91,k<2);h=life_member(h,x-xx,y-hhg*0.5,z-zz,hhg*0.5,0.036,0.036,1,4u,b,c+u32(k),s);}
 for(var k=0;k<2;k=k+1){var xx=select(-0.43,0.43,k==1);h=life_member(h,x-xx,y-0.345,z,0.94,0.066,0.022,2,4u,b,c+4u+u32(k),s);var zz=select(-0.94,0.94,k==1);h=life_member(h,x,y-0.345,z-zz,0.43,0.066,0.022,0,4u,b,c+6u+u32(k),s);}
 // Discrete slats are analytic repeated members, not an instance table.
 var slat=clamp(round((z+0.81)/0.18),0.0,9.0);h=life_member(h,x,y-0.397,z-(-0.81+slat*0.18),0.408,0.013,0.063,0,4u,b,c+8u+u32(slat),s);
 for(var k=0;k<2;k=k+1){h=life_member(h,x,y-(0.61+0.19*f32(k)),z+0.94,0.40,0.042,0.018,0,4u,b,c+18u+u32(k),s);}
 // A mattress and folded cover have their own physical volume. R6.1 field binding is separate, never called wood.
 var roll=0.012*cos(z*3.1)+0.008*cos(x*8.0+z*1.7);var cover=geo_box(x,y-0.476-roll,z,0.40,0.050,0.90)-0.018;
 h=geo_take(h,cover,7u,b,c+20u,s,vec3f(x,y-0.476,z),geo_axis(x,y-0.476,z,0.42,0.068,0.92));
 var pillow=geo_box(x,y-0.565,z+0.68,0.27,0.038,0.11)-0.042;h=geo_take(h,pillow,7u,b,c+21u,s,vec3f(x,y-0.565,z+0.68),geo_axis(x,y-0.565,z+0.68,0.312,0.08,0.152));
 // Visible dowel heads at rail/post joints; the member overlap is the authored tenon seat.
 for(var k=0;k<4;k=k+1){var xx=select(-0.466,0.466,k%2==1);var zz=select(-0.927,0.927,k>=2);var dd=max(sqrt((y-0.345)*(y-0.345)+(z-zz)*(z-zz))-0.007,abs(x-xx)-0.003);h=geo_take(h,dd,4u,b,c+22u+u32(k),s,vec3f(x-xx,y-0.345,z-zz),vec3f(select(-1.0,1.0,k%2==1),0.0,0.0));}
 return h;
\`);
fn('life_water','hh:GeoHit,x:f32,y:f32,z:f32,b:u32,c:u32,s:u32','GeoHit',\`
 var h=hh;var bounds=geo_box(x,y-0.56,z,0.55,0.59,0.37);if(bounds>h.d){return h;}
 // Repairable metal trough: rounded shell, open top, drain aperture and supported lip.
 var outer=geo_box(x,y-0.695,z,0.46,0.095,0.225)-0.025;var inner=geo_box(x,y-0.741,z,0.435,0.115,0.200)-0.018;var shell=max(outer,-inner);var drain=max(sqrt(x*x+(z+0.10)*(z+0.10))-0.020,abs(y-0.60)-0.10);shell=max(shell,-drain);
 h=geo_take(h,shell,3u,b,c,s,vec3f(x,y-0.695,z),geo_axis(x,y-0.695,z,0.485,0.12,0.25));
 for(var k=0;k<2;k=k+1){var xx=select(-0.38,0.38,k==1);h=geo_cube(h,x-xx,y-0.32,z+0.13,0.018,0.32,0.018,3u,b,c+1u+u32(k),s);h=geo_cube(h,x-xx,y-0.58,z,0.018,0.018,0.23,3u,b,c+3u+u32(k),s);}
 var stem=max(sqrt(x*x+(z+0.31)*(z+0.31))-0.018,abs(y-0.53)-0.53);h=geo_take(h,stem,3u,b,c+5u,s,vec3f(x,y,z+0.31),vec3f(0.0,0.0,1.0));
 var spout=max(sqrt(x*x+(y-1.045)*(y-1.045))-0.016,abs(z+0.23)-0.08);h=geo_take(h,spout,3u,b,c+6u,s,vec3f(x,y-1.045,z+0.23),vec3f(0.0,1.0,0.0));
 h=geo_cube(h,x,y-1.09,z+0.31,0.075,0.012,0.012,3u,b,c+7u,s);
 var waste=max(sqrt(x*x+(z+0.10)*(z+0.10))-0.024,abs(y-0.30)-0.30);h=geo_take(h,waste,3u,b,c+8u,s,vec3f(x,y,z+0.10),vec3f(1.0,0.0,0.0));return h;
\`);
`;
