/* Candidate-only R13 side-light transfer. No pinned SEDDI file is modified. */
(function (root) {
  'use strict';
  const S = root.StudioLighting || (typeof require === 'function' ? require('./studio-lighting.js') : null);
  if (!S) throw Error('StudioLighting must load before the rabbit lighting adapter');
  const kinds = ['ShellShader', 'FinShader', 'DiffuseColoredShader'];
  const installed = new WeakSet();

  function transformRabbitLightingSources(vertex, fragment, kind) {
    if (!kinds.includes(kind) || typeof vertex !== 'string' || typeof fragment !== 'string' || fragment.includes('r13SideLighting') || vertex.includes('rabbitRigPosition')) throw Error('Rabbit lighting adapter source or shader kind is invalid');
    // Vertex positions remain byte-for-byte in the original gl_Position path.
    // Undo only the view transform, retain object rotation, and normalize size.
    // Mapping engine [z,x,y] to R13 [x,y,z]: p=.yzx; inverse direction map=.zxy.
    // Orbit rotates geometry, never either world-fixed lamp's orientation.
    const declarations = '\nuniform highp vec3 r13Center;\nuniform highp float r13Radius;\nout highp vec3 rabbitRigPosition;\n';
    const version = vertex.match(/^#version 300 es\r?\n/);
    if (!version) throw Error('Rabbit lighting adapter requires the pinned GLSL ES 3 vertex shader');
    vertex = S.once(vertex, version[0], version[0] + declarations, kind + ' version');
    const position = kind === 'DiffuseColoredShader' ? 'vPos =  (view_model_matrix * rm_Vertex).xyz;' : 'vPos =  (view_model_matrix * vertex).xyz;';
    const sourceVertex = kind === 'DiffuseColoredShader' ? 'rm_Vertex' : 'vertex';
    vertex = S.once(vertex, position, position + `
    mat4 rabbitWorldMatrix = inverse(view_matrix) * view_model_matrix;
    vec3 rabbitWorld = (rabbitWorldMatrix * ${sourceVertex}).xyz;
    vec3 rabbitCenterWorld = (rabbitWorldMatrix * vec4(r13Center, 1.0)).xyz;
    float rabbitWorldRadius = r13Radius * length(rabbitWorldMatrix[0].xyz);
    rabbitRigPosition = (rabbitWorld - rabbitCenterWorld).yzx / max(rabbitWorldRadius, 1e-5);
`, kind + ' vertex position');
    fragment = S.afterPrecision(fragment, '\nin highp vec3 rabbitRigPosition;\nuniform highp mat4 view_matrix;\n' + S.glsl, kind + ' fragment');
    const skin = kind === 'DiffuseColoredShader', functionName = skin ? 'computePointLight' : 'computeHairLighting';
    fragment = S.once(fragment, 'vec4 ' + functionName + '() {', 'vec4 rabbitLegacyLighting() {', kind + ' legacy function');
    // Keep each source's hair response: shell uses combed hairNormal; fin's
    // pinned Kajiya variant uses N as T. Do not silently repair/reinterpret it.
    const normal = kind === 'ShellShader' ? 'normal' : 'finNormal';
    const tangent = kind === 'ShellShader' ? 'hairNormal' : 'finNormal';
    const direct = skin ? `
    vec3 halfwayDir = normalize(L - V);
    float lambertian = Ps * max(dot(N, L), 0.0);
    float spec = Ks * Ps * pow(max(dot(N, halfwayDir), 0.0), shininess);
    color += (Kd * lambertian + vec3(spec)) * E * r13DisplayGain;
` : `
    vec3 H = normalize(L + V);
    float kajiyaV = clamp(dot(T, H), -1.0, 1.0);
    vec3 direct = clamp(Kd * dot(N, L), 0.0, 1.0)
      + clamp(dot(N, L), 0.0, 1.0) * Ks * pow(sin(acos(kajiyaV)), Ps);
    color += direct * E * r13DisplayGain;
`;
    fragment += `
vec4 ${functionName}() {
  if (r13LightingMode == 0) return rabbitLegacyLighting();
  highp vec3 N = normalize(${normal}), V = normalize(-vPos);
  ${skin ? '' : 'highp vec3 T = normalize(' + tangent + ');'}
  // Ambient is evaluated ONCE, independently of lamp count and power.
  vec3 color = ${skin ? 'Pa * Ka * lightColor' : 'Sa * Ka'};
  for (int lamp = 0; lamp < 2; lamp++) {
    highp vec3 rigL, E;
    r13SideLamp(lamp, rabbitRigPosition, rigL, E);
    vec3 L = normalize(mat3(view_matrix) * rigL.zxy);
    ${direct}
  }
  // Preserve the source intensity/alpha behavior. Source AO and masks execute
  // afterward, exactly where the pinned source applied them.
  return vec4(color, 1.0) * intensity;
}
`;
    return {vertexShaderCode: vertex, fragmentShaderCode: fragment};
  }

  function installRabbitLightingAdapter({role, getModule, getGL, getMesh, modelAssets, initialState = S.DEFAULTS}) {
    // Teacher isolation is deliberately before module/GL/model resolution.
    if (role !== 'candidate') return Object.freeze({getState: () => ({...S.LEGACY}), setState: () => ({...S.LEGACY}), patch: () => ({...S.LEGACY})});
    if (typeof getModule !== 'function' || typeof getGL !== 'function' || typeof getMesh !== 'function' || !modelAssets) throw Error('Rabbit lighting adapter needs module, GL, mesh and source assets');
    const controller = S.createController(initialState), boundsCache = new Map();
    const sourceBounds = () => {
      const mesh = getMesh();
      if (!['rabbit', 'cloth'].includes(mesh)) throw Error('Unsupported rabbit lighting mesh: ' + mesh);
      if (!boundsCache.has(mesh)) {
        const path = mesh === 'rabbit' ? 'data/models/bunnyUV.json' : 'data/models/cloth.json';
        boundsCache.set(mesh, S.boundsFromModelJSON(modelAssets[path]));
      }
      return boundsCache.get(mesh);
    };
    const shaders = kinds.map(kind => ({kind, Shader: getModule(kind)}));
    // Preflight the full set before patching the first prototype.
    for (const {kind, Shader} of shaders) if (!Shader?.prototype || installed.has(Shader) || typeof Shader.prototype.fillCode !== 'function' || typeof Shader.prototype.fillUniformsAttributes !== 'function' || typeof Shader.prototype.use !== 'function') throw Error('Rabbit lighting adapter cannot install ' + kind);
    for (const {kind, Shader} of shaders) {
      const fillCode = Shader.prototype.fillCode, fillUniforms = Shader.prototype.fillUniformsAttributes, use = Shader.prototype.use;
      Shader.prototype.fillCode = function (...args) {
        fillCode.apply(this, args);
        Object.assign(this, transformRabbitLightingSources(this.vertexShaderCode, this.fragmentShaderCode, kind));
      };
      Shader.prototype.fillUniformsAttributes = function (...args) {
        fillUniforms.apply(this, args);
        for (const name of ['r13LightingMode', 'r13Powers', 'r13Center', 'r13Radius']) if (this.getUniform(name) === null) throw Error(kind + ' missing lighting uniform ' + name);
        S.bindUniforms(getGL(), this.program, controller.getState(), sourceBounds());
      };
      Shader.prototype.use = function (...args) {
        const result = use.apply(this, args);
        if (this.program) S.bindUniforms(getGL(), this.program, controller.getState(), sourceBounds());
        return result;
      };
      installed.add(Shader);
    }
    return Object.freeze({...controller, getBounds: () => S.validateBounds(sourceBounds())});
  }
  const api = Object.freeze({transformRabbitLightingSources, installRabbitLightingAdapter});
  root.RabbitLightingAdapter = api;
  root.installRabbitLightingAdapter = installRabbitLightingAdapter;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
