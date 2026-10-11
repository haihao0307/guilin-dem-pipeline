import test from 'node:test';import assert from 'node:assert/strict';
import {contourGeometry,contourShapes} from '../native-a4/branding/contours.mjs';
import plaque from '../native-a4/branding/company_plaque-gold.mjs';
import word from '../native-a4/branding/wordmark.mjs';import gold from '../native-a4/branding/wordmark-gold.mjs';
import number from '../native-a4/branding/number88.mjs';
const area=g=>{const p=g.attributes.position,idx=g.index;let n=0;for(let i=0;i<idx.count;i+=3){const a=idx.getX(i),b=idx.getX(i+1),c=idx.getX(i+2);n+=Math.abs((p.getX(b)-p.getX(a))*(p.getY(c)-p.getY(a))-(p.getY(b)-p.getY(a))*(p.getX(c)-p.getX(a)))/2;}return n;};
for(const recipe of[plaque,word,gold,number])test('Tessellated '+recipe.asset+' preserves all explicit source holes and area',()=>{const g=contourGeometry(recipe);try{assert(Math.abs(area(g)-recipe.rings.reduce((a,r)=>a+r.signed_area_px2,0))<.01);}finally{g.dispose();}});
test('Original six-spoke plaque wheel owns its six large apertures, not the outer plaque border',()=>{
 const shapes=contourShapes(plaque),wheel=shapes.find(s=>{const b=s.getPoints().reduce((b,p)=>[Math.min(b[0],p.x),Math.max(b[1],p.x),Math.min(b[2],-p.y),Math.max(b[3],-p.y)],[Infinity,-Infinity,Infinity,-Infinity]);return b[0]>600&&b[0]<680&&b[1]>870&&b[1]<900&&b[2]>300&&b[2]<350&&b[3]>530&&b[3]<560;});
 assert(wheel,'original wheel outer contour');const large=wheel.holes.filter(h=>{const pts=h.getPoints();let a=0;for(let i=0;i<pts.length;i++){const p=pts[i],q=pts[(i+1)%pts.length];a+=p.x*q.y-q.x*p.y;}return Math.abs(a)/2>1000;});assert.equal(large.length,6);
});
