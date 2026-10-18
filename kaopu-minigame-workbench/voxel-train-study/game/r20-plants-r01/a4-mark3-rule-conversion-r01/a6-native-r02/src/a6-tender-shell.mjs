/** A6 closed oil/water tender. First-party native surfaces, independent of R01/R02.
 * x lateral, y rail datum up, z rearward in the locomotive's rest frame.
 * This is an editable exterior design, not a certified reservoir or coupling.
 */
import {A6Mesh,grid,range,unit,sub,mul,cross,dot,boundsOf} from './a6-shell-geometry.mjs';
export const A6_TENDER_DEFAULTS=Object.freeze({
  zStart:12.9,length:7.6,width:2.743,bottom:1.60,crownHeight:4.03,
  sideTop:3.15,lowerCornerRadius:.18,endCapLength:.24,endSectionInset:.075,
  wallThickness:.045,goldLineY:1.96,goldLineHeight:.018,
  longitudinalSegments:48,roofSegments:64,sideSegments:20,cornerSegments:16,endCapSegments:16,
  includeInnerShell:true,includeGoldLine:true,includeServicePanels:true
});
export const A6_TENDER_EVIDENCE=Object.freeze({
  checkedOn:'2026-10-17',provenance:'First-party analytic rounded-section sweep and compact quarter-ellipse end return; no teacher geometry or residuals.',
  referenceUse:['A6-REF-10: continuous skin','A6-REF-19/20: green family and compact separated interfaces','A6-EXTRA-R08: closed streamlined tender; no coal','A6-EXTRA-BLUE: independent mechanically retained underbody'],
  frozenAxlesZ:[13.681075,15.281275,16.957675,18.557875],
  mechanicalTopBearingY:1.565,minimumDesignShellBottom:1.60,
  locomotiveInterfaceZ:12.17295,
  dimensionStatus:'A6 silhouette is provisional designed metres, not reservoir volume or whole-vehicle engineering certification.'
});
function parameters(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Expected A6 tender parameters');
  const p={...A6_TENDER_DEFAULTS,...input};
  for(const [key,value]of Object.entries(p)){
    if(!(key in A6_TENDER_DEFAULTS))throw new RangeError(`Unknown A6 tender parameter: ${key}`);
    if(typeof A6_TENDER_DEFAULTS[key]==='boolean'){if(typeof value!=='boolean')throw new TypeError(`${key} must be boolean`);}
    else if(typeof value!=='number'||!Number.isFinite(value))throw new TypeError(`${key} must be finite`);
  }
  if(p.bottom<1.60||p.bottom>1.90)throw new RangeError('Tender bottom must clear the frozen 1.565 m top bearing by at least 35 mm');
  if(p.width<2.4||p.width>3.0||p.length<6.8||p.length>8.0||p.zStart<12.7||p.zStart>13.1)throw new RangeError('Unsupported tender envelope');
  if(p.zStart+p.length<19.35)throw new RangeError('Tender body cannot truncate the fixed four-axle layout');
  if(p.crownHeight<3.8||p.crownHeight>4.25||p.sideTop<3.02||p.sideTop>=p.crownHeight-.45)throw new RangeError('Unsupported A6 tender crown');
  if(p.lowerCornerRadius<.09||p.lowerCornerRadius>.30||p.sideTop<=p.bottom+2*p.lowerCornerRadius)throw new RangeError('Unsupported lower corner');
  if(p.endCapLength<.12||p.endCapLength>.40||p.endSectionInset<.025||p.endSectionInset>.14)throw new RangeError('Unsupported compact end cap');
  if(p.wallThickness<.01||p.wallThickness>.075||p.wallThickness>=p.lowerCornerRadius/2)throw new RangeError('Unsupported shell thickness');
  if(p.goldLineY<=p.bottom+p.lowerCornerRadius+.025||p.goldLineY>=p.sideTop-.10||p.goldLineHeight<.005||p.goldLineHeight>.035)throw new RangeError('Gold line outside flat side domain');
  for(const key of ['longitudinalSegments','roofSegments','sideSegments','cornerSegments','endCapSegments'])if(!Number.isInteger(p[key])||p[key]<8||p[key]>128)throw new RangeError(`Invalid ${key}`);
  return p;
}
/** Counter-clockwise section in x/y, with analytic outward normals and tangents.
 * Side/roof junction has exactly matching [±1,0,0] normals; no ornamental tubes.
 */
