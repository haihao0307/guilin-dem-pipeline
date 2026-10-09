import{ANCHORS,LIMIT,distance,supply}from'./core.mjs';
export const POINTS={A:[250,580],B:[485,475],C:[620,300],D:[855,195],near1:[255,442],near2:[375,534],engineer:[467,648],yao:[852,263],pump:[150,682]};
export const TARGETS={near1:'near1',near2:'near2',first:'engineer',engineer:'engineer',anchor:'B',basket:'C',cross:'D',pull:'yao',platform:'yao',valve:'pump',widen:'pump'};
const TAU=Math.PI*2;const mix=(a,b,t)=>a+(b-a)*t;
export function along(points,t){const lens=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1])),total=lens.reduce((a,b)=>a+b,0);let d=Math.min(1,Math.max(0,t))*total;for(let i=0;i<lens.length;i++){if(d<=lens[i]||i===lens.length-1){let u=d/lens[i];return[mix(points[i][0],points[i+1][0],u),mix(points[i][1],points[i+1][1],u)]}d-=lens[i]}return points.at(-1);}

export class Scene{
 constructor(canvas){this.c=canvas;this.ctx=canvas.getContext('2d');this.state=null;this.selected=[];this.hover=null;this.map=false;this.drag=null;this.events=[];this.start=performance.now();this.resize();new ResizeObserver(()=>this.resize()).observe(canvas);this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;this.run=this.run.bind(this);requestAnimationFrame(this.run);}
 resize(){const r=this.c.getBoundingClientRect();this.w=r.width;this.h=r.height;const d=Math.min(devicePixelRatio||1,2);this.c.width=Math.round(r.width*d);this.c.height=Math.round(r.height*d);this.d=d;}
 set(s,selected){this.state=s;this.selected=selected;}
 animate(old,s){this.previous=old;this.animStart=performance.now();}
 xy(p){return [p[0]*this.w/1000,p[1]*this.h/800];}
 path(d,fill,stroke,lw=1){const c=this.ctx,p=new Path2D(d);if(fill){c.fillStyle=fill;c.fill(p)}if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke(p)}}
 line(points,color,width=1,dash=[]){let c=this.ctx;c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.lineWidth=width;c.strokeStyle=color;c.setLineDash(dash);c.stroke();c.setLineDash([])}
 circle(x,y,r,fill,stroke){const c=this.ctx;c.beginPath();c.arc(x,y,r,0,TAU);if(fill){c.fillStyle=fill;c.fill()}if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke()}}
 run(t){if(this.state)this.draw(this.reduced?0:(t-this.start)/1000,t);requestAnimationFrame(this.run)}
 draw(t,now){const c=this.ctx,w=this.w,h=this.h,elapsed=this.animStart?Math.min(1,(now-this.animStart)/1350):1,ease=elapsed*elapsed*(3-2*elapsed);c.setTransform(this.d*w/1000,0,0,this.d*h/800,0,0);c.clearRect(0,0,1000,800);let sky=c.createLinearGradient(0,0,900,800);sky.addColorStop(0,'#203b46');sky.addColorStop(.42,'#638380');sky.addColorStop(.75,'#8ca49a');sky.addColorStop(1,'#274b56');c.fillStyle=sky;c.fillRect(0,0,1000,800);
 // Cold dawn light, distant ridges, aerial perspective.
 let glow=c.createRadialGradient(650,160,5,650,160,490);glow.addColorStop(0,'#d6ddba36');glow.addColorStop(1,'#d8e2cb00');c.fillStyle=glow;c.fillRect(0,0,1000,700);
 this.path('M-60 385 Q-15 272 52 292 L114 206 Q144 185 164 210 L207 295 L251 265 Q266 229 295 220 L336 108 Q352 69 380 119 L447 254 L479 245 L507 205 L550 256 L578 201 Q600 145 633 188 L708 295 L762 268 L800 320 L876 232 L915 297 L1030 231 L1030 700 L-60 700Z','#597579');
 this.path('M0 480 L40 396 L75 377 L124 313 L163 368 L190 383 L234 338 L277 400 L320 379 L356 299 L383 340 L437 359 L470 456 L521 396 L555 413 L587 334 L610 390 L649 366 L685 429 L742 363 L791 420 L864 348 L935 402 L1000 340 L1000 800 L0 800Z','#3e6369');
 this.path('M346 125 L368 145 L384 198 L393 222 L370 212 L358 223 L342 204 L319 237Z','#a3b3a350');this.path('M604 183 L624 211 L640 247 L612 233 L600 254 L590 218Z','#b8c5b13b');
 // Forest silhouettes staggered at the far edge.
 for(let i=0;i<72;i++){const x=i*15,y=410+Math.sin(i*.67)*40,z=15+Math.sin(i*3)*9;this.tree(x,y,z,'#264d575c')}
 // Canyon far wall; long mineral seams are hand-authored, not voxel blocks.
 this.path('M526 423 Q557 409 562 367 L598 304 Q617 293 654 286 L701 244 L740 242 L781 190 Q810 177 851 185 L891 167 L947 167 Q963 154 1008 150 L1030 830 L537 830 Q578 699 561 601Z','#314f53');
 this.path('M610 327 L651 310 L697 265 L741 267 L787 216 L861 208 L909 190 L1000 174 L1000 311 L942 325 L909 359 L856 349 L793 381 L744 368 L701 411 L643 399 L612 462Z','#566e68');
 this.path('M733 273 L770 235 L799 233 L799 348 L780 382 L784 475 L750 516 L734 690 L714 761 L699 662 L726 548 L711 476Z','#223e43');
 this.path('M892 206 L945 184 L962 215 L946 278 L951 395 L927 455 L936 562 L909 641 L909 793 L857 800 L873 682 L863 590 L894 438 L880 340Z','#233f45');
 this.path('M611 328 Q634 319 648 318 L697 269 L741 269 L788 216 L859 211 L910 192 L1000 175 L1000 184 L911 204 L859 224 L787 229 L742 280 L700 283 L650 332 L615 342Z','#a6aa8891');
 for(let i=0;i<33;i++){let x=580+(i*71)%440,y=350+(i*103)%460;this.path(`M${x} ${y} l${18+(i%4)*7} -7 l-9 28 l12 37` ,null,'#93a39413',2)}
 // River, drifting fog and depth cues.
 this.path('M542 425 Q620 474 609 541 Q589 631 519 679 Q464 725 500 800 L335 830 Q331 751 433 683 Q498 646 509 568 Q495 501 542 425Z','#508581');
 this.path('M552 454 Q596 511 557 577 Q544 645 459 711 Q400 759 425 813',null,'#a4c9b160',4);this.path('M535 499 Q562 558 527 604 M466 707 Q425 748 434 785',null,'#c2dcc94a',2);
 for(let i=0;i<18;i++){let y=530+(i*31+t*11)%270,x=535-(y-530)*.32+Math.sin(i*7)*25;this.path(`M${x} ${y} q20 5 39 -4`,null,'#bfd8c91f',1)}
 const fog=c.createLinearGradient(0,450,0,810);fog.addColorStop(0,'#91bdb500');fog.addColorStop(1,'#a7c6b553');c.fillStyle=fog;c.fillRect(0,450,1000,350);
 // Foreground ledges, strata and fern-tinted edges.
 this.path('M-30 434 Q24 414 74 435 L106 481 L152 488 L186 429 Q202 414 240 421 L282 419 L307 446 L302 470 L365 504 Q386 514 401 552 L437 580 L436 627 L472 656 L473 690 Q437 704 393 709 L357 747 L319 800 L-30 830Z','#172f39');
 this.path('M-10 451 L74 457 L105 499 L156 506 L195 444 L233 440 L273 437 L288 458 L275 486 L340 527 L382 542 L403 579 L413 635 L449 663 L449 676 L396 682 L346 714 L312 778 L265 810 L-10 810Z','#2d4a4b');
 this.path('M2 452 L77 460 L107 500 L156 507 L199 445 L271 439 L287 458 L275 486 L340 527 L383 544 L405 579 L413 635 L449 664',null,'#a3a789',5);
 this.path('M63 513 L98 537 L115 590 L98 642 L118 717 L109 815 M199 506 L226 533 L218 589 L258 647 L233 694 L250 788 M318 568 L307 607 L338 661 L310 692 L299 743',null,'#112e3680',14);
 // Safe station terrace and rails.
 this.path('M-25 590 L171 587 L286 645 L229 720 L-20 718Z','#203d43');this.path('M-20 586 L171 581 L291 640 L273 663 L221 694 L-20 696Z','#546660');this.path('M-20 590 L171 585 L281 641 L219 679 L-20 680Z','#788276');this.line([[0,586],[171,583],[281,642]],'#c0b993',3);this.line([[10,701],[212,702],[285,656]],'#081e28',4);
 for(let i=0;i<8;i++){let x=i*30;this.line([[x,628],[x+12,665]],'#2c464749',1)}
 // Canvas fabric hut, rescue stripes, rigging.
 this.path('M20 545 L91 522 L154 550 L143 604 L30 605Z','#d5c8a3');this.path('M20 545 L91 522 L100 546 L30 605Z','#b49d78');this.path('M100 546 L154 550 L143 604 L102 604Z','#637c73');this.path('M105 559 L130 562 L126 600 L104 600Z','#12323e');this.line([[19,545],[10,610]],'#d9cba8',2);this.line([[155,550],[170,620]],'#d9cba8',2);this.path('M50 557 h19 v-8 h8 v8 h17 v8 h-17 v18 h-8 v-18 h-19Z','#ad634a');
 this.line([[55,526],[55,479]],'#9fb4a7',2);this.path(`M55 479 Q74 ${472+Math.sin(t*2)*3} 89 483 L84 499 Q68 493 55 498Z`,'#d2ad6a');
 // The supplied lift genuinely changes position and carries the final passenger.
 const powered=supply(this.state)===1,wasPowered=this.previous&&supply(this.previous)===1&&this.previous.done.includes('basket'),transported=this.state.done.includes('platform'),wasTransported=this.previous?.done.includes('platform');
 let lift=[600,510];if(powered&&this.state.done.includes('basket')){let u=wasPowered?1:ease;lift=[mix(600,POINTS.yao[0],u),mix(510,POINTS.yao[1]+21,u)];this.line([[599,481],POINTS.C,[POINTS.D[0],POINTS.D[1]+20]],'#aacfc069',2,[3,6]);}
 if(transported){let u=wasTransported?1:ease;lift=[mix(POINTS.yao[0],153,u),mix(POINTS.yao[1]+21,669,u)-Math.sin(u*Math.PI)*75];}
 this.metrics={lift:{x:lift[0],y:lift[1],powered,ready:powered&&this.state.done.includes('basket'),transported}};c.save();c.translate(lift[0]-600,lift[1]-510);this.path('M548 503 L598 484 L648 505 L600 526Z',powered?'#d7c492':'#8e967d');this.path('M548 503 L600 526 L600 539 L548 516Z','#496161');this.path('M600 526 L648 505 L648 518 L600 539Z','#243f47');for(let i=0;i<4;i++)this.line([[556+i*12,504+i*5],[600+i*10,487+i*5]],'#3c555b',1);this.line([[554,506],[554,477],[600,497],[643,479],[643,508]],powered?'#aceed0':'#7b9995',2);this.circle(600,524,4,powered?'#b8ffda':'#e5ab72');c.fillStyle='#0d2833e6';c.beginPath();c.roundRect(536,553,130,25,4);c.fill();c.font='12px sans-serif';c.textAlign='center';c.fillStyle=powered?'#b7f6d7':'#ffd39a';c.fillText(transported?'平台 · 已接回伤员':powered?(this.state.done.includes('basket')?'100% · 平台就位':'100% · 等待吊篮'):`${supply(this.state)*100}% · 平台停机`,601,570);c.textAlign='left';c.restore();
 // Far edge rescue basket.
 this.path('M813 286 L860 295 L882 278 L838 270Z','#b39369');this.path('M813 286 L813 305 L860 316 L882 297 L882 278',null,'#d0b282',3);for(let i=0;i<5;i++)this.line([[815+i*11,289+i*2],[815+i*11,306+i*2]],'#ab926b',1);
 // Mechanical winch station, three identical mechanisms.
 for(let i=0;i<3;i++){const x=169+i*28,y=620+i*12;this.path(`M${x-12} ${y+13} l22 10 17 -10 -22 -10Z`,'#293c3b');this.circle(x+2,y+5,10,'#122d37','#9eb5a5');this.circle(x+2,y+5,6,'#4f6c68','#c9c1a3');this.line([[x-10,y+7],[x+13,y+14]],'#ced1aa',2)}
 // Permanent harnesses. Every action locks off and releases its machine.
 this.line([[250,580],[249,453]],'#b6c8a083',2);this.line([[250,580],[372,543]],'#b6c8a083',2);this.line([[250,580],[467,657]],'#b6c8a083',2);
 const done=this.state.done;const chain=[['A','B','anchor'],['B','C','basket'],['C','D','cross']];
 for(const[a,b,id]of chain){const p=POINTS[a],q=POINTS[b];if(done.includes(id)||this.selected.includes(id)){this.rope(p,q,done.includes(id)?'#e9d8a3':'#a6f1cf',this.selected.includes(id),t);}else if(this.map)this.line([p,q],'#cbe0c650',1,[5,6]);}
 if(done.includes('basket')){this.path('M607 319 l27 7 12 -9 -27 -7Z','#c5b58c');this.line([[607,319],[607,336],[634,343],[646,334],[646,317]],'#d7c8a2',2);}
 for(const[k,p]of Object.entries(POINTS).filter(([k])=>'ABCD'.includes(k))){this.circle(...p,11,'#293e40','#b7baa0');this.circle(...p,5,'#102f36','#e3d3a1');this.line([[p[0]-12,p[1]+11],[p[0]+12,p[1]+11]],'#61756a',3);if(this.map){c.font='12px sans-serif';c.fillStyle='#e9eccf';c.fillText(`${k} (${ANCHORS[k].join(',')})`,p[0]+15,p[1]+5);}}
 if(this.map){for(const[a,b]of[['A','B'],['B','C'],['C','D']]){let p=POINTS[a],q=POINTS[b];c.fillStyle='#eae8c8';c.font='12px sans-serif';c.fillText('√2 ≈ 1.41',(p[0]+q[0])/2+7,(p[1]+q[1])/2-9);}this.line([POINTS.A,POINTS.C],'#e8a786',1,[6,8]);c.fillStyle='#f6c89c';c.fillText('A → C = 2.00 · 超长',386,392);}
 // Human figures: helmet, fabric, harness, limbs; intentionally an authored 2.5D illustration.
 const persons=[['lin','near1','#d7af6d'],['shan','near2','#9ab6a0'],['engineer','engineer','#e8b170'],['yao','yao','#d69678']];
 const anim=elapsed;
 for(let i=0;i<persons.length;i++){const[id,point,col]=persons[i],saved=this.state.saved.includes(id),prior=this.previous?.saved.includes(id);let p=POINTS[point].slice(),dest=[54+i*33,641+(i%2)*7],progress=saved?1:0;if(saved&&!prior&&anim<1)progress=anim*anim*(3-2*anim);p=id==='yao'&&this.state.done.includes('pull')?along([POINTS.yao,POINTS.D,POINTS.C,POINTS.B,POINTS.A,dest],progress):[mix(p[0],dest[0],progress),mix(p[1],dest[1],progress)-Math.sin(progress*Math.PI)*75];if(saved&&progress<1){if(id!=='yao')this.rope(POINTS.A,p,'#c8e6bc',false,t);this.circle(p[0],p[1]-18,30,'#aaf1d411')};this.person(p[0],p[1],saved?col:col,id==='yao'&&!saved,id==='engineer'&&done.includes('first'),t,i,saved);}
 // Silhouetted foliage, carefully bounded away from interactive targets.
 for(let i=0;i<13;i++)this.fern(i*34-20,770+Math.sin(i)*17,20+(i%4)*8,'#0c3038');for(let i=0;i<9;i++)this.tree(950+i*12,570+(i%3)*23,30+(i%4)*5,'#1d3b41');
 // Slab poised over the injured climber. Danger progresses only on submitted beats.
 let risk=this.state.status==='won'?0:this.state.beat;const rockY=94+risk*14;this.path(`M826 ${rockY} L847 ${rockY-19} L882 ${rockY-16} L910 ${rockY+10} L896 ${rockY+39} L861 ${rockY+48} L831 ${rockY+30}Z`,'#3b4c49','#a59e7b',1);this.path(`M826 ${rockY} L855 ${rockY+7} L882 ${rockY-16} L861 ${rockY+26} L861 ${rockY+48} L831 ${rockY+30}Z`,'#617060');this.line([[862,rockY+8],[880,rockY+18],[870,rockY+32]],'#192f31',2);
 this.path(`M832 ${rockY+48} L780 283 L907 306 L895 ${rockY+41}Z`,this.state.status==='won'?'#cebd7504':`rgba(246,166,99,${.035+risk*.014})`);
 for(let i=0;i<14;i++){let phase=this.reduced?.5:(t*.23+i*.27)%1,x=819+(i*29)%103+phase*9,y=rockY+43+phase*114;this.circle(x,y,1+(i%3)*.7,`rgba(225,198,153,${.65*(1-phase)})`)}
 // Atmospheric motes and vignette keep the important play space legible.
 for(let i=0;i<23;i++){const x=(i*71+t*(2+i%3))%1000,y=300+(i*47)%480;this.circle(x,y,.7,'#d2d5b02b')}
 let shade=c.createLinearGradient(0,0,0,800);shade.addColorStop(0,'#0a20265c');shade.addColorStop(.24,'#061b2300');shade.addColorStop(.72,'#071c2400');shade.addColorStop(1,'#081e27bc');c.fillStyle=shade;c.fillRect(0,0,1000,800);
 // Live drag is an interaction overlay, not a replacement for committed routes.
 if(this.drag){const [x,y]=this.drag.point;if(this.drag.mode==='relay'&&this.drag.valid){for(const[a,b]of[['A','B'],['B','C'],['C','D']])this.rope(POINTS[a],POINTS[b],'#b8ffdc',true,t);this.rope(POINTS.D,[x,y],'#b8ffdc',true,t)}else if(this.drag.mode!=='platform')this.rope(this.drag.from||POINTS.A,[x,y],this.drag.valid?'#b8ffdc':'#f1bc87',true,t);this.circle(x,y,9,'#d5ffe7','#e5ffed')}
 if(this.state.status==='lost'){c.fillStyle='#13252b44';c.fillRect(0,0,1000,800)}
 }
 rope(p,q,col,dashed,t){let c=this.ctx;c.beginPath();c.moveTo(...p);c.quadraticCurveTo((p[0]+q[0])/2,(p[1]+q[1])/2+13+Math.sin(t)*2,...q);c.strokeStyle='#0a222b';c.lineWidth=5;c.stroke();c.strokeStyle=col;c.lineWidth=2;c.setLineDash(dashed?[7,5]:[]);c.stroke();c.setLineDash([])}
 person(x,y,col,injured,freed,t,i,safe){let c=this.ctx;c.save();c.translate(x,y);let inv=Math.sqrt((this.w/1000)/(this.h/800));c.scale(1/inv,inv);c.scale(.96,.96);const sway=this.reduced?0:Math.sin(t*1.4+i)*.6;c.translate(sway,0);c.lineCap='round';this.circle(0,5,13,'#061d284b');if(injured){c.scale(1.28,1.28);this.path('M-15 -10 Q0 -17 16 -4 L28 0',null,'#243c43',9);this.path('M-9 -17 Q3 -21 8 -12 L1 -3 -13 -5Z',col);this.circle(-15,-18,6,'#c6a17c');this.path('M-22 -21 Q-16 -29 -10 -22 L-9 -18 -22 -18Z','#e6c884');this.line([[-9,-11],[-15,-4],[-21,-7]],'#cba782',4);c.restore();return;}
 this.path('M-4 -16 L-7 -1 L-11 1 M4 -16 L7 -2 L13 1',null,'#20323a',7);this.line([[-12,2],[-6,2]],'#0d252d',4);this.line([[7,2],[14,2]],'#0d252d',4);
 this.path('M-9 -42 Q0 -45 8 -39 L11 -18 Q0 -12 -10 -18Z',col);this.path('M5 -39 Q14 -44 15 -29 L12 -17 8 -20Z','#506d65');this.path('M-5 -42 L-3 -17 M5 -42 L3 -17 M-10 -22 L9 -23',null,'#2a4649',2);this.circle(0,-23,2,'#ebcd8e');
 if(safe){this.line([[-8,-37],[-17,-43],[-18,-54]],col,6);this.circle(-18,-56,3,'#c9a985');this.line([[9,-35],[15,-22],[12,-17]],col,6);}else{this.line([[-8,-37],[-16,-27],[-17,-16]],col,6);this.circle(-17,-15,3,'#d6b087');this.line([[8,-37],[14,-44],[14,-52]],col,6);this.circle(14,-54,3,'#d6b087')};
 this.circle(0,-48,7,'#d2ac85');this.path('M-8 -51 Q-7 -61 2 -60 Q10 -58 9 -50 L-8 -50Z',i===2?'#e6ba62':'#d1d8b4');this.path('M-9 -50 L10 -50',null,'#eee5bd',2);this.path('M2 -45 L5 -44',null,'#7f6c58',1);c.restore();}
 tree(x,y,h,col){this.path(`M${x} ${y-h} l${h*.25} ${h*.47} -${h*.12} 0 ${h*.24} ${h*.3} -${h*.17} 0 ${h*.24} ${h*.25} -${h*.84} 0 ${h*.23} -${h*.25} -${h*.17} 0 ${h*.24} -${h*.3} -${h*.12} 0Z`,col)}
 fern(x,y,h,col){for(let i=0;i<6;i++){const a=-2.8+i*.45;this.path(`M${x} ${y} q${Math.cos(a)*h*.5} ${Math.sin(a)*h} ${Math.cos(a)*h} ${Math.sin(a)*h}`,null,col,3)}}
}
export function drawNetwork(canvas,s,t=0){const c=canvas.getContext('2d');c.clearRect(0,0,600,200);const points={U:[135,100],V:[465,100],X:[300,48],Y:[300,100],Z:[300,152]},active=s.done.includes('valve'),wide=s.done.includes('widen');
 function edge(a,b,amount,capacity,color){let p=points[a],q=points[b];c.beginPath();c.moveTo(...p);c.lineTo(...q);c.lineWidth=capacity===2?9:5;c.strokeStyle='#496263';c.stroke();c.lineWidth=3;c.strokeStyle=color;c.stroke();let progress=(t*.15+(a.charCodeAt(0)+b.charCodeAt(0))*.17)%1;c.beginPath();c.arc(mix(p[0],q[0],progress),mix(p[1],q[1],progress),4,0,TAU);c.fillStyle=color;c.fill();}
 for(const h of ['U','V'])for(const r of ['X','Y','Z'])edge(h,r,1,wide&&h==='U'&&r==='X'?2:1,active?'#9df1d2':wide?'#d7b789':'#92bcb1');
 // Added hub edge curves through the external face. It is not an intersection at Y.
 c.beginPath();c.moveTo(135,100);c.bezierCurveTo(70,-15,530,-15,465,100);c.lineWidth=3;c.setLineDash(active?[]:[7,7]);c.strokeStyle=active?'#9df1d2':'#596c68';c.stroke();c.setLineDash([]);
 for(const[k,[x,y]]of Object.entries(points)){c.beginPath();c.arc(x,y,13,0,TAU);c.fillStyle='#17363d';c.fill();c.strokeStyle='#a3b8a6';c.stroke();c.fillStyle='#d1dbca';c.font='16px sans-serif';c.textAlign='center';c.fillText(k,x,y+5)}c.font='15px sans-serif';c.fillStyle=active?'#9df1d2':'#92a9a5';c.fillText(active?'旁路已开':'预装旁路 · 待开启',300,195);c.textAlign='left';}
