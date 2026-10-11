/** Original fictional Kowloon terminus. Dimensions are design choices in metres,
 * not a measured reconstruction. One score owns structure and surface parameters. */
export const STATION_SCHEMA='kaopu.railway.kowloon-station/1';
export const STATION_OPERATOR='kaopu.railway.kowloon-station';
const defaults={schema:STATION_SCHEMA,kind:'kowloon-terminal',object:{id:'kowloon-terminal-r01',seed:19160328},
  tracks:{gauge:1.435,railHead:.3485,activeIndex:3,activeCenterZ:0,vehicleWidth:3.5,vehicleHeight:4.65},
  shed:{bays:11,pitch:8,span:18,trackOffset:3.2,frontX:10,eave:8.1,rise:5.1,trussDepth:.72},
  platform:{top:1.1,edgeClearance:1.85,outerWidth:6},
  hall:{depth:16,entryGap:2,cornice:13.8,pediment:17.4},
  tower:{height:44,footprint:6.2,seaCornerOffset:1.6},
  waterfront:{quayDepth:12,waterGap:6,pierLength:24,roadWidth:13,hotelSetback:14,hotelHeight:22},
  bridge:{enabled:true,x:-10,deckY:6.65,width:2.4,stairWidth:1.5,stairRiserMax:.18,stairTread:.29},
  furnishings:{benchesPerIsland:3,benchLength:2.4,seatHeight:.46,signHeight:2.6,lampHeight:3.9},
  surface:{ageYears:38,repairFraction:.18,wetness:.24,saltExposure:.55,rainExposure:.74,ironTint:'#394944',stoneTint:'#c5bb9d',woodTint:'#785438'},
  placement:{position:[0,0,0],yaw:0}};
const clone=v=>structuredClone(v);
function plain(v,p){if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))throw Error('Plain object required: '+p);for(const k of Reflect.ownKeys(v)){if(typeof k!=='string'||['constructor','prototype','__proto__'].includes(k))throw Error('Unsafe key: '+p);const d=Object.getOwnPropertyDescriptor(v,k);if(!d.enumerable||!('value'in d))throw Error('Data property required: '+p+'.'+k);}}
function shape(v,base,p){plain(v,p);for(const k of Object.keys(v)){if(!Object.hasOwn(base,k))throw Error('Unknown field: '+p+'.'+k);if(base[k]&&typeof base[k]==='object'&&!Array.isArray(base[k]))shape(v[k],base[k],p+'.'+k);}}
const range=(n,a,b,label)=>{if(typeof n!=='number'||!Number.isFinite(n)||n<a||n>b)throw Error('Out of range: '+label);};
export function normalizeStationScore(input={}){
  shape(input,defaults,'station');const s={};for(const[k,v]of Object.entries(defaults))s[k]=v&&typeof v==='object'&&!Array.isArray(v)?{...clone(v),...(input[k]||{})}:input[k]??v;
  if(s.schema!==STATION_SCHEMA||s.kind!=='kowloon-terminal')throw Error('Unsupported station schema/kind');
  if(!/^[a-zA-Z0-9_.-]{1,96}$/.test(s.object.id))throw Error('Invalid identity');range(s.object.seed,0,0xffffffff,'seed');if(!Number.isInteger(s.object.seed))throw Error('Integer seed required');
  const ranges={tracks:{gauge:[1,1.8],railHead:[0,1],activeIndex:[0,5],activeCenterZ:[-100,100],vehicleWidth:[2,4],vehicleHeight:[3,5.3]},shed:{bays:[4,20],pitch:[5,10],span:[13,20],trackOffset:[2.5,4.5],frontX:[8,20],eave:[7,11],rise:[3,7],trussDepth:[.5,1.2]},platform:{top:[.8,1.5],edgeClearance:[1.55,2.1],outerWidth:[3,8]},hall:{depth:[12,24],entryGap:[1.5,5],cornice:[12,18],pediment:[14,23]},tower:{height:[35,48],footprint:[5,8],seaCornerOffset:[0,4]},waterfront:{quayDepth:[8,25],waterGap:[2,15],pierLength:[12,40],roadWidth:[9,20],hotelSetback:[8,25],hotelHeight:[16,26]},bridge:{x:[-100,5],deckY:[6,8],width:[2,3.5],stairWidth:[1.2,2],stairRiserMax:[.15,.19],stairTread:[.26,.34]},furnishings:{benchesPerIsland:[1,8],benchLength:[1.8,3],seatHeight:[.42,.50],signHeight:[2.3,3],lampHeight:[3.3,4.5]},surface:{ageYears:[0,120],repairFraction:[0,1],wetness:[0,1],saltExposure:[0,1],rainExposure:[0,1]}};
  for(const[section,fields]of Object.entries(ranges))for(const[k,[a,b]]of Object.entries(fields))range(s[section][k],a,b,section+'.'+k);
  for(const[section,key]of [['tracks','activeIndex'],['shed','bays'],['furnishings','benchesPerIsland']])if(!Number.isInteger(s[section][key]))throw Error('Integer required: '+section+'.'+key);
  for(const k of ['ironTint','stoneTint','woodTint'])if(!/^#[0-9a-f]{6}$/i.test(s.surface[k]))throw Error('Hex colour required: '+k);
  if(typeof s.bridge.enabled!=='boolean')throw Error('Boolean bridge.enabled required');
  if(!Array.isArray(s.placement.position)||Object.getPrototypeOf(s.placement.position)!==Array.prototype||s.placement.position.length!==3||Reflect.ownKeys(s.placement.position).length!==4)throw Error('Three coordinates required');for(let i=0;i<3;i++){const d=Object.getOwnPropertyDescriptor(s.placement.position,String(i));if(!d||!('value'in d)||!d.enumerable)throw Error('Plain coordinates required');}s.placement.position.forEach(n=>range(n,-1e6,1e6,'position'));range(s.placement.yaw,-Math.PI*2,Math.PI*2,'yaw');
  const h=s.shed,p=s.platform;
  if(h.trackOffset<s.tracks.vehicleWidth/2+.6||h.span/2-h.trackOffset<p.edgeClearance+.85)throw Error('Unsafe paired-track/platform spacing');
  if(p.edgeClearance<s.tracks.vehicleWidth/2+.05)throw Error('Platform intrudes into train envelope');
  if(h.eave+h.rise>s.hall.pediment+.5)throw Error('Shed overwhelms requested low station silhouette');
  if(s.hall.pediment<=s.hall.cornice)throw Error('Pediment must rise above cornice');
  if(s.bridge.enabled&&(s.bridge.deckY-.35<s.tracks.vehicleHeight+.8||s.bridge.deckY+1.25>h.eave-.1))throw Error('Bridge rail/roof clearance insufficient');
  const back=h.frontX-h.bays*h.pitch,stairLength=Math.ceil((s.bridge.deckY-p.top)/s.bridge.stairRiserMax)*s.bridge.stairTread;
  if(s.bridge.enabled&&(s.bridge.x-s.bridge.width/2-stairLength<back+3||s.bridge.x+s.bridge.width/2>h.frontX-3))throw Error('Bridge stairs outside platform');
  return clone(s);
}
export function canonicalStationScore(input){return JSON.stringify(normalizeStationScore(input));}
export const DEFAULT_STATION_SCORE=Object.freeze(normalizeStationScore());
