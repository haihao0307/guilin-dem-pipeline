import test from 'node:test';
import assert from 'node:assert/strict';
import {profile78,generateTropical78} from './rules/native78-musa-author.mjs';
import {PLANT_SEGMENT} from './segment.mjs';
test('analytic native wind envelope includes each leaf hinge chord and flutter-raised global gain before accepting 15cm clearance',()=>{
 const specimen=generateTropical78(profile78('musa-balbisiana',{stage:'establishing',habitatForm:'sheltered',seed:761014}),{compactBlades76:true}),g=specimen.geometry,strength=.25,angle=strength*.06,h=Math.max(.1,specimen.growth.axes.reduce((h,a)=>Math.max(h,...a.path.map(p=>p.position[1])),0)),maximum=[0,0,0];let maxRadius=0,maxFlutter=0;
 for(let i=0;i<g.positions.length;i+=3){const p=Array.from(g.positions.subarray(i,i+3)),leaf=Array.from(g.windLeafAxes.subarray(i,i+3)).reduce((n,x)=>n+x*x,0)>.1,radius=leaf?Math.hypot(...p.map((x,j)=>x-g.windAnchors[i+j])):0,flutter=2*radius*Math.sin(angle/2),movedY=Math.max(0,p[1]+flutter),gain=Math.min(.42,h*.012)*strength*(movedY/h)**2,delta=[flutter+gain,flutter,flutter+.65*gain];maxRadius=Math.max(maxRadius,radius);maxFlutter=Math.max(maxFlutter,flutter);for(let j=0;j<3;j++)maximum[j]=Math.max(maximum[j],delta[j]);}
 assert.equal(angle,.015);assert.equal(PLANT_SEGMENT.windClearanceMarginM,.15);assert(maxRadius>1.8&&maxRadius<1.9);assert(maxFlutter>.027&&maxFlutter<.029);assert(maximum.every(x=>x>0&&x<PLANT_SEGMENT.windClearanceMarginM));assert(maximum[0]<.046);assert(maximum[1]<.028);assert(maximum[2]<.040);
 const stems=specimen.growth.axes.filter(a=>a.role==='pseudostem');assert.equal(stems.length,4);assert(stems.every(a=>a.path[0].position[1]===0));assert(Math.min(...Array.from(g.positions).filter((_,i)=>i%3===1))<0);
});
