import {contourShapes} from '../src/retained/branding/contours-injected.mjs';
import companyPlaque from '../src/retained/branding/company_plaque-gold.mjs';
import wordmarkGold from '../src/retained/branding/wordmark-gold.mjs';
import wordmark from '../src/retained/branding/wordmark.mjs';

/** Original authored contours, not replacement font text or a fabricated company name. */
export function addOriginalCoachIdentity(T,M,parent,side){
 const group=new T.Group();group.name='Original authored company plaque and Flying Hongkonger contours';parent.add(group);
 const finish=(source,color,name)=>{const m=source.clone();m.color.set(color);m.onBeforeCompile=source.onBeforeCompile;m.customProgramCacheKey=()=>source.customProgramCacheKey()+'/'+name;m.name=name;return m;};
 const red=finish(M.paint,'#a22515','Original brand red / FH88 kernel'),gold=finish(M.brass,'#d6aa61','Original brand gold / FH88 kernel');
 function relief(recipe,width,x,z,material=gold,offset=0){
  const scale=width/recipe.size_px[0],depth=.008;
  const g=new T.ExtrudeGeometry(contourShapes(T,recipe),{depth:depth/scale,bevelEnabled:false,curveSegments:1});
  g.scale(scale,scale,scale);g.translate(-width/2,width*recipe.size_px[1]/recipe.size_px[0]/2,0);
  const o=new T.Mesh(g,material);o.name='Original contour relief / '+recipe.asset;
  o.applyMatrix4(new T.Matrix4().set(-side,0,0,x,0,0,side,side*(1.455+offset),0,1,0,z,0,0,0,1));
  o.castShadow=o.receiveShadow=true;o.userData={originalContours:true,sourceAsset:recipe.asset,sourceModule:recipe===companyPlaque?'company_plaque-gold.mjs':recipe===wordmarkGold?'wordmark-gold.mjs':'wordmark.mjs',sourceRingCount:recipe.rings.length,scaleUniform:true,extrusionM:depth,noInventedCompanyText:true};group.add(o);return o;
 }
 relief(companyPlaque,.64,10.72,1.76);relief(wordmark,3.4,4.2,1.63,red);relief(wordmarkGold,3.4,4.2,1.63,gold,.009);
 return group;
}

/** Upper chine only: fairing rises over both bogies; brakes and suspension remain open.
 * This is visual design geometry, not an aerodynamic or high-speed certification.
 * No source mesh is removed, collapsed, or hidden by these additions.
 */
export function addStreamlinerFairings(T,M,{near,far}){
 const result=[];
 for(const side of[-1,1])for(const [xmin,xmax]of[[-8.96,-.69],[.69,8.96]]){
  const positions=[],indices=[],nu=80,nv=20,ring=2*(nv+1);
  for(let i=0;i<=nu;i++){
   const x=xmin+(xmax-xmin)*i/nu;
   const endBlend=Math.min(1,(10.05-Math.abs(x))/.8),smooth=endBlend*endBlend*(3-2*endBlend);
   const bogieLift=Math.max(Math.exp(-(((x-7.65)/1.92)**4)),Math.exp(-(((x+7.65)/1.92)**4)));
   const drop=(.285-.225*bogieLift)*(.12+.88*smooth);
   for(const inner of[false,true])for(let j=0;j<=nv;j++){
    const t=(inner?nv-j:j)/nv,a=t*Math.PI/2;
    // Smooth shoulder at the body, turning into a tucked-under lower hem.
    const y=1.425-.185*(1-Math.cos(a))-(inner?.024:0),z=1.315-drop*Math.sin(a);
    positions.push(x,side*y,z);
   }
  }
  for(let i=0;i<nu;i++)for(let j=0;j<ring;j++){
   const a=i*ring+j,b=(i+1)*ring+j,c=i*ring+(j+1)%ring,d=(i+1)*ring+(j+1)%ring;
   indices.push(a,b,c,b,d,c);
  }
  // End caps use the exact paired section endpoints, not a floating overlay.
  for(const end of[0,nu])for(let j=0;j<nv;j++){
   const base=end*ring,a=base+j,b=a+1,c=base+ring-1-j,d=c-1;
   if(end===0)indices.push(a,c,b,b,c,d);else indices.push(a,b,c,b,d,c);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);
  // A mirrored side must preserve outward winding. Determine by closed signed volume.
  let volume=0;const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),p=g.attributes.position;
  for(let k=0;k<indices.length;k+=3){a.fromBufferAttribute(p,indices[k]);b.fromBufferAttribute(p,indices[k+1]);c.fromBufferAttribute(p,indices[k+2]);volume+=a.dot(b.cross(c))/6;}
  if(volume<0){for(let k=0;k<indices.length;k+=3)[indices[k+1],indices[k+2]]=[indices[k+2],indices[k+1]];g.setIndex(indices);}
  g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
  g.userData={finiteThicknessM:.024,closed:true,source:'new upper chine addition only',bogieClearance:'lower hem raised at bogies; all source running gear retained',signedVolumeM3:Math.abs(volume)};
  const mesh=new T.Mesh(g,M.paint);mesh.name='Smooth finite upper skirt / open bogie relief '+side;mesh.castShadow=mesh.receiveShadow=true;mesh.userData={retentionSafe:true,noPerformanceClaim:true};(side===1?near:far).add(mesh);result.push(mesh);
 }
 return result;
}
