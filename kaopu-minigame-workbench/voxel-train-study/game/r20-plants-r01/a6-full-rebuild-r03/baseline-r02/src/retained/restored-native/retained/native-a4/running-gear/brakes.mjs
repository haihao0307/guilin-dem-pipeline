// Parametric tread-brake assemblies. Contours are reconstructed from the
// retained locomotive's mechanical layout, not surveyed brake rigging drawings.
export function createTreadBrake(T,{radiusM,steel,iron}){
 const root=new T.Group();root.name='curved tread brake shoe, hanger and cross shaft';
 const ri=radiusM+.012,ro=ri+.055,a=-.30,b=.30,s=new T.Shape();
 s.absarc(0,0,ro,a,b,false);s.lineTo(ri*Math.cos(b),ri*Math.sin(b));s.absarc(0,0,ri,b,a,true);s.closePath();
 const g=new T.ExtrudeGeometry(s,{depth:.085,bevelEnabled:false,curveSegments:16});g.translate(0,0,-.0425);g.rotateX(Math.PI/2);
 const shoe=new T.Mesh(g,iron);shoe.name='concave replaceable tread shoe, 12 mm released gap';root.add(shoe);
 const hanger=new T.Mesh(new T.BoxGeometry(.048,.075,radiusM*.78),steel);hanger.name='flat brake hanger';hanger.position.set(radiusM+.079,0,radiusM*.29);root.add(hanger);
 for(const z of[0,radiusM*.68]){const pin=new T.Mesh(new T.CylinderGeometry(.029,.029,.14,16),steel);pin.name='brake hanger pivot';pin.position.set(radiusM+.079,0,z);root.add(pin);}
 root.userData={nativeBrake:true,releasedGapM:.012,shoeFaceWidthM:.085,dimensionStatus:'visual reconstruction, brake force remains existing physical model'};return root;
}
export function createLaminatedSpring(T,{lengthM,widthM,thicknessM,steel}){
 const p=[],idx=[],n=20;for(let i=0;i<=n;i++){const x=lengthM*(i/n-.5),z=.085*(2*x/lengthM)**2;for(const[y,dz]of[[-widthM/2,0],[widthM/2,0],[widthM/2,thicknessM],[-widthM/2,thicknessM]])p.push(x,y,z+dz);}
 for(let i=0;i<n;i++)for(let j=0;j<4;j++){const a=i*4+j,b=i*4+(j+1)%4,c=a+4,d=b+4;idx.push(a,b,d,a,d,c);}idx.push(0,2,1,0,3,2,n*4,n*4+1,n*4+2,n*4,n*4+2,n*4+3);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();const m=new T.Mesh(g,steel);m.name='cambered laminated spring leaf';return m;
}
