// Render the exact analytic material curves. This is a sheet layout, not cloth nesting.
const n=x=>Number(x.toFixed(6));
const point=p=>p.map(n).join(' ');
export const escapeXML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function edgePath(panel,edge,move=true){
  const [a,b]=edge.endpoints.map(i=>panel.verticesMm[i]);
  const prefix=move?`M ${point(a)} `:'';
  if(edge.kind==='line')return `${prefix}L ${point(b)}`;
  if(edge.kind==='quadratic')return `${prefix}Q ${point(edge.controlPointsMm[0])} ${point(b)}`;
  if(edge.kind==='cubic')return `${prefix}C ${edge.controlPointsMm.map(point).join(' ')} ${point(b)}`;
  if(edge.kind==='circle'){
    const a=edge.arc;
    return `${prefix}A ${n(a.radiusMm)} ${n(a.radiusMm)} 0 ${Math.abs(a.sweepDegrees)>180?1:0} ${a.sweepDegrees>0?1:0} ${point(b)}`;
  }
  throw Error(`Unsupported analytic curve ${edge.kind}`);
}
export function panelBounds(panel){
  // Bezier control hull and full circle bounds conservatively include every curve point.
  const pts=[...panel.verticesMm];
  for(const e of panel.edges){
    if(e.controlPointsMm)pts.push(...e.controlPointsMm);
    if(e.arc){
      const [x,y]=e.arc.centerMm,r=e.arc.radiusMm,start=e.arc.startAngleDegrees*Math.PI/180,end=start+e.arc.sweepDegrees*Math.PI/180;
      for(let k=Math.ceil(Math.min(start,end)/(Math.PI/2));k<=Math.floor(Math.max(start,end)/(Math.PI/2));k++){
        const angle=k*Math.PI/2;pts.push([x+r*Math.cos(angle),y+r*Math.sin(angle)]);
      }
    }
  }
  const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
  return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};
}
export function layoutPanels(panels){
  const margin=28,gap=36,label=26;
  const boxes=panels.map(p=>({panel:p,box:panelBounds(p)}));
  const area=boxes.reduce((s,{box:b})=>s+(b.w+gap)*(b.h+gap+label),0);
  const width=Math.max(900,...boxes.map(x=>x.box.w+2*margin),Math.sqrt(area)*1.4);
  let x=margin,y=margin,row=0;
  for(const item of boxes){
    const {box:b}=item;
    if(x+b.w>width-margin&&x>margin){x=margin;y+=row+gap;row=0;}
    item.x=x;item.y=y;item.labelY=y+b.h+18;x+=b.w+gap;row=Math.max(row,b.h+label);
  }
  return {width,height:y+row+margin,items:boxes};
}
const palette=['#d5e8e2','#e7dfc8','#d9e0f2','#e8d9e5','#d6e6ef','#e8ddcf'];
export function renderPaper(ticket,{thumbnail=false,seams=true,grain=false,labels=true}={}){
  const {pattern}=ticket,layout=layoutPanels(pattern.panels),edgeSeams=new Map();
  for(const seam of pattern.seams)for(const side of ['a','b'])edgeSeams.set(`${seam[side].panelId}:${seam[side].edge}`,seam.id);
  const paths=layout.items.map(({panel:p,box:b,x,y,labelY},i)=>{
    const transform=`translate(${n(x-b.x)} ${n(y+b.y+b.h)}) scale(1 -1)`;
    const outline=p.edges.map((e,k)=>edgePath(p,e,k===0)).join(' ')+' Z';
    const boundaries=seams&&!thumbnail?p.edges.map(e=>{
      const sid=edgeSeams.get(`${p.id}:${e.index}`);
      return `<path class="paper-edge ${sid?'sewn':'free'}" data-panel="${escapeXML(p.id)}" data-edge="${e.index}" ${sid?`data-seam="${escapeXML(sid)}"`:''} d="${edgePath(p,e)}" fill="none" stroke="${sid?'#4c7770':'#bd8257'}" stroke-width="${sid?1.05:1.4}" vector-effect="non-scaling-stroke"><title>${escapeXML(p.id)} · e${e.index} · ${e.lengthMm.toFixed(2)} mm${sid?' · '+sid:' · 原始自由边'}</title></path>`;
    }).join(''):'';
    const gx=b.x+b.w/2,gy=b.y+b.h/2,gl=Math.min(80,b.h*.3);
    const grainMark=grain&&!thumbnail?`<path d="M ${n(gx)} ${n(gy-gl/2)} L ${n(gx)} ${n(gy+gl/2)} l -5 -9 m 5 9 l 5 -9" fill="none" stroke="#6b7c77" stroke-width="1" vector-effect="non-scaling-stroke"/>`:'';
    return `<g><g transform="${transform}"><path data-outline="${escapeXML(p.id)}" d="${outline}" fill="${palette[i%palette.length]}" stroke="#31584f" stroke-width="${thumbnail?1.1:1}" vector-effect="non-scaling-stroke"/>${boundaries}${grainMark}</g>${labels&&!thumbnail?`<text x="${n(x)}" y="${n(labelY)}" font-size="11" fill="#4b615a">${i+1}. ${escapeXML(p.id)}</text>`:''}</g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(layout.width)} ${n(layout.height)}" width="${n(layout.width)}mm" height="${n(layout.height)}mm" role="img" aria-label="${escapeXML(ticket.name)}二维裁片"><title>${escapeXML(ticket.name)} · ${ticket.id}</title><desc>毫米净缝线纸样。各片保持原尺寸与曲线；仅作平移排版，不是布幅排料。缝份为零，布纹沿用适配器约定，非生产裁剪单。</desc>${paths}</svg>`;
}
