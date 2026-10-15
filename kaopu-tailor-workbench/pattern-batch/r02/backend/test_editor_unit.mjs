/** Controller regression only: minimal in-memory DOM fixture, not a browser/render test. */
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {mountParameterEditor} from './parameters-r043.mjs';
const checks=[];
function check(name, condition){checks.push({name,passed:!!condition});if(!condition)throw Error(name);}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject};}
class FixtureElement {
  constructor(tag='div'){this.tagName=tag;this.children=[];this.dataset={};this.disabled=false;this.checked=false;this._value='';this._text='';this.className='';}
  set value(x){this._value=String(x)} get value(){return this._value}
  append(...nodes){for(const n of nodes){n.parentElement=this;this.children.push(n)}}
  replaceChildren(...nodes){this.children=[];this.append(...nodes)}
  set textContent(x){this._text=String(x);this.children=[]} get textContent(){return this._text+this.children.map(x=>x.textContent).join('')}
  set innerHTML(html){
    // The editor has a fixed host template; dynamic parameter fields use createElement.
    this.children=[];
    for(const m of html.matchAll(/<(\w+)\b[^>]*\bid="([^"]+)"[^>]*>/g)){const el=new FixtureElement(m[1]);el.id=m[2];this.append(el)}
    for(const m of html.matchAll(/<button\b[^>]*\bdata-ease="([^"]+)"[^>]*>/g)){const el=new FixtureElement('button');el.dataset.ease=m[1];this.append(el)}
  }
  querySelectorAll(selector){
    const matching=el=>{
      if(selector.startsWith('#'))return el.id===selector.slice(1);
      if(selector.startsWith('.'))return el.className.split(/\s+/).includes(selector.slice(1));
      const d=selector.match(/^\[data-([\w-]+)(?:="([^"]*)")?\]$/);
      if(d){const key=d[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase());return d[2]===undefined?Object.hasOwn(el.dataset,key):el.dataset[key]===d[2]}
      return el.tagName===selector;
    };
    const result=[],visit=n=>{for(const c of n.children){if(matching(c))result.push(c);visit(c)}};visit(this);return result;
  }
  querySelector(selector){return this.querySelectorAll(selector)[0]??null;}
}
globalThis.document={createElement:tag=>new FixtureElement(tag)};
const schema=JSON.parse(await fs.readFile(new URL('./parameter-schema.json',import.meta.url)));
const audit=JSON.parse(await fs.readFile(new URL('./PARAMETER_AUDIT_R043.json',import.meta.url)));
globalThis.fetch=async name=>({ok:true,json:async()=>structuredClone(name==='parameter-schema.json'?schema:audit)});
const papers={};for(const id of ['T01','T07'])papers[id]=JSON.parse(gunzipSync(await fs.readFile(new URL('./assets/papers/'+id+'.json.gz',import.meta.url))));
let read=async()=>structuredClone(papers.T01),apply=async()=>({testStub:true}),events=[],calls=0;
const host=new FixtureElement(),editor=await mountParameterEditor(host,{readCurrentPaper:()=>read(),apply:async q=>{calls++;return apply(q)},onState:q=>events.push(q)});
try{
 await editor.load();
 check('122 actual schema controls are built',host.querySelectorAll('[data-path]').length===122);
 await editor.set({'shirt.width':1.2},3,0);
 check('public parameter setter notifies dirty-state consumer',events.at(-1).changedParameters['shirt.width']===1.2&&events.at(-1).easeCm===3);
 check('chest/hip ease is separate from waistband ease',editor.state().easeCm===3&&editor.state().waistEaseCm===0);
 check('current values match the rendered input fixture',host.querySelector('[data-path="shirt.width"]').value==='1.2');
 let rejected=false;try{await editor.set({'shirt.width':'1.2'})}catch{rejected=true}
 check('invalid API request rejected without corrupting prior values',rejected&&editor.state().changedParameters['shirt.width']===1.2);
 const width=host.querySelector('[data-path="shirt.width"]');width.value='';width.onchange();
 check('blank numeric input remains invalid instead of silently becoming zero',Number.isNaN(editor.state().changedParameters['shirt.width']));
 const beforeCalls=calls;await editor.generate();
 check('blank numeric input cannot reach original drafting callback',calls===beforeCalls&&host.querySelector('#parameter-feedback').textContent.includes('范围'));
 await editor.restoreRequest({parameters:{'shirt.width':1.2,'sleeve.sleeveless':false},easeCm:6,waistEaseCm:1});
 check('stored variant restores dimensions/ease/boolean fields',editor.state().changedParameters['sleeve.sleeveless']===false&&host.querySelector('#garment-ease').value==='6'&&host.querySelector('#waist-ease').value==='1');
 const waiting=deferred();apply=()=>waiting.promise;const drafting=editor.generate();await Promise.resolve();
 check('drafting disables parameters and both ease inputs',editor.state().busy&&host.querySelector('[data-path="shirt.width"]').disabled&&host.querySelector('#garment-ease').disabled&&host.querySelector('#waist-ease').disabled);
 check('drafting disables ease presets and reset',host.querySelectorAll('[data-ease]').every(x=>x.disabled)&&host.querySelector('#reset-native-parameters').disabled);
 rejected=false;try{await editor.set({'shirt.width':1.1})}catch{rejected=true}
 check('API cannot mutate in-flight source request',rejected&&editor.state().changedParameters['shirt.width']===1.2);
 editor.invalidate();read=async()=>structuredClone(papers.T07);await editor.load();
 host.querySelector('#parameter-feedback').textContent='new selected paper';waiting.reject(Error('late old request error'));await drafting;
 check('obsolete drafting rejection cannot overwrite new selection feedback',host.querySelector('#parameter-feedback').textContent==='new selected paper');
 check('old generation does not leave new editor stuck busy',!editor.state().busy&&!host.querySelector('#apply-native-parameters').disabled);
 check('old source values cannot leak into new source selection',Object.keys(editor.state().changedParameters).length===0&&host.querySelector('[data-path="shirt.width"]').value===String(papers.T07.design.shirt.width.v));
 const first=deferred();read=()=>first.promise;const loadFirst=editor.load();editor.invalidate();read=async()=>structuredClone(papers.T01);await editor.load();first.resolve(papers.T07);await loadFirst;
 check('late source load cannot replace newer source fields',host.querySelector('[data-path="shirt.width"]').value===String(papers.T01.design.shirt.width.v));
 await editor.set({'shirt.width':1.2},3,0);editor.synchronize({});
 check('read-original operation can reset variant fields without restarting the editor',Object.keys(editor.state().changedParameters).length===0&&editor.state().easeCm===0&&events.at(-1).easeCm===0);
 const conditional=host.querySelectorAll('.parameter-row').find(n=>n.dataset.parameter==='collar.bc_angle');
 check('conditional controls show explicit verified activation dependencies',conditional.querySelector('small').textContent.includes('条件参数')&&JSON.parse(conditional.querySelector('small').title)['collar.b_collar']==='CircleArcNeckHalf');
 await editor.set({'shirt.width':1.2},3,0);await host.querySelector('#reset-native-parameters').onclick({type:'click'});
 check('reset event is not mistaken for a source parameter request',Object.keys(editor.state().changedParameters).length===0&&host.querySelector('#garment-ease').value==='0');
 const missing=deferred();read=()=>missing.promise;const pending=editor.load();editor.invalidate();host.querySelector('#parameter-feedback').textContent='new control state';missing.reject(Error('old missing source'));check('obsolete source read error does not mutate active selection',await pending===false&&host.querySelector('#parameter-feedback').textContent==='new control state');
 const report={baseCommit:'58338295d84f03fafae66c14e23d3af13646242d',scope:'Node controller unit tests with minimal DOM and transport fixtures; no real browser, original drafting or image rendering exercised',passed:true,count:checks.length,checks};
 await fs.writeFile(new URL('./EDITOR_UNIT_TESTS.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,count:checks.length}));
}catch(error){await fs.writeFile(new URL('./EDITOR_UNIT_TESTS.json',import.meta.url),JSON.stringify({passed:false,checks,error:error.message},null,2));throw error;}
