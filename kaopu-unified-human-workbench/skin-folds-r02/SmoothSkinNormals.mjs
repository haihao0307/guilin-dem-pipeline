/** Smooth only the inherited base shading. The exact normal change caused by
 * new geometric tissue folds is added back, so this never paints fake wrinkles. */
export class SmoothSkinNormals {
 constructor(fair){this.fair=fair;const size=fair.mask.length*3;this.base=new Float32Array(size);this.smooth=new Float32Array(size);this.temp=new Float32Array(size);}
 capture(normals){
  const {active,mask,offsets,neighbors}=this.fair;this.base.set(normals);this.smooth.set(normals);
  for(let pass=0;pass<6;pass++){
   this.temp.set(this.smooth);for(const i of active){const k=i*3;let x=0,y=0,z=0;for(let j=offsets[i];j<offsets[i+1];j++){const q=neighbors[j]*3;x+=this.smooth[q];y+=this.smooth[q+1];z+=this.smooth[q+2];}const count=offsets[i+1]-offsets[i],a=.66*mask[i];x=this.smooth[k]*(1-a)+x/count*a;y=this.smooth[k+1]*(1-a)+y/count*a;z=this.smooth[k+2]*(1-a)+z/count*a;const length=Math.hypot(x,y,z)||1;this.temp[k]=x/length;this.temp[k+1]=y/length;this.temp[k+2]=z/length;}this.smooth.set(this.temp);
  }
  let max=0,count=0;for(const i of active){const k=i*3,d=Math.max(-1,Math.min(1,this.smooth[k]*this.base[k]+this.smooth[k+1]*this.base[k+1]+this.smooth[k+2]*this.base[k+2])),angle=Math.acos(d),cap=.20943951*mask[i];
   if(angle>cap&&angle>1e-6){const den=Math.sin(angle)||1,a=Math.sin(angle-cap)/den,b=Math.sin(cap)/den;let x=this.base[k]*a+this.smooth[k]*b,y=this.base[k+1]*a+this.smooth[k+1]*b,z=this.base[k+2]*a+this.smooth[k+2]*b;const length=Math.hypot(x,y,z)||1;this.smooth[k]=x/length;this.smooth[k+1]=y/length;this.smooth[k+2]=z/length;}
   max=Math.max(max,Math.min(angle,cap)*180/Math.PI);if(angle>.001)count++;
  }
  this.report={correctedBaseNormals:count,maxCorrectionDegrees:max,capDegrees:12,foldNormalDeltaPreserved:true,positionChanges:0,protectedMaskUnchanged:true};
 }
 compose(normals){for(const i of this.fair.active){const k=i*3,x=normals[k]+this.smooth[k]-this.base[k],y=normals[k+1]+this.smooth[k+1]-this.base[k+1],z=normals[k+2]+this.smooth[k+2]-this.base[k+2],length=Math.hypot(x,y,z)||1;normals[k]=x/length;normals[k+1]=y/length;normals[k+2]=z/length;}return this.report;}
}
