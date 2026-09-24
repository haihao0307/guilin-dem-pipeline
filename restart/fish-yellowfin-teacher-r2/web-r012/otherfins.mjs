import * as THREE from 'three';

// Read-only observations over the remaining R005 source patches.
export function installRemainingFinStudy(ctx) {
  const {compiled, meshes, state: fishState, qa, scenes, cam, controls, preset, regionTool, getSurfaces} = ctx;
  const $ = selector => document.querySelector(selector);
  const evidence = $('#otherFinEvidence');
  const data = JSON.parse(evidence.textContent);
  evidence.remove();
  const parts = new Map(regionTool.data.parts.map(part => [part.id, part]));
  const state = {id: 'none', isolated: false, trail: false};

  const panel = document.createElement('div');
  panel.className = 'section';
  panel.id = 'otherFinPanel';
  panel.innerHTML = '<h2>其余原鳍面与鳍根观察 · R012</h2><p class="sub">沿用 R005 候选面片、原索引缝边与作者控制权重。所有名称仍为源观察标签，不代表解剖核准。</p><select id="otherFinSelect" class="w100" aria-label="选择原始鳍面"><option value="none">选择候选原鳍面</option></select><div class="row"><button id="otherFinFocus">定位面片</button><button id="otherFinIsolate">隔离原面片</button></div><div class="row"><button id="otherFinMin">垂向最小样本</button><button id="otherFinMax">垂向最大样本</button></div><div class="row"><button id="otherFinTrail">显示原点轨迹</button><button id="otherFinClear">恢复全鱼</button></div><pre id="otherFinLive">选择面片后显示原源索引、接口、原控制组和 Swim 样本值。</pre><details><summary>源证据与边界</summary><pre id="otherFinSource"></pre><p class="sub">坐标与面积使用标准化源坐标。极值点、接口均值和蒙皮驱动链仅为工程探针，不是鳍角、骨长、受力或物理鱼长。开放边界按源数据显示，不补面。</p></details>';
  $('#pectoralPanel').before(panel);
  for (const definition of data.definitions) {
    const option = document.createElement('option');
    option.value = definition.id;
    option.textContent = definition.label;
    $('#otherFinSelect').append(option);
  }

  function overlay(color, size = 1) {
    const object = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({color, depthTest: false}));
    object.frustumCulled = false;
    object.renderOrder = 52;
    object.visible = false;
    object.userData.size = size;
    scenes[1].add(object);
    return object;
  }
  const edges = overlay(0x76dfd2);
  const rig = overlay(0xbfcdfa);
  const markers = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({color: 0xffc67a, size: 7, sizeAttenuation: false, depthTest: false}));
  markers.frustumCulled = false;
  markers.renderOrder = 54;
  markers.visible = false;
  scenes[1].add(markers);
  const trail = overlay(0xffae67);

  const vector = (surface, index) => new THREE.Vector3().fromArray(surface.p, index * 3);
  const objectPosition = object => new THREE.Vector3().setFromMatrixPosition(object.matrixWorld);
  function fill(object, values) {
    const attribute = object.geometry.getAttribute('position');
    if (attribute && attribute.array.length === values.length) {
      attribute.array.set(values);
      attribute.needsUpdate = true;
    } else {
      object.geometry.dispose();
      object.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(values, 3));
    }
  }
  function axes(matrix) {
    const result = new THREE.Matrix3().setFromMatrix4(matrix);
    const values = result.elements;
    for (let column = 0; column < 3; column++) {
      const norm = Math.hypot(values[column * 3], values[column * 3 + 1], values[column * 3 + 2]);
      for (let row = 0; row < 3; row++) values[column * 3 + row] /= norm;
    }
    return result;
  }
  const restAxes = axes(new THREE.Matrix4().fromArray(data.restBodyMatrix));
  const selected = () => data.definitions.find(definition => definition.id === state.id);
  function measure(definition, surfaces, bodyMatrix) {
    const surface = surfaces[definition.mesh];
    const boundaryVertices = [...new Set(definition.interfaceGroups.flatMap(group => group.positionGroups.map(item => item.sourceVertex)))];
    const interfaceMean = boundaryVertices.map(id => vector(surface, id)).reduce((sum, point) => sum.add(point), new THREE.Vector3()).divideScalar(Math.max(1, boundaryVertices.length));
    const probe = vector(surface, definition.probe.sourceVertex);
    const frame = axes(bodyMatrix).multiply(restAxes.clone().transpose());
    const offset = probe.clone().sub(interfaceMean).applyMatrix3(frame.transpose());
    const part = parts.get(definition.id);
    let area = 0;
    const positions = surface.p;
    for (const face of part.sourceTriangles) {
      const ids = surface.idx.subarray(face * 3, face * 3 + 3);
      const a = ids[0] * 3, b = ids[1] * 3, c = ids[2] * 3;
      const abx = positions[b] - positions[a], aby = positions[b + 1] - positions[a + 1], abz = positions[b + 2] - positions[a + 2];
      const acx = positions[c] - positions[a], acy = positions[c + 1] - positions[a + 1], acz = positions[c + 2] - positions[a + 2];
      const nx = aby * acz - abz * acy, ny = abz * acx - abx * acz, nz = abx * acy - aby * acx;
      area += Math.hypot(nx, ny, nz) * 0.5;
    }
    const interfaceGaps = {};
    let maxGap = 0;
    for (const group of definition.interfaceGroups) {
      let gap = 0;
      for (const edge of group.edges) for (let index = 0; index < 2; index++) {
        gap = Math.max(gap, vector(surface, edge.finVertices[index]).distanceTo(vector(surface, edge.neighborVertices[index])));
      }
      interfaceGaps[group.neighborPart] = gap;
      maxGap = Math.max(maxGap, gap);
    }
    let aliasGap = 0;
    for (const group of definition.interfaceGroups) for (const positionGroup of group.positionGroups) {
      const canonical = vector(surface, positionGroup.sourceVertex);
      for (const alias of positionGroup.sourceAliases) aliasGap = Math.max(aliasGap, canonical.distanceTo(vector(surface, alias)));
    }
    return {
      probe,
      interfaceMean,
      interfaceGaps,
      aliasGap,
      metrics: {
        probeToInterfaceMean: probe.distanceTo(interfaceMean),
        bodyFrameProbeLongitudinal: offset.x,
        bodyFrameProbeVertical: offset.y,
        bodyFrameProbeLateral: offset.z,
        sourcePatchSurfaceArea: area,
        interfaceMaxGap: maxGap,
      },
    };
  }
  function update() {
    const definition = selected();
    const surfaces = getSurfaces();
    if (!definition || !surfaces?.length) return;
    const observation = measure(definition, surfaces, compiled.nodes[data.bodyNode].matrixWorld);
    fill(edges, definition.interfaceEdges.flatMap(edge => edge.finVertices.flatMap(id => vector(surfaces[definition.mesh], id).toArray())));
    const graph = compiled.pkg.objectGraph;
    fill(rig, definition.controlNodes.flatMap(node => {
      const parent = graph[node].parent;
      return parent == null ? [] : [...objectPosition(compiled.nodes[parent]).toArray(), ...objectPosition(compiled.nodes[node]).toArray()];
    }));
    fill(markers, [...observation.interfaceMean.toArray(), ...observation.probe.toArray()]);
    edges.visible = rig.visible = markers.visible = true;
    trail.visible = state.trail;
    qa.otherFinCurrent = {id: definition.id, time: fishState.time, rest: fishState.rest, isolated: state.isolated, sourceVertex: definition.probe.sourceVertex, interfaceGaps: observation.interfaceGaps, metrics: observation.metrics};
    $('#otherFinLive').textContent = `${definition.label}\n${fishState.rest ? '原静息态' : `原 Swim ${fishState.time.toFixed(4)} s`} · ${state.isolated ? '仅显示原面片' : '全鱼观察'}\n源顶点探针 ${definition.probe.sourceVertex}\n到原接口均值 ${observation.metrics.probeToInterfaceMean.toFixed(6)}\n体架垂向位移 ${observation.metrics.bodyFrameProbeVertical.toFixed(6)}\n体架侧向位移 ${observation.metrics.bodyFrameProbeLateral.toFixed(6)}\n原三角面面积 ${observation.metrics.sourcePatchSurfaceArea.toFixed(6)}\n最大接口间距 ${observation.metrics.interfaceMaxGap.toExponential(2)}\n原接口邻面 ${Object.entries(observation.interfaceGaps).map(([name, gap]) => `${name}: ${gap.toExponential(2)}`).join(' · ')}`;
  }
  function hide() {
    const wasIsolated = state.isolated;
    state.id = 'none';
    state.isolated = false;
    $('#otherFinSelect').value = 'none';
    $('#otherFinIsolate').classList.remove('active');
    for (const object of [edges, rig, markers, trail]) object.visible = false;
    qa.otherFinEnabled = false;
    if (wasIsolated) regionTool.restore();
  }
  function choose(id) {
    if (id === 'none') return clear();
    if (!parts.has(id) || !data.definitions.some(definition => definition.id === id)) throw new Error('Unknown source fin patch');
    ctx.clearOther();
    regionTool.restore();
    window.FISH_CANONICAL.choose(-1);
    state.id = id;
    state.isolated = false;
    $('#otherFinSelect').value = id;
    $('#otherFinIsolate').classList.remove('active');
    qa.otherFinEnabled = true;
    regionTool.choose(id);
    const definition = selected();
    $('#otherFinSource').textContent = JSON.stringify({
      id: definition.id,
      sourceTriangles: definition.sourceTriangles.length,
      sourceVertexIndices: definition.sourceVertices.length,
      probe: definition.probe,
      sourceInterfaces: definition.interfaceGroups.map(group => ({neighborPart: group.neighborPart, sourceEdges: group.edges.length, exactPositionGroups: group.positionGroups.length, aliasesPreserved: true})),
      sourceControlSupport: definition.sourceControlSupport,
      controlNodeCount: definition.controlNodes.length,
      sampledTimes: data.samples.length,
      naturalAnatomyApproved: false,
      physicalLengthKnown: false,
    }, null, 2);
    fill(trail, data.samples.slice(1).flatMap((sample, index) => [...sample.patches[data.definitions.indexOf(definition)].probe, ...data.samples[index].patches[data.definitions.indexOf(definition)].probe]));
    update();
  }
  function focus() {
    if (state.id === 'none') choose(data.definitions[0].id);
    regionTool.focus();
  }
  function isolate() {
    if (state.id === 'none') choose(data.definitions[0].id);
    state.isolated = !state.isolated;
    regionTool.selection.isolate = state.isolated;
    regionTool.choose(state.id);
    $('#otherFinIsolate').classList.toggle('active', state.isolated);
    update();
  }
  function peak(kind) {
    if (state.id === 'none') choose(data.definitions[0].id);
    const definition = selected();
    const index = definition.summary.bodyFrameProbeVertical[`${kind}Index`];
    ctx.jumpExact(data.samples[index].time);
    $('#time').value = fishState.time;
    $('#timeLabel').textContent = `${fishState.time.toFixed(3)} s · 源样本`;
    qa.otherFinSelectedSample = {kind, id: definition.id, index, key: 'bodyFrameProbeVertical'};
    focus();
    update();
  }
  function clear() {
    hide();
    regionTool.restore();
    window.FISH_CANONICAL.choose(-1);
    preset('side');
  }
  function audit() {
    const previous = state.id;
    hide();
    let pointError = 0, matrixError = 0, areaError = 0, measureError = 0, seamError = 0, aliasError = 0;
    const jointNodes = compiled.pkg.skeletonGraphs[0].jointNodes;
    ctx.beginExact();
    try {
      for (const sample of [data.restSample, ...data.samples]) {
        ctx.seekExact(sample.time ?? 0, sample.rest);
        for (let runtime = 0; runtime < 2; runtime++) {
          const bone = id => runtime === 0 ? meshes[0][0].skeleton.bones[jointNodes.indexOf(id)] : compiled.nodes[id];
          const surfaces = runtime === 0 ? ctx.readSurface(0) : getSurfaces();
          for (const item of sample.controlMatrices) item.matrix.forEach((value, index) => { matrixError = Math.max(matrixError, Math.abs(value - bone(item.node).matrixWorld.elements[index])); });
          for (let index = 0; index < data.definitions.length; index++) {
            const definition = data.definitions[index];
            const observation = measure(definition, surfaces, bone(data.bodyNode).matrixWorld);
            const expected = sample.patches[index];
            pointError = Math.max(pointError, observation.probe.distanceTo(new THREE.Vector3().fromArray(expected.probe)), observation.interfaceMean.distanceTo(new THREE.Vector3().fromArray(expected.interfaceMean)));
            for (const [neighbor, gap] of Object.entries(observation.interfaceGaps)) seamError = Math.max(seamError, Math.abs(gap - expected.interfaceGaps[neighbor]));
            aliasError = Math.max(aliasError, observation.aliasGap);
            for (const [key, value] of Object.entries(observation.metrics)) {
              const error = Math.abs(value - expected.metrics[key]);
              if (key === 'sourcePatchSurfaceArea') areaError = Math.max(areaError, error);
              else measureError = Math.max(measureError, error);
            }
          }
        }
      }
    } finally {
      ctx.endExact();
      state.id = previous;
      if (previous !== 'none') update();
    }
    return {
      restSamples: 1,
      clampedTimes: data.samples.length,
      comparedRuntimes: 2,
      patches: data.qa.patchIds,
      sourceTriangles: data.qa.sourceTriangles,
      controlContextNodes: data.qa.controlContextNodes,
      sourceTracks: data.qa.sourceTracks,
      pointMaxError: pointError,
      matrixMaxError: matrixError,
      measureMaxError: measureError,
      surfaceAreaMaxError: areaError,
      interfaceMaxError: seamError,
      aliasMaxGap: aliasError,
      lengthTolerance: 1e-6,
      areaTolerance: 1e-8,
      passed: Math.max(pointError, matrixError, measureError, seamError, aliasError) < 1e-6 && areaError < 1e-8,
      mirroredPatchesCreated: false,
      anatomicalApproval: false,
    };
  }

  $('#otherFinSelect').onchange = event => choose(event.target.value);
  $('#otherFinFocus').onclick = focus;
  $('#otherFinIsolate').onclick = isolate;
  $('#otherFinMin').onclick = () => peak('min');
  $('#otherFinMax').onclick = () => peak('max');
  $('#otherFinTrail').onclick = () => {
    if (state.id === 'none') choose(data.definitions[0].id);
    state.trail = !state.trail;
    $('#otherFinTrail').classList.toggle('active', state.trail);
    update();
  };
  $('#otherFinClear').onclick = clear;
  for (const selector of ['#tailSelect', '#pectoralSelect', '#featureSelect', '#headSelect', '#regionSelect', '#groupSelect', '#jointSelect', '#interfaceSelect']) $(selector)?.addEventListener('change', () => { if (state.id !== 'none') hide(); }, true);
  for (const selector of ['#tailFocus', '#tailMin', '#tailMax', '#tailClear', '#pectoralFocus', '#pectoralMin', '#pectoralMax', '#pectoralClear', '#oralShow', '#oralMin', '#oralMax', '#oralFront', '#oralClear', '#headFocus', '#headPeak', '#headClear', '#featureMin', '#featureMax', '#featureFocus', '#featureClear', '#regionClear', '#boundaryClear', '#reset']) $(selector)?.addEventListener('click', () => { if (state.id !== 'none') hide(); }, true);
  qa.otherFinStudy = data.qa;
  qa.otherFinEnabled = false;
  const api = {data, state, choose, hide, clear, focus, isolate, peak, update, audit};
  window.FISH_OTHER_FINS = api;
  return api;
}

