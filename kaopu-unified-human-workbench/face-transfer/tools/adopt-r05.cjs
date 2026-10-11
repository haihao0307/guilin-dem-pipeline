// Adopt only the reviewed native entry delta at a frozen production commit.
// No main/gh-pages write, merge, or unrelated workbench imports.
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..'),repo=path.resolve(root,'..'),sha='0b4703359efbae10ffc6c0e5fe3fc081e7eca4fe';
const records=[
 ['ENTRY-R04-README.md','15a4939810945453f437b8e32de4a5e83dcc59c4799392810c517dae39c4d411'],
 ['ENTRY-R05-README.md','5043332a6d08579697da18338a176b91d184bea096ec34a82c52f5eea164d4c5'],
 ['boxing-r02.html','9c0545c5a9a2a4bd7b07b081e461dafb19d7cbff04d7d9df03529f62afd0f613'],
 ['full/motion-studio/MotionStudio.mjs','a079b04934b4ddc9360fb5a198a68f7dec4556cfd3046c07409ceec34209c29d'],
 ['full/ui/EntryActions.mjs','fc105add6f8b0fd55e89ff71c2074f089f3fad57d57fd50b59b532107511fee2'],
 ['full/ui/FaceIdentityPresets.mjs','c536e4c1498b3fbba900ce6617c9b1ad04a040ef409a7e4cec87df135098b9b3'],
 ['full/ui/PresetBrowser.mjs','e9a88cc3591eb25f698af4a9ee80b0b1ee8f110660dd7f286f2b7702c77d8785'],
 ['full/ui/browser-app.mjs','864236572e8fc9b42a2f5c5122ef3b4f022e66bc27729f5976b623f4dee228d9'],
 ['full/ui/entry-controls.css','ee17e303f05b03da0706682f893a121e354fafa20afc1034f73112756b44fb34'],
 ['index.html','87cfd761999805ab80e1487d73f0897fe978ffc41cbbb9bc8feeb34948e618f9'],
 ['tests/cold-ring-browser.cjs','5b684ca07450aa48acea0a63df5c0a6b60f757e9ed10d833d882b0a6ad77e637'],
 ['tests/entry-actions.mjs','ae945f576fdcf7af6fadd749e9ee00ed3418db6139a708b5f744dfd3a8a28d00'],
 ['tests/entry-load-readiness.mjs','c1e180475aeb1ff20c5f42b3f3137f9a1196e49124f51a7bb068fd3fbcf9c8f6'],
 ['tests/entry-r04-browser.cjs','b391b2d5581b60d2ae33961a0848008c03445251eb77eec933cd28c3dce76653'],
 ['tests/face-identity-presets.mjs','35a0b934eb4b4e27c33d18442ec298ad988fcf38bfc8aaeaf4205c8885c87297'],
 ['tests/motion-lifecycle.mjs','131cd23e84c3e98d9abff724d22f5b3a4ca7abb6764bfa4434dca03fb60753e2']
];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
cp.execFileSync('git',['fetch','--depth=1','origin',sha],{stdio:'inherit'});
const files=[];
for(const [name,expected]of records){const rel='kaopu-unified-human-workbench/'+name,dest=path.resolve(root,name);assert(dest.startsWith(root+path.sep));const b=cp.execFileSync('git',['show',sha+':'+rel],{maxBuffer:8e6});assert.equal(hash(b),expected,'Native R05 mismatch '+name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,b);files.push({path:rel,sha256:expected,bytes:b.length});}
const report=path.resolve(__dirname,'../NATIVE-R05.json');fs.writeFileSync(report,JSON.stringify({source:sha,previousNative:'2c9c6403815083b731d40051cc1d711cfdd7c34f',scope:'existing native entry, four GNM identity choices and original motion lifecycle; byte-exact files before additive wiring',files},null,2));
// Stage these reviewed paths only. Workflow commits them only after all tests.
cp.execFileSync('git',['add',...files.map(f=>f.path),report],{stdio:'inherit'});
console.log('Reviewed current native entry adopted',sha,files.length);
