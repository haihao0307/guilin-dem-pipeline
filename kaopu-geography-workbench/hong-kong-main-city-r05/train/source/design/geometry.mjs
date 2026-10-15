export function kit(T,M,parent){
 const add=(g,m,n,p=[0,0,0])=>{const o=new T.Mesh(g,typeof m==='string'?M[m]:m);o.position.set(...p);o.name=n;o.castShadow=o.receiveShadow=true;parent.add(o);return o};
 const box=(p,s,m,n)=>add(new T.BoxGeometry(...s),m,n,p);
 const rod=(a,b,r,m,n,segments=20,r2=r)=>{const A=new T.Vector3(...a),B=new T.Vector3(...b),v=B.clone().sub(A);const g=new T.CylinderGeometry(r2,r,v.length(),segments);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.normalize()));return add(g,m,n,A.add(B).multiplyScalar(.5).toArray());};
 const pipe=(pts,r,m,n,segments=Math.max(24,pts.length*8))=>add(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p))),segments,r,10,false),m,n);
 const torus=(at,r,t,m,n,normal=[0,0,1])=>{const g=new T.TorusGeometry(r,t,10,64);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(...normal)));return add(g,m,n,at)};
 const panel=(shape,depth,m,n)=>{const g=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:20});return add(g,m,n)};
 return{add,box,rod,pipe,torus,panel};
}
export function roundedShape(T,w,h,r=.08){const s=new T.Shape(),x=-w/2,y=-h/2;r=Math.min(r,w/2,h/2);s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;}
export function sweptSurface(T,map,nu=180,nv=36){const p=[],uv=[],idx=[];for(let i=0;i<=nu;i++)for(let j=0;j<=nv;j++){p.push(...map(i/nu,j/nv));uv.push(i/nu,j/nv);}for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){const a=i*(nv+1)+j,b=a+nv+1;idx.push(a,b,a+1,b,b+1,a+1);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;}
export function smoothStations(rows,x){let i=0;while(i<rows.length-2&&x>rows[i+1][0])i++;const a=rows[i],b=rows[i+1],t=Math.max(0,Math.min(1,(x-a[0])/(b[0]-a[0]))),s=t*t*(3-2*t);return a.slice(1).map((v,j)=>v+(b[j+1]-v)*s);}
