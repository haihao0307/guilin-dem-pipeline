(() => {
  const prototype = globalThis.WebGL2RenderingContext?.prototype;
  if (!prototype || prototype.__guilinReferenceShaderFix221) return;
  const original = prototype.shaderSource;
  prototype.shaderSource = function shaderSourceWithGuilinReferenceFix(shader, source) {
    let patched = source;
    if (typeof patched === 'string' && patched.includes('uCandidate==1') && patched.includes(',flat=1.-smoothstep')) {
      patched = patched
        .replace(',flat=1.-smoothstep', ',flatness=1.-smoothstep')
        .replace('flat*hy.a', 'flatness*hy.a');
    }
    return original.call(this, shader, patched);
  };
  prototype.__guilinReferenceShaderFix221 = true;
})();
