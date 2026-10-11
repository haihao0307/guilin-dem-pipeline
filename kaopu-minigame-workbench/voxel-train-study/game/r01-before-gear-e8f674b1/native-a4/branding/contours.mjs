// Preserve explicit even-odd topology for nested artwork: plaque border, glyphs,
// wheel rim, six spoke apertures and islands. ShapePath's order-based fallback
// cannot safely assign holes when multiple nested outer boundaries contain them.
import * as T from '../../../../vendor/three.module.js';
const contains=(points,[x,y])=>{let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
export function contourShapes(recipe){
 const outer=recipe.rings.filter(r=>r.role==='outer').map(r=>({ring:r,area:Math.abs(r.signed_area_px2),shape:new T.Shape(r.points.map(([x,y])=>new T.Vector2(x,-y)))}));
 for(const ring of recipe.rings.filter(r=>r.role==='hole')){
  const parent=outer.filter(o=>o.area>Math.abs(ring.signed_area_px2)&&contains(o.ring.points,ring.points[0])).sort((a,b)=>a.area-b.area)[0];
  if(!parent)throw Error('Brand contour hole has no containing solid');
  parent.shape.holes.push(new T.Path(ring.points.map(([x,y])=>new T.Vector2(x,-y))));
 }
 return outer.map(o=>o.shape);
}
export function contourGeometry(recipe){return new T.ShapeGeometry(contourShapes(recipe),1);}
