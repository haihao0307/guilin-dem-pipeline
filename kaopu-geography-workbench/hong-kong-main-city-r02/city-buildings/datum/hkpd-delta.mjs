// Pass the unmodified R03 detail-data/datum/datum_controls.json object.
// Inputs are EPSG:2326 E,N metres, NOT local render X,Z.
// Heights returned by this visual model are NOT survey-grade.
export function createHKPDDatumLookup(manifest) {
  const grids=manifest.grids;
  if (!Array.isArray(grids) || !grids.length) throw new Error('Missing datum controls');
  const ascending=a=>Array.isArray(a)&&a.length>=2&&a.every((v,i)=>Number.isFinite(v)&&(i===0||v>a[i-1]));
  for(const g of grids) {
    if(!ascending(g.xs)||!ascending(g.ys)||g.delta_grid_m.length!==g.ys.length||g.delta_grid_m.some(r=>r.length!==g.xs.length||r.some(v=>!Number.isFinite(v)))) throw new Error('Invalid datum grid '+g.patch);
  }
  function cell(a,x){if(!Number.isFinite(x)||x<a[0]||x>a.at(-1))return -1;let i=0;while(i<a.length-2&&x>a[i+1])i++;return i;}
  function lookup(E,N) {
    for(const g of grids){const i=cell(g.xs,E),j=cell(g.ys,N);if(i<0||j<0)continue;
      const u=(E-g.xs[i])/(g.xs[i+1]-g.xs[i]),v=(N-g.ys[j])/(g.ys[j+1]-g.ys[j]),z=g.delta_grid_m;
      return {deltaM:(1-u)*(1-v)*z[j][i]+u*(1-v)*z[j][i+1]+(1-u)*v*z[j+1][i]+u*v*z[j+1][i+1],patch:g.patch,status:'model-aligned; not survey-grade',interpolationCheckMaxResidualM:g.max_interpolation_or_height_test_residual_m};
    }
    return null; // Never clamp/extrapolate or substitute a constant outside controls.
  }
  function sourceToMap(E,N,Hmpd){if(!Number.isFinite(Hmpd))return null;const q=lookup(E,N);return q?{...q,x:E-834000,y:Hmpd+q.deltaM,z:827000-N}:null;}
  function boundsCovered([Emin,Nmin,Emax,Nmax]) { // Entire instance/chunk must be inside one valid control rectangle.
    if(![Emin,Nmin,Emax,Nmax].every(Number.isFinite)||Emin>Emax||Nmin>Nmax)return false;
    return grids.some(g=>Emin>=g.xs[0]&&Emax<=g.xs.at(-1)&&Nmin>=g.ys[0]&&Nmax<=g.ys.at(-1));
  }
  return {lookup,sourceToMap,boundsCovered};
}
