/* Pure CPU + GLSL analytic construction. All dimensions are GAME hypotheses. */
'use strict';
const num=x=>{if(!Number.isFinite(x))throw Error('Finite geometry coefficient required');const s=x.toPrecision(17);return /[.eE]/.test(s)?s:s+'.0';},vec=p=>'vec3('+p.map(num).join(',')+')';
const box=(lo,hi)=>({kind:'box',lo,hi});
const cylinder=(axis,center,radius,range)=>({kind:'cylinder',axis,center,radius,range});
const plane=(normal,offset)=>({kind:'plane',normal,offset});
const union=(...children)=>({kind:'union',children});
const intersect=(...children)=>({kind:'intersection',children});
const difference=(base,...voids)=>({kind:'difference',base,voids});
const annulus=(center,ri,ro,range)=>difference(cylinder(2,center,ro,range),cylinder(2,center,ri,[range[0]-.001,range[1]+.001]));
function hexZ(center,apothem,range){const circum=apothem/Math.cos(Math.PI/6),base=cylinder(2,center,circum,range);return intersect(base,...Array.from({length:6},(_,i)=>{const a=i*Math.PI/3,n=[Math.cos(a),Math.sin(a),0];return plane(n,-n[0]*center[0]-n[1]*center[1]-apothem);}));}
function scalar(s,p,context={beta:.126}){
 if(s.kind==='box')return Math.max(...p.map((v,j)=>Math.max(s.lo[j]-v,v-s.hi[j])));
 if(s.kind==='plane')return s.normal.reduce((v,n,j)=>v+n*p[j],s.offset);
 if(s.kind==='cylinder'){const a=s.axis,rad=Math.hypot(...p.filter((_,j)=>j!==a).map((v,k)=>v-s.center.filter((_,j)=>j!==a)[k]));return Math.max(rad-s.radius,s.range[0]-p[a],p[a]-s.range[1]);}
 if(s.kind==='union')return Math.min(...s.children.map(q=>scalar(q,p,context)));
 if(s.kind==='intersection')return Math.max(...s.children.map(q=>scalar(q,p,context)));
 if(s.kind==='difference')return Math.max(scalar(s.base,p,context),...s.voids.map(q=>-scalar(q,p,context)));
 if(s.kind==='tiltedCylinder'){const b=context.beta,yp=p[1]-s.axisY,pp=[p[0],Math.cos(b)*yp-Math.sin(b)*p[2],Math.sin(b)*yp+Math.cos(b)*p[2]];return Math.max(Math.hypot(pp[0],pp[1])-s.radius,s.range[0]-pp[2],pp[2]-s.range[1]);}
 if(s.kind==='webOuter'){const b=context.beta,a=[0,s.axisY+Math.tan(b)*p[2]],d=[s.x-a[0],s.y-a[1]],t=Math.max(0,Math.min(1,((p[0]-a[0])*d[0]+(p[1]-a[1])*d[1])/(d[0]*d[0]+d[1]*d[1]))),az=Math.sin(b)*(p[1]-s.axisY)+Math.cos(b)*p[2];return Math.max(Math.hypot(p[0]-a[0]-t*d[0],p[1]-a[1]-t*d[1])-s.radius,s.range[0]-p[2],p[2]-s.range[1],s.axialRange[0]-az,az-s.axialRange[1]);}
 throw Error('Unknown geometry '+s.kind);
}
function bounds(s){
 if(s.bounds)return s.bounds.map(a=>a.slice());
 if(s.kind==='box')return [s.lo.slice(),s.hi.slice()];
 if(s.kind==='cylinder'){const lo=s.center.map(v=>v-s.radius),hi=s.center.map(v=>v+s.radius);lo[s.axis]=s.range[0];hi[s.axis]=s.range[1];return[lo,hi];}
 if(s.kind==='plane')return[[-Infinity,-Infinity,-Infinity],[Infinity,Infinity,Infinity]];
 if(s.kind==='difference')return bounds(s.base);
 if(s.kind==='union'||s.kind==='intersection'){const bs=s.children.map(bounds),u=s.kind==='union';return [[0,1,2].map(j=>(u?Math.min:Math.max)(...bs.map(b=>b[0][j]))),[0,1,2].map(j=>(u?Math.max:Math.min)(...bs.map(b=>b[1][j])))];}
 throw Error('Explicit bounds required for '+s.kind);
}
function glsl(s){
 if(s.kind==='box'){const c=s.lo.map((a,j)=>(a+s.hi[j])/2),h=s.lo.map((a,j)=>(s.hi[j]-a)/2);return `mBoxInf(p,${vec(c)},${vec(h)})`;}
 if(s.kind==='plane')return `(dot(p,${vec(s.normal)})+${num(s.offset)})`;
 if(s.kind==='cylinder'){const c=s.center.slice();c[s.axis]=(s.range[0]+s.range[1])/2;return `mDisc(p,${vec(c)},${s.axis},${num(s.radius)},${num((s.range[1]-s.range[0])/2)})`;}
 if(s.kind==='union'||s.kind==='intersection')return s.children.map(glsl).reduce((a,b)=>`${s.kind==='union'?'min':'max'}(${a},${b})`);
 if(s.kind==='difference')return s.voids.map(glsl).reduce((a,b)=>`max(${a},-(${b}))`,glsl(s.base));
 if(s.kind==='tiltedCylinder')return `mCylZ(mLocal(p-${vec([0,s.axisY,0])},sin(middleInclination),cos(middleInclination)),${num(s.radius)},${num(s.range[0])},${num(s.range[1])})`;
 if(s.kind==='webOuter')return 'topologyWebOuter(p)';
 throw Error('Unknown geometry '+s.kind);
}
module.exports={box,cylinder,plane,union,intersect,difference,annulus,hexZ,scalar,bounds,glsl,num,vec};
