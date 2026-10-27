/* KAOPU native bogie end-package Mother. Source is a semantic primitive/CSG
 * graph, shared exact dimension literals and named placement inputs; NOT mesh
 * samples or an encoded shader dictionary. Expanded GLSL is a rebuildable cache.
 * The emitted legacy arithmetic/order/literal spelling is deliberately preserved.
 */
(function(root){'use strict';
const literal=/^(?:\(-?(?:\d*\.)?\d+(?:e[+-]?\d+)?\)|-?(?:\d*\.)?\d+(?:e[+-]?\d+)?)$/i;
const finite=s=>typeof s==='string'&&literal.test(s)&&Number.isFinite(Number(s.replace(/[()]/g,'')));
const deepFreeze=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(deepFreeze);Object.freeze(o);}return o;};
function create(model){
 const mother={id:'a4/bogie-spring-end-package@1',units:'m, coil turns dimensionless',contract:'negative-inside analytic CSG; inherited coil conservative range, not universal exact SDF',parent:'A4/model_local_frame',axes:['transverse x','vertical y','longitudinal z'],Time:'A4/shared_mechanical_theta; retained static identity at this modelling revision',dimensions:'retained inferred teaching geometry, not measured A4',worldPlacement:null,historicalDate:null,noise:false};
 const members=model.members,graph=model.graph,instances=model.instances;
 if(members.length!==10||graph.length!==50||instances.length!==8)throw Error('Bounded eight-package contract required');
 const instanceIDs=new Set();
 for(const i of instances){if(!/^(left|right)_axle[01]_(rear|front)$/.test(i.id)||instanceIDs.has(i.id))throw Error('Unique retained instance identity required');instanceIDs.add(i.id);
  if(!Array.isArray(i.origin)||i.origin.length!==3||!Array.from(i.origin).every(finite)||i.origin[1]!=='0.0')throw Error('Finite hanger-axis generation origin required');
  if(!['guideX','guideZ','seatX'].every(k=>finite(i.placement[k])))throw Error('Explicit retained guide/seat placement required');
  if(![i.guideBase,i.bodyBase,i.rangeBase].every(Number.isSafeInteger)||i.bounds.length!==10||!i.bounds.every(b=>b.length===6&&Array.from(b).every(Number.isFinite)&&b.slice(0,3).every((x,j)=>x<=b[j+3])))throw Error('Legacy bindings and finite ordered enclosure certificates required');
 }
 const source={},parts={},records=[];
 for(const i of instances){
  const placement={...i.placement,hangerX:i.origin[0],hangerZ:i.origin[2]},known=new Set(),nodeBounds=new Map(),nodeByKey=new Map(graph.map(n=>[n.key,n]));
  const resolve=v=>typeof v==='object'&&v!==null?placement[v.$]:v;
  const f=v=>{v=resolve(v);if(!finite(v))throw Error('Finite exact decimal parameter required');return v;};
  const vec=a=>{if(!Array.isArray(a)||a.length!==3)throw Error('Three explicit coordinates required');return 'vec3('+Array.from(a).map(f).join(',')+')';};
  const num=v=>Number(f(v).replace(/[()]/g,'')),positive=v=>{const x=num(v);if(x<=0)throw Error('Positive primitive dimension required');return x;};
  function enclosure(n){const pair=(c,h)=>[c.map((v,k)=>v-h[k]),c.map((v,k)=>v+h[k])];
   if(n.op==='box')return pair(n.center.map(num),n.half.map(positive));
   if(n.op==='cylinderY')return pair(n.center.map(num),[positive(n.radius),positive(n.half),positive(n.radius)]);
   if(n.op==='coilY'){const c=n.center.map(num),r=positive(n.radius)+positive(n.wire),a=num(n.start),b=num(n.end);positive(n.turns);if(!(b>a))throw Error('Ordered coil extent required');return[[c[0]-r,c[1]+a-num(n.wire),c[2]-r],[c[0]+r,c[1]+b+num(n.wire),c[2]+r]];}
   if(['member','retainedRigidIdentity'].includes(n.op))return nodeBounds.get(n.of);
   if(n.op==='subtract')return nodeBounds.get(n.a);
   if(n.op==='union'||n.op==='intersect'){const a=nodeBounds.get(n.a),b=nodeBounds.get(n.b),un=n.op==='union';return[0,1].map(k=>[0,1,2].map(j=>(k===0?un?Math.min:Math.max:un?Math.max:Math.min)(a[k][j],b[k][j])));}
   return null;
  }
  const name=k=>/^n\d+$/.test(k)?'support_node_'+(+k.slice(1)<2?i.guideBase+(+k.slice(1)):i.bodyBase+(+k.slice(1))-2):/^r\d+$/.test(k)?'support_interval_'+(i.rangeBase+(+k.slice(1))):members.includes(k)?'support_trucks_bogie_'+k+'_'+i.id:(()=>{throw Error('Unknown member '+k)})();
  const ref=k=>{if(!known.has(k))throw Error('Undefined or forward graph dependency '+k);return name(k);};
  for(const n of graph){let body,args='vec3 p',type='float';if(known.has(n.key))throw Error('Duplicate node');
   switch(n.op){
    case 'box':body=`return support_sdBox(p-${vec(n.center)},${vec(n.half)});`;break;
    case 'cylinderY':body=`vec3 q=p-${vec(n.center)};return max(length(q.xz)-${f(n.radius)},abs(q[1])-${f(n.half)});`;break;
    case 'subtract':case 'union':case 'intersect':body=`return ${n.op==='union'?'min':'max'}(${ref(n.a)}(p),${n.op==='subtract'?'-':''}${ref(n.b)}(p));`;break;
    case 'retainedRigidIdentity':body=`vec3 q=p-vec3(0.0,0.0,0.0);return ${ref(n.of)}(vec3(dot(q,vec3(1.0,0.0,(-0.0))),dot(q,vec3(0.0,1.0,0.0)),dot(q,vec3(0.0,0.0,1.0))));`;break;
    case 'member':body=`return ${ref(n.of)}(p);`;break;
    case 'coilY':body=`return support_coil(p-${vec(n.center)},1,${[n.start,n.end,n.radius,n.wire,n.turns].map(f).join(',')});`;break;
    case 'coilRangeY':{ref(n.of);const c=nodeByKey.get(n.of);if(c.op!=='coilY')throw Error('Range must consume the same coil node');args='vec3 lo,vec3 hi';type='vec2';body=`return support_coilRange(lo-${vec(c.center)},hi-${vec(c.center)},1,${[c.start,c.end,c.radius,c.wire,c.turns].map(f).join(',')});`;break;}
    case 'retainedRigidIdentityRange':args='vec3 lo,vec3 hi';type='vec2';body=`vec3 c=(lo+hi)*0.5-vec3(0.0,0.0,0.0),h=(hi-lo)*0.5;vec3 qc=vec3(dot(c,vec3(1.0,0.0,(-0.0))),dot(c,vec3(0.0,1.0,0.0)),dot(c,vec3(0.0,0.0,1.0))),qh=vec3(dot(h,vec3(1.0,0.0,0.0)),dot(h,vec3(0.0,1.0,0.0)),dot(h,vec3(0.0,0.0,1.0)));return ${ref(n.of)}(qc-qh,qc+qh);`;break;
    default:throw Error('Unsupported native Mother operation '+n.op);
   }
   nodeBounds.set(n.key,enclosure(n));known.add(n.key);if(Object.prototype.hasOwnProperty.call(source,name(n.key)))throw Error('Duplicate generated function identity');source[name(n.key)]=`${type} ${name(n.key)}(${args}){${body}}`;
  }
  const fieldIDs=[];
  members.forEach((slot,k)=>{const e=nodeBounds.get(slot),cert=i.bounds[k];if(!e||e.some((row,j)=>row.some((x,a)=>!Number.isFinite(x)||(j===0?x<cert[a]:x>cert[a+3]))))throw Error('Changed geometry exceeds retained enclosure certificate: '+slot);const id='trucks/bogie_'+slot+'_'+i.id,b=i.bounds[k],p={id,group:'trucks',glsl_function:name(slot),aabb_min:b.slice(0,3),aabb_max:b.slice(3),status:'exact_R20_signed_field_port_inferred_teaching_geometry'};if(slot==='main_coil')p.interval_function=name('r1');else p.lipschitz=1.000002;p.source='support';parts[id]=p;fieldIDs.push(id);});
  records.push({id:'bogie_end/'+i.id,mother:mother.id,Time:{reference:mother.Time,historicalDate:null},Location:{parent:mother.parent,origin:i.origin.map(s=>Number(s.replace(/[()]/g,''))),axes:mother.axes,worldPlacement:null},Object:{members:fieldIDs,relations:'coaxial hanger/annular seat/coil/lower plate/rubber-stack/box/bottom fasteners; guide has its own declared original placement',placement:i.placement,modelFrameContract:'origin is the hanger-axis mathematical convention; exact guide/seat parent-coordinate literals retained to avoid reassociation rounding',dimensions:mother.dimensions}});
 }
 const api={mother,parameters:graph,instances:records,parts,source,fragment(names){return names.map(n=>{if(!(n in source))throw Error('Missing generated definition '+n);return source[n];}).join('\n');}};
 return deepFreeze(api);
}
root.KAOPU_BOGIE_MOTHER=Object.freeze({create});
})(typeof window==='object'?window:globalThis);
