/* R02 growth FORM studies, not identified coral species. Closed surfaces, generated only. */
const CoralForms=(()=>{
function build(form='massive'){
 const p=[],idx=[],co=[];
 function ellipsoid(cx,cy,cz,rx,ry,rz,color,ruffle=0){
  const st=p.length/3,lon=28,lat=12;
  const add=(x,y,z)=>{p.push(x,y,z);co.push(...color)};
  add(cx,cy+ry,cz);
  for(let j=1;j<lat;j++)for(let i=0;i<lon;i++){
   const phi=Math.PI*j/lat,a=2*Math.PI*i/lon,s=Math.sin(phi),d=1+ruffle*Math.sin(7*a+phi*3)*s;
   add(cx+rx*s*Math.cos(a)*d,cy+ry*Math.cos(phi),cz+rz*s*Math.sin(a)*d)
  }
  const bot=p.length/3;add(cx,cy-ry,cz);
  for(let i=0;i<lon;i++){idx.push(st,st+1+i,st+1+(i+1)%lon);idx.push(bot,st+1+(lat-2)*lon+(i+1)%lon,st+1+(lat-2)*lon+i)}
  for(let j=0;j<lat-2;j++)for(let i=0;i<lon;i++){const a=st+1+j*lon+i,b=st+1+j*lon+(i+1)%lon;idx.push(a,a+lon,b+lon,a,b+lon,b)}
 }
 if(form==='table'){ellipsoid(0,.25,0,.18,.25,.18,[.46,.40,.29]);ellipsoid(0,.55,0,.84,.065,.72,[.64,.54,.36],.055);ellipsoid(.06,.43,.04,.63,.04,.58,[.55,.47,.30],.055)}
 else ellipsoid(0,.45,0,.62,.46,.57,[.53,.55,.34],.02);
 const positions=new Float32Array(p),indices=new Uint16Array(idx);return{positions,indices,colors:new Float32Array(co),normals:FishMother.computeNormals(positions,indices),metrics:{form,vertexCount:p.length/3,triangleCount:idx.length/3,namedSpecies:false,visualAcceptance:false}};
}
// Geometry and conservative solid bounds are coupled, so corals are not collision-free decorations.
function fit(d,r,h){const p=new Float32Array(d.positions);let maxR=0,minY=Infinity,maxY=-Infinity;for(let i=0;i<p.length;i+=3){maxR=Math.max(maxR,Math.hypot(p[i],p[i+2]));minY=Math.min(minY,p[i+1]);maxY=Math.max(maxY,p[i+1])}for(let i=0;i<p.length;i+=3){p[i]*=r/(maxR||1);p[i+2]*=r/(maxR||1);p[i+1]=(p[i+1]-minY)*h/(maxY-minY||1)}return{...d,positions:p,normals:FishMother.computeNormals(p,d.indices)}}
return{build,fit};})();
