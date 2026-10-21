/** Analytic box fields, metres; no mesh, triangle model, textures, or imported assets. */
export function boxDistance(p,c,h){const q=p.map((v,i)=>Math.abs(v-c[i])-h[i]);return Math.hypot(...q.map(v=>Math.max(0,v)))+Math.min(Math.max(...q),0);}
export function sceneFields(s){const out=[];const box=(id,c,h,role=4,tone=0)=>out.push({id,center:c,half:h,role,tone});
 const lo=s.floors[0].elevation,hi=s.floors.at(-1).elevation+2.8;
 box('shaft-back',[0,(lo+hi)/2,-1.1],[1.75,(hi-lo)/2,.1],1);
 for(const x of [-1.6,1.6])box('shaft-column-'+x,[x,(lo+hi)/2,x>0?-.94:-.3],[.13,(hi-lo)/2,x>0?.11:.85],2);
 for(const x of [-1.2,1.2])box('guide-rail-'+x,[x,(lo+hi)/2,-.92],[.035,(hi-lo)/2,.035],4);
 for(const f of s.floors){const y=f.elevation;
  box(f.id+'-slab',[0,y-.12,1.8],[2.2,.12,.95],1);
  for(const x of [-1.3,1.3])box(f.id+'-jamb-'+x,[x,y+1.2,1.05],[.33,1.2,.09],4,5);
  box(f.id+'-lintel',[0,y+2.47,1.05],[1.62,.09,.12],4,5);
  box(f.id+'-sill-base',[0,y+.006,1.05],[1.05,.006,.15],4,0);
  for(const z of [.925,1.015,1.105,1.185])box(f.id+'-sill-rib-'+z,[0,y+.02,z],[1.05,.008,.035],4,2);
  const open=s.landingDoors[f.id];
  for(const side of [-1,1])box(f.id+'-landing-'+side,[side*(.47+open*.87),y+1.18,1.08],[.467,1.14,.045],4,f.served?1:3);
 }
 const y=s.y;
 box('car-floor',[0,y+.03,-.05],[1.13,.03,.94],4,2);
 box('car-back',[0,y+1.21,-.92],[1.13,1.15,.035],4,2);
 box('car-left',[-1.11,y+1.21,-.05],[.035,1.15,.9],4,2);
 // Right side omitted for pedagogical cutaway, not a buildable enclosure.
 box('car-ceiling',[0,y+2.4,-.05],[1.13,.04,.94],4,2);
 box('car-light',[0,y+2.345,-.15],[.7,.012,.3],4,4);
 for(const x of [-.7,0,.7])box('car-panel-seam-'+x,[x,y+1.21,-.875],[.008,1.12,.008],4,0);
 box('car-skirt',[0,y+.12,-.86],[1.04,.045,.02],4,0);
 box('car-handrail',[0,y+.93,-.83],[.85,.025,.025],4,2);
 for(const side of [-1,1])box('car-door-'+side,[side*(.47+s.carDoor*.87),y+1.18,.84],[.467,1.14,.035],4,2);
 return out;
}
