(() => {
'use strict';
const base = window.LandscapeMotherKernel;
if (!base) throw new Error('Landscape Mother V1 kernel is missing');

function compile(options) {
  const compiled = base.compile(options);
  compiled.runtimeVersion = '2.0.0';
  compiled.fieldGraphVersion = compiled.receipt.fieldGraphVersion || '1.0.0';
  compiled.knowledgeArchiveSha256 = options.contract.knowledgeIntegration?.proceduralFieldMini?.archiveSha256 || null;
  compiled.qualityTiers = Object.freeze({ ...(options.contract.runtimeTiers || {}) });
  return compiled;
}

window.LandscapeMotherKernel = Object.freeze({
  version: '2.0.0',
  compile,
});
})();
