import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as THREE from '../../vendor/three.module.js';
import {Session} from '../session.mjs';
import {createGameWorld} from '../world.mjs';

globalThis.document ??= {createElement:()=>({getContext:()=>({fillRect(){},fillText(){}})})};
const dir=path.dirname(fileURLToPath(import.meta.url));
const keys=['wheelFront','wheelRear','cylinderLeft','cylinderRight','whistle','guard','crowdFront','crowdRear'];
const points=()=>Object.fromEntries(keys.map(name=>[name,[0,0,0]]));
const near=(a,b)=>assert(Math.abs(a-b)<1e-6,`${a} differs from ${b}`);

test('Listener sources use rendered train/station transforms and do not jump with next-stop HUD',()=>{
  const game=new Session({line:'kcr1',seed:'R11-SPATIAL'});game.command('start');
  const world=createGameWorld(),out=points();world.update(game.view(),game.route);world.fillAudioSources(out);
  near(out.wheelFront[0],.6);near(out.wheelRear[0],-18);
  const beforeGuard=out.guard.slice(),beforeCrowd=out.crowdFront.slice();
  game.distance=2;game.activateStation(1);world.update(game.view(),game.route);world.fillAudioSources(out);
  near(out.guard[0],beforeGuard[0]-2);near(out.crowdFront[0],beforeCrowd[0]-2);
  const current=out.wheelFront.slice();world.root.position.set(7,3,-9);world.root.rotation.y=.4;
  world.fillAudioSources(out);const expected=new THREE.Vector3(...current).applyMatrix4(world.root.matrixWorld);
  out.wheelFront.forEach((x,i)=>near(x,expected.toArray()[i]));
  for(const point of Object.values(out))assert(point.every(Number.isFinite));
});

test('Frozen R10 keeps its version, default-on original cue and complete relative runtime resources',()=>{
  const root=path.resolve(dir,'../r10');
  assert.match(fs.readFileSync(path.join(root,'app.mjs'),'utf8'),/version:'kcr-atmosphere-r10'/);
  assert.match(fs.readFileSync(path.join(root,'app.mjs'),'utf8'),/createJourneyMusic\(\{volume:\.32,enabled:true\}\)/);
  const visit=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?visit(path.join(p,e.name)):[path.join(p,e.name)]);
  for(const file of visit(root).filter(p=>/\.(mjs|html|css)$/.test(p))){
    const text=fs.readFileSync(file,'utf8');
    const refs=[...text.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g),...text.matchAll(/(?:src|href)="(\.[^"]+)"/g)];
    for(const match of refs){const rel=match[1].split(/[?#]/)[0];assert(fs.existsSync(path.resolve(path.dirname(file),rel)),`${file}: missing ${rel}`);}
  }
});

test('R11 disables the rejected original cue by default while retaining the explicit music control',()=>{
  const app=fs.readFileSync(path.resolve(dir,'../app.mjs'),'utf8'),html=fs.readFileSync(path.resolve(dir,'../index.html'),'utf8');
  assert.match(app,/createJourneyMusic\(\{volume:\.32,enabled:false\}\)/);
  assert.match(app,/let musicEnabled=false/);
  assert.match(html,/<button id="musicToggle" aria-pressed="false">配樂：關<\/button>/);
  assert.match(html,/href="\.\/r10\/"/);
});


test('Only actual collision events receive a world-space impact anchor, with matching event identity',()=>{
 const game=new Session({line:'kcr1',seed:'R11-HIT'});game.command('start');for(let i=0;i<3;i++)game.command('throttle-up');
 const world=createGameWorld(),out=points();for(let i=0;i<4;i++)out['impact'+i]={position:[0,0,0],eventId:null,enabled:false};
 while(!game.events.some(e=>e.type==='stone-thrown')&&game.tick<900)game.stepTicks(1);world.update(game.view(),game.route);world.fillAudioSources(out,game.view());
 assert.equal(game.stats.stoneHits,0);assert([0,1,2,3].every(i=>out['impact'+i].enabled===false));
 while(!game.stats.stoneHits&&game.tick<900)game.stepTicks(1);const hit=game.events.find(e=>e.type==='stone-hit');assert(hit);
 world.update(game.view(),game.route);world.fillAudioSources(out,game.view());const anchor=out['impact'+(hit.id%4)];
 assert.equal(anchor.eventId,hit.id);assert.equal(anchor.enabled,true);anchor.position.forEach((v,i)=>near(v,hit.point[i]));
});
