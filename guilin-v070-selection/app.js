(() => {
  const $ = id => document.getElementById(id);
  const drawnItems = new L.FeatureGroup();
  let map;
  let manifest;
  let selectionLayer = null;
  let footprintLayer = null;
  let selectionPayload = null;

  proj4.defs(
    'EPSG:32649',
    '+proj=utm +zone=49 +datum=WGS84 +units=m +no_defs +type=crs'
  );

  function setStatus(text, ok = false) {
    const node = $('loadStatus');
    node.textContent = text;
    node.classList.toggle('ok', ok);
  }

  function formatPercent(value) {
    return `${(value * 100).toFixed(3)}%`;
  }

  function simpleToUtm(latlng) {
    const [west, south, east, north] = manifest.mosaic_bounds_epsg32649;
    const width = manifest.preview.width;
    const height = manifest.preview.height;
    const x = west + (latlng.lng / width) * (east - west);
    const y = south + (latlng.lat / height) * (north - south);
    return [x, y];
  }

  function utmToSimple(x, y) {
    const [west, south, east, north] = manifest.mosaic_bounds_epsg32649;
    const width = manifest.preview.width;
    const height = manifest.preview.height;
    const lng = ((x - west) / (east - west)) * width;
    const lat = ((y - south) / (north - south)) * height;
    return L.latLng(lat, lng);
  }

  function ringFromLayer(layer) {
    const latlngs = layer.getLatLngs();
    const ring = Array.isArray(latlngs[0]) ? latlngs[0] : latlngs;
    return ring.map(simpleToUtm);
  }

  function closeRing(ring) {
    if (!ring.length) return ring;
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) return [...ring, [...first]];
    return ring;
  }

  function polygonArea(ring) {
    const closed = closeRing(ring);
    let area = 0;
    for (let i = 0; i < closed.length - 1; i += 1) {
      area += closed[i][0] * closed[i + 1][1] - closed[i + 1][0] * closed[i][1];
    }
    return Math.abs(area) / 2;
  }

  function buildSelectionPayload(layer) {
    const ringUtm = closeRing(ringFromLayer(layer));
    const ringWgs84 = ringUtm.map(([x, y]) => proj4('EPSG:32649', 'EPSG:4326', [x, y]));
    const xs = ringUtm.map(point => point[0]);
    const ys = ringUtm.map(point => point[1]);
    const areaM2 = polygonArea(ringUtm);
    return {
      areaM2,
      ringUtm,
      ringWgs84,
      boundsUtm: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
      geojson: {
        type: 'Feature',
        properties: {
          project: 'guilin-v070-raw-mosaic-aoi',
          source_resolution_m: 12.5,
          source_crs: 'EPSG:32649',
          area_m2: areaM2,
          area_km2: areaM2 / 1_000_000,
          utm_ring_epsg32649: ringUtm,
        },
        geometry: { type: 'Polygon', coordinates: [ringWgs84] },
      },
      wkt: `POLYGON((${ringUtm.map(([x, y]) => `${x.toFixed(3)} ${y.toFixed(3)}`).join(', ')}))`,
    };
  }

  function updateSelection() {
    if (!selectionLayer) {
      selectionPayload = null;
      $('emptySelection').hidden = false;
      $('selectionMetrics').hidden = true;
      for (const id of ['downloadGeoJSON', 'downloadWKT', 'copyUTM', 'clearSelection']) $(id).disabled = true;
      return;
    }
    selectionPayload = buildSelectionPayload(selectionLayer);
    $('emptySelection').hidden = true;
    $('selectionMetrics').hidden = false;
    $('selectionArea').textContent = `${(selectionPayload.areaM2 / 1_000_000).toFixed(3)} km²`;
    $('selectionVertices').textContent = String(selectionPayload.ringUtm.length - 1);
    const [west, south, east, north] = selectionPayload.boundsUtm;
    $('selectionBounds').textContent = `${west.toFixed(1)}, ${south.toFixed(1)} → ${east.toFixed(1)}, ${north.toFixed(1)}`;
    for (const id of ['downloadGeoJSON', 'downloadWKT', 'copyUTM', 'clearSelection']) $(id).disabled = false;
  }

  function download(filename, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function clearSelection() {
    drawnItems.clearLayers();
    selectionLayer = null;
    updateSelection();
  }

  function transformFootprintFeature(feature) {
    const coordinates = feature.geometry.coordinates[0].map(([lon, lat]) => {
      const [x, y] = proj4('EPSG:4326', 'EPSG:32649', [lon, lat]);
      return utmToSimple(x, y);
    });
    return L.polygon(coordinates, {
      color: '#f0c474',
      weight: 1,
      opacity: 0.75,
      fillColor: '#f0c474',
      fillOpacity: 0.04,
      interactive: true,
    }).bindTooltip(feature.properties.file, { sticky: true });
  }

  async function loadFootprints() {
    if (footprintLayer) return footprintLayer;
    const response = await fetch('./data/source_footprints.geojson', { cache: 'no-store' });
    if (!response.ok) throw new Error(`源片范围读取失败：${response.status}`);
    const data = await response.json();
    footprintLayer = L.layerGroup(data.features.map(transformFootprintFeature));
    return footprintLayer;
  }

  async function boot() {
    try {
      const response = await fetch('./data/mosaic_manifest.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`拼接清单读取失败：${response.status}`);
      manifest = await response.json();

      $('sourceCount').textContent = `${manifest.source_count} 张`;
      $('resolution').textContent = `${manifest.source_resolution_m} m`;
      $('crs').textContent = manifest.crs;
      $('grid').textContent = `${manifest.mosaic_grid[0]} × ${manifest.mosaic_grid[1]}`;
      $('coverage').textContent = formatPercent(manifest.valid_fraction);
      $('nodata').textContent = formatPercent(manifest.nodata_fraction);

      const imageWidth = manifest.preview.width;
      const imageHeight = manifest.preview.height;
      const imageBounds = L.latLngBounds([[0, 0], [imageHeight, imageWidth]]);

      map = L.map('map', {
        crs: L.CRS.Simple,
        minZoom: -5,
        maxZoom: 5,
        zoomSnap: 0.25,
        zoomDelta: 0.5,
        attributionControl: true,
      });
      map.attributionControl.setPrefix('12.5 m DEM raw union');
      map.addLayer(drawnItems);
      const image = L.imageOverlay(`./data/${manifest.preview.file}`, imageBounds, {
        opacity: 1,
        interactive: false,
      }).addTo(map);
      image.on('load', () => setStatus('原始联合拼接已载入', true));
      map.fitBounds(imageBounds, { padding: [14, 14] });
      map.setMaxBounds(imageBounds.pad(0.12));
      L.control.scale({ imperial: false, maxWidth: 160 }).addTo(map);

      const drawControl = new L.Control.Draw({
        position: 'topleft',
        draw: {
          polygon: {
            allowIntersection: false,
            showArea: false,
            shapeOptions: { color: '#6ee3a7', weight: 2, fillOpacity: 0.12 },
          },
          rectangle: {
            shapeOptions: { color: '#6ee3a7', weight: 2, fillOpacity: 0.12 },
          },
          polyline: false,
          circle: false,
          circlemarker: false,
          marker: false,
        },
        edit: { featureGroup: drawnItems, remove: true },
      });
      map.addControl(drawControl);

      map.on(L.Draw.Event.CREATED, event => {
        clearSelection();
        selectionLayer = event.layer;
        drawnItems.addLayer(selectionLayer);
        updateSelection();
      });
      map.on(L.Draw.Event.EDITED, event => {
        event.layers.eachLayer(layer => { selectionLayer = layer; });
        updateSelection();
      });
      map.on(L.Draw.Event.DELETED, () => {
        selectionLayer = null;
        updateSelection();
      });

      $('footprintToggle').addEventListener('change', async event => {
        try {
          const layer = await loadFootprints();
          if (event.target.checked) layer.addTo(map);
          else map.removeLayer(layer);
        } catch (error) {
          event.target.checked = false;
          setStatus(error.message, false);
        }
      });
      $('downloadGeoJSON').addEventListener('click', () => download(
        'guilin-aoi-wgs84.geojson',
        JSON.stringify(selectionPayload.geojson, null, 2),
        'application/geo+json'
      ));
      $('downloadWKT').addEventListener('click', () => download(
        'guilin-aoi-epsg32649.wkt',
        `${selectionPayload.wkt}\n`,
        'text/plain'
      ));
      $('copyUTM').addEventListener('click', async () => {
        await navigator.clipboard.writeText(JSON.stringify(selectionPayload.ringUtm));
        setStatus('UTM 坐标已复制', true);
      });
      $('clearSelection').addEventListener('click', clearSelection);

      updateSelection();
      window.__GUILIN_SELECTION_READY = true;
    } catch (error) {
      console.error(error);
      setStatus(error.message, false);
    }
  }

  boot();
})();
