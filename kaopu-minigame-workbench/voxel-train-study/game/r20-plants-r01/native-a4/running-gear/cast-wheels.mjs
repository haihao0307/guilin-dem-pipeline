import {createTyreGeometry} from '../../wheel-rail-profile.mjs';
// Retains the previous native wheel component hierarchy and actual hub geometry.
// The source's torus tyre and cylindrical spokes are deliberately corrected:
// GAME lathed tyre section + smooth, tapered cast spokes. No imported mesh.
function spokeGeometry(T,radius){
 const p=[],idx=[],steps=18,corners=8,start=radius*.145,end=radius-.087;
 const width=t=>{const w=radius*.055;return w*(1+1.00*Math.exp(-t*12)+.60*Math.exp(-(1-t)*12));};
 for(let i=0;i<=steps;i++){const t=i/steps,x=start+(end-start)*t,w=width(t)/2,d=.048+(1-t)*.017,b=Math.min(w*.3,.009);const cross=[[-d+b,-w], [d-b,-w],[d,-w+b],[d,w-b],[d-b,w],[-d+b,w],[-d,w-b],[-d,-w+b]];for(const[y,z]of cross)p.push(x,y,z);}
 for(let i=0;i<steps;i++)for(let j=0;j<corners;j++){const a=i*corners+j,b=i*corners+(j+1)%corners,c=(i+1)*corners+j,d=(i+1)*corners+(j+1)%corners;idx.push(a,b,d,a,d,c);}for(let j=1;j<corners-1;j++){idx.push(0,j+1,j);idx.push(steps*corners,steps*corners+j,steps*corners+j+1);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();g.computeBoundingBox();return g;
}
function annularSection(T,inner,outer,depth){const g=new T.LatheGeometry([[inner,-depth/2],[outer,-depth/2],[outer,depth/2],[inner,depth/2],[inner,-depth/2]].map(p=>new T.Vector2(...p)),96);return g;}
export function createCorrectedNativeWheel(T,{sourceWheel,sourceRadius,radiusM,side,driver,spokes=driver?20:10,steel,cast}){
 if(!sourceWheel||![-1,1].includes(side)||!Number.isInteger(spokes)||spokes<8)throw Error('SOURCE_WHEEL_AND_DECLARED_PROFILE_REQUIRED');
 const root=new T.Group();root.name='轮圈 / 轮毂 / 辐条';const add=(geometry,material,name)=>{const o=new T.Mesh(geometry,material);o.name=name;o.castShadow=o.receiveShadow=true;root.add(o);return o;};
 add(createTyreGeometry(T,{radiusM,side,axis:'native-y'}),steel,'retained GAME tyre: tread band and inner flange');
 add(annularSection(T,radiusM-.119,radiusM-.057,.10),cast,'cast wheel centre outer felly');
 const sg=spokeGeometry(T,radiusM);for(let i=0;i<spokes;i++){const m=add(sg,cast,'tapered cast spoke '+(i+1));m.rotation.y=-i*Math.PI*2/spokes;}
 const sourceHub=new T.Group();sourceHub.name='retained native hub shapes, metrically refitted';sourceHub.rotation.x=side<0?Math.PI:0;root.add(sourceHub);
 const transform=new T.Matrix4().set(0,0,1,0,1,0,0,0,0,1,0,0,0,0,0,1),scale=radiusM/sourceRadius,orientedHub=new T.Group();orientedHub.quaternion.setFromRotationMatrix(transform);sourceHub.scale.set(scale,1,scale);sourceHub.add(orientedHub);
 for(const i of[2,3]){const src=sourceWheel.children[i];if(!src?.isMesh)throw Error('SOURCE_HUB_MISSING');const m=src.clone();m.geometry=src.geometry.clone();m.material=i===3?steel:cast;orientedHub.add(m);}

 if(driver){const ri=radiusM*.64,ro=radiusM-.105,a=Math.PI-.56,b=Math.PI+.56,s=new T.Shape();s.absarc(0,0,ro,a,b,false);s.lineTo(ri*Math.cos(b),ri*Math.sin(b));s.absarc(0,0,ri,b,a,true);s.closePath();const g=new T.ExtrudeGeometry(s,{depth:.105,bevelEnabled:false,curveSegments:24});g.translate(0,0,-.0525);g.rotateX(Math.PI/2);add(g,cast,'integral crescent balance weight opposite crank');}
 root.userData={nativeWheel:true,sourceName:sourceWheel.name,sourceHubReused:true,runningRadiusM:radiusM,spokes,flangeMirrored:side,corrections:['torus replaced with existing GAME lathed tread and flange','round spokes replaced with tapered cast sections','declared per-axle diameter; no whole-wheel nonuniform scaling'],historicalWheelProfileCertified:false};return root;
}
