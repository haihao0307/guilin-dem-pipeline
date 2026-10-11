// Conservative visibility only. Original template positions/normals never change.
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function onSegment(a,b,p){return Math.abs(cross(a,b,p))<1e-9&&p[0]>=Math.min(a[0],b[0])-1e-9&&p[0]<=Math.max(a[0],b[0])+1e-9&&p[1]>=Math.min(a[1],b[1])-1e-9&&p[1]<=Math.max(a[1],b[1])+1e-9;}
function inside(p,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[j],b=poly[i];if(onSegment(a,b,p))return false;if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
function intersects(a,b,c,d){const p=cross(a,b,c),q=cross(a,b,d),r=cross(c,d,a),s=cross(c,d,b);return p*q<0&&r*s<0||onSegment(a,b,c)||onSegment(a,b,d)||onSegment(c,d,a)||onSegment(c,d,b);}
function containsRect(region,rect){const poly=region.polygon||[[region.u0,region.y0],[region.u1,region.y0],[region.u1,region.y1],[region.u0,region.y1]],corners=[[rect.u0,rect.y0],[rect.u1,rect.y0],[rect.u1,rect.y1],[rect.u0,rect.y1]];if(!corners.every(p=>inside(p,poly)))return false;for(let j=0;j<poly.length;j++)for(let i=0;i<4;i++)if(intersects(poly[j],poly[(j+1)%poly.length],corners[i],corners[(i+1)%4]))return false;for(const hole of region.holes||[]){if(hole.some(p=>p[0]>=rect.u0&&p[0]<=rect.u1&&p[1]>=rect.y0&&p[1]<=rect.y1)||corners.some(p=>inside(p,hole)))return false;for(let j=0;j<hole.length;j++)for(let i=0;i<4;i++)if(intersects(hole[j],hole[(j+1)%hole.length],corners[i],corners[(i+1)%4]))return false;}return true;}
export function brickHiddenByBothCoats(w,placement,entry,coatings){
 const b=entry.geometry.boundingBox;if(!b||b.max.z>.062||b.min.z<-.062)return false; // guaranteed outside envelope < ±(55+8)mm
 const u=w.alongX?placement.position[0]:placement.position[2],y=placement.position[1],margin=.001,radius=Math.max(Math.abs(b.min.x),Math.abs(b.max.x)),rect={u0:u-radius-margin,u1:u+radius+margin,y0:y+b.min.y-margin,y1:y+b.max.y+margin};
 if(w.openings.some(o=>rect.u1>o.center-o.width/2-margin&&rect.u0<o.center+o.width/2+margin&&rect.y1>w.bottom+o.bottom-margin&&rect.y0<w.bottom+o.bottom+o.height+margin))return false;
 return [-1,1].every(face=>coatings.some(c=>c.faces.includes(face)&&c.regions.some(r=>containsRect(r,rect))));
}
