// A continuous, advected procedural air field, not a prescribed hair trajectory.
// It represents gusts at two spatial scales. This is not a Navier-Stokes solver.
export function airAt(x,y,z,time,strength,out=[0,0,0]){
 const a=x*23+z*15-time*.85,b=y*32-x*11-time*1.25;
 const fine=x*157+z*103-time*4.2,other=y*83-z*139-time*3.1;
 out[0]=strength*(.58+.22*Math.sin(a)+.13*Math.sin(b)+.09*Math.sin(fine)*Math.cos(other));
 out[1]=strength*(.035*Math.sin(b*.73)+.025*Math.cos(fine));
 out[2]=strength*(.13*Math.sin(a*.81+1.3)+.10*Math.cos(b+fine*.25)+.05*Math.sin(other));
 return out;
}
export function guideMaterial(g){const random=(Math.sin(g*127.1+19.19)*43758.5453)%1;return .82+.36*(random-Math.floor(random));}
export function exposureAt(x,z,t){const edge=Math.min(1,Math.sqrt((x/.027)**2+(z/.014)**2));return .28+.42*edge**3+.30*t*t;}
