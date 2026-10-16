/** Reusable authored architecture rules. Metres; no historical source mesh or solver dependency. */
export function vaultSpec({spanX,spanZ=spanX,spring,rise,supports}){
 if(!(spanX>0&&spanZ>0&&rise>0&&spring>=0))throw Error('Vault dimensions must be positive');
 if(!Array.isArray(supports)||supports.length!==4)throw Error('Four explicit corner supports required');
 const corners=[[-spanX/2,-spanZ/2],[spanX/2,-spanZ/2],[-spanX/2,spanZ/2],[spanX/2,spanZ/2]];
 if(!corners.every(([x,z])=>supports.some(p=>Math.abs(p[0]-x)<1e-8&&Math.abs(p[1]-z)<1e-8)))throw Error('Support grid does not match vault footprint');
 return Object.freeze({spanX,spanZ,spring,rise,crown:spring+rise,supports:supports.map(p=>Object.freeze([...p])),solver:'authored geometric envelope; no thrust/load certification'});
}
export function groinHeight(x,z,v){
 const a=Math.max(0,1-(x/(v.spanX/2))**2),b=Math.max(0,1-(z/(v.spanZ/2))**2);
 return v.spring+v.rise*Math.sqrt(Math.max(a,b));
}
export function archProfile({centre=0,span,spring,rise,segments=48}){
 if(!(span>0&&rise>0&&segments>=8))throw Error('Invalid arch profile');
 return Array.from({length:segments+1},(_,i)=>{const a=Math.PI-i*Math.PI/segments;return[centre+span/2*Math.cos(a),spring+rise*Math.sin(a)];});
}
export function bayStations(start,end,pitch,{includeEnds=true}={}){
 if(!(end>start&&pitch>0))throw Error('Invalid bay range');const count=Math.round((end-start)/pitch);
 if(Math.abs(count*pitch-(end-start))>1e-8)throw Error('Boundary must fit the declared bay pitch');
 return Array.from({length:count+1},(_,i)=>start+i*pitch).filter((_,i)=>includeEnds||i>0&&i<count);
}
export function rectangleIntersection(a,b){return Math.max(0,Math.min(a[1],b[1])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[3],b[3])-Math.max(a[2],b[2]));}
export function areaLedger(envelope,footprints){const allocation=(envelope[1]-envelope[0])*(envelope[3]-envelope[2]);const permanent=footprints.reduce((n,p)=>n+rectangleIntersection(envelope,p),0);return{allocation,permanent,remaining:allocation-permanent};}
export function apertureIsOpen(x,z,aperture){return x>aperture[0]&&x<aperture[1]&&z>aperture[2]&&z<aperture[3];}
