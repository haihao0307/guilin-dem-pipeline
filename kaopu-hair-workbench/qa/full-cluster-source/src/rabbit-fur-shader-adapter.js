/* Candidate-only appearance adapter. The pinned SEDDI source files stay byte-identical. */
'use strict';

// A bounded alpha-mask remap changes the apparent width/coverage of an existing
// strand or tuft. It creates no geometry, follicles, noise or texture assets.
// Keep the width=1 path algebraically identical, including unclamped source alpha.
function transformRabbitFurFragmentSource(source, kind) {
  const helper = '\nuniform float rabbitMaskWidth;\n' +
    'float rabbitRemapFurMask(float sourceMask) {\n' +
    '  if (rabbitMaskWidth == 1.0) return sourceMask;\n' +
    '  return pow(clamp(sourceMask, 0.0, 1.0), 1.0 / clamp(rabbitMaskWidth, 0.5, 1.8));\n' +
    '}\n';
  const precision = /precision\s+(?:highp|mediump)\s+float\s*;/;
  const anchor = kind === 'ShellShader'
    ? 'fragColor.a *= alphaColor;'
    : kind === 'FinShader' ? 'alpha*texture(alphaMap,outTextCoord).r' : null;
  const replacement = kind === 'ShellShader'
    ? 'fragColor.a *= rabbitRemapFurMask(alphaColor);'
    : 'alpha*rabbitRemapFurMask(texture(alphaMap,outTextCoord).r)';
  if (typeof source !== 'string' || !anchor || !precision.test(source) ||
      source.split(anchor).length !== 2 || source.includes('rabbitRemapFurMask')) {
    throw Error('Rabbit appearance adapter does not match the pinned ' + kind + ' source');
  }
  return source.replace(precision, match => match + helper).replace(anchor, replacement);
}

function installRabbitFurShaderAdapter({role, getModule, getGL}) {
  let width = 1;
  // Do not even resolve the teacher's shader classes through this adapter.
  if (role !== 'candidate') return Object.freeze({getWidth: () => 1, setWidth: () => 1});
  const bound = value => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < .5 || value > 1.8) {
      throw Error('遮罩视觉粗细必须在 0.5–1.8 之间');
    }
    return value;
  };
  for (const kind of ['ShellShader', 'FinShader']) {
    const Shader = getModule(kind);
    const originalCode = Shader.prototype.fillCode;
    const originalUniforms = Shader.prototype.fillUniformsAttributes;
    const originalUse = Shader.prototype.use;
    Shader.prototype.fillCode = function (...args) {
      originalCode.apply(this, args);
      this.fragmentShaderCode = transformRabbitFurFragmentSource(this.fragmentShaderCode, kind);
    };
    Shader.prototype.fillUniformsAttributes = function (...args) {
      originalUniforms.apply(this, args);
      this.rabbitMaskWidth = this.getUniform('rabbitMaskWidth');
      if (this.rabbitMaskWidth === null) throw Error(kind + ' appearance uniform is unavailable');
      getGL().uniform1f(this.rabbitMaskWidth, width);
    };
    Shader.prototype.use = function (...args) {
      const result = originalUse.apply(this, args);
      if (this.program) getGL().uniform1f(this.rabbitMaskWidth, width);
      return result;
    };
  }
  return Object.freeze({getWidth: () => width, setWidth: value => (width = bound(value))});
}
