/* Display official source image pixels only. No 3D scene render or generated fill. */
let clipSequence=0;
export function createOfficialTextureView(p) {
 const NS='http://www.w3.org/2000/svg',el=n=>document.createElementNS(NS,n);
 if(p?.evidenceKind!=='official_model_appearance_texture'||!p.imageUrl||!p.atlasUVTriangles?.length)throw Error('Verified official texture descriptor required');
 const [W,H]=p.atlasSize,[x0,y0,x1,y1]=p.atlasCropXYXY,w=x1-x0,h=y1-y0,rot=p.atlasRotationCCW??0,swap=rot===90||rot===270;
 const svg=el('svg');svg.setAttribute('viewBox',`0 0 ${swap?h:w} ${swap?w:h}`);svg.setAttribute('width',String(swap?h:w));svg.setAttribute('height',String(swap?w:h));svg.setAttribute('role','img');svg.setAttribute('aria-label',p.label);svg.classList.add('official-texture-image');svg.style.cssText='display:block;width:100%;height:auto;max-height:430px;background:#e4e9ef;';svg.dataset.sourcePatchId=p.sourcePatchId;svg.dataset.texturedModelId=p.texturedModelId;
 const title=el('title');title.textContent=p.label;svg.append(title);
 const defs=el('defs'),clip=el('clipPath'),id='official-texture-clip-'+(++clipSequence);clip.id=id;clip.setAttribute('clipPathUnits','userSpaceOnUse');
 for(const triangle of p.atlasUVTriangles){const poly=el('polygon');poly.setAttribute('points',triangle.map(([u,v])=>`${u*W-x0},${v*H-y0}`).join(' '));clip.append(poly);}defs.append(clip);svg.append(defs);
 const orientation=el('g');if(rot===90)orientation.setAttribute('transform',`translate(0 ${w}) rotate(-90)`);else if(rot===270)orientation.setAttribute('transform',`translate(${h} 0) rotate(90)`);else if(rot===180)orientation.setAttribute('transform',`translate(${w} ${h}) rotate(180)`);
 const masked=el('g');masked.setAttribute('clip-path',`url(#${id})`);const img=el('image');img.setAttribute('href',p.imageUrl);img.setAttribute('x',String(-x0));img.setAttribute('y',String(-y0));img.setAttribute('width',String(W));img.setAttribute('height',String(H));img.setAttribute('preserveAspectRatio','none');img.addEventListener('error',()=>{svg.replaceWith(Object.assign(document.createElement('div'),{className:'missing',textContent:'官方贴图未能加载；未用其他面替代。'}));});masked.append(img);orientation.append(masked);svg.append(orientation);return svg;
}
