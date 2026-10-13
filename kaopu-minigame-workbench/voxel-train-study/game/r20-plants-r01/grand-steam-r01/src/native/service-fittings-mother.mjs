// The two compact white lamps, their vent neck/cap, side-plane loop handles,
// short convex glass and lower outer irons are observed in the original A4.
// Dimensions below adapt those ratios to this native buffer-beam envelope;
// they are not A4 measured dimensions and use no source buffers or textures.
export const A4_LAMP_DESIGN=Object.freeze({halfSpacingM:.86,bodyXM:4.515,baseZM:1.375,bodyRadiusM:.068,bodyHeightM:.132,lensRadiusM:.042,lensBulgeM:.015,lensSeatXM:4.610,lensCentreZM:1.445,totalHeightM:.338,sourceGeometryTransferred:false,emissionEnabled:false});
// External fitting families observed on the reference, natively authored for88.
// All visual ports have a declared mount. Flow/valve functions stay unproved.
export function createServiceFittingsMother(T,{shell,gear}={}){
 const root=new T.Group();root.name='88 native external fittings / declared mounts';const parts=[],ports=[],mounts=[];
 const M={steel:new T.MeshStandardMaterial({color:0x485759,metalness:.80,roughness:.35}),black:new T.MeshStandardMaterial({color:0x202a29,metalness:.03,roughness:.38}),brass:new T.MeshStandardMaterial({color:0xa48646,metalness:.83,roughness:.32}),copper:new T.MeshStandardMaterial({color:0x9b623d,metalness:.83,roughness:.42}),lampPaint:new T.MeshStandardMaterial({color:0xdad5c7,metalness:0,roughness:.33}),reflector:new T.MeshStandardMaterial({color:0xa6b2b1,metalness:.92,roughness:.20}),lens:new T.MeshPhysicalMaterial({color:0xe6eeeb,emissive:0x000000,emissiveIntensity:0,metalness:0,roughness:.075,transmission:.72,thickness:.003,ior:1.5,clearcoat:1,clearcoatRoughness:.06,envMapIntensity:1})};
 for(const[k,m]of Object.entries(M)){if(k==='lens'){m.name='A4 native clear convex lamp glass / non-emissive';m.userData={shapeAndMaterialShareDomain:true,thermalOrFluidSolution:false,sourceTextureUsed:false,appearanceRevision:'a4-lamp-r06',refractiveIndexAuthored:1.5};continue;}m.name='native fitting '+k+' / shape-service field';m.userData={shapeAndMaterialShareDomain:true,thermalOrFluidSolution:false};m.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vFitting;').replace('#include <begin_vertex>','#include <begin_vertex>\nvFitting=position;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vFitting;');const c='float grime=exp(-abs(vFitting.z-.7)/.6);float grain=.5+.5*sin(vFitting.x*159.+vFitting.y*83.+vFitting.z*127.);';s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+c+'diffuseColor.rgb*=1.-grime*(.04+.04*grain);');s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+grime*.1,.08,.96);')};m.customProgramCacheKey=()=>k+'-native-fittings-r02'}
 const add=(g,mat,name,role)=>{const m=new T.Mesh(g,M[mat]);m.name=name;m.userData={mother:'boiler-service-plumbing',functionRole:role};m.castShadow=m.receiveShadow=true;root.add(m);parts.push(m);return m};
 const box=(at,size,m,n,r)=>{const g=new T.BoxGeometry(...size);g.translate(...at);return add(g,m,n,r)};
 function rod(a,b,r,m,n,role,segments=24,rt=r){const A=new T.Vector3(...a),B=new T.Vector3(...b),v=B.clone().sub(A),g=new T.CylinderGeometry(rt,r,v.length(),segments);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.normalize()));g.translate(...A.add(B).multiplyScalar(.5).toArray());return add(g,m,n,role)}
 function pipe(ps,r,m,n,role){return add(new T.TubeGeometry(new T.CatmullRomCurve3(ps.map(p=>new T.Vector3(...p))),Math.max(24,ps.length*10),r,10,false),m,n,role)}
 // Paired outer lower lamps. The centre iron remains unoccupied, as in the
 // inspected source configuration. Painted outer bezel; only the recessed
 // seal is black. No brass face, emissive disk, point light or glow sprite.
 const L=A4_LAMP_DESIGN;
 function ringX(x,y,z,inner,outer,length,mat,name,role){
  const profile=[[inner,-length/2],[outer,-length/2],[outer,length/2],[inner,length/2],[inner,-length/2]].map(([r,a])=>new T.Vector2(r,a));
  const g=new T.LatheGeometry(profile,48);g.rotateZ(-Math.PI/2);g.translate(x,y,z);return add(g,mat,name,role);
 }
 function lampIron(y,label,occupied){
  // The visible upright joins the already-existing beam; the small forward
  // lip and lamp rear socket form a continuous load path.
  box([4.362,y,1.273],[.032,.032,.214],'black','front lamp iron upright '+label,'beam to lower lamp-iron bend');
  box([4.417,y,1.369],[.126,.032,.022],'black','front lamp iron foot '+label,'bent iron mounting lip');
  box([4.470,y,1.411],[.020,.032,.094],'black','front lamp iron tongue '+label,'vertical tongue into removable lamp rear socket');
  if(occupied)box([4.470,y,1.443],[.032,.066,.100],'lampPaint','lamp rear mounting socket '+label,'removable lantern socket seated over iron');
 }
 lampIron(0,'centre',false);
 for(const side of[-1,1]){
  const y=side*L.halfSpacingM,x=L.bodyXM,z=L.baseZM,label=side<0?'left':'right';lampIron(y,label,true);
  rod([x,y,z],[x,y,z+.014],.072,'lampPaint','lamp base rim '+label,'painted lantern base flange',48);
  rod([x,y,z+.012],[x,y,z+L.bodyHeightM],L.bodyRadiusM,'lampPaint','lamp vertical casing '+label,'compact upright oil-lantern body',48,L.bodyRadiusM*.97);
  rod([x,y,z+L.bodyHeightM-.006],[x,y,z+L.bodyHeightM+.006],.069,'lampPaint','lamp upper rim '+label,'painted casing closing rim',48);
  rod([x,y,z+L.bodyHeightM+.005],[x,y,z+.228],.032,'lampPaint','lamp vent neck '+label,'observed narrow vertical neck',40,.029);
  rod([x,y,z+.226],[x,y,z+.240],.042,'lampPaint','lamp hood lip '+label,'cap over vent neck',48);
  {const points=[new T.Vector2(0,0),new T.Vector2(.042,0)];for(let j=1;j<=12;j++){const t=j*Math.PI/24;points.push(new T.Vector2(.042*Math.cos(t),.022*Math.sin(t)))}points.push(new T.Vector2(0,0));const g=new T.LatheGeometry(points,48);g.rotateX(Math.PI/2);g.translate(x,y,z+.241);add(g,'lampPaint','lamp domed vent cap '+label,'low domed weather cap');}
  // Loop is in the longitudinal vertical plane, edge-on in front view.
  const handle=[[x-.064,y,z+.139],[x-.064,y,z+.257],...Array.from({length:16},(_,j)=>{const t=Math.PI-(j+1)*Math.PI/16;return[x+.064*Math.cos(t),y,z+.257+.076*Math.sin(t)]}),[x+.064,y,z+.139]];
  pipe(handle,.004,'lampPaint','lamp side-plane lifting handle '+label,'fine loop anchored on both sides of lantern');
  const q=L.lensCentreZM,seat=L.lensSeatXM;
  ringX(seat-.016,y,q,.043,.052,.037,'lampPaint','lamp painted lens barrel '+label,'short painted front projection');
  ringX(seat-.001,y,q,.042,.0432,.008,'black','lamp recessed lens seal '+label,'narrow internal dark gasket');
  ringX(seat+.001,y,q,.0430,.052,.007,'lampPaint','lamp painted lens bezel '+label,'thin light-painted external retention ring');
  rod([seat-.024,y,q],[seat-.022,y,q],.0435,'black','lamp optical recess '+label,'dark interior behind glass',48);
  // A shallow concave reflector occupies the recess; no luminous material.
  {const pp=Array.from({length:17},(_,j)=>{const r=.042*j/16;return new T.Vector2(r,.008*(r/.042)**2)}),g=new T.LatheGeometry(pp.reverse(),48);g.rotateZ(-Math.PI/2);g.translate(seat-.021,y,q);add(g,'reflector','lamp inner reflector '+label,'shallow reflective bowl behind clear glass');}
  {const r=L.lensRadiusM,d=L.lensBulgeM,R=(r*r+d*d)/(2*d),g=new T.SphereGeometry(R,48,20,0,Math.PI*2,0,Math.acos((R-d)/R));g.rotateZ(-Math.PI/2);g.translate(seat-R+d,y,q);const m=add(g,'lens','lamp convex glass '+label,'short convex dielectric lens; scene reflections, no emission');m.castShadow=false;}
  mounts.push({id:'headlamp-'+label,from:[4.362,y,1.166],to:[4.470,y,1.443],parent:'front buffer beam',kind:'observed A4 outer lamp iron / native dimensional adaptation',bodyCentreM:[x,y,z+L.bodyHeightM/2],lensCentreM:[seat,y,q],sourceDimensionsCalibrated:false});
 }
 // Whistle family is observed; the acoustic/control model is not solved here.
 const wx=3.07,wz=shell.surfaceZM(wx,0);rod([wx,0,wz-.010],[wx,0,wz+.028],.084,'black','whistle mounting flange','conformal shell crown attachment',32);rod([wx,0,wz+.025],[wx,0,wz+.12],.030,'brass','whistle stem and valve body','observed whistle family');rod([wx,0,wz+.11],[wx,0,wz+.275],.050,'brass','whistle bell body','authored whistle proportions',40,.062);rod([wx,0,wz+.279],[wx,0,wz+.295],.056,'brass','whistle bell cap','closed crown');pipe([[wx,0,wz+.06],[wx-.16,0,wz+.06],[wx-.20,0,shell.surfaceZM(wx-.2,0)+.006]],.012,'copper','whistle short supply candidate','mounted visual connection; valve/sound physics unconnected');ports.push({id:'whistle',positionM:[wx,0,wz+.275],physicalStateReader:null,physicalControlWriter:null,acousticFlowCertified:false});mounts.push({id:'whistle',surfacePointM:[wx,0,wz],parent:'native shell domain'});
 // Rear crown fitting group: topology observed, pressure-service role unresolved.
 for(const side of[-1,1]){const x=-5.94,y=side*.16,z=shell.surfaceZM(x,y)-.11;rod([x,y,z-.01],[x,y,z+.035],.063,'black','rear crown fitting flange '+side,'A6 recessed service mounting below detachable rear crown panel');rod([x,y,z+.03],[x,y,z+.072],.038,'brass','rear crown fitting barrel '+side,'observed top-fitting family; exact service unknown');rod([x,y,z+.069],[x,y,z+.086],.049,'steel','rear crown fitting cap '+side,'cap attached to barrel');for(const dx of[-.072,.072])rod([x+dx,y,z+.014],[x+dx,y,shell.surfaceZM(x+dx,y)-.022],.013,'steel','A6 recessed fitting mounting lug '+side+'/'+dx,'fitting flange to inner service-panel support');ports.push({id:'rear-crown-'+side,positionM:[x,y,z+.086],physicalRole:null,physicsState:null,serviceAccess:'remove rear crown panel; inherited function unidentified'})}
 // Two outside-cylinder drain candidates terminate at real casing taps. They
 // are deliberately not inferred from a six-event beat or UI throttle value.
 for(const c of gear.parameters.cylinders.filter(c=>c.id!=='inside')){const side=Math.sign(c.axisYM),x=gear.parameters.drivingAxleXM+gear.parameters.rodPinCentresM+1.02,y=c.axisYM,z=1.016-.254;rod([x,y,z+.012],[x,y,z-.10],.024,'brass',c.id+' cylinder lower tap','geometry touches declared cylinder casing');const end=[4.18,side*1.04,.62];pipe([[x,y,z-.07],[x+.30,y,z-.12],[3.45,side*1.10,.63],end],.020,'copper',c.id+' external drain candidate','author-defined88 route; condensate physics unavailable');rod(end,[end[0]+.065,end[1],end[2]],.033,'brass',c.id+' drain terminal union','terminal fitted to pipe end');for(const A of[[x+.30,y,z-.12],end]){pipe([[A[0],side*.50,1.30],A],.012,'steel',c.id+' drain pipe support '+A[0],'support from native frame to exact routed pipe point');}ports.push({id:c.id+'-drain',positionM:[end[0]+.065,end[1],end[2]],connectsTo:c.id+' cylinder casing lower tap',physicalDrainState:null,routeIsAuthoredNotSourceProven:true})}
 root.userData={mother:'boiler-service-plumbing',sourceBuffersUsed:false,mounts,ports,steamFlowSolved:false,drainDynamics:null,whistleAcoustics:null,lampDesign:L,roleProvenance:'Whistle/lamp/pipe families observed; native dimensions and routing authored. Unknown top fittings remain unidentified.'};return{root,parts,ports,mounts,coverageStatus:'mounted-native-fitting-candidate-functions-unresolved'};
}
