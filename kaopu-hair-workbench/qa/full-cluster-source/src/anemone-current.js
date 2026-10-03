/* Regional-flow adapter for the restored r03 anemone core.
 * Load after baselines/r03-restored/src/anemone-core.js in a browser, then
 * explicitly select AnemoneCurrent.solve. This file does not replace the core.
 *
 * Qualitative basis: H. magnifica previews UP24379/UP14739 and the SICB
 * A. diaphana field abstract support flow-led bending and irregular flutter.
 * Constants below are visual-fit controls, not measured species parameters,
 * NOAA/PICRC values, an FSI solver, contraction physiology or contact proof.
 * Roots, shape distribution, rest tangent and normalized fixed edge lengths
 * are inherited unchanged. There is no oral-disc/body animation or breathing.
 */
(function (root) {
  'use strict';
  const C = typeof module !== 'undefined' && module.exports
    ? require('../../baselines/r03-restored/src/anemone-core.js') : root.AnemoneCore;
  if (!C) throw Error('Load the restored AnemoneCore before AnemoneCurrent');
  const VERSION = 'regional-aperiodic-1';
  const fade = t => t*t*t*(t*(t*6-15)+10);
  const mix = (a,b,t) => a+(b-a)*t;

  // A continuous C2 value field: no tentacle index, random per-frame state,
  // looped timeline, per-root random phase or discrete region membership.
  function lattice(x,z,t,seed) {
    let h = (seed ^ Math.imul(x,0x1f123bb5) ^ Math.imul(z,0x5f356495) ^ Math.imul(t,0x6c8e9cf5)) | 0;
    h = Math.imul(h^(h>>>16),0x45d9f3b);
    h = Math.imul(h^(h>>>16),0x45d9f3b);
    return ((h^(h>>>16))>>>0)/4294967295*2-1;
  }
  function noise3(x,z,t,seed) {
    const ix=Math.floor(x), iz=Math.floor(z), it=Math.floor(t);
    const a=fade(x-ix), b=fade(z-iz), c=fade(t-it);
    return mix(
      mix(mix(lattice(ix,iz,it,seed),lattice(ix+1,iz,it,seed),a),
          mix(lattice(ix,iz+1,it,seed),lattice(ix+1,iz+1,it,seed),a),b),
      mix(mix(lattice(ix,iz,it+1,seed),lattice(ix+1,iz,it+1,seed),a),
          mix(lattice(ix,iz+1,it+1,seed),lattice(ix+1,iz+1,it+1,seed),a),b),c);
  }
  function field(s,x,z,u,t,dx,dz,out) {
    // Smooth advection delay means nearby roots respond together while more
    // distant regions can lag. The spatial field also changes waveform, so
    // every root is not driven by one shared scalar or shifted global sine.
    const along=x*dx+z*dz, clock=t-.45*along;
    const broad=noise3(x*.38+.83,z*.38-.41,clock*.31-u*.13,s.seed^0x51ed270b);
    const regional=noise3(x*.86-.27,z*.86+.63,clock*.70-u*.28,s.seed^0x2745937f);
    const cross=noise3(x*.82+.21,z*.82-.72,clock*.62-u*.25,s.seed^0x68bc21eb);
    const local=noise3(x*1.85-.38,z*1.85+.16,clock*1.65-u*.87,s.seed^0x02e5be93);
    const low=.48*broad+.52*regional;
    out.streamwise=s.current*(.58+.63*low+.12*s.turbulence*local);
    out.crosswise=s.turbulence*(.72*cross+.28*local);
    out.low=low; out.disturbance=local;
    return out;
  }
  function sampleFlow(s,x,z,u,time,out={}) {
    if (!Number.isFinite(time)) throw Error('Regional flow requires finite time');
    const d=s.direction*Math.PI/180;
    return field(s,x,z,u,time*s.frequency,Math.cos(d),Math.sin(d),out);
  }
  function solve(s,rs,time,out=new Float32Array(rs.length*(C.SEGMENTS+1)*4)) {
    if (!Number.isFinite(time)) throw Error('Regional flow requires finite time');
    const d=s.direction*Math.PI/180, dx=Math.cos(d), dz=Math.sin(d), t=time*s.frequency;
    const S=C.SEGMENTS, flow={};
    for(let i=0;i<rs.length;i++) {
      const r=rs[i], base=i*(S+1)*4, step=r.length/S;
      out[base]=r.x; out[base+1]=r.y; out[base+2]=r.z; out[base+3]=r.radius;
      let x=r.x,y=r.y,z=r.z;
      for(let j=1;j<=S;j++) {
        const u=(j-.5)/S,flex=u*u;
        field(s,r.x,r.z,u,t,dx,dz,flow);
        // Exact r03 rest-shape formulas; root phase remains geometry-only.
        const bend=C.clamp(r.lean+r.curve*Math.pow(u,.82),0,2.3);
        const heading=r.heading+.16*Math.sin(u*2.7+r.phase);
        const vx=Math.cos(heading)*Math.sin(bend)+flex*(dx*flow.streamwise*.7-dz*flow.crosswise*.5);
        const vz=Math.sin(heading)*Math.sin(bend)+flex*(dz*flow.streamwise*.7+dx*flow.crosswise*.5);
        const vy=Math.cos(bend), norm=Math.hypot(vx,vy,vz);
        x+=vx/norm*step; y+=vy/norm*step; z+=vz/norm*step;
        const o=base+j*4;
        out[o]=x; out[o+1]=y; out[o+2]=z; out[o+3]=j===S?r.length:r.radius;
      }
    }
    return out;
  }
  const api={...C,VERSION,noise3,sampleFlow,solve};
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  else root.AnemoneCurrent=api;
})(typeof window!=='undefined'?window:globalThis);
