/* Actual analytic paper thumbnails and inspectable mm sewing layout. */
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const number=x=>Math.round(x*1e5)/1e5;
const xy=p=>p.map(number).join(' ');
export function edgePath(panel,edge){const[a,b]=edge.endpoints.map(i=>panel.verticesMm[i]);let d=`M ${xy(a)}`;
 if(edge.kind==='line')return d+` L ${xy(b)}`;
 if(edge.kind==='quadratic')return d+` Q ${xy(edge.controlPointsMm[0])} ${xy(b)}`;
 if(edge.kind==='cubic')return d+` C ${xy(edge.controlPointsMm[0])} ${xy(edge.controlPointsMm[1])} ${xy(b)}`;
 if(edge.kind==='circle'){const r=number(edge.arc.radiusMm),large=Math.abs(edge.arc.sweepDegrees)>180?1:0,sweep=edge.arc.sweepDegrees>0?1:0;return d+` A ${r} ${r} 0 ${large} ${sweep} ${xy(b)}`;}
 throw Error('Unsupported analytic edge '+edge.kind);
}
export function layoutPaper(input,{rowWidthMm=1400,gapMm=45}={}){let x=gapMm,y=gapMm,rowHeight=0,width=0;const rows=[];for(const panel of input.panels){const pts=panel.edges.flatMap(e=>e.sampledPointsMm||e.endpoints.map(i=>panel.verticesMm[i])),xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),w=maxX-minX,h=maxY-minY;if(x>gapMm&&x+w>rowWidthMm){x=gapMm;y+=rowHeight+gapMm;rowHeight=0;}rows.push({panel,x:x-minX,y:y+maxY,width:w,height:h,bounds:{minX,maxX,minY,maxY}});x+=w+gapMm;rowHeight=Math.max(rowHeight,h+20);width=Math.max(width,x);}return{rows,width,height:y+rowHeight+gapMm};}
export function paperSVG(input,{thumbnail=false,selectedSeamId=null}={}){
 const layout=layoutPaper(input),palette=['#d5b48b','#96b8c2','#b4c59b','#bf9fb8','#c6c0a0','#91b6ab'],selected=input.seams.find(s=>s.id===selectedSeamId);let content='';
 layout.rows.forEach(({panel,x,y,bounds},i)=>{const full=panel.edges.map((e,i)=>i?edgePath(panel,e).replace(/^M [-\d.e+]+ [-\d.e+]+ /,''):edgePath(panel,e)).join(' ')+' Z';content+=`<g data-panel="${esc(panel.id)}" transform="translate(${number(x)} ${number(y)}) scale(1 -1)"><path d="${full}" fill="${palette[i%palette.length]}" stroke="#dae4e7" stroke-width="${thumbnail?2:1}"/>`;
 if(!thumbnail){for(const edge of panel.edges){const end=selected&&[selected.a,selected.b].find(e=>e.panelId===panel.id&&e.edge===edge.index);if(end)content+=`<path d="${edgePath(panel,edge)}" fill="none" stroke="#f5dd84" stroke-width="5"/>`;}}
 content+='</g>';if(!thumbnail)content+=`<text x="${number(x+bounds.minX)}" y="${number(y-bounds.minY+16)}" fill="#edf2ef" font-size="11">${esc(panel.id)}</text>`;
 });
 return`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${number(layout.width)} ${number(layout.height)}" width="${number(layout.width)}mm" height="${number(layout.height)}mm" role="img" aria-label="${thumbnail?'实际二维纸样缩略图':'原始毫米纸样与缝边'}"><rect width="100%" height="100%" fill="#18252d"/>${content}</svg>`;
}
