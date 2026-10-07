// Numeric functions shared by parameter extraction and the standalone player.
export function basis(s, knots, degree=3) {
  const count=knots.length-degree-1;
  if(s===knots.at(-1))return Array.from({length:count},(_,i)=>i===count-1?1:0);
  let row=Array.from({length:knots.length-1},(_,i)=>s>=knots[i]&&s<knots[i+1]?1:0);
  for(let d=1;d<=degree;d++)row=Array.from({length:row.length-1},(_,i)=>{
    const a=knots[i+d]-knots[i],b=knots[i+d+1]-knots[i+1];
    return (a?(s-knots[i])/a*row[i]:0)+(b?(knots[i+d+1]-s)/b*row[i+1]:0);
  });
  return row;
}
export function spline(s, knots, coefficients) {
  const w=basis(s,knots);
  return w.reduce((sum,v,i)=>sum+v*coefficients[i],0);
}
export function phase(t, period, harmonics) {
  const angle=2*Math.PI*t/period, row=[1];
  for(let n=1;n<=harmonics;n++)row.push(Math.cos(n*angle),Math.sin(n*angle));
  return row;
}
export function series(coefficients, timeBasis) {
  return coefficients.reduce((sum,v,i)=>sum+v*timeBasis[i],0);
}
// Rodrigues rotation from a rotation vector; no scene or animation dependency.
export function rotate(v, rotation) {
  const a=Math.hypot(...rotation);
  if(a<1e-14)return [...v];
  const [x,y,z]=rotation.map(c=>c/a),[vx,vy,vz]=v;
  const c=Math.cos(a),s=Math.sin(a),dot=x*vx+y*vy+z*vz;
  return [vx*c+(y*vz-z*vy)*s+x*dot*(1-c),vy*c+(z*vx-x*vz)*s+y*dot*(1-c),vz*c+(x*vy-y*vx)*s+z*dot*(1-c)];
}
