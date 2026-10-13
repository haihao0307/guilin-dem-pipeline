const {test}=require('node:test'),assert=require('node:assert/strict'),{cropProjection}=require('./crop_projection.cjs');
test('cropped perspective equals the original pixel location minus the fixed crop origin',()=>{
 const P=[7.18,0,0,0,0,9.7,0,0,.32,.7,-1.0002,-1,0,0,-.020002,0],box=[367,160,263,82],Q=cropProjection(P,797,590,box);
 const pixel=(M,p,w,h)=>{const c=[0,1,2,3].map(r=>M[r]*p[0]+M[4+r]*p[1]+M[8+r]*p[2]+M[12+r]);return[(c[0]/c[3]+1)*w/2,(1-c[1]/c[3])*h/2]};
 for(const p of[[0,0,-1],[.03,.06,-.8],[-.04,-.07,-1.2]]){const a=pixel(P,p,797,590),b=pixel(Q,p,box[2],box[3]);assert(Math.abs(a[0]-box[0]-b[0])<1e-10);assert(Math.abs(a[1]-box[1]-b[1])<1e-10);}
});
test('crop rejects invalid extents and nonfinite projection',()=>{const P=Array(16).fill(0);assert.throws(()=>cropProjection(P,797,590,[-1,0,20,20]));P[0]=NaN;assert.throws(()=>cropProjection(P,797,590,[0,0,20,20]));});
