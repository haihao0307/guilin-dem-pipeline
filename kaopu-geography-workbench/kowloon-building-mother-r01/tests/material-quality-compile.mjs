/** Generate actual candidate program sources; no draw or geometry buffer. */
import {readFileSync} from 'node:fs';
import {deriveField} from '../r07/field.mjs';
import {deriveMeasuredCase} from '../r07/cases.mjs';
import {deriveSourceBoundAssembly} from '../r07/assemblies.mjs';
import {deriveCaseContext} from '../r07/context.mjs';
import {deriveHostedCase} from '../material-quality-r01/host-bindings.mjs';
import {deriveHostedScene} from '../material-quality-r01/hosted-scene.mjs';
import {buildRendererSources} from '../material-quality-r01/renderer.mjs';
const official=JSON.parse(readFileSync(new URL('../r07/sources/official-footprints.json',import.meta.url))),scenes={kernel:deriveField()};
for(const [id,model] of Object.entries({lowrise:'B367642137201063C0',kcc:'B359971994401063C0',warehouse:'B369121858401063C0'})){
 const m=deriveMeasuredCase(JSON.parse(readFileSync(new URL(`../../hk-three-buildings-r01/geometry/${model}.score.json`,import.meta.url)))),a=deriveSourceBoundAssembly(id,m,official),b=deriveHostedCase(id,m,a),c=deriveCaseContext(m,b.assembly,{inspectionContext:true});scenes[id]=deriveHostedScene(c,b.components,{sourceMasks:b.sourceMasks});
}
const out={};for(const[id,s] of Object.entries(scenes)){const p=buildRendererSources(s);out[id]=Object.fromEntries((p.split?['primary','rescue','shade','rayPrimary','rayRescue','rayResult']:['direct','opticsProbe']).filter(k=>p[k]).map(k=>[k,p[k]]));}
process.stdout.write(JSON.stringify(out));
