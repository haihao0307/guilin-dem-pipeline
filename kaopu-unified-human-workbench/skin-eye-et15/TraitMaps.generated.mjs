import * as THREE from '../full/source/registration-vendor/three.module.js';
import {seededRandom} from '../identity-lab/Catalogue.mjs';
import {FIELD_WIDTH as W,FIELD_HEIGHT as H,FIELD_RECT,fieldCanvas,fieldBlob as blob,fieldCurve as curve,wrinklePath,hashField} from '../identity-lab/FieldRaster.mjs';
// Appearance authoring, not diagnosis. Height channels affect shading, not
// mesh silhouette or shadow depth. Coordinates are fixed neutral-head mm.
const valid=(x,y)=>![-31,31].some(a=>((x-a)/17)**2+((y-301)/7.5)**2<1)&&!(Math.abs(x)<26&&y>216&&y<247)&&!(Math.abs(x)<20&&y>247&&y<260);
export function paintTraitMaps(s){
 const start=performance.now(),layers=Array.from({length:7},fieldCanvas),[pigment,red,white,rise,depth,rough,heads]=layers,r=seededRandom(s.seed),marks={freckles:[],acne:[],scar:[],scarPaths:[],moles:[],capillaryPaths:[],wrinklePaths:[]};
 if(s.enabled){
  const count=Math.round(s.freckles*1050);let accepted=0;
  for(let attempt=0;attempt<25000&&accepted<count;attempt++){
   const x=(r()*2-1)*61,y=251+r()*75,coverage=Math.exp(-Math.pow((y-287)/18,2))*Math.exp(-Math.pow(Math.abs(x)/(24+38*s.freckleSpread),4));
   const cluster=.08+.92*Math.pow(.5+.5*Math.sin(x*.19+y*.071+s.seed%29)*Math.sin(y*.22-x*.041),2);if(r()>coverage*(1-s.freckleClustering+s.freckleClustering*cluster)||!valid(x,y))continue;const size=s.freckleSize*(.4+.9*r()),op=s.freckleContrast*(.25+.6*r());blob(pigment,x,y,size,size*(.55+.55*r()),op,r()*6.28,s.freckleEdge);marks.freckles.push([x,y,size]);accepted++;
  }
  const rc=seededRandom(s.seed^91837);
  function spot(){let x=0,y=350;for(let j=0;j<100;j++){x=(rc()*2-1)*56;y=211+rc()*162;if(valid(x,y)&&((y>328&&Math.abs(x)<43)||(y<290&&Math.abs(x)>22)||(y<215&&Math.abs(x)<30))&&(!s.acneDistribution||rc()<((s.acneDistribution>0?y<300:y>325)?1:1-Math.abs(s.acneDistribution)*.9)))break;}return[x,y];}
  for(let i=0;i<64;i++){
   const [x,y]=spot(),size=s.acneSize*(.65+.6*rc()),whitehead=rc(),height=.65+.35*rc(),redness=.3+.3*rc();
   if(i<Math.round(s.acne*64)){blob(red,x,y,size*2.2,size*1.9,s.acneRedness*redness*(1-s.acneStage*.72));blob(rise,x,y,size,size,s.acneRelief*height*(1-s.acneStage*.94),0,0);blob(pigment,x,y,size*1.2,size,s.acneStage*.17);if(whitehead<s.acneWhiteheads*(1-s.acneStage))blob(heads,x,y,size*.34,size*.28,.50,0,.05);marks.acne.push([x,y,size]);}
   if(i>=32&&i<32+Math.round(s.acneMarks*32)){blob(pigment,x,y,size*1.2,size,.28);blob(red,x,y,size*1.7,size*1.5,.20);}
   if(i>=10&&i<10+Math.round(s.pittedScars*36)){blob(depth,x,y,size*.7,size*.62,.20,0,0);blob(rough,x,y,size,size,.4);}
  }
  const rs=seededRandom(s.seed^78561);for(let i=0;i<Math.round(s.ageSpots*44);i++){const x=(rs()*2-1)*60,y=253+rs()*122;if(!valid(x,y))continue;const size=s.ageSpotSize*(.4+rs()*.7);blob(pigment,x,y,size,size*(.45+.6*rs()),.28+rs()*.27,rs()*6.28,.35);}
  for(const side of[-1,1]){blob(pigment,side*32,289,15,4.5,s.darkCircles*.5);blob(red,side*42,273,15,11,s.redPatches*.35);}
  const rw=seededRandom(s.seed^234879);
  function wrinkle(p,width,amount){if(!amount)return;curve(depth,p,width,s.wrinkleDepth*amount);curve(pigment,p,width*.7,.10*amount);curve(rough,p,width*1.2,.25*amount);marks.wrinklePaths.push(p);}
  for(let i=0;i<4;i++){const length=[39,44,37,29][i],y=337+i*8.5;wrinkle(wrinklePath(-length,y,length*(.86+i*.025),y+1.8,1.8+i*.35,rw,s.wrinkleIrregularity),s.wrinkleWidth*(.7+.35*rw()),s.forehead*(1-i*.12));}
  for(let i=0;i<2;i++)wrinkle(wrinklePath(-5+i*9,314.5+i,-7+i*13,332-i*1.5,.8,rw,s.wrinkleIrregularity),s.wrinkleWidth*.8,s.frown*(i===1?.82:1));
  for(const side of[-1,1]){
   for(let j=0;j<4;j++)wrinkle(wrinklePath(side*47,298+j*.6,side*(60+j*.8),293+j*4,-1.2,rw,s.wrinkleIrregularity),s.wrinkleWidth*.55,s.crowsFeet*(1-j*.12));
   for(let j=0;j<3;j++)wrinkle(wrinklePath(side*19,292-j*2.6,side*45,291-j*2.4,-2.2,rw,s.wrinkleIrregularity),s.wrinkleWidth*.40,s.underEye*(.9-j*.22));
   const pts=[];for(let j=0;j<=30;j++){const t=j/30;pts.push([side*(19+14*t+2*Math.sin(t*3.14)),255-30*t+Math.sin(t*11)*.2*s.wrinkleIrregularity]);}wrinkle(pts,s.wrinkleWidth*1.7,s.nasolabial);
   for(let j=0;j<5;j++){const x=side*(3+j*4);wrinkle(wrinklePath(x,241,x+side,247,0,rw,s.wrinkleIrregularity),s.wrinkleWidth*.40,s.lipLines*.5);wrinkle(wrinklePath(x,217,x+side*.3,224,0,rw,s.wrinkleIrregularity),s.wrinkleWidth*.37,s.lipLines*.55);}
  }
  if(s.scar){const a=s.scarAngle*Math.PI/180,pts=[];for(let i=0;i<=42;i++){const t=i/42-.5,d=t*s.scarLength,v=(Math.sin(t*17+1.2)*.65+Math.sin(t*43)*.25)*s.scarJagged;pts.push([s.scarX+Math.cos(a)*d-Math.sin(a)*v,s.scarY+Math.sin(a)*d+Math.cos(a)*v]);}curve(s.scarRelief>=0?rise:depth,pts,s.scarWidth,Math.abs(s.scarRelief)*s.scar);curve(red,pts,s.scarWidth*1.7,s.scar*(1-s.scarAge)*.6);curve(white,pts,s.scarWidth,s.scar*s.scarAge*.55);curve(rough,pts,s.scarWidth*1.7,s.scar*.8);marks.scar=pts;marks.scarPaths.push(pts);
   const sr=seededRandom(s.seed^345627);for(let n=1;n<s.scarCount;n++){const angle=s.scarAngle*Math.PI/180+(sr()-.5)*s.scarVariation,shift=(n%2?1:-1)*Math.ceil(n/2)*s.scarSpacing,cx=Math.max(-55,Math.min(55,s.scarX+shift*.48)),cy=Math.max(205,Math.min(377,s.scarY+shift));if(!valid(cx,cy))continue;const length=s.scarLength*(1+(sr()-.5)*s.scarVariation),width=s.scarWidth*(1+(sr()-.5)*s.scarVariation*.6),points=[];for(let j=0;j<=42;j++){const t=j/42-.5,d=t*length,v=Math.sin(t*19+n)*s.scarJagged*.7;points.push([cx+Math.cos(angle)*d-Math.sin(angle)*v,cy+Math.sin(angle)*d+Math.cos(angle)*v]);}curve(s.scarRelief>=0?rise:depth,points,width,Math.abs(s.scarRelief)*s.scar);curve(red,points,width*1.7,s.scar*(1-s.scarAge)*.6);curve(white,points,width,s.scar*s.scarAge*.55);curve(rough,points,width*1.7,s.scar*.8);marks.scarPaths.push(points);}
  }
  if(s.moles){const mr=seededRandom(s.seed^985751);for(let j=0;j<s.moleCount;j++){let x=s.moleX,y=s.moleY,size=s.moleSize;if(j){for(let k=0;k<60;k++){x=(mr()*2-1)*53;y=254+mr()*110;if(valid(x,y))break;}size*=.60+mr()*.55;}blob(pigment,x,y,size,size*.85,s.moles,0,.65);blob(rise,x,y,size*.9,size*.8,s.moles*s.moleRelief,0,.2);marks.moles.push([x,y,size]);}}
  if(s.capillaries){const cr=seededRandom(s.seed^818763);for(const side of [-1,1])for(let n=0;n<6;n++){const x=side*(27+cr()*20),y=266+cr()*15,pts=[];for(let j=0;j<=16;j++){const t=j/16;pts.push([x+side*t*(3+cr()),y-t*6+Math.sin(t*8+n)*.5]);}curve(red,pts,.13,s.capillaries*.34);const q=pts[8],branch=[q,[q[0]-side*1.6,q[1]-1.4],[q[0]-side*2.2,q[1]-2.9]];curve(red,branch,.10,s.capillaries*.24);marks.capillaryPaths.push(pts,branch);}}
 }
 const data=layers.map(c=>c.getImageData(0,0,W,H).data),color=new Uint8Array(W*H*4),height=new Uint8Array(color.length);let nonzero=0;
 for(let k=0;k<color.length;k+=4){color[k]=data[0][k];color[k+1]=data[1][k];color[k+2]=data[2][k];color[k+3]=data[6][k];height[k]=data[3][k];height[k+1]=data[4][k];height[k+2]=data[5][k];height[k+3]=255;if(color[k]||color[k+1]||color[k+2]||height[k]||height[k+1])nonzero++;}
 function texture(a){const t=new THREE.DataTexture(a,W,H,THREE.RGBAFormat);t.colorSpace=THREE.NoColorSpace;t.flipY=false;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.generateMipmaps=true;t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;t.needsUpdate=true;return t;}
 const result={color:texture(color),height:texture(height),report:{seed:s.seed,width:W,height:H,rectMM:FIELD_RECT,colorHash:hashField(color),heightHash:hashField(height),nonzeroPixels:nonzero,freckleCount:marks.freckles.length,acneCount:marks.acne.length,wrinkleCurves:marks.wrinklePaths.length,scarPoints:marks.scar.length,scarCount:marks.scarPaths.length,moleCount:marks.moles.length,capillaryCurves:marks.capillaryPaths.length,buildMS:performance.now()-start,kind:'authored pigment/redness/signed-height fields',relief:'normal perturbation, not silhouette displacement'},marks};result.dispose=()=>{result.color.dispose();result.height.dispose();};return result;
}
