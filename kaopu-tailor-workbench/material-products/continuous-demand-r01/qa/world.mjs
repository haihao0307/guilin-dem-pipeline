import fs from'node:fs';import zlib from'node:zlib';import path from'node:path';import{fileURLToPath,pathToFileURL}from'node:url';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function createWorld(variant='candidate',inputPath='qa/input.json'){
 const directory=path.join(root,variant),{BodySDF}=await import(pathToFileURL(path.join(directory,'material-physics.mjs'))),{CoupledCloth}=await import(pathToFileURL(path.join(directory,'coupled-cloth.mjs'))),{accelerateWorld,loadClothKernel}=await import(pathToFileURL(path.join(directory,'wasm-cloth.mjs')));
 const input=JSON.parse(fs.readFileSync(path.join(root,inputPath))),meta=JSON.parse(fs.readFileSync(path.join(directory,'assets/body-sdf-grid.json'))),raw=zlib.gunzipSync(fs.readFileSync(path.join(directory,'assets/common-body.sdfd.gz'))),sdf=new BodySDF(meta,new Int16Array(raw.buffer,raw.byteOffset,raw.byteLength/2),input.lock.groundShiftM);
 return accelerateWorld(new CoupledCloth(input.rows.map(r=>({...r,positions:Float32Array.from(r.positions)})),{sdf,actor:input.actor,settings:input.settings}),await loadClothKernel(fs.readFileSync(path.join(directory,'cloth-kernel.wasm'))));
}