function section(p,depth=0){
  const h=p.width/2-depth,b=p.bottom+depth,r=p.lowerCornerRadius-depth,top=p.crownHeight-depth,shoulder=p.sideTop;
  const bottomHalf=h-r;
  return [
    {name:'bottom',count:24,eval:t=>({point:[-bottomHalf+2*bottomHalf*t,b,0],tangent:[2*bottomHalf,0,0],normal:[0,-1,0]})},
    {name:'right-lower-curve',count:p.cornerSegments,eval:t=>{const a=-Math.PI/2+t*Math.PI/2;return {point:[h-r+r*Math.cos(a),b+r+r*Math.sin(a),0],tangent:[-r*Math.sin(a)*Math.PI/2,r*Math.cos(a)*Math.PI/2,0],normal:[Math.cos(a),Math.sin(a),0]};}},
    {name:'right-side',count:p.sideSegments,eval:t=>({point:[h,b+r+(shoulder-b-r)*t,0],tangent:[0,shoulder-b-r,0],normal:[1,0,0]})},
    {name:'roof',count:p.roofSegments,eval:t=>{const a=t*Math.PI;return {point:[h*Math.cos(a),shoulder+(top-shoulder)*Math.sin(a),0],tangent:[-h*Math.sin(a)*Math.PI,(top-shoulder)*Math.cos(a)*Math.PI,0],normal:unit([Math.cos(a)/h,Math.sin(a)/(top-shoulder),0])};}},
    {name:'left-side',count:p.sideSegments,eval:t=>({point:[-h,shoulder-(shoulder-b-r)*t,0],tangent:[0,-(shoulder-b-r),0],normal:[-1,0,0]})},
    {name:'left-lower-curve',count:p.cornerSegments,eval:t=>{const a=Math.PI+t*Math.PI/2;return {point:[-h+r+r*Math.cos(a),b+r+r*Math.sin(a),0],tangent:[-r*Math.sin(a)*Math.PI/2,r*Math.cos(a)*Math.PI/2,0],normal:[Math.cos(a),Math.sin(a),0]};}}
  ];
}
function body(p,depth=0,inward=false){
  const mesh=new A6Mesh(inward?'tender-inner-closed-lining':'tender-continuous-closed-skin',inward?'interior':'paint',inward?'lining':'shell',{
    containsCoal:false,closedRoof:true,closedBottom:true,sourceGeometryUsed:false,
    section:'rounded lower corners, vertical sides and one continuous elliptical roof/shoulder',
    continuousRoofShoulderNormals:true,thicknessMeaning:'section design inset; not certified plate gauge'
  });
  const start=p.zStart+p.endCapLength,end=p.zStart+p.length-p.endCapLength;
  for(const segment of section(p,depth))grid(mesh,(t,z)=>{const s=segment.eval(t);return {point:[s.point[0],s.point[1],z],normal:mul(s.normal,inward?-1:1),uv:[z-p.zStart,t]};},range(0,1,segment.count),range(start,end,p.longitudinalSegments));
  return mesh.finish();
}
function cap(p,sign,depth=0,inward=false){
  const start=sign<0?p.zStart+p.endCapLength:p.zStart+p.length-p.endCapLength;
  const pivotY=(p.bottom+p.crownHeight)/2,capLength=p.endCapLength-depth;
  const shrink=p.endSectionInset/(p.width/2);
  const mesh=new A6Mesh(`tender-${sign<0?'front':'rear'}-${inward?'inner-':'smooth-'}end-cap`,inward?'interior':'paint',inward?'lining':'end-cap',{
    continuousWithBody:true,quarterEllipseReturn:true,containsCoal:false,
    endCapLength:p.endCapLength,structuralCoupling:false,provisionalInterface:true
  });
  const sec=section(p,depth);
  function map(segment,t,a){
    const s=segment.eval(t),scale=1-shrink*(1-Math.cos(a)),ds=-shrink*Math.sin(a),r=[s.point[0],s.point[1]-pivotY,0];
    const tangent=mul(s.tangent,scale),along=[r[0]*ds,r[1]*ds,sign*capLength*Math.cos(a)],n=mul(unit(cross(tangent,along)),sign*(inward?-1:1));
    return {point:[r[0]*scale,pivotY+r[1]*scale,start+sign*capLength*Math.sin(a)],normal:n,uv:[t,a*p.endCapLength]};
  }
  for(const segment of sec)grid(mesh,(t,a)=>map(segment,t,a),range(0,1,segment.count),range(0,Math.PI/2,p.endCapSegments));
  // End plane is actually closed. The previous A4 tender's open coal/rim is not reused.
  const face=new A6Mesh(`tender-${sign<0?'front':'rear'}-${inward?'inner-':''}closed-face`,inward?'interior':'paint',inward?'lining':'closed-end-face',{closed:true,containsCoal:false,mechanicalAreaBelowBottomOpen:true});
  const faceZ=start+sign*capLength,n=[0,0,sign*(inward?-1:1)],center=[0,pivotY,faceZ];
  for(const segment of sec)for(let i=0;i<segment.count;i++){
    const a=map(segment,i/segment.count,Math.PI/2).point,b=map(segment,(i+1)/segment.count,Math.PI/2).point;
    face.triangle([center,a,b],[n,n,n],[[0,pivotY],[a[0],a[1]],[b[0],b[1]]]);
  }
  return [mesh.finish(),face.finish()];
}
function goldLines(p){
  const parts=[],start=p.zStart+p.endCapLength,end=p.zStart+p.length-p.endCapLength,pivotY=(p.bottom+p.crownHeight)/2,shrink=p.endSectionInset/(p.width/2);
  for(const sign of [-1,1]){
    const mesh=new A6Mesh(`tender-flush-gold-line-${sign}`,'trim-brass','flush-inlay',{lineCentreY:p.goldLineY,raisedBy:.0015,noTubeGeometry:true});
    grid(mesh,(z,y)=>({point:[sign*(p.width/2+.0015),y,z],normal:[sign,0,0],uv:[z-p.zStart,y]}),range(start,end,48),[p.goldLineY-p.goldLineHeight/2,p.goldLineY+p.goldLineHeight/2]);
    for(const endSign of [-1,1]){
      const z=endSign<0?start:end;
      grid(mesh,(a,y)=>{const scale=1-shrink*(1-Math.cos(a)),ds=-shrink*Math.sin(a),x=sign*(p.width/2+.0015),ry=y-pivotY;
        const n=unit([sign*p.endCapLength*Math.cos(a),0,-endSign*Math.abs(x)*ds]);
        return {point:[x*scale,pivotY+ry*scale,z+endSign*p.endCapLength*Math.sin(a)],normal:n,uv:[a*p.endCapLength,y]};
      },range(0,Math.PI/2,p.endCapSegments),[p.goldLineY-p.goldLineHeight/2,p.goldLineY+p.goldLineHeight/2]);
    }
    parts.push(mesh.finish());
  }
  return parts;
}
function servicePanels(p){
  const parts=[],width=.86,height=.48,r=.065,centres=[p.zStart+p.length*.165,p.zStart+p.length*.345];
  const outline=(d=0)=>{const w=width+2*d,h=height+2*d,rad=r+d,out=[];for(let k=0;k<4;k++){const c=[[w/2-rad,h/2-rad],[-w/2+rad,h/2-rad],[-w/2+rad,-h/2+rad],[w/2-rad,-h/2+rad]][k];for(let i=0;i<8;i++){const a=(k+i/8)*Math.PI/2;out.push([c[0]+rad*Math.cos(a),c[1]+rad*Math.sin(a)]);}}return out;};
  for(const side of [-1,1])for(let j=0;j<centres.length;j++){
    const name=`tender-${side}-sealed-${j===0?'oil':'water'}-service-panel`,edge=new A6Mesh(name+'-seal','rubber','service-panel-seal',{sealed:true,independent:true,contents:'visual oil/water concept only'}),panel=new A6Mesh(name,'paint','sealed-service-panel',{sealed:true,independent:true,internalCapacity:'not-engineered'}),a=outline(.009),b=outline(),y=2.70,z=centres[j],n=[side,0,0];
    const point=(q,d)=>[side*(p.width/2+d),y+q[1],z+q[0]];
    for(let i=0;i<a.length;i++){const k=(i+1)%a.length;edge.quad([{point:point(a[i],.0017),normal:n,uv:a[i]},{point:point(a[k],.0017),normal:n,uv:a[k]},{point:point(b[k],.0017),normal:n,uv:b[k]},{point:point(b[i],.0017),normal:n,uv:b[i]}]);panel.triangle([[side*(p.width/2+.002),y,z],point(b[i],.002),point(b[k],.002)],[n,n,n],[[0,0],b[i],b[k]]);}
    parts.push(edge.finish(),panel.finish());
  }
  return parts;
}
export function buildA6TenderShell(input={}){
  const p=parameters(input),parts=[body(p),...cap(p,-1),...cap(p,1)];
  if(p.includeInnerShell)parts.push(body(p,p.wallThickness,true),...cap(p,-1,p.wallThickness,true),...cap(p,1,p.wallThickness,true));
  if(p.includeGoldLine)parts.push(...goldLines(p));
  if(p.includeServicePanels)parts.push(...servicePanels(p));
  return {schema:'kaopu.a6-native-closed-tender-shell/1.0',generator:'native-closed-section-analytic-endcap-r01',parts,parameters:p,bounds:boundsOf(parts),openings:[],evidence:A6_TENDER_EVIDENCE,
    interfaces:{coordinateSystem:{x:'lateral',y:'rail datum up',z:'rearward from first leading axle',unit:'design m'},frontZ:p.zStart,rearZ:p.zStart+p.length,locomotiveRearMechanicalZ:12.17295,frontStaticSeparation:p.zStart-12.17295,bottomY:p.bottom,topBearingY:1.565,minimumVerticalBearingMargin:p.bottom-1.565,commonCrownY:p.crownHeight,commonGoldLineY:p.goldLineY,axleCentresZ:[...A6_TENDER_EVIDENCE.frozenAxlesZ],mechanicalPartsGenerated:0,connectionStatus:'Small independent end caps; offsets/gaps provisional, no rigid inter-car bridge and no coupler geometry changed'},
    completion:{closedOilWaterBody:true,coal:false,chassis:'existing-frozen-mechanics-external',physics:'not-engineered',visualApproval:'pending'}};
}
export function sampleA6TenderSection(input={},depth=0){const p=parameters(input);return section(p,depth).flatMap(s=>range(0,1,s.count).slice(0,-1).map(t=>s.eval(t)));}

