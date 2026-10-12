import{createCabMother,cabRoofTopAtY}from'./cab-mother.mjs';
import{a6Section,a6RoofZM,a6SideYM}from'./a6-form-domain.mjs';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export function createA6CabMother(T,{shell}={}){
 const cab=createCabMother(T),p=cab.parameters,H=p.widthM/2,wall=H-p.wallInsetM,eave=cabRoofTopAtY(p,H);
 const map=(v,roof=false)=>{let[x,y,z]=v;const sign=Math.sign(y)||1;if(roof){const newEaveY=Math.abs(a6SideYM(x,eave)),yy=y*newEaveY/H;return[x,yy,a6RoofZM(x,yy)+(z-cabRoofTopAtY(p,y))]}const outward=Math.abs(a6SideYM(x,z))-.019-wall,weight=clamp((Math.abs(y)-.96)/(wall-.96));if(z>p.floorZM-.15)y+=sign*outward*weight;return[x,y,z]};
 for(const m of cab.parts){const g=m.geometry,a=g.attributes.position,roof=m.userData.functionalParent==='roof';for(let i=0;i<a.count;i++)a.setXYZ(i,...(m.name.startsWith('steps.')?[a.getX(i),a.getY(i),a.getZ(i)]:map([a.getX(i),a.getY(i),a.getZ(i)],roof)));delete g.userData.analyticRoofNormals;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();if(shell&&m.userData.domain.material==='paint'&&['roof','wall','door'].includes(m.userData.domain.kind)){m.material=shell.materials.green;m.userData.shapeAndMaterialShareDomain='A6 C2 body/cab loft and common coating'}m.userData.a6FormBinding={roof,retainedFunction:true,originalPartId:m.name};}
 for(const port of cab.ports){const q=map(port.positionM,port.owner==='roof');port.positionM=q;port.matrix=new T.Matrix4().makeTranslation(...q).toArray();const o=cab.root.getObjectByName(port.frameObjectName);o?.position.fromArray(q)}
 for(const a of cab.root.userData.attachments){a.fromM=map(a.fromM,a.owner==='roof');a.toM=map(a.toM,a.owner==='roof')}
 cab.root.name='A6 continuous rear canopy / full cab internals';cab.root.userData.a6Design={historicalA6:false,outerWalls:'Conformal shoulder binding, real existing windows/doors retained',roof:'Same continuous master crown as boiler',floorAndCrewDatumUnchanged:true,backheadDatumUnchanged:true,doorMotionBeyondClosedPoseUnverified:true};cab.surfaceY=(x,z,side)=>a6SideYM(x,z,side);cab.roofZM=a6RoofZM;return cab;
}
