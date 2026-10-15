// Independently authored, metre-based geometry. Source-derived coordinates live in airport-data.json.
export const MAP_ORIGIN=[834000,827000];
export const toWorld=([e,n],y=0)=>[e-MAP_ORIGIN[0],y,MAP_ORIGIN[1]-n];
export const toGrid=([x,y,z])=>[x+MAP_ORIGIN[0],MAP_ORIGIN[1]-z];
export function inside(p,polygon){let c=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if(((a[1]>p[1])!==(b[1]>p[1]))&&(p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]))c=!c;}return c;}
export function area(p){return p.reduce((s,a,i)=>{let b=p[(i+1)%p.length];return s+a[0]*b[1]-a[1]*b[0]},0)/2;}
export function triangulate(poly){
 const ids=poly.map((_,i)=>i);if(area(poly)<0)ids.reverse();const out=[];
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const inTri=(p,a,b,c)=>cross(a,b,p)>=-1e-8&&cross(b,c,p)>=-1e-8&&cross(c,a,p)>=-1e-8;
 for(let tries=0;ids.length>3&&tries<poly.length*poly.length;tries++){
  let found=false;for(let i=0;i<ids.length;i++){const a=ids[(i+ids.length-1)%ids.length],b=ids[i],c=ids[(i+1)%ids.length];if(cross(poly[a],poly[b],poly[c])<=1e-8)continue;if(ids.some(k=>k!==a&&k!==b&&k!==c&&inTri(poly[k],poly[a],poly[b],poly[c])))continue;out.push(a,b,c);ids.splice(i,1);found=true;break;}if(!found)throw Error('Non-simple airport polygon');
 }if(ids.length===3)out.push(...ids);if(out.length!==(poly.length-2)*3)throw Error('Airport triangulation incomplete');return out;
}
export function runwayFrame(data){const [a,b]=data.runway.endpoints_epsg2326,len=Math.hypot(b[0]-a[0],b[1]-a[1]),u=[(b[0]-a[0])/len,(b[1]-a[1])/len],v=[-u[1],u[0]];return{a,b,u,v,length:len,point:(s,t)=>[a[0]+s*u[0]+t*v[0],a[1]+s*u[1]+t*v[1]],st:p=>[(p[0]-a[0])*u[0]+(p[1]-a[1])*u[1],(p[0]-a[0])*v[0]+(p[1]-a[1])*v[1]]};}
export function geometry(data){
 const vertices=[],features=[],F=runwayFrame(data),height=data.display_height_m;
 const colors={land:[.49,.49,.47],runway:[.29,.30,.30],taxi:[.40,.41,.39],apron:[.53,.54,.52],mark:[.90,.89,.80],taxiMark:[.76,.66,.34],roof:[.56,.57,.54],wall:[.43,.45,.43],survey:[.64,.80,.81]};
 function poly(p,y,color,id){const start=vertices.length/6,world=p.map(a=>toWorld(a,y));for(const i of triangulate(p))vertices.push(...world[i],...color);features.push({id,triangles:(vertices.length/6-start)/3});}
 function rect(s,t,l,w,y,color,id){poly([[s-l/2,t-w/2],[s+l/2,t-w/2],[s+l/2,t+w/2],[s-l/2,t+w/2]].map(([a,b])=>F.point(a,b)),y,color,id);}
 function line(a,b,w,y,color,id){let dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),vx=-dy/len*w/2,vy=dx/len*w/2;poly([[a[0]+vx,a[1]+vy],[b[0]+vx,b[1]+vy],[b[0]-vx,b[1]-vy],[a[0]-vx,a[1]-vy]],y,color,id);}
 for(const [i,p]of data.land_polygons_epsg2326.entries())poly(p,height,colors.land,'historic-land-'+i);
 for(const [i,p]of(data.aprons_epsg2326||[]).entries())poly(p,height+.08,colors.apron,'apron-'+i);
 const L=F.length,W=data.runway.width_m;
 rect(L/2,0,L,W,height+.12,colors.runway,'runway-13-31');
 // Taxiway dimensions remain explicitly labelled map-level approximations.
 for(const [i,t]of(data.taxiways||[]).entries()){
  const pts=t.points_epsg2326;for(let j=1;j<pts.length;j++){line(pts[j-1],pts[j],t.width_m,height+.10,colors.taxi,'taxiway-'+i);line(pts[j-1],pts[j],.75,height+.19,colors.taxiMark,'taxiway-center-'+i);}
 }
 for(const t of[-W/2+1.1,W/2-1.1])rect(L/2,t,L,0.9,height+.25,colors.mark,'runway-edge');
 for(let s=170;s<L-120;s+=60)rect(s,0,30,.9,height+.25,colors.mark,'runway-center');
 if(data.runway.thresholds_verified)for(const end of[0,1])for(const sign of[-1,1])for(let i=0;i<6;i++)rect(end?L-35:35,sign*(4.5+i*3.7),30,1.8,height+.27,colors.mark,'threshold-bars-'+end);
 // Readable 13/31, generated as original vector strokes, no third-party fonts or imagery.
 const digit={1:[[[.5,0],[.5,1]],[[.2,.75],[.5,1]]],3:[[[0,1],[1,1],[1,.5],[.15,.5]],[[1,.5],[1,0],[0,0]]]};
 if(data.runway.thresholds_verified)for(const [end,text]of[[0,'13'],[1,'31']])for(let d=0;d<2;d++)for(const path of digit[+text[d]])for(let j=1;j<path.length;j++){
  const convert=([x,y])=>F.point(end?L-86+y*18:86-y*18,(end?-1:1)*((d-.5)*13+(x-.5)*9));line(convert(path[j-1]),convert(path[j]),1.5,height+.28,colors.mark,'runway-number-'+text);
 }
 // Low, schematic terminal masses only where a footprint has been source-located.
 for(const b of(data.buildings||[])){poly(b.footprint_epsg2326,height+b.height_m,colors.roof,b.id+'-roof');const p=b.footprint_epsg2326;for(let i=0;i<p.length;i++){const a=toWorld(p[i],height),c=toWorld(p[(i+1)%p.length],height),d=[...c],e=[...a];d[1]+=b.height_m;e[1]+=b.height_m;for(const q of[a,c,d,a,d,e])vertices.push(...q,...colors.wall);}}
 return {vertices:new Float32Array(vertices),features,triangleCount:vertices.length/18,frame:F};
}
export function terrainClass(data,e,n){const p=[e,n];if((data.water_cut_polygons_epsg2326||[]).some(a=>inside(p,a)))return 0;if(data.land_polygons_epsg2326.some(a=>inside(p,a)))return 1;return null;}
export function applyTerrain(data,grid,heights,mask){let land=0,water=0;for(let r=0;r<grid.height;r++)for(let c=0;c<grid.width;c++){const e=grid.x0+c*grid.step,n=grid.y0-r*grid.step,k=terrainClass(data,e,n);if(k===null)continue;const i=r*grid.width+c;mask[i]=k;heights[i]=k?data.display_height_m-.20:-3;k?land++:water++;}return{land,water};}
