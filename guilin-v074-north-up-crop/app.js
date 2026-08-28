(() => {
  'use strict';

  const Geo = window.GuilinGeo;
  if (!Geo) throw new Error('GuilinGeo is required');

  const $ = id => document.getElementById(id);
  const query = new URLSearchParams(window.location.search);
  const selfTestMode = query.get('qa') === '1';
  const fixtureMode = query.get('fixture') === '1';
  const runtimeErrors = [];
  const listeners = [];
  let toastTimer = null;

  window.addEventListener('error', event => {
    runtimeErrors.push({ type: 'error', message: event.message || String(event.error || 'unknown error') });
  });
  window.addEventListener('unhandledrejection', event => {
    runtimeErrors.push({ type: 'unhandledrejection', message: String(event.reason || 'unknown rejection') });
  });

  const state = {
    manifest: null,
    footprints: null,
    footprintRings: [],
    landmarks: [],
    aoiStatus: null,
    runtimeContract: null,
    hydrology: null,
    hydrologyLoading: false,
    image: null,
    imageReady: false,
    imageFailed: false,
    imageUrl: null,
    imageWidth: 8192,
    imageHeight: 8879,
    viewportWidth: 1,
    viewportHeight: 1,
    dpr: 1,
    view: { scale: 1, tx: 0, ty: 0, minScale: 0.01, maxScale: 2 },
    mode: 'pan',
    aoi: null,
    aoiKind: null,
    polygonDraft: [],
    rectangleDraft: null,
    activePointer: null,
    editIndex: null,
    isDragging: false,
    layers: {
      footprints: false,
      nodata: true,
      rivers: false,
      landmarks: true,
      scale: false,
    },
  };

  const terrainCanvas = $('terrainCanvas');
  const vectorCanvas = $('vectorCanvas');
  const viewport = $('mapViewport');
  const terrainContext = terrainCanvas.getContext('2d', { alpha: true });
  const vectorContext = vectorCanvas.getContext('2d', { alpha: true });

  function on(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  }

  function showToast(message, error = false) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.toggle('error', error);
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
  }

  async function fetchJson(url, timeoutMs = 60000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error(`${url} returned ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchFirstJson(candidates) {
    const failures = [];
    for (const candidate of candidates) {
      try {
        return { data: await fetchJson(candidate), url: candidate };
      } catch (error) {
        failures.push(`${candidate}: ${error.message}`);
      }
    }
    throw new Error(failures.join(' | '));
  }

  function makeQaPreviewDataUrl() {
    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 1040;
    const context = canvas.getContext('2d');
    const gradient = context.createLinearGradient(0, canvas.height, canvas.width, 0);
    gradient.addColorStop(0, '#f4e7a0');
    gradient.addColorStop(0.22, '#bdd69a');
    gradient.addColorStop(0.48, '#76ab78');
    gradient.addColorStop(0.72, '#547f65');
    gradient.addColorStop(1, '#d9d3ae');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.globalAlpha = 0.28;
    for (let y = -100; y < canvas.height + 100; y += 48) {
      context.beginPath();
      for (let x = -80; x < canvas.width + 80; x += 12) {
        const ridge = Math.sin((x + y * 0.62) * 0.023) * 23 + Math.sin((x - y) * 0.009) * 34;
        const py = y + ridge;
        if (x === -80) context.moveTo(x, py);
        else context.lineTo(x, py);
      }
      context.strokeStyle = y % 96 === 0 ? '#fff8d6' : '#244d3b';
      context.lineWidth = y % 96 === 0 ? 8 : 4;
      context.stroke();
    }
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'destination-out';
    context.beginPath();
    context.ellipse(115, 125, 72, 92, -0.2, 0, Math.PI * 2);
    context.ellipse(810, 860, 95, 120, 0.25, 0, Math.PI * 2);
    context.ellipse(885, 170, 70, 58, 0, 0, Math.PI * 2);
    context.fill();
    context.globalCompositeOperation = 'source-over';
    return canvas.toDataURL('image/png');
  }

  async function loadImageCandidates(candidates) {
    const urls = fixtureMode ? [makeQaPreviewDataUrl()] : candidates;
    const failures = [];
    for (const url of urls) {
      const image = new Image();
      if (!url.startsWith('data:')) image.crossOrigin = 'anonymous';
      const loaded = await new Promise(resolve => {
        let settled = false;
        const finish = value => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(value);
        };
        const timer = setTimeout(() => {
          image.src = '';
          finish(false);
        }, 60000);
        image.onload = () => finish(true);
        image.onerror = () => finish(false);
        image.src = url;
      });
      if (loaded) {
        state.image = image;
        state.imageReady = true;
        state.imageFailed = false;
        state.imageUrl = url;
        return;
      }
      failures.push(url);
    }
    state.imageReady = false;
    state.imageFailed = true;
    state.imageUrl = null;
    throw new Error(`DEM 预览读取失败：${failures.join('、')}`);
  }

  function validateContracts() {
    const source = state.manifest?.source_dem;
    const contract = state.runtimeContract;
    const aoi = state.aoiStatus;
    if (state.manifest?.schema !== 'guilin-v074-north-up-crop/v1') throw new Error('mosaic manifest schema mismatch');
    if (source?.file !== 'guilin_raw_union_12_5m.tif') throw new Error('source filename mismatch');
    if (source?.sha256 !== '9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4') throw new Error('source hash mismatch');
    if (source?.crs !== 'EPSG:32649' || source?.resolution_m?.[0] !== 12.5 || source?.resolution_m?.[1] !== 12.5) throw new Error('source grid contract mismatch');
    if (source?.crop_applied !== false || source?.gap_fill_applied !== false) throw new Error('raw union must stay uncropped and unfilled');
    if (contract?.north_up !== true || contract?.rotation_allowed !== false || contract?.perspective_allowed !== false) throw new Error('north-up lock contract mismatch');
    if (contract?.source_dem_read_only !== true || contract?.nodata_fill_allowed !== false || contract?.active_30m_dem_allowed !== false) throw new Error('truth policy mismatch');
    if (aoi?.status !== 'UNCONFIRMED' || aoi?.accepted !== false || aoi?.distillation_allowed !== false) throw new Error('AOI gate mismatch');
  }

  function formatInteger(value) {
    return new Intl.NumberFormat('zh-Hant').format(value);
  }

  function formatPercent(value) {
    return `${(value * 100).toFixed(3)}%`;
  }

  function populateSourcePanel() {
    const source = state.manifest.source_dem;
    $('sourceCount').textContent = `${state.footprints.features.length} 張`;
    $('sourceCrs').textContent = source.crs;
    $('sourceGrid').textContent = `${formatInteger(source.grid[0])} × ${formatInteger(source.grid[1])}`;
    $('sourceCoverage').textContent = formatPercent(source.valid_fraction);
    $('sourceElevation').textContent = `${formatInteger(source.elevation_range_m[0])} 至 ${formatInteger(source.elevation_range_m[1])} m`;
    $('sourceHash').textContent = source.sha256;
    $('aoiState').textContent = state.aoiStatus.status;
  }

  function prepareFootprints() {
    state.footprintRings = state.footprints.features.map(feature => ({
      properties: feature.properties,
      ring: Geo.ringWgs84ToUtm(feature.geometry.coordinates[0]),
    }));
  }

  function prepareLandmarks() {
    const offsets = {
      zhenbaoding: [0, -18],
      guilin: [76, -22],
      yangtang: [-72, 34],
      yangshuo: [0, 36],
    };
    state.landmarks = Object.entries(state.landmarksSource).map(([id, item]) => {
      const utm = Geo.forward(item.lon, item.lat);
      return { id, ...item, utm, offset: offsets[id] || [0, -18] };
    });
    const layer = $('landmarkLayer');
    layer.replaceChildren();
    for (const landmark of state.landmarks) {
      const element = document.createElement('div');
      element.className = 'landmark-label';
      element.dataset.landmarkId = landmark.id;
      element.dataset.coordinateLines = '1';
      element.setAttribute('role', 'note');
      element.setAttribute('aria-label', `${landmark.name}，东经 ${landmark.lon.toFixed(6)} 度，北纬 ${landmark.lat.toFixed(6)} 度`);
      const name = document.createElement('span');
      name.className = 'landmark-name';
      name.textContent = landmark.name;
      const coordinate = document.createElement('span');
      coordinate.className = 'landmark-coordinate';
      coordinate.textContent = `E ${landmark.lon.toFixed(6)}° · N ${landmark.lat.toFixed(6)}°`;
      element.append(name, coordinate);
      layer.append(element);
      landmark.element = element;
    }
  }

  function resizeCanvas() {
    const rect = viewport.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const previousWidth = state.viewportWidth;
    const previousHeight = state.viewportHeight;
    state.viewportWidth = width;
    state.viewportHeight = height;
    state.dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    for (const canvas of [terrainCanvas, vectorCanvas]) {
      canvas.width = Math.round(width * state.dpr);
      canvas.height = Math.round(height * state.dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    terrainContext.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    vectorContext.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    if (previousWidth <= 1 || previousHeight <= 1) fitUnion(false);
    else {
      const centerImage = screenToImage([previousWidth / 2, previousHeight / 2]);
      state.view.tx = width / 2 - centerImage[0] * state.view.scale;
      state.view.ty = height / 2 - centerImage[1] * state.view.scale;
      constrainView();
      requestRender();
    }
  }

  function fitUnion(announce = true) {
    const padding = Math.max(22, Math.min(state.viewportWidth, state.viewportHeight) * 0.045);
    const scale = Math.min(
      (state.viewportWidth - padding * 2) / state.imageWidth,
      (state.viewportHeight - padding * 2) / state.imageHeight,
    );
    state.view.minScale = scale * 0.72;
    state.view.maxScale = scale * 28;
    state.view.scale = scale;
    state.view.tx = (state.viewportWidth - state.imageWidth * scale) / 2;
    state.view.ty = (state.viewportHeight - state.imageHeight * scale) / 2;
    requestRender();
    if (announce) showToast('已回到完整联合 DEM 范围');
  }

  function constrainView() {
    const margin = Math.min(state.viewportWidth, state.viewportHeight) * 0.28;
    const mapWidth = state.imageWidth * state.view.scale;
    const mapHeight = state.imageHeight * state.view.scale;
    const minTx = state.viewportWidth - mapWidth - margin;
    const maxTx = margin;
    const minTy = state.viewportHeight - mapHeight - margin;
    const maxTy = margin;
    if (mapWidth <= state.viewportWidth) state.view.tx = (state.viewportWidth - mapWidth) / 2;
    else state.view.tx = Math.max(minTx, Math.min(maxTx, state.view.tx));
    if (mapHeight <= state.viewportHeight) state.view.ty = (state.viewportHeight - mapHeight) / 2;
    else state.view.ty = Math.max(minTy, Math.min(maxTy, state.view.ty));
  }

  function imageToScreen(point) {
    return [state.view.tx + point[0] * state.view.scale, state.view.ty + point[1] * state.view.scale];
  }

  function screenToImage(point) {
    return [(point[0] - state.view.tx) / state.view.scale, (point[1] - state.view.ty) / state.view.scale];
  }

  function utmToScreen(point) {
    const source = state.manifest.source_dem;
    return imageToScreen(Geo.utmToImage(point, source.bounds_epsg32649, state.imageWidth, state.imageHeight));
  }

  function screenToUtm(point, clamp = false) {
    const image = screenToImage(point);
    if (clamp) {
      image[0] = Math.max(0, Math.min(state.imageWidth, image[0]));
      image[1] = Math.max(0, Math.min(state.imageHeight, image[1]));
    }
    return Geo.imageToUtm(image, state.manifest.source_dem.bounds_epsg32649, state.imageWidth, state.imageHeight);
  }

  function requestRender() {
    if (state.renderPending) return;
    state.renderPending = true;
    requestAnimationFrame(() => {
      state.renderPending = false;
      render();
    });
  }

  function drawCheckerboard(context, x, y, width, height) {
    context.save();
    context.beginPath();
    context.rect(x, y, width, height);
    context.clip();
    context.fillStyle = '#e6eae5';
    context.fillRect(x, y, width, height);
    const size = 18;
    context.fillStyle = '#d6ddd7';
    const startX = Math.floor(x / size) * size;
    const startY = Math.floor(y / size) * size;
    for (let row = 0, py = startY; py < y + height + size; row += 1, py += size) {
      for (let column = 0, px = startX; px < x + width + size; column += 1, px += size) {
        if ((row + column) % 2 === 0) context.fillRect(px, py, size, size);
      }
    }
    context.restore();
  }

  function renderTerrain() {
    const context = terrainContext;
    const width = state.viewportWidth;
    const height = state.viewportHeight;
    context.clearRect(0, 0, width, height);
    const x = state.view.tx;
    const y = state.view.ty;
    const mapWidth = state.imageWidth * state.view.scale;
    const mapHeight = state.imageHeight * state.view.scale;
    if (state.layers.nodata) drawCheckerboard(context, x, y, mapWidth, mapHeight);
    if (state.imageReady && state.image) {
      context.save();
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(state.image, x, y, mapWidth, mapHeight);
      context.restore();
    } else {
      context.save();
      context.fillStyle = 'rgba(255, 254, 249, 0.76)';
      context.fillRect(x, y, mapWidth, mapHeight);
      context.fillStyle = state.imageFailed ? '#9c4f48' : '#53635a';
      context.font = '700 13px system-ui, sans-serif';
      context.textAlign = 'center';
      context.fillText(state.imageFailed ? 'DEM 预览读取失败' : '正在读取 DEM 预览', x + mapWidth / 2, y + mapHeight / 2);
      context.restore();
    }
    context.save();
    context.strokeStyle = 'rgba(31, 56, 44, 0.55)';
    context.lineWidth = 1;
    context.strokeRect(x + 0.5, y + 0.5, mapWidth - 1, mapHeight - 1);
    context.restore();
  }

  function pathRing(context, ring) {
    if (!ring || ring.length === 0) return;
    const first = utmToScreen(ring[0]);
    context.moveTo(first[0], first[1]);
    for (let index = 1; index < ring.length; index += 1) {
      const point = utmToScreen(ring[index]);
      context.lineTo(point[0], point[1]);
    }
    context.closePath();
  }

  function renderFootprints(context) {
    if (!state.layers.footprints) return;
    context.save();
    context.strokeStyle = 'rgba(165, 104, 24, 0.84)';
    context.fillStyle = 'rgba(212, 153, 56, 0.055)';
    context.lineWidth = 1.2;
    context.setLineDash([6, 5]);
    for (const item of state.footprintRings) {
      context.beginPath();
      pathRing(context, item.ring);
      context.fill();
      context.stroke();
    }
    context.restore();
  }

  function renderRivers(context) {
    if (!state.layers.rivers || !state.hydrology) return;
    context.save();
    context.lineCap = 'round';
    context.lineJoin = 'round';
    for (const feature of state.hydrology.features) {
      const system = feature.properties?.system;
      if (system !== 'li' && system !== 'xiang') continue;
      const coordinates = feature.geometry?.coordinates;
      if (!Array.isArray(coordinates) || coordinates.length < 2) continue;
      context.beginPath();
      coordinates.forEach((coordinate, index) => {
        const screen = utmToScreen(Geo.forward(coordinate[0], coordinate[1]));
        if (index === 0) context.moveTo(screen[0], screen[1]);
        else context.lineTo(screen[0], screen[1]);
      });
      context.strokeStyle = system === 'li' ? 'rgba(25, 114, 155, 0.92)' : 'rgba(49, 125, 172, 0.74)';
      context.lineWidth = system === 'li' ? 2.4 : 2;
      context.stroke();
    }
    context.restore();
  }

  function renderScaleReferences(context) {
    if (!state.layers.scale) return;
    const source = state.manifest.source_dem;
    const worldWidth = source.world_size_m[0];
    const lengths = [100000, 50000, 10000];
    const x = 24;
    let y = state.viewportHeight - 75;
    context.save();
    context.font = '800 9px ui-monospace, monospace';
    context.textBaseline = 'middle';
    for (const length of lengths) {
      const pixels = (length / worldWidth) * state.imageWidth * state.view.scale;
      context.strokeStyle = 'rgba(22, 45, 35, 0.92)';
      context.fillStyle = 'rgba(255, 254, 249, 0.86)';
      context.lineWidth = 3;
      context.fillRect(x - 6, y - 8, pixels + 54, 16);
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + pixels, y);
      context.moveTo(x, y - 5);
      context.lineTo(x, y + 5);
      context.moveTo(x + pixels, y - 5);
      context.lineTo(x + pixels, y + 5);
      context.stroke();
      context.fillStyle = '#20382d';
      context.fillText(`${length / 1000} km`, x + pixels + 8, y);
      y -= 21;
    }
    context.restore();
  }

  function renderAoi(context) {
    if (state.aoi) {
      context.save();
      context.beginPath();
      pathRing(context, state.aoi);
      context.fillStyle = 'rgba(45, 137, 84, 0.18)';
      context.strokeStyle = '#165f3a';
      context.lineWidth = 2.3;
      context.setLineDash([]);
      context.fill();
      context.stroke();
      context.restore();
    }
    if (state.polygonDraft.length > 0) {
      context.save();
      const points = state.polygonDraft.map(utmToScreen);
      context.beginPath();
      context.moveTo(points[0][0], points[0][1]);
      for (let index = 1; index < points.length; index += 1) context.lineTo(points[index][0], points[index][1]);
      context.strokeStyle = '#1f7a4a';
      context.lineWidth = 2;
      context.setLineDash([7, 5]);
      context.stroke();
      for (const point of points) drawHandle(context, point, false);
      context.restore();
    }
    if (state.rectangleDraft) {
      const [start, end] = state.rectangleDraft;
      const a = utmToScreen(start);
      const b = utmToScreen(end);
      context.save();
      context.fillStyle = 'rgba(45, 137, 84, 0.12)';
      context.strokeStyle = '#1f7a4a';
      context.lineWidth = 2;
      context.setLineDash([7, 5]);
      context.fillRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
      context.strokeRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
      context.restore();
    }
    if (state.mode === 'edit' && state.aoi) {
      context.save();
      const unique = state.aoi.slice(0, -1);
      unique.forEach((point, index) => drawHandle(context, utmToScreen(point), state.editIndex === index));
      context.restore();
    }
  }

  function drawHandle(context, point, active) {
    context.beginPath();
    context.arc(point[0], point[1], active ? 7 : 5.5, 0, Math.PI * 2);
    context.fillStyle = active ? '#f1b13e' : '#fffef8';
    context.strokeStyle = '#165f3a';
    context.lineWidth = 2;
    context.fill();
    context.stroke();
  }

  function renderVectors() {
    const context = vectorContext;
    context.clearRect(0, 0, state.viewportWidth, state.viewportHeight);
    renderFootprints(context);
    renderRivers(context);
    renderScaleReferences(context);
    renderAoi(context);
  }

  function updateLandmarkPositions() {
    const visible = state.layers.landmarks;
    $('landmarkLayer').hidden = !visible;
    if (!visible) return;
    for (const landmark of state.landmarks) {
      const screen = utmToScreen(landmark.utm);
      landmark.element.style.left = `${screen[0]}px`;
      landmark.element.style.top = `${screen[1]}px`;
      const [baseDx, dy] = landmark.offset;
      const labelWidth = Math.min(190, Math.max(118, landmark.element.offsetWidth || 150));
      const halfWidth = labelWidth / 2;
      const targetCenter = screen[0] + baseDx;
      const clampedCenter = Math.max(halfWidth + 7, Math.min(state.viewportWidth - halfWidth - 7, targetCenter));
      const dx = clampedCenter - screen[0];
      landmark.element.style.transform = `translate(calc(-50% + ${dx}px), calc(-100% + ${dy}px))`;
      const outside = screen[0] < -200 || screen[0] > state.viewportWidth + 200 || screen[1] < -120 || screen[1] > state.viewportHeight + 120;
      landmark.element.hidden = outside;
    }
  }

  function render() {
    renderTerrain();
    renderVectors();
    updateLandmarkPositions();
  }

  function setMode(mode, announce = true) {
    if (!['pan', 'polygon', 'rectangle', 'edit'].includes(mode)) throw new Error(`Unsupported mode ${mode}`);
    if (mode === 'edit' && !state.aoi) return;
    state.mode = mode;
    state.polygonDraft = [];
    state.rectangleDraft = null;
    state.editIndex = null;
    viewport.dataset.mode = mode;
    for (const button of document.querySelectorAll('[data-mode]')) {
      const active = button.dataset.mode === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    }
    const help = {
      pan: '滾輪縮放，拖動平移。選擇工具後在地圖上繪製。',
      polygon: '逐點單擊繪製多邊形。雙擊、按 Enter 或點回起點完成。',
      rectangle: '按住並拖動，放開后完成矩形。',
      edit: '拖動白色頂點修改選区。按 Delete 可删除。',
    };
    $('mapHelp').textContent = help[mode];
    requestRender();
    if (announce) showToast(`已切换到${buttonLabel(mode)}`);
  }

  function buttonLabel(mode) {
    return { pan: '平移工具', polygon: '多边形工具', rectangle: '矩形工具', edit: '顶点编辑' }[mode];
  }

  function normalizeAoi(points) {
    const ring = Geo.closeRing(points);
    const unique = ring.slice(0, -1);
    if (unique.length < 3) return null;
    return ring;
  }

  function orientation(a, b, c) {
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  }

  function segmentsIntersect(a, b, c, d) {
    const epsilon = 1e-8;
    const o1 = orientation(a, b, c);
    const o2 = orientation(a, b, d);
    const o3 = orientation(c, d, a);
    const o4 = orientation(c, d, b);
    return ((o1 > epsilon && o2 < -epsilon) || (o1 < -epsilon && o2 > epsilon))
      && ((o3 > epsilon && o4 < -epsilon) || (o3 < -epsilon && o4 > epsilon));
  }

  function isSimpleRing(ring) {
    if (!ring || ring.length < 4) return false;
    const segmentCount = ring.length - 1;
    for (let i = 0; i < segmentCount; i += 1) {
      for (let j = i + 1; j < segmentCount; j += 1) {
        if (Math.abs(i - j) <= 1) continue;
        if (i === 0 && j === segmentCount - 1) continue;
        if (segmentsIntersect(ring[i], ring[i + 1], ring[j], ring[j + 1])) return false;
      }
    }
    return true;
  }

  function aoiValidity() {
    if (!state.aoi) return { valid: false, reason: 'empty' };
    if (Geo.polygonArea(state.aoi) <= 1) return { valid: false, reason: 'zero-area' };
    if (!isSimpleRing(state.aoi)) return { valid: false, reason: 'self-intersection' };
    return { valid: true, reason: 'valid' };
  }

  function setAoi(points, kind = 'polygon', announce = false) {
    const ring = normalizeAoi(points);
    if (!ring) throw new Error('AOI needs at least three vertices');
    state.aoi = ring;
    state.aoiKind = kind;
    state.polygonDraft = [];
    state.rectangleDraft = null;
    updateSelectionPanel();
    requestRender();
    if (announce) showToast('活动 AOI 已更新');
  }

  function clearAoi(announce = true) {
    state.aoi = null;
    state.aoiKind = null;
    state.polygonDraft = [];
    state.rectangleDraft = null;
    state.editIndex = null;
    if (state.mode === 'edit') setMode('pan', false);
    updateSelectionPanel();
    requestRender();
    if (announce) showToast('活动 AOI 已清空');
  }

  function updateVertex(index, point) {
    if (!state.aoi) throw new Error('No AOI to edit');
    const unique = state.aoi.slice(0, -1);
    if (index < 0 || index >= unique.length) throw new RangeError('vertex index out of range');
    unique[index] = [...point];
    state.aoi = Geo.closeRing(unique);
    updateSelectionPanel();
    requestRender();
  }

  function createRectangleFromBounds(bounds, announce = false) {
    const [west, south, east, north] = bounds;
    setAoi([[west, south], [east, south], [east, north], [west, north]], 'rectangle', announce);
  }

  function selectionPayload() {
    const validity = aoiValidity();
    if (!validity.valid) return null;
    const ringUtm = Geo.closeRing(state.aoi);
    const ringWgs84 = ringUtm.map(point => Geo.inverse(point[0], point[1]));
    const areaM2 = Geo.polygonArea(ringUtm);
    const utmBounds = Geo.bounds(ringUtm);
    const wgsBounds = Geo.bounds(ringWgs84);
    return {
      validity,
      areaM2,
      ringUtm,
      ringWgs84,
      utmBounds,
      wgsBounds,
      geojson: {
        type: 'Feature',
        properties: {
          schema: 'guilin-v074-aoi/v1',
          project: 'guilin-v074-north-up-crop-and-distillation',
          status: 'UNCONFIRMED',
          aoi_kind: state.aoiKind,
          area_m2: Geo.round(areaM2, 3),
          area_km2: Geo.round(areaM2 / 1_000_000, 6),
          source_dem: state.manifest.source_dem.file,
          source_dem_sha256: state.manifest.source_dem.sha256,
          source_resolution_m: 12.5,
          source_crs: 'EPSG:32649',
          source_dem_read_only: true,
          north_up: true,
          rotation_allowed: false,
          utm_ring_epsg32649: ringUtm.map(point => point.map(value => Geo.round(value, 3))),
        },
        geometry: {
          type: 'Polygon',
          coordinates: [ringWgs84.map(point => point.map(value => Geo.round(value, 9)))],
        },
      },
      wkt: `POLYGON((${ringUtm.map(([x, y]) => `${x.toFixed(3)} ${y.toFixed(3)}`).join(', ')}))`,
    };
  }

  function updateSelectionPanel() {
    const hasAoi = Boolean(state.aoi);
    const payload = selectionPayload();
    $('emptySelection').hidden = hasAoi;
    $('selectionDetails').hidden = !hasAoi;
    const badge = $('selectionBadge');
    badge.classList.toggle('empty', !hasAoi);
    badge.textContent = hasAoi ? (payload ? '有效' : '需修正') : '未繪製';
    $('toolEdit').disabled = !hasAoi;
    $('deleteAoi').disabled = !hasAoi;
    $('clearSelection').disabled = !hasAoi;
    $('downloadGeojson').disabled = !payload;
    $('downloadWkt').disabled = !payload;
    $('copyCoordinates').disabled = !payload;
    if (!hasAoi) return;
    const ring = state.aoi.slice(0, -1);
    $('selectionVertices').textContent = String(ring.length);
    $('selectionValidity').textContent = payload ? '有效，无自交' : '无效或自交';
    if (!payload) {
      $('selectionArea').textContent = '－';
      $('selectionWgs84').textContent = '－';
      $('selectionUtm').textContent = '－';
      return;
    }
    $('selectionArea').textContent = payload.areaM2 >= 1_000_000
      ? `${(payload.areaM2 / 1_000_000).toFixed(3)} km²`
      : `${payload.areaM2.toFixed(0)} m²`;
    const [westLon, southLat, eastLon, northLat] = payload.wgsBounds;
    $('selectionWgs84').textContent = `W ${westLon.toFixed(6)}° · S ${southLat.toFixed(6)}° · E ${eastLon.toFixed(6)}° · N ${northLat.toFixed(6)}°`;
    const [west, south, east, north] = payload.utmBounds;
    $('selectionUtm').textContent = `W ${west.toFixed(1)} · S ${south.toFixed(1)} · E ${east.toFixed(1)} · N ${north.toFixed(1)} m`;
  }

  function downloadText(filename, content, mime) {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }

  async function loadHydrology() {
    if (state.hydrology) return state.hydrology;
    if (state.hydrologyLoading) {
      await new Promise(resolve => {
        const timer = setInterval(() => {
          if (!state.hydrologyLoading) {
            clearInterval(timer);
            resolve();
          }
        }, 30);
      });
      return state.hydrology;
    }
    state.hydrologyLoading = true;
    $('riverLayerStatus').textContent = '正在载入';
    try {
      if (fixtureMode) {
        state.hydrology = {
          type: 'FeatureCollection',
          features: [
            { type: 'Feature', properties: { system: 'li', name: '漓江 QA' }, geometry: { type: 'LineString', coordinates: [[110.10, 26.18], [110.22, 25.75], [110.30, 25.28], [110.49, 24.78], [110.70, 24.50]] } },
            { type: 'Feature', properties: { system: 'xiang', name: '湘江 QA' }, geometry: { type: 'LineString', coordinates: [[110.30, 26.45], [110.58, 26.25], [110.82, 26.13], [111.05, 25.98]] } },
          ],
        };
      } else {
        const result = await fetchFirstJson(state.manifest.hydrology.asset_candidates);
        state.hydrology = result.data;
      }
      const counts = state.hydrology.features.reduce((sum, feature) => sum + (['li', 'xiang'].includes(feature.properties?.system) ? 1 : 0), 0);
      $('riverLayerStatus').textContent = `${counts} 段已载入`;
      return state.hydrology;
    } catch (error) {
      state.hydrology = null;
      state.layers.rivers = false;
      $('layerRivers').checked = false;
      $('riverLayerStatus').textContent = '读取失败';
      showToast('漓江与湘江中心线读取失败，其他裁切功能不受影响', true);
      return null;
    } finally {
      state.hydrologyLoading = false;
      requestRender();
    }
  }

  function pointerPosition(event) {
    const rect = viewport.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  }

  function nearestVertexIndex(screen, threshold = 13) {
    if (!state.aoi) return -1;
    let best = -1;
    let bestDistance = threshold;
    state.aoi.slice(0, -1).forEach((point, index) => {
      const candidate = utmToScreen(point);
      const distance = Math.hypot(candidate[0] - screen[0], candidate[1] - screen[1]);
      if (distance <= bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    return best;
  }

  function finishPolygon() {
    if (state.polygonDraft.length < 3) {
      showToast('多边形至少需要三个顶点', true);
      return;
    }
    setAoi(state.polygonDraft, 'polygon');
    state.polygonDraft = [];
    setMode('edit', false);
    showToast('多边形 AOI 已建立，可继续编辑顶点');
  }

  function handlePointerDown(event) {
    if (event.button !== 0 && event.button !== 1) return;
    const screen = pointerPosition(event);
    viewport.focus({ preventScroll: true });
    if (state.mode === 'pan' || event.button === 1 || event.shiftKey) {
      state.activePointer = { type: 'pan', id: event.pointerId, start: screen, tx: state.view.tx, ty: state.view.ty };
      state.isDragging = true;
      viewport.classList.add('dragging');
      viewport.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }
    if (state.mode === 'rectangle') {
      const point = screenToUtm(screen, true);
      state.activePointer = { type: 'rectangle', id: event.pointerId, start: point };
      state.rectangleDraft = [point, point];
      viewport.setPointerCapture(event.pointerId);
      event.preventDefault();
      requestRender();
      return;
    }
    if (state.mode === 'edit') {
      const index = nearestVertexIndex(screen);
      if (index >= 0) {
        state.editIndex = index;
        state.activePointer = { type: 'edit', id: event.pointerId, index };
        viewport.setPointerCapture(event.pointerId);
        event.preventDefault();
        requestRender();
      }
    }
  }

  function handlePointerMove(event) {
    const screen = pointerPosition(event);
    const point = screenToUtm(screen, false);
    const [lon, lat] = Geo.inverse(point[0], point[1]);
    $('cursorReadout').textContent = `E ${lon.toFixed(5)}° · N ${lat.toFixed(5)}° · UTM ${point[0].toFixed(0)}, ${point[1].toFixed(0)}`;
    if (!state.activePointer || state.activePointer.id !== event.pointerId) return;
    if (state.activePointer.type === 'pan') {
      state.view.tx = state.activePointer.tx + screen[0] - state.activePointer.start[0];
      state.view.ty = state.activePointer.ty + screen[1] - state.activePointer.start[1];
      constrainView();
      requestRender();
      return;
    }
    if (state.activePointer.type === 'rectangle') {
      state.rectangleDraft = [state.activePointer.start, screenToUtm(screen, true)];
      requestRender();
      return;
    }
    if (state.activePointer.type === 'edit') {
      updateVertex(state.activePointer.index, screenToUtm(screen, true));
    }
  }

  function handlePointerUp(event) {
    if (!state.activePointer || state.activePointer.id !== event.pointerId) return;
    const active = state.activePointer;
    state.activePointer = null;
    state.isDragging = false;
    viewport.classList.remove('dragging');
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    if (active.type === 'rectangle' && state.rectangleDraft) {
      const [a, b] = state.rectangleDraft;
      state.rectangleDraft = null;
      const west = Math.min(a[0], b[0]);
      const east = Math.max(a[0], b[0]);
      const south = Math.min(a[1], b[1]);
      const north = Math.max(a[1], b[1]);
      if ((east - west) * (north - south) < 10_000) {
        showToast('矩形范围太小，请重新拖动', true);
        requestRender();
        return;
      }
      createRectangleFromBounds([west, south, east, north]);
      setMode('edit', false);
      showToast('矩形 AOI 已建立，可继续编辑顶点');
    }
    if (active.type === 'edit') {
      state.editIndex = null;
      updateSelectionPanel();
      requestRender();
    }
  }

  function handleClick(event) {
    if (state.mode !== 'polygon' || event.button !== 0 || state.isDragging) return;
    if (event.detail > 1) return;
    const screen = pointerPosition(event);
    if (state.polygonDraft.length >= 3) {
      const firstScreen = utmToScreen(state.polygonDraft[0]);
      if (Math.hypot(firstScreen[0] - screen[0], firstScreen[1] - screen[1]) <= 14) {
        finishPolygon();
        return;
      }
    }
    state.polygonDraft.push(screenToUtm(screen, true));
    requestRender();
  }

  function handleDoubleClick(event) {
    if (state.mode !== 'polygon') return;
    event.preventDefault();
    finishPolygon();
  }

  function handleWheel(event) {
    event.preventDefault();
    const screen = pointerPosition(event);
    const before = screenToImage(screen);
    const factor = Math.exp(-event.deltaY * 0.0015);
    const next = Math.max(state.view.minScale, Math.min(state.view.maxScale, state.view.scale * factor));
    state.view.scale = next;
    state.view.tx = screen[0] - before[0] * next;
    state.view.ty = screen[1] - before[1] * next;
    constrainView();
    requestRender();
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      state.polygonDraft = [];
      state.rectangleDraft = null;
      state.activePointer = null;
      setMode('pan', false);
      showToast('已取消当前绘制');
    }
    if (event.key === 'Enter' && state.mode === 'polygon') finishPolygon();
    if ((event.key === 'Delete' || event.key === 'Backspace') && state.aoi && state.mode === 'edit') {
      event.preventDefault();
      clearAoi();
    }
  }

  function bindControls() {
    for (const button of document.querySelectorAll('[data-mode]')) on(button, 'click', () => setMode(button.dataset.mode));
    on($('fitUnion'), 'click', () => fitUnion());
    on($('deleteAoi'), 'click', () => clearAoi());
    on($('clearSelection'), 'click', () => clearAoi());
    on($('downloadGeojson'), 'click', () => {
      const payload = selectionPayload();
      if (!payload) return;
      downloadText('guilin-v074-aoi-wgs84-unconfirmed.geojson', `${JSON.stringify(payload.geojson, null, 2)}\n`, 'application/geo+json;charset=utf-8');
      showToast('WGS84 GeoJSON 已生成');
    });
    on($('downloadWkt'), 'click', () => {
      const payload = selectionPayload();
      if (!payload) return;
      downloadText('guilin-v074-aoi-epsg32649-unconfirmed.wkt', `${payload.wkt}\n`, 'text/plain;charset=utf-8');
      showToast('EPSG:32649 WKT 已生成');
    });
    on($('copyCoordinates'), 'click', async () => {
      const payload = selectionPayload();
      if (!payload) return;
      await copyText(JSON.stringify({
        status: 'UNCONFIRMED',
        wgs84_polygon: payload.geojson.geometry.coordinates[0],
        epsg32649_polygon: payload.ringUtm.map(point => point.map(value => Geo.round(value, 3))),
        wkt_epsg32649: payload.wkt,
      }, null, 2));
      showToast('WGS84 与 EPSG:32649 坐标已复制');
    });
    const layerBindings = [
      ['layerFootprints', 'footprints'],
      ['layerNodata', 'nodata'],
      ['layerLandmarks', 'landmarks'],
      ['layerScale', 'scale'],
    ];
    for (const [id, key] of layerBindings) on($(id), 'change', event => {
      state.layers[key] = event.target.checked;
      requestRender();
    });
    on($('layerRivers'), 'change', async event => {
      state.layers.rivers = event.target.checked;
      if (state.layers.rivers) await loadHydrology();
      requestRender();
    });
    on(viewport, 'pointerdown', handlePointerDown);
    on(viewport, 'pointermove', handlePointerMove);
    on(viewport, 'pointerup', handlePointerUp);
    on(viewport, 'pointercancel', handlePointerUp);
    on(viewport, 'click', handleClick);
    on(viewport, 'dblclick', handleDoubleClick);
    on(viewport, 'wheel', handleWheel, { passive: false });
    on(viewport, 'keydown', handleKeyDown);
    on(window, 'resize', resizeCanvas);
  }

  function distance(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
  }

  function computedBackgroundIsTransparent(element) {
    const value = getComputedStyle(element).backgroundColor.replace(/\s+/g, '');
    return value === 'rgba(0,0,0,0)' || value === 'transparent';
  }

  async function runSelfTest() {
    const checks = {};
    const expectedUtm = {
      zhenbaoding: [482534.53046244296, 2890708.122979571],
      guilin: [429459.2395402428, 2795494.225020682],
      yangtang: [414949.56581014313, 2789301.889164384],
      yangshuo: [448648.4626595516, 2740850.767499203],
    };
    checks.image_loaded = state.imageReady === true;
    checks.north_up_contract = state.runtimeContract.north_up === true && state.runtimeContract.rotation_allowed === false;
    checks.no_rotation_control = document.querySelector('[data-mode="rotate"], #rotate, .rotate-control') === null;
    checks.no_external_runtime_dependency = document.querySelectorAll('script[src^="http"], link[href^="http"]').length === 0;
    checks.four_landmarks = state.landmarks.length === 4;
    checks.landmark_accuracy_under_50m = state.landmarks.every(item => distance(item.utm, expectedUtm[item.id]) < 50);
    checks.landmark_accuracy_under_1m = state.landmarks.every(item => distance(item.utm, expectedUtm[item.id]) < 1);
    checks.labels_transparent = state.landmarks.every(item => computedBackgroundIsTransparent(item.element));
    checks.one_coordinate_line_per_label = state.landmarks.every(item => item.element.querySelectorAll('.landmark-coordinate').length === 1 && item.element.dataset.coordinateLines === '1');
    const byLatitude = [...state.landmarks].sort((a, b) => b.lat - a.lat);
    const screenY = byLatitude.map(item => utmToScreen(item.utm)[1]);
    checks.north_south_order = screenY.every((value, index) => index === 0 || value > screenY[index - 1]);

    setAoi([
      [390000, 2730000],
      [505000, 2742000],
      [520000, 2840000],
      [445000, 2880000],
      [382000, 2810000],
    ], 'polygon');
    const polygonPayload = selectionPayload();
    checks.polygon_draw = Boolean(polygonPayload && polygonPayload.areaM2 > 0 && polygonPayload.ringUtm.length === 6);
    checks.geojson_export = polygonPayload?.geojson?.geometry?.type === 'Polygon' && polygonPayload.geojson.properties.status === 'UNCONFIRMED';
    checks.wkt_export = /^POLYGON\(\(.+\)\)$/.test(polygonPayload?.wkt || '');
    const oldVertex = [...state.aoi[0]];
    updateVertex(0, [oldVertex[0] + 1250, oldVertex[1] + 1750]);
    checks.vertex_edit = distance(state.aoi[0], oldVertex) > 2000;
    clearAoi(false);
    checks.delete_and_clear = state.aoi === null;

    createRectangleFromBounds([385000, 2720000, 525000, 2895000]);
    checks.rectangle_draw = state.aoiKind === 'rectangle' && state.aoi.length === 5 && Geo.polygonArea(state.aoi) > 0;
    checks.single_active_aoi = Boolean(state.aoi) && document.querySelectorAll('[data-active-aoi]').length <= 1;
    checks.source_hash_locked = state.manifest.source_dem.sha256 === '9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4';
    checks.source_read_only = state.runtimeContract.source_dem_read_only === true && state.runtimeContract.nodata_fill_allowed === false;
    checks.preview_visual_reference_only = state.manifest.preview.provenance_status === 'PENDING_SOURCE_TIFF_HASH_RECONCILIATION' && state.manifest.preview.exact_locked_tiff_derivation_verified === false;
    checks.status_unconfirmed = state.aoiStatus.status === 'UNCONFIRMED' && state.aoiStatus.distillation_allowed === false;
    checks.default_light = getComputedStyle(document.documentElement).colorScheme.includes('light');
    checks.console_errors_zero = runtimeErrors.length === 0;

    $('layerFootprints').checked = true;
    state.layers.footprints = true;
    $('layerScale').checked = true;
    state.layers.scale = true;
    $('layerRivers').checked = true;
    state.layers.rivers = true;
    await loadHydrology();
    checks.li_xiang_layer = Boolean(state.hydrology?.features?.some(feature => feature.properties?.system === 'li') && state.hydrology?.features?.some(feature => feature.properties?.system === 'xiang'));
    requestRender();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    checks.console_errors_zero = runtimeErrors.length === 0;

    const failed = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
    const result = {
      schema: 'guilin-v074-browser-qa/v1',
      passed: failed.length === 0,
      failed,
      checks,
      runtime_errors: runtimeErrors,
      aoi_status: state.aoiStatus.status,
      source_sha256: state.manifest.source_dem.sha256,
      image_url: state.imageUrl?.startsWith('data:') ? 'qa-data-url' : state.imageUrl,
    };
    $('qaJson').textContent = JSON.stringify(result);
    document.body.dataset.qaPassed = String(result.passed);
    window.__GUILIN_V074_QA_RESULT = result;
    return result;
  }

  async function boot() {
    try {
      const [manifest, footprints, landmarks, aoiStatus, runtimeContract] = await Promise.all([
        fetchJson('./data/mosaic_manifest.json'),
        fetchJson('./data/source_footprints.geojson'),
        fetchJson('./data/landmarks.json'),
        fetchJson('./data/aoi_status.json'),
        fetchJson('./data/runtime_contract.json'),
      ]);
      state.manifest = manifest;
      state.footprints = footprints;
      state.landmarksSource = landmarks;
      state.aoiStatus = aoiStatus;
      state.runtimeContract = runtimeContract;
      state.imageWidth = manifest.preview.width;
      state.imageHeight = manifest.preview.height;
      validateContracts();
      prepareFootprints();
      prepareLandmarks();
      populateSourcePanel();
      bindControls();
      resizeCanvas();
      updateSelectionPanel();
      setMode('pan', false);

      try {
        await loadImageCandidates(manifest.preview.asset_candidates);
        $('loadStatus').textContent = '合同与正北底图已载入';
        document.querySelector('.header-status').classList.add('ready');
      } catch (imageError) {
        $('loadStatus').textContent = '合同已载入，底图读取失败';
        showToast(imageError.message, true);
      }
      requestRender();
      window.__GUILIN_V074 = Object.freeze({
        schema: 'guilin-v074-public-api/v1',
        get state() {
          return {
            mode: state.mode,
            aoi: state.aoi ? state.aoi.map(point => [...point]) : null,
            aoiKind: state.aoiKind,
            layers: { ...state.layers },
            imageReady: state.imageReady,
            status: state.aoiStatus.status,
          };
        },
        geo: Geo,
        setMode,
        setAoiUtm: setAoi,
        createRectangleFromUtmBounds: createRectangleFromBounds,
        updateVertex,
        clearAoi,
        fitUnion,
        buildGeoJSON: () => selectionPayload()?.geojson || null,
        buildWKT: () => selectionPayload()?.wkt || null,
        runSelfTest,
      });
      window.__GUILIN_V074_READY = true;
      if (selfTestMode) await runSelfTest();
    } catch (error) {
      runtimeErrors.push({ type: 'boot', message: error.message });
      $('loadStatus').textContent = `启动失败：${error.message}`;
      showToast(`页面启动失败：${error.message}`, true);
      $('qaJson').textContent = JSON.stringify({ passed: false, failed: ['boot'], runtime_errors: runtimeErrors });
      document.body.dataset.qaPassed = 'false';
    }
  }

  boot();
})();
