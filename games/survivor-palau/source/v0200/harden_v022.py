"""V0.2.2 physical shoreline correction.

Applied after the V0.2.1 adapter.  This patch changes only the authored Stone
Money Island coast/game layer; the byte-locked original Ocean Mother source
payload remains untouched.
"""


def apply(s: str) -> str:
    def rep(old: str, new: str, count: int = 1) -> None:
        nonlocal s
        actual = s.count(old)
        assert actual == count, (old[:140], actual, count)
        s = s.replace(old, new)

    # Version and honest workbench identity.
    rep("Stone Money Island — Survivor Palau · V0.2.1", "Stone Money Island — Survivor Palau · V0.2.2")
    rep("const VERSION='stone-money-island-0.2.1-beach-contact';", "const VERSION='stone-money-island-0.2.2-physical-beach';")
    rep("第一章 · 岸边求生 V0.2.0", "第一章 · 岸边求生 V0.2.2")

    # Increase the actual white-sand annulus by more than ten times, while
    # keeping the whole authored island inside the existing world domain.
    rep('"key":"radius","label":"海岛半径","min":18,"max":42,"step":0.5,"value":36',
        '"key":"radius","label":"海岛半径","min":18,"max":120,"step":0.5,"value":92')
    rep('"key":"roundness","label":"岸线轻微起伏","min":0,"max":0.6,"step":0.005,"value":0.24',
        '"key":"roundness","label":"岸线轻微起伏","min":0,"max":0.6,"step":0.005,"value":0.18')
    rep('"key":"islandHeight","label":"岛心高度","min":1.5,"max":8.5,"step":0.1,"value":5.8',
        '"key":"islandHeight","label":"岛心高度","min":1.5,"max":12,"step":0.1,"value":7.8')
    rep('"key":"beachWidth","label":"沙滩宽度","min":5,"max":22,"step":0.5,"value":16.5',
        '"key":"beachWidth","label":"沙滩宽度","min":5,"max":70,"step":0.5,"value":50')
    rep('"key":"beachSlope","label":"滩面坡形","min":0.6,"max":2.4,"step":0.05,"value":1.05',
        '"key":"beachSlope","label":"滩面坡形","min":0.2,"max":1.5,"step":0.05,"value":0.72')
    rep('"key":"shelfWidth","label":"浅海平台宽度","min":12,"max":52,"step":1,"value":34',
        '"key":"shelfWidth","label":"浅海平台宽度","min":12,"max":120,"step":1,"value":84')
    rep('"key":"bedRelief","label":"海床起伏","min":0,"max":0.75,"step":0.01,"value":0.22',
        '"key":"bedRelief","label":"海床起伏","min":0,"max":0.75,"step":0.01,"value":0.14')

    # Replace the explicit foam-wall defaults with low-amplitude, long-period
    # swash.  Wet-sand memory remains, but white ribbons are no longer the
    # primary wave expression.
    for old, new in [
        ('"key":"swell","label":"主涌浪高度","min":0.15,"max":2.4,"step":0.05,"value":0.62',
         '"key":"swell","label":"主涌浪高度","min":0.15,"max":2.4,"step":0.05,"value":0.38'),
        ('"key":"period","label":"主涌浪周期","min":4,"max":13,"step":0.1,"value":6.6',
         '"key":"period","label":"主涌浪周期","min":4,"max":13,"step":0.1,"value":7.4'),
        ('"key":"secondary","label":"次涌浪高度","min":0,"max":1,"step":0.02,"value":0.14',
         '"key":"secondary","label":"次涌浪高度","min":0,"max":1,"step":0.02,"value":0.07'),
        ('"key":"crest","label":"浪峰尖锐度","min":0,"max":0.55,"step":0.01,"value":0.10',
         '"key":"crest","label":"浪峰尖锐度","min":0,"max":0.55,"step":0.01,"value":0.03'),
        ('"key":"curlOuter","label":"外层卷浪","min":0,"max":1.8,"step":0.05,"value":0.98',
         '"key":"curlOuter","label":"外层卷浪","min":0,"max":1.8,"step":0.05,"value":0'),
        ('"key":"curlMiddle","label":"中层卷浪","min":0,"max":1.8,"step":0.05,"value":0.74',
         '"key":"curlMiddle","label":"中层卷浪","min":0,"max":1.8,"step":0.05,"value":0'),
        ('"key":"curlInner","label":"内层翻涌","min":0,"max":1.8,"step":0.05,"value":0.50',
         '"key":"curlInner","label":"内层翻涌","min":0,"max":1.8,"step":0.05,"value":0'),
        ('"key":"foam","label":"泡沫生成强度","min":0,"max":2,"step":0.05,"value":0.84',
         '"key":"foam","label":"泡沫生成强度","min":0,"max":2,"step":0.05,"value":0.06'),
        ('"key":"foamThickness","label":"泡沫光学厚度","min":0.1,"max":1.8,"step":0.05,"value":0.92',
         '"key":"foamThickness","label":"泡沫光学厚度","min":0.1,"max":1.8,"step":0.05,"value":0.25'),
        ('"key":"shoreFoam","label":"贴岸白沫增强","min":0,"max":2,"step":0.05,"value":0.42',
         '"key":"shoreFoam","label":"贴岸白沫增强","min":0,"max":2,"step":0.05,"value":0.04'),
        ('"key":"rockFoam","label":"撞岩泡沫增强","min":0,"max":3,"step":0.05,"value":0.88',
         '"key":"rockFoam","label":"撞岩泡沫增强","min":0,"max":3,"step":0.05,"value":0.12'),
        ('"key":"residualFoam","label":"回洗泡沫残留","min":0,"max":1,"step":0.05,"value":0.30',
         '"key":"residualFoam","label":"回洗泡沫残留","min":0,"max":1,"step":0.05,"value":0.05'),
        ('"key":"spray","label":"浪花喷射量","min":0,"max":3,"step":0.05,"value":1.1',
         '"key":"spray","label":"浪花喷射量","min":0,"max":3,"step":0.05,"value":0.22'),
    ]:
        rep(old, new)

    # One gently rising physical beach in CPU and GLSL.  No abrupt upper-beach
    # ledge and no water-level change used to disguise a terrain error.
    rep("const shelfU=clamp(s/c.shelfWidth,0,1),shelf=-.035*Math.min(s,c.shelfWidth)-.85*Math.pow(shelfU,2.2);",
        "const shelfU=clamp(s/c.shelfWidth,0,1),shelf=-.010*Math.min(s,c.shelfWidth)-.32*Math.pow(shelfU,2.35);")
    rep("const inland=-s,q=clamp(inland/B,0,1),beach=.18*q+.78*q*q*(3-2*q),interior=smooth(B*.82,B+4.5,inland),core=Math.pow(clamp(inland/Math.max(1,R),0,1),.68);",
        "const inland=-s,q=clamp(inland/B,0,1),beach=2.15*q*q*(3-2*q),interior=smooth(B*.96,B+22,inland),core=Math.pow(clamp(inland/Math.max(1,R),0,1),.72);")
    rep("const body=beach+(c.islandHeight-1.02)*interior*(.32+.68*core);",
        "const body=beach+(c.islandHeight-2.15)*interior*(.18+.82*core);")
    rep("float shelfU=clamp(s/p_shelfWidth,0.0,1.0),shelf=-.035*min(s,p_shelfWidth)-.85*pow(shelfU,2.2);",
        "float shelfU=clamp(s/p_shelfWidth,0.0,1.0),shelf=-.010*min(s,p_shelfWidth)-.32*pow(shelfU,2.35);")
    rep("float inland=-s,q=clamp(inland/B,0.0,1.0),beach=.18*q+.78*q*q*(3.0-2.0*q),interior=smoothstep(B*.82,B+4.5,inland),core=pow(clamp(inland/max(1.0,R),0.0,1.0),.68);",
        "float inland=-s,q=clamp(inland/B,0.0,1.0),beach=2.15*q*q*(3.0-2.0*q),interior=smoothstep(B*.96,B+22.0,inland),core=pow(clamp(inland/max(1.0,R),0.0,1.0),.72);")
    rep("float body=beach+(p_islandHeight-1.02)*interior*(.32+.68*core);",
        "float body=beach+(p_islandHeight-2.15)*interior*(.18+.82*core);")

    # A broad, irregular swash pulse replaces the three visible mechanical
    # foam walls.  The old band machinery stays available for later study but
    # its default gain is zero and the separate curling sheet is not drawn.
    rep("eta+=p_runup*.11*sin(uTime*2.0*PI/p_period-r*.60)*exp(-s*s/11.0);",
        "float swashNoise=fbm(p*.028+vec2(uTime*.009,-uTime*.007));eta+=p_runup*.065*sin(uTime*.44-r*.09+swashNoise*3.2)*exp(-s*s/55.0);eta+=shallow*wet*.045*p_swell*sin(uTime*.57-r*.075+swashNoise*4.0);")
    rep("const run=c.runup*.10*Math.sin(time*TAU/c.period-r*.60)*Math.exp(-s*s/12);",
        "const swashNoise=noise2(x*.028+time*.009,z*.028-time*.007,1301),run=c.runup*.065*Math.sin(time*.44-r*.09+swashNoise*3.2)*Math.exp(-s*s/55)+shallow*wet*.045*c.swell*Math.sin(time*.57-r*.075+swashNoise*4.0);")
    rep('if(!query.has("reference")){drawWater(sun);drawCurl(sun)}',
        'if(!query.has("reference")){drawWater(sun)}')

    # Physical water/terrain permission.  Dynamic wave height may lap over the
    # low swash strip, but once the bed is above the run-up ceiling the water
    # surface is placed below the bed and the fragment is discarded.
    rep(
        "void main(){vec2 p=aXZ;float d0=uSeaLevel-bedH(p),shallow=1.0-smoothstep(.85,3.8,d0),k=2.0*PI/(20.5*(uPeriod/8.0)),omega=sqrt(9.81*k*tanh(k*3.5)),phase=k*dot(vec2(.06,-.998),p)-omega*uTime+.1,q=(.12+.20*shallow)*uSwell*smoothstep(.035,.62,d0);float br=0.0,y=waveSurface(p,br),e=.17,bx=0.0,bz=0.0,yx=waveSurface(p+vec2(e,0.0),bx),yz=waveSurface(p+vec2(0.0,e),bz);vec3 tx=vec3(e,yx-y,0.0),tz=vec3(0.0,yz-y,e);vNormal=normalize(cross(tz,tx));vWorld=vec3(p.x,y,p.y);vBreaker=br;vThickness=max(0.0,y-bedH(p));gl_Position=uProj*uView*vec4(vWorld,1.0);}",
        "void main(){vec2 p=aXZ;float bed=bedH(p),d0=uSeaLevel-bed,shallow=1.0-smoothstep(.85,3.8,d0),k=2.0*PI/(20.5*(uPeriod/8.0)),omega=sqrt(9.81*k*tanh(k*3.5)),phase=k*dot(vec2(.06,-.998),p)-omega*uTime+.1,q=(.12+.20*shallow)*uSwell*smoothstep(.035,.62,d0);float runupCeiling=uSeaLevel+.08+p_runup*.24,br=0.0,raw=waveSurface(p,br),permission=1.0-smoothstep(runupCeiling-.03,runupCeiling+.03,bed),y=mix(bed-.02,raw,permission),e=.17,bx=0.0,bz=0.0;vec2 px=p+vec2(e,0.0),pz=p+vec2(0.0,e);float bedX=bedH(px),bedZ=bedH(pz),rawX=waveSurface(px,bx),rawZ=waveSurface(pz,bz),permX=1.0-smoothstep(runupCeiling-.03,runupCeiling+.03,bedX),permZ=1.0-smoothstep(runupCeiling-.03,runupCeiling+.03,bedZ),yx=mix(bedX-.02,rawX,permX),yz=mix(bedZ-.02,rawZ,permZ);vec3 tx=vec3(e,yx-y,0.0),tz=vec3(0.0,yz-y,e);vNormal=normalize(cross(tz,tx));vWorld=vec3(p.x,y,p.y);vBreaker=br*permission;vThickness=max(0.0,y-bed);gl_Position=uProj*uView*vec4(vWorld,1.0);}",
    )
    rep(
        "float smiCoastWeight=1.-smoothstep(8.,20.,max(0.,uSeaLevel-bedH(vWorld.xz)));if(smiCoastWeight<.001)discard;",
        "float physicalBed=bedH(vWorld.xz),runupCeiling=uSeaLevel+.08+p_runup*.24,physicalWater=1.-smoothstep(runupCeiling-.025,runupCeiling+.025,physicalBed);if(physicalWater<.001)discard;float smiCoastWeight=1.-smoothstep(8.,22.,max(0.,uSeaLevel-physicalBed));if(smiCoastWeight<.001)discard;",
    )
    rep("float coverage=smoothstep(.001,.045,thickness);coverage*=smiCoastWeight;outColor=vec4(smiFilm(water*uExposure)*coverage,coverage);",
        "float coverage=smoothstep(.001,.045,thickness);coverage*=smiCoastWeight*physicalWater;outColor=vec4(smiFilm(water*uExposure)*coverage,coverage);")

    # Foam becomes a thin translucent aerated-water cue, not detached white
    # ribbons.  The beach motion now reads primarily through water and wet sand.
    rep("float foam=sat((carried*.76+crest*.92+shoreLace)*p_foamThickness)*smoothstep(.008,.07,thickness);",
        "float foam=.10*sat((carried*.76+crest*.92+shoreLace)*p_foamThickness)*smoothstep(.008,.07,thickness);")
    rep("foam=max(foam,sat((residualBand*.98+outerBreak*1.18)*p_foamThickness));",
        "foam=max(foam,sat((residualBand*.10+outerBreak*.08)*p_foamThickness));")
    rep("vec3 foamColor=mix(vec3(1.16,1.20,1.17),vec3(1.78,1.69,1.48),.34+.56*ndl);float foamVisible=smoothstep(.10,.72,foam);",
        "vec3 foamColor=mix(vec3(.42,.69,.70),vec3(.70,.82,.80),.34+.56*ndl);float foamVisible=.18*smoothstep(.38,.90,foam);")

    # Remove the constructed stone-house envelope and rectangular ramp.  The
    # shelter target is now only a natural terrain location; no fake building
    # geometry or collision remains.
    rep("""const slabs=[
{id:'floor',c:[27,1.18,14],r:[3.7,.17,4.1],solid:false},
{id:'west',c:[23.45,3.10,13.8],r:[.65,2.10,4.35]},
{id:'east',c:[30.55,3.12,13.8],r:[.65,2.12,4.35]},
{id:'back',c:[27,3.12,9.8],r:[3.8,2.12,.65]},
{id:'roof',c:[27,5.04,13.8],r:[4.10,.64,4.7]},
{id:'bend',c:[27.15,2.48,14.35],r:[1.15,1.2,.42]}
];""", "const slabs=[];")
    rep("function ground(x,z){let h=host.bed(x,z);if(x>23.3&&x<30.7&&z>9.7&&z<18.1)h=Math.max(h,1.35);if(x>24&&x<30&&z>=18.1&&z<23){const t=(23-z)/4.9;h=Math.max(h,host.bed(x,z)*(1-t)+1.35*t);}return h;}",
        "function ground(x,z){return host.bed(x,z);}")
    rep("function rebuildStatic(){dispose(staticGeo);const b=builder();for(const v of slabs){if(v.id==='floor')b.box(v.c,v.r,palette.sand);else b.rock(v.c,v.r,[.34,.35,.31]);}b.quad([24,1.35,18.1],[30,1.35,18.1],[30,host.bed(30,23)+.025,23],[24,host.bed(24,23)+.025,23],palette.sand);for(const d of defs){",
        "function rebuildStatic(){dispose(staticGeo);const b=builder();for(const d of defs){")
    rep("if(s.bed){b.box([25.2,1.47,12.1],[1.1,.12,.58],[.13,.24,.08]);for(let i=0;i<14;i++)b.rod([24.2+i*.14,1.61,11.65],[24.2+i*.14,1.61,12.55],.033,[.23,.33,.11]);}",
        "if(s.bed){const by=ground(42,34)+.08;for(let i=0;i<14;i++)b.rod([41.05+i*.14,by,33.48],[41.05+i*.14,by,34.52],.033,[.23,.33,.11]);}")

    # Reposition all first-chapter objects on the enlarged beach.  Stone money
    # is on the upper beach, not in the waterline.
    positions = [
        ("{id:'driftwood-01',type:'wood',name:'直木枝',x:23,z:22}", "{id:'driftwood-01',type:'wood',name:'直木枝',x:67,z:55}"),
        ("{id:'driftwood-02',type:'wood',name:'漂来的木枝',x:27,z:24}", "{id:'driftwood-02',type:'wood',name:'漂来的木枝',x:74,z:52}"),
        ("{id:'stone-01',type:'stone',name:'可握持的石块',x:23,z:19}", "{id:'stone-01',type:'stone',name:'可握持的石块',x:61,z:52}"),
        ("{id:'coconut-01',type:'coconut',name:'完整椰子',x:25,z:20}", "{id:'coconut-01',type:'coconut',name:'完整椰子',x:53,z:48}"),
        ("{id:'coconut-02',type:'coconut',name:'完整椰子',x:22.5,z:20}", "{id:'coconut-02',type:'coconut',name:'完整椰子',x:57,z:45}"),
        ("{id:'shell-01',type:'shell',name:'干净的空椰壳',x:28,z:21}", "{id:'shell-01',type:'shell',name:'干净的空椰壳',x:72,z:57}"),
        ("{id:'leaves-01',type:'leaves',name:'落下的宽叶',x:24.8,z:19.1}", "{id:'leaves-01',type:'leaves',name:'落下的宽叶',x:47,z:42}"),
        ("{id:'radio-01',type:'radio',name:'损坏的求生发报装置',x:20,z:23}", "{id:'radio-01',type:'radio',name:'损坏的求生发报装置',x:68,z:58}"),
        ("{id:'rai-01',type:'rai',name:'石钱',x:18.2,z:13.6}", "{id:'rai-01',type:'rai',name:'石钱',x:44,z:40}"),
        ("{id:'shelter-01',type:'shelter',name:'岩棚深处',x:25.2,z:12.1}", "{id:'shelter-01',type:'shelter',name:'树林后的避风凹处',x:42,z:34}"),
    ]
    for old, new in positions:
        rep(old, new)
    rep("player:{x:21,z:26.5,yaw:2.58,pitch:-.10", "player:{x:62,z:58,yaw:2.58,pitch:-.10")
    rep("if(Math.abs(v.player.x)>100||Math.abs(v.player.z)>100", "if(Math.abs(v.player.x)>230||Math.abs(v.player.z)>230")
    rep("if(Math.hypot(x,z)>118)return '先认识这片海岸，不要冒险远行';", "if(Math.hypot(x,z)>230)return '先认识这片海岸，不要冒险远行';")
    rep("label:'进入岩棚，铺好睡卧处'", "label:'进入树林后的避风凹处，铺好睡卧处'")
    rep("note('shelter','岩棚后方终于有了一处可以休息的地方。');", "note('shelter','树林和天然岩壁之间终于有了一处可以休息的地方。');")

    # Fish are not decorative land objects.  They acquire a valid underwater
    # position from the same water/bed queries; invalid positions are not drawn
    # or targetable and are pushed outward until sufficient water exists.
    rep("const fish=Array.from({length:12},(_,i)=>({id:'fish-'+String(i+1).padStart(2,'0'),type:i%3,anchor:[31.4+(i%3)*1.9,22+(i%4)*1.25],phase:random()*TAU,length:.44+random()*.23,pos:[0,0,0],yaw:0}));",
        "const fish=Array.from({length:12},(_,i)=>({id:'fish-'+String(i+1).padStart(2,'0'),type:i%3,anchor:[88+(i%3)*3.2,68+(i%4)*2.6],phase:random()*TAU,length:.44+random()*.23,pos:[0,0,0],yaw:0,submerged:false}));let fishWaterViolations=0;")
    rep("function locateFish(time){for(const f of fish){const t=time*(.24+f.type*.055)+f.phase,x=f.anchor[0]+Math.sin(t)*1.25,z=f.anchor[1]+Math.cos(t*.87)*.85,water=host.water(x,z).eta,bed=ground(x,z);f.pos=[x,Math.min(water-.17,Math.max(bed+.16,water-.40)),z];f.yaw=Math.atan2(Math.cos(t)*1.25,-Math.sin(t*.87)*.74);}}",
        "function locateFish(time){fishWaterViolations=0;for(const f of fish){const t=time*(.24+f.type*.055)+f.phase;let x=f.anchor[0]+Math.sin(t)*1.25,z=f.anchor[1]+Math.cos(t*.87)*.85,w=host.water(x,z),surface=w.eta,bed=host.bed(x,z),depth=surface-bed;for(let k=0;k<8&&depth<.48;k++){const a=Math.atan2(z,x),rr=Math.hypot(x,z)+3.5;x=Math.cos(a)*rr;z=Math.sin(a)*rr;w=host.water(x,z);surface=w.eta;bed=host.bed(x,z);depth=surface-bed;}const clearance=Math.min(.38,Math.max(.18,depth*.42));f.pos=[x,surface-clearance,z];f.submerged=depth>.34&&f.pos[1]<surface-.05&&f.pos[1]>bed+.05;if(!f.submerged){fishWaterViolations++;f.pos=[x,bed-.25,z];}f.yaw=Math.atan2(Math.cos(t)*1.25,-Math.sin(t*.87)*.74);}}")
    rep("for(const f of fish){if(s.fish[f.id])continue;", "for(const f of fish){if(s.fish[f.id]||!f.submerged)continue;")
    rep("for(const f of fish)if(!s.fish[f.id])draw(fishGeo[f.type],matrix(...f.pos,f.yaw,f.length));",
        "for(const f of fish)if(!s.fish[f.id]&&f.submerged)draw(fishGeo[f.type],matrix(...f.pos,f.yaw,f.length));")
    rep("fishCount:fish.length,staticTriangles:staticGeo.count/3", "fishCount:fish.length,submergedFishCount:fish.filter(f=>f.submerged&&!s.fish[f.id]).length,fishWaterViolations,shelterSlabCount:slabs.length,staticTriangles:staticGeo.count/3")

    # Expose the physical permission for browser/numerical QA.
    rep("window.StoneMoneyShoreline={shoreAt:(x,z,t=physicalTime)=>shorelineAt(x,z,t,config)};",
        "window.StoneMoneyShoreline={shoreAt:(x,z,t=physicalTime)=>shorelineAt(x,z,t,config),physicalWaterAt:(x,z,t=physicalTime)=>{const q=shorelineAt(x,z,t,config),ceiling=q.surface+.08+config.runup*.24;return{...q,runupCeiling:ceiling,allowed:q.bed<ceiling};}};")
    rep("qa.shoreline='bed-and-water-shared';", "qa.shoreline='physical-bed-water-permission-v022';")

    return s
