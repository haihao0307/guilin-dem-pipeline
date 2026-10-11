// Exact idempotent final integration fixes. Render comparisons still inspect
// every framebuffer pixel; this avoids repeated PNG encoder/layout waits.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
function edit(file,pairs){const p=path.join(__dirname,file);let s=fs.readFileSync(p,'utf8');for(const[a,b]of pairs){if(s.includes(b))continue;assert.equal(s.split(a).length,2,'Expected unique final anchor in '+file);s=s.replace(a,()=>b);}fs.writeFileSync(p,s);}
edit('IdentityUI.mjs',[
 ['height:60%;flex-shrink:0;background:','height:60%;flex-shrink:0;overflow:hidden;background:'],
 ['flex:1;min-height:120px','flex:1;min-height:0'],
 ['min-height:30px}#identityPanel','min-height:30px;flex-shrink:0}#identityPanel'],
 ['#identityPanel{height:330px;min-height:330px}','#identityPanel{height:420px;min-height:420px}'],
 ["function eyeStyle(id){const r=EYE_STYLES[id];if(!r)throw Error('未知眼型');return transact", "function eyeStyle(id){const r=EYE_STYLES[id];if(!r)throw Error('未知眼型');const ownerState=controller.state();if(ownerState.headShapeComposition!=='shared-layers/1'&&ownerState.owners.headShape!=='anny')throw Error('当前头形不接受该原生组合；请先选择共同头形或Anny头形。');return transact"],
 ['眼型组合可继续逐项修改；单／双眼皮只表示本版可调的褶皱外观，不是身份解剖重建。','眼型组合可继续逐项修改。左右选择作用于原生五官通道；本页补充睑褶形态仍为双眼共同控制。单／双眼皮是外观倾向，不是身份解剖重建。']
]);
edit('verify.cjs',[
 ["async function pixels(){await page.evaluate(()=>identityWorkbench.render());return crypto.createHash('sha256').update(await page.locator('#canvas').screenshot()).digest('hex');}","async function pixels(){return page.evaluate(async()=>{identityWorkbench.render();const gl=__IDENTITY_QA__.viewer().renderer.getContext(),data=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,data);if(gl.getError()!==gl.NO_ERROR)throw Error('Identity pixel readback failed');return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),v=>v.toString(16).padStart(2,'0')).join('');});}"]
]);
edit('review.cjs',[
 ["check('no runtime errors',report.errors.length===0,report.errors);", "const layout=await page.evaluate(()=>{const panel=document.getElementById('identityPanel').getBoundingClientRect(),fields=document.getElementById('identityFields').getBoundingClientRect(),status=document.getElementById('identityStatus').getBoundingClientRect();return{panelBottom:panel.bottom,fieldsBottom:fields.bottom,statusTop:status.top,statusBottom:status.bottom,fieldHeight:fields.height};});check('mobile fields and status stay inside their own panel without overlap',layout.fieldsBottom<=layout.statusTop+1&&layout.statusBottom<=layout.panelBottom+1&&layout.fieldHeight>35,layout);\n check('no runtime errors',report.errors.length===0,report.errors);"]
]);
