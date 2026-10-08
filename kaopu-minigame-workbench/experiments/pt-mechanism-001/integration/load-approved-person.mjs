import {attachCommonPerson} from './CommonPersonSceneAdapter.mjs';
export const APPROVED_PERSON=Object.freeze({
  sourceCommit:'be719199ac33fac351a798e8afea51a0ee6d214e',
  base:'https://haihao0307.github.io/guilin-dem-pipeline/kaopu-unified-human-workbench/full/',
  topologySha256:'e8526431b9b24bec71d8161ed409794a8398ffc68ad25800abb27e0fc09644de',
  adapterFingerprint:'4ac1f6b9ffac5ab45d1a427a1eb5e9578af0e7f105d58bff4d48555e4e2027a5',
  vertices:25417,triangles:50624
});
/** Load the existing approved production runtime on demand. No fallback person. */
export async function loadApprovedPerson({THREE,scene,signal,onProgress=()=>{},requestRender=()=>{}}){
  const alive=()=>{if(signal?.aborted)throw new DOMException('Load cancelled','AbortError');};
  const base=APPROVED_PERSON.base;
  const [loader,stateModule,skinModule]=await Promise.all([
    import(base+'ui/load-common.mjs?v=characters-r02-20261008'),
    import(base+'src/State.mjs?v=human-r2-20261008'),
    import(base+'ui/skin/CommonSkinLayer.mjs?v=presets-r01-20261008')
  ]);alive();
  const loaded=await loader.loadCommon({signal,onProgress,base:new URL(base)});alive();
  const m=loaded.metadata;
  if(m.topologySha256!==APPROVED_PERSON.topologySha256||m.adapterFingerprint!==APPROVED_PERSON.adapterFingerprint||m.vertices!==APPROVED_PERSON.vertices||m.triangles!==APPROVED_PERSON.triangles)
    throw Error('现有人物版本与已核锚点不同，已停止装配，请先重新核对版本。');
  loaded.model.compute(stateModule.defaultState());alive();
  const adapter=attachCommonPerson({THREE,scene,model:loaded.model,SkinLayer:skinModule.CommonSkinLayer,requestRender,position:[-1.65,0,-3.65]});
  return {adapter,metadata:m,source:APPROVED_PERSON};
}
