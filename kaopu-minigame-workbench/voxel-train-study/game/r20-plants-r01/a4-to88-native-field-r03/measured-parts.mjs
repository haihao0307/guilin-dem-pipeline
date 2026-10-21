/* LNER-supplied 1935 Silver Link dimension table, The Engineer p320.
 * These are nominal journal/pin measurement segments, NOT complete shafts.
 * Unknown shoulders, fits, corner radii and assembly transforms stay null.
 */
export const PART_SOURCE='https://theengineer.markallengroup.com/production/2018/09/Gresley-Silver-Jubilee.pdf#page=3';
const inch=.0254;
export const MEASURED_CATALOG=Object.freeze([
 {id:'journal.leading',label:'导向轴颈量段',diameterIn:6.5,lengthIn:9,tableRow:'Axles, journals: Bogie'},
 {id:'journal.coupled',label:'驱动轴颈量段',diameterIn:9.5,lengthIn:11,tableRow:'Axles, journals: Coupled'},
 {id:'journal.trailing',label:'从动轴颈量段',diameterIn:6,lengthIn:11,tableRow:'Axles, journals: Trailing'},
 {id:'crankpin.outside',label:'外侧曲柄销量段',diameterIn:5.5,lengthIn:6,tableRow:'Crank pins: Outside'},
 {id:'crankpin.inside',label:'内侧曲柄销量段',diameterIn:8.25,lengthIn:6,tableRow:'Crank pins: Inside'}
]);
export function makeMeasuredParts(){return MEASURED_CATALOG.map(d=>{const r=d.diameterIn*inch/2,h=d.lengthIn*inch/2;return {...d,kind:5,material:4,position:[0,0,0],size:[r,h,r],rounding:0,sections:[],bounds:[[-r,-h,-r],[r,h,r]],source:PART_SOURCE,dimensionStatus:'observed in primary published table',basis:'nominal dimension segment only; not manufacturing geometry',assemblyTransform:null,shoulderGeometry:null,fitTolerance:null,cornerRadius:null,fullPart:false};});}
export function measuredPart(id){const p=makeMeasuredParts().find(x=>x.id===id);if(!p)throw Error('UNKNOWN_MEASURED_PART');return p;}
