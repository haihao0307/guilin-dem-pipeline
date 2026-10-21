import {panelFields,scalePoint} from './controls.mjs';
/** Analytic box fields, metres; no mesh, triangle model, textures, or imported assets. */
export function boxDistance(p,c,h){const q=p.map((v,i)=>Math.abs(v-c[i])-h[i]);return Math.hypot(...q.map(v=>Math.max(0,v)))+Math.min(Math.max(...q),0);}
export function sceneFields(s){const out=[];const box=(id,c,h,role=4,tone=0)=>out.push({id,center:c,half:h,role,tone});
 const lo=s.floors[0].elevation,hi=s.floors.at(-1).elevation+2.8;
 box('shaft-back',[0,(lo+hi)/2,-1.1],[1.75,(hi-lo)/2,.1],1);
 for(const x of [-1.6,1.6])box('shaft-column-'+x,[x,(lo+hi)/2,x>0?-.94:-.3],[.13,(hi-lo)/2,x>0?.11:.85],2);
 for(const x of [-1.42,1.42])box('guide-rail-'+x,[x,(lo+hi)/2,-.82],[.035,(hi-lo)/2,.035],4);
 for(const f of s.floors){const y=f.elevation;
  box(f.id+'-slab',[0,y-.12,1.985],[2.2,.12,.765],1);
  for(const x of [-1.625,1.625])box(f.id+'-slab-side-'+x,[x,y-.12,1.035],[.575,.12,.185],1);
  for(const x of [-1.13,1.13])box(f.id+'-jamb-'+x,[x,y+1.1885,1.05],[.50,1.1885,.09],4,5);
  box(f.id+'-lintel',[0,y+2.47,1.05],[1.62,.09,.12],4,5);
  box(f.id+'-sill-base',[0,y-.016,1.05],[1.05,.012,.17],4,0);
  for(const z of [.925,1.015,1.105,1.185])box(f.id+'-sill-rib-'+z,[0,y-.004,z],[1.05,.004,.035],4,2);
  const open=s.landingDoors[f.id];
  for(const side of [-1,1])box(f.id+'-landing-'+side,[side*(.30+open*.60),y+1.18,.89],[.297,1.17,.035],4,f.served?1:3);
 }
 const y=s.y;
 box('car-floor',[0,y-.035,-.05],[1.28,.035,.85],4,2);
 box('car-back',[0,y+1.18,-.92],[1.28,1.18,.035],4,2);
 box('car-left',[-1.26,y+1.18,-.15],[.035,1.18,.8],4,2);
 // Right side omitted for pedagogical cutaway, not a buildable enclosure.
 box('car-ceiling',[0,y+2.4,-.05],[1.28,.04,.85],4,2);
 box('car-light',[0,y+2.345,-.15],[.7,.012,.3],4,4);
 for(const x of [-.7,0,.7])box('car-panel-seam-'+x,[x,y+1.21,-.875],[.008,1.12,.008],4,0);
 box('car-skirt',[0,y+.12,-.86],[1.04,.045,.02],4,0);
 box('car-handrail',[-.35,y+.93,-.83],[.6,.025,.025],4,2);
 for(const side of [-1,1])box('car-door-'+side,[side*(.30+s.carDoor*.60),y+1.18,.76],[.297,1.17,.035],4,2);
 out.push(...panelFields(s));return out.map(f=>({...f,center:scalePoint(s,f.center),half:[f.half[0]*s.design.width/2.56,f.half[1],f.half[2]*s.design.depth/1.7]}));
}