/** Surface registration for independent emblems/labels; no stored point arrays.
 * Returns the analytic positive x coordinate at an outer-body (y,z) location.
 */
export function sampleTenderHalfWidth(y,z,input={}){
  const p=parameters(input);
  if(!Number.isFinite(y)||!Number.isFinite(z)||z<p.zStart-1e-9||z>p.zStart+p.length+1e-9)throw new RangeError('Tender surface sample leaves body domain');
  const pivot=(p.bottom+p.crownHeight)/2,front=p.zStart+p.endCapLength,rear=p.zStart+p.length-p.endCapLength;
  const endDistance=z<front?front-z:z>rear?z-rear:0;
  const scale=1-p.endSectionInset/(p.width/2)*(1-Math.sqrt(Math.max(0,1-(endDistance/p.endCapLength)**2)));
  const sectionY=pivot+(y-pivot)/scale,h=p.width/2,r=p.lowerCornerRadius;
  if(sectionY<p.bottom-1e-8||sectionY>p.crownHeight+1e-8)throw new RangeError('Tender surface y leaves rounded section');
  const halfWidth=sectionY<p.bottom+r?h-r+Math.sqrt(Math.max(0,r*r-(sectionY-p.bottom-r)**2)):
    sectionY<=p.sideTop?h:h*Math.sqrt(Math.max(0,1-((sectionY-p.sideTop)/(p.crownHeight-p.sideTop))**2));
  return halfWidth*scale;
}
export function sampleA6TenderSideSurface(y,z,side=1,input={}){
  if(side!==-1&&side!==1)throw new RangeError('side must be -1 or 1');
  const p=parameters(input),h=1e-5,x=sampleTenderHalfWidth(y,z,p),y0=Math.max(p.bottom+1e-6,y-h),y1=Math.min(p.crownHeight-1e-6,y+h),z0=Math.max(p.zStart+1e-6,z-h),z1=Math.min(p.zStart+p.length-1e-6,z+h);
  const dy=(sampleTenderHalfWidth(y1,z,p)-sampleTenderHalfWidth(y0,z,p))/(y1-y0),dz=(sampleTenderHalfWidth(y,z1,p)-sampleTenderHalfWidth(y,z0,p))/(z1-z0);
  return {point:[side*x,y,z],normal:unit([side,-dy,-dz]),status:'analytic-position; finite-difference-normal; caller owns emblem offset'};
}
