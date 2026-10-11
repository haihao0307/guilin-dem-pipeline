import{geometryForPart as baseGeometry}from'./station-geometry.mjs';
export function geometryForPart(T,part){const s=part.shape;let g;
 if(s.type==='oriented-box'){g=new T.BoxGeometry(...s.size);g.applyMatrix4(new T.Matrix4().makeRotationFromEuler(new T.Euler(...s.rotation)));g.translate(...s.center);}
 else if(s.type==='sphere'){g=new T.SphereGeometry(s.radius,s.segments||24,16,0,Math.PI*2,0,part.surface.feature==='dome-profile'?Math.PI/2:Math.PI);g.scale(...(s.scale||[1,1,1]));g.translate(...s.center);}
 else if(s.type==='disc'){g=new T.CircleGeometry(s.radius,64);if(s.axis==='x')g.rotateY(Math.PI/2);if(s.reverse)g.rotateY(Math.PI);g.translate(...s.center);}
 else if(s.type==='ring'&&s.axis){g=new T.TorusGeometry(s.radius,s.tube,8,s.segments||48);if(s.axis==='x')g.rotateY(Math.PI/2);else if(s.axis==='y')g.rotateX(Math.PI/2);g.translate(...s.center);}
 else if(s.type==='arch-band'){const q=new T.Shape(),r=s.radius,R=r+s.width;q.absarc(0,0,R,0,Math.PI,false);q.lineTo(-r,0);q.absarc(0,0,r,Math.PI,0,true);q.closePath();g=new T.ExtrudeGeometry(q,{depth:s.depth,bevelEnabled:false,curveSegments:24});g.translate(0,0,-s.depth/2);if(s.axis==='x')g.rotateY(Math.PI/2);g.translate(...s.center);}
 else if(s.type==='triangle-prism'){const q=new T.Shape();q.moveTo(-s.width/2,0);q.lineTo(s.width/2,0);q.lineTo(0,s.rise);q.closePath();g=new T.ExtrudeGeometry(q,{depth:s.depth,bevelEnabled:false});g.translate(0,0,-s.depth/2);if(s.axis==='x')g.rotateY(Math.PI/2);g.translate(...s.center);}
 else return baseGeometry(T,part);
 g.computeBoundingBox();g.computeBoundingSphere();g.userData.stationPart=part.id;return g;
}
