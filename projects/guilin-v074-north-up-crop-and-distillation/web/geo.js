(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GuilinGeo = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const WGS84_A = 6378137.0;
  const WGS84_F = 1 / 298.257223563;
  const K0 = 0.9996;
  const E2 = WGS84_F * (2 - WGS84_F);
  const EP2 = E2 / (1 - E2);
  const ZONE = 49;
  const CENTRAL_MERIDIAN_DEG = (ZONE - 1) * 6 - 180 + 3;
  const DEG = Math.PI / 180;

  function finiteNumber(value, name) {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new TypeError(`${name} must be finite`);
    return number;
  }

  function forward(lonDeg, latDeg) {
    const lon = finiteNumber(lonDeg, 'longitude') * DEG;
    const lat = finiteNumber(latDeg, 'latitude') * DEG;
    if (latDeg < 0 || latDeg > 84) throw new RangeError('EPSG:32649 supports northern UTM latitude');
    const lon0 = CENTRAL_MERIDIAN_DEG * DEG;
    const sinLat = Math.sin(lat);
    const cosLat = Math.cos(lat);
    const tanLat = Math.tan(lat);
    const n = WGS84_A / Math.sqrt(1 - E2 * sinLat * sinLat);
    const t = tanLat * tanLat;
    const c = EP2 * cosLat * cosLat;
    const a = cosLat * (lon - lon0);
    const e4 = E2 * E2;
    const e6 = e4 * E2;
    const m = WGS84_A * (
      (1 - E2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * lat
      - (3 * E2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * lat)
      + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * lat)
      - (35 * e6 / 3072) * Math.sin(6 * lat)
    );
    const easting = K0 * n * (
      a
      + (1 - t + c) * Math.pow(a, 3) / 6
      + (5 - 18 * t + t * t + 72 * c - 58 * EP2) * Math.pow(a, 5) / 120
    ) + 500000;
    const northing = K0 * (
      m + n * tanLat * (
        a * a / 2
        + (5 - t + 9 * c + 4 * c * c) * Math.pow(a, 4) / 24
        + (61 - 58 * t + t * t + 600 * c - 330 * EP2) * Math.pow(a, 6) / 720
      )
    );
    return [easting, northing];
  }

  function inverse(eastingValue, northingValue) {
    const easting = finiteNumber(eastingValue, 'easting') - 500000;
    const northing = finiteNumber(northingValue, 'northing');
    const e4 = E2 * E2;
    const e6 = e4 * E2;
    const m = northing / K0;
    const mu = m / (WGS84_A * (1 - E2 / 4 - 3 * e4 / 64 - 5 * e6 / 256));
    const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
    const j1 = 3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32;
    const j2 = 21 * e1 * e1 / 16 - 55 * Math.pow(e1, 4) / 32;
    const j3 = 151 * Math.pow(e1, 3) / 96;
    const j4 = 1097 * Math.pow(e1, 4) / 512;
    const fp = mu + j1 * Math.sin(2 * mu) + j2 * Math.sin(4 * mu) + j3 * Math.sin(6 * mu) + j4 * Math.sin(8 * mu);
    const sinFp = Math.sin(fp);
    const cosFp = Math.cos(fp);
    const tanFp = Math.tan(fp);
    const c1 = EP2 * cosFp * cosFp;
    const t1 = tanFp * tanFp;
    const n1 = WGS84_A / Math.sqrt(1 - E2 * sinFp * sinFp);
    const r1 = WGS84_A * (1 - E2) / Math.pow(1 - E2 * sinFp * sinFp, 1.5);
    const d = easting / (n1 * K0);
    const lat = fp - (n1 * tanFp / r1) * (
      d * d / 2
      - (5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * EP2) * Math.pow(d, 4) / 24
      + (61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * EP2 - 3 * c1 * c1) * Math.pow(d, 6) / 720
    );
    const lon = CENTRAL_MERIDIAN_DEG * DEG + (
      d
      - (1 + 2 * t1 + c1) * Math.pow(d, 3) / 6
      + (5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * EP2 + 24 * t1 * t1) * Math.pow(d, 5) / 120
    ) / cosFp;
    return [lon / DEG, lat / DEG];
  }

  function closeRing(points) {
    const ring = points.map(point => [finiteNumber(point[0], 'x'), finiteNumber(point[1], 'y')]);
    if (ring.length === 0) return ring;
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first]);
    return ring;
  }

  function polygonArea(points) {
    const ring = closeRing(points);
    let area = 0;
    for (let index = 0; index < ring.length - 1; index += 1) {
      area += ring[index][0] * ring[index + 1][1] - ring[index + 1][0] * ring[index][1];
    }
    return Math.abs(area) / 2;
  }

  function bounds(points) {
    if (!Array.isArray(points) || points.length === 0) return null;
    const xs = points.map(point => finiteNumber(point[0], 'x'));
    const ys = points.map(point => finiteNumber(point[1], 'y'));
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }

  function utmToImage(point, mosaicBounds, width, height) {
    const [west, south, east, north] = mosaicBounds;
    return [
      ((point[0] - west) / (east - west)) * width,
      ((north - point[1]) / (north - south)) * height,
    ];
  }

  function imageToUtm(point, mosaicBounds, width, height) {
    const [west, south, east, north] = mosaicBounds;
    return [
      west + (point[0] / width) * (east - west),
      north - (point[1] / height) * (north - south),
    ];
  }

  function ringUtmToWgs84(points) {
    return closeRing(points).map(point => inverse(point[0], point[1]));
  }

  function ringWgs84ToUtm(points) {
    return closeRing(points).map(point => forward(point[0], point[1]));
  }

  function round(value, digits) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
  }

  return Object.freeze({
    zone: ZONE,
    centralMeridianDeg: CENTRAL_MERIDIAN_DEG,
    forward,
    inverse,
    closeRing,
    polygonArea,
    bounds,
    utmToImage,
    imageToUtm,
    ringUtmToWgs84,
    ringWgs84ToUtm,
    round,
  });
});
