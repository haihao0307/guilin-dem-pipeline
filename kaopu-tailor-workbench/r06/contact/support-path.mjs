// Temporary assembly motion, not a garment pose. Original UVs and anchor target
// are unchanged. Raise before moving across the shoulder clearance surface.
export function liftedSupportPosition(hold,elapsed,out=[0,0,0]){
 const smooth=t=>t*t*(3-2*t),t=Math.max(0,Math.min(1,elapsed/4)),start=hold.start,target=hold.target,safeY=Math.max(start[1],target[1])+.08;
 if(t<.25){out[0]=start[0];out[2]=start[2];out[1]=start[1]+(safeY-start[1])*smooth(t/.25);}
 else if(t<.75){const u=smooth((t-.25)/.5);out[0]=start[0]+(target[0]-start[0])*u;out[2]=start[2]+(target[2]-start[2])*u;out[1]=safeY;}
 else{out[0]=target[0];out[2]=target[2];out[1]=safeY+(target[1]-safeY)*smooth((t-.75)/.25);}
 return out;
}
