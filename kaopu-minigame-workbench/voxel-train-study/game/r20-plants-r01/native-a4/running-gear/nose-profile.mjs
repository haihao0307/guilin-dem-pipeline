// Correct the existing native A4 skin's longitudinal sections. The reference
// photographs establish the descending nose/fascia relationship, not exact shop
// ordinates. Wheel stations and buffer datums are never moved by this function.
export function reshapeNativeNose(T,{skin,source,sourceFrontZ,lengthScale,widthScale,heightScale,locoFactor,paint,root,door,lens}){
 const p=source.parameters,L=p.boilerLength,R=p.boilerRadius,Y=p.boilerY,railTop=.3485;
 const sourceToX=z=>5+(z-sourceFrontZ)*lengthScale*locoFactor;
 const xToSource=x=>sourceFrontZ+(x-5)/(lengthScale*locoFactor);
 const yToSource=y=>(y-railTop)/heightScale+.08;
 const rearZ=-L*.5-1.2,span=L+2.25,startU=.80,startX=sourceToX(rearZ+span*startU),endX=4.75;
 const baseY=railTop+(Y-.08)*heightScale,baseH=(R+.22)*heightScale,baseW=(R+.24)*widthScale;
 function section(x){const t=Math.max(0,Math.min(1,(x-startX)/(endX-startX))),q=t*t*(3-2*t);return {centreY:baseY+(2.12-baseY)*q,halfHeight:baseH+(.73-baseH)*q,halfWidth:baseW+(1.03-baseW)*q};}
 const g=skin.geometry.clone(),a=g.attributes.position,slices=g.parameters.slices,stacks=g.parameters.stacks;
 if(a.count!==(slices+1)*(stacks+1))throw Error('NATIVE_SKIN_TOPOLOGY_REQUIRED');
 for(let j=0;j<=stacks;j++)for(let i=0;i<=slices;i++){const u=i/slices,angle=(j/stacks*2-1)*Math.PI,oldZ=rearZ+span*u,x=u<=startU?sourceToX(oldZ):startX+(endX-startX)*(u-startU)/(1-startU),c=section(x);a.setXYZ(j*(slices+1)+i,Math.sin(angle)*c.halfWidth/widthScale,yToSource(c.centreY+Math.cos(angle)*c.halfHeight),xToSource(x));}
 a.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();skin.geometry=g;
 const end=section(endX),outline=new T.Shape();outline.absellipse(0,yToSource(end.centreY),end.halfWidth/widthScale,end.halfHeight/heightScale,0,Math.PI*2,false,0);
 const front=new T.Mesh(new T.ShapeGeometry(outline,64),paint);front.name='native A4 descending nose fascia above buffer beam';front.position.z=xToSource(endX);root.add(front);
 door.position.set(0,yToSource(end.centreY),xToSource(4.755));lens.position.set(0,yToSource(end.centreY),xToSource(4.815));
 return {section,startX,endX,frontLowerY:1.39,reference:'SNGLT e2149/o941 visible descending nose; unannotated section ordinates reconstructed',surfaceHalfWidth:(x,y)=>{const c=section(x),v=(y-c.centreY)/c.halfHeight;return c.halfWidth*Math.sqrt(Math.max(0,1-v*v));}};
}
