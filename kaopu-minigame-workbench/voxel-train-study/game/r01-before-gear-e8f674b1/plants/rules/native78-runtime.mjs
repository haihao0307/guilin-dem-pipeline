// ../current-site-source/checkout/src/TropicalLibrary/BoundedArchiveBlob77.ts
var PART_LIMIT = 64 * 1048576;
var BoundedArchiveBlob77 = class _BoundedArchiveBlob77 extends Blob {
  #parts;
  #offsets;
  constructor(parts, options = {}) {
    if (parts.some((p) => !(p instanceof Blob) || p.size > PART_LIMIT)) throw Error("Native77 Blob parts must be bounded");
    super(parts, options);
    this.#parts = Object.freeze([...parts]);
    this.#offsets = new Float64Array(parts.length + 1);
    for (let i = 0; i < parts.length; i++) this.#offsets[i + 1] = this.#offsets[i] + parts[i].size;
    if (!Number.isSafeInteger(this.size) || this.#offsets.at(-1) !== this.size) throw Error("Native77 Blob byte size mismatch");
  }
  slice(start = 0, end = this.size, contentType = "") {
    const integer2 = (v) => Number.isNaN(Number(v)) ? 0 : Math.trunc(Number(v)), relative = (v) => v < 0 ? Math.max(this.size + v, 0) : Math.min(v, this.size), from = relative(integer2(start)), to = Math.max(from, relative(integer2(end))), parts = [];
    let low = 0, high = this.#parts.length;
    while (low < high) {
      const middle = low + high >>> 1;
      if (this.#offsets[middle + 1] <= from) low = middle + 1;
      else high = middle;
    }
    for (let i = low; i < this.#parts.length && this.#offsets[i] < to; i++) {
      const offset = this.#offsets[i], part = this.#parts[i];
      parts.push(part.slice(Math.max(0, from - offset), Math.min(part.size, to - offset)));
    }
    return new _BoundedArchiveBlob77(parts, { type: contentType });
  }
};
async function boundedArchiveSource77(blob) {
  const node = globalThis.process?.versions?.node;
  if (!node || blob.size <= 4294967295 || blob instanceof BoundedArchiveBlob77) return blob;
  const reader = blob.stream().getReader(), parts = [];
  let buffer = new Uint8Array(PART_LIMIT), used = 0, total = 0;
  try {
    for (; ; ) {
      const r = await reader.read();
      if (r.done) break;
      let offset = 0;
      total += r.value.length;
      while (offset < r.value.length) {
        const n = Math.min(buffer.length - used, r.value.length - offset);
        buffer.set(r.value.subarray(offset, offset + n), used);
        used += n;
        offset += n;
        if (used === buffer.length) {
          parts.push(new Blob([buffer]));
          buffer = new Uint8Array(PART_LIMIT);
          used = 0;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  if (total !== blob.size) throw Error("Native77 source stream length mismatch");
  if (used) parts.push(new Blob([buffer.subarray(0, used)]));
  return new BoundedArchiveBlob77(parts, { type: blob.type });
}

// ../current-site-source/checkout/src/TropicalLibrary/NativeArchive76.ts
var MAGIC = new TextEncoder().encode("VGPLANT76");
var MAGIC77 = new TextEncoder().encode("VGPLANT77");
var CHUNK = 32 * 1048576;
var MAX_HEADER = 16 * 1048576;
var classes = { Float32Array, Float64Array, Uint32Array, Uint16Array, Uint8Array };
var forbidden = (k) => ["$nativeBuffer76", "__proto__", "constructor", "prototype"].includes(k);
var integer = (n) => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
async function bounded76(stream, limit, exact) {
  const reader = stream.getReader(), parts = [];
  let size = 0;
  try {
    for (; ; ) {
      const r = await reader.read();
      if (r.done) break;
      size += r.value.length;
      if (size > limit) {
        await reader.cancel();
        throw Error("Native76 chunk exceeds its byte limit");
      }
      parts.push(r.value);
    }
  } finally {
    reader.releaseLock();
  }
  if (exact !== void 0 && size !== exact) throw Error("Native76 decoded chunk length mismatch");
  const result = new Uint8Array(size);
  let at = 0;
  for (const p of parts) {
    result.set(p, at);
    at += p.length;
  }
  return result;
}
async function decodeNativeArchive76(blob) {
  if (blob.size < 13 || blob.size > 16 * 1073741824) throw Error("Invalid native archive size");
  const prefix = new Uint8Array(await blob.slice(0, 13).arrayBuffer()), archiveVersion = MAGIC.every((v, i) => prefix[i] === v) ? 76 : MAGIC77.every((v, i) => prefix[i] === v) ? 77 : 0;
  if (!archiveVersion) throw Error("Not a native full specimen archive");
  const maxBuffer = (archiveVersion === 77 ? 8 : 2) * 1073741824, maxTotal = (archiveVersion === 77 ? 64 : 16) * 1073741824, maxFile = (archiveVersion === 77 ? 16 : 8) * 1073741824;
  if (blob.size > maxFile) throw Error("Native archive exceeds its versioned file bound");
  const n = new DataView(prefix.buffer).getUint32(9, true);
  if (n > MAX_HEADER || n > blob.size - 13) throw Error("Invalid native76 archive header");
  const h = JSON.parse(await blob.slice(13, 13 + n).text());
  if (h.archiveVersion !== archiveVersion || !integer(h.decodedBytes) || h.decodedBytes > maxTotal || !Array.isArray(h.buffers) || h.buffers.length > (archiveVersion === 77 ? 65536 : 8192)) throw Error("Invalid native76 archive index");
  let decoded = 0, offset = 0;
  for (const b of h.buffers) {
    if (!b || !Object.hasOwn(classes, b.type) || !integer(b.length) || !Array.isArray(b.chunks)) throw Error("Invalid native76 buffer");
    const bytes = b.length * classes[b.type].BYTES_PER_ELEMENT;
    if (!Number.isSafeInteger(bytes) || bytes > maxBuffer) throw Error("Native archive exceeds its versioned buffer bound");
    decoded += bytes;
    let own = 0;
    for (const c of b.chunks) {
      if (!c || !integer(c.offset) || c.offset !== offset || !integer(c.bytes) || !integer(c.decoded) || !c.decoded || c.decoded > CHUNK || c.bytes > CHUNK + 1048576 || !["raw", "gzip"].includes(c.codec) || c.codec === "raw" && c.bytes !== c.decoded || c.codec === "gzip" && !c.bytes) throw Error("Invalid native76 chunk index");
      own += c.decoded;
      offset += c.bytes;
    }
    if (own !== bytes) throw Error("Native76 buffer length mismatch");
  }
  const start = 13 + n;
  if (decoded !== h.decodedBytes || decoded > maxTotal || start + offset !== blob.size) throw Error("Native76 archive total mismatch");
  const inspect2 = (v, depth = 0) => {
    if (depth > 90) throw Error("Native76 archive nesting exceeds its bound");
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) {
      for (const x of v) inspect2(x, depth + 1);
      return;
    }
    const o = v;
    if ("$nativeBuffer76" in o) {
      if (Object.keys(o).length !== 1 || !integer(o.$nativeBuffer76) || o.$nativeBuffer76 >= h.buffers.length) throw Error("Invalid native76 buffer reference");
      return;
    }
    for (const [k, x] of Object.entries(o)) {
      if (forbidden(k)) throw Error("Reserved native76 archive field");
      inspect2(x, depth + 1);
    }
  };
  inspect2(h.skeleton);
  if (archiveVersion === 77 && h.skeleton?.asset?.specimen?.growth?.profile?.productionSystemVersion !== 77 && h.skeleton?.asset?.specimen?.growth?.profile?.productionSystemVersion !== 78) throw Error("Native77 envelope requires explicit production77");
  if (archiveVersion === 77) blob = await boundedArchiveSource77(blob);
  const arrays = [];
  for (const b of h.buffers) {
    const C = classes[b.type], array = new C(b.length), target = new Uint8Array(array.buffer);
    let at = 0;
    for (const c of b.chunks) {
      let stream = blob.slice(start + c.offset, start + c.offset + c.bytes).stream();
      if (c.codec === "gzip") {
        if (typeof DecompressionStream === "undefined") throw Error("Native76 requires gzip decompression support");
        stream = stream.pipeThrough(new DecompressionStream("gzip"));
      }
      target.set(await bounded76(stream, c.decoded, c.decoded), at);
      at += c.decoded;
    }
    arrays.push(array);
  }
  const restore = (v) => {
    if (!v || typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map(restore);
    const o = v;
    if ("$nativeBuffer76" in o) return arrays[o.$nativeBuffer76];
    const out = {};
    for (const [k, x] of Object.entries(o)) out[k] = restore(x);
    return out;
  };
  return restore(h.skeleton);
}

// ../current-site-source/checkout/src/Core/sha256.ts
var K = new Uint32Array([1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298]);
var rot = (n, b) => n >>> b | n << 32 - b;
function sha256Portable(bytes) {
  const h = new Uint32Array([1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225]);
  const length = Math.ceil((bytes.length + 9) / 64) * 64, data = new Uint8Array(length);
  data.set(bytes);
  data[bytes.length] = 128;
  const view = new DataView(data.buffer);
  view.setUint32(length - 8, Math.floor(bytes.length / 536870912));
  view.setUint32(length - 4, bytes.length * 8 >>> 0);
  const w = new Uint32Array(64);
  for (let off = 0; off < length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15], y = w[i - 2];
      w[i] = w[i - 16] + (rot(x, 7) ^ rot(x, 18) ^ x >>> 3) + w[i - 7] + (rot(y, 17) ^ rot(y, 19) ^ y >>> 10) >>> 0;
    }
    let [a, b, c, d, e, f, g, j] = h;
    for (let i = 0; i < 64; i++) {
      const t = j + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + (e & f ^ ~e & g) + K[i] + w[i] >>> 0, u = (rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + (a & b ^ a & c ^ b & c) >>> 0;
      j = g;
      g = f;
      f = e;
      e = d + t >>> 0;
      d = c;
      c = b;
      b = a;
      a = t + u >>> 0;
    }
    const out = [a, b, c, d, e, f, g, j];
    for (let i = 0; i < 8; i++) h[i] = h[i] + out[i] >>> 0;
  }
  return Array.from(h, (x) => x.toString(16).padStart(8, "0")).join("");
}
async function digestBytes(bytes) {
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return sha256Portable(bytes);
}

// ../current-site-source/checkout/src/TropicalLibrary/Hash76.ts
async function hashNative76(value) {
  const buffers = [], seen = /* @__PURE__ */ new Map(), encoder = new TextEncoder();
  async function visit(v, depth = 0) {
    if (depth > 90) throw Error("Native76 hash nesting exceeds its bound");
    if (v === null || typeof v !== "object") return v;
    if (ArrayBuffer.isView(v)) {
      if (seen.has(v)) return { $buffer: seen.get(v) };
      if (!(v instanceof Float32Array || v instanceof Float64Array || v instanceof Uint32Array || v instanceof Uint16Array || v instanceof Uint8Array)) throw Error("Unsupported native hash buffer");
      const id = buffers.length;
      seen.set(v, id);
      buffers.push(null);
      const bytes = new Uint8Array(v.buffer, v.byteOffset, v.byteLength), chunks = [];
      for (let start = 0; start < bytes.length; start += 8 * 1048576) chunks.push(await digestBytes(bytes.subarray(start, Math.min(bytes.length, start + 8 * 1048576))));
      buffers[id] = { type: v.constructor.name, length: v.length, bytes: v.byteLength, chunks };
      return { $buffer: id };
    }
    if (Array.isArray(v)) {
      const out2 = [];
      for (const x of v) out2.push(await visit(x, depth + 1));
      return out2;
    }
    const out = {};
    for (const key of Object.keys(v).sort()) {
      if (["$buffer", "__proto__", "constructor", "prototype"].includes(key)) throw Error("Reserved native hash field");
      const x = v[key];
      if (x !== void 0) out[key] = await visit(x, depth + 1);
    }
    return out;
  }
  const skeleton = await visit(value);
  return digestBytes(encoder.encode(JSON.stringify({ hashVersion: 76, skeleton, buffers })));
}

// ../current-site-source/checkout/data/tropical-library/research76.json
var research76_default = {
  researchVersion: 76,
  date: "2026-10-02",
  source: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
  entries: [
    {
      candidate: "T01",
      presetId: "v8:ceiba-pentandra",
      species: "ceiba-pentandra",
      scientificName: "Ceiba pentandra",
      label: "\u5409\u8D1D / Kapok",
      wave: 1,
      kind: "woody",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://heritagetrees.nparks.gov.sg/heritagetrees/ht-2005-134/"
      ]
    },
    {
      candidate: "T02",
      presetId: "v8:koompassia-excelsa",
      species: "koompassia-excelsa",
      scientificName: "Koompassia excelsa",
      label: "Tualang",
      wave: 1,
      kind: "woody",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://www.nparks.gov.sg/florafaunaweb/flora/2/9/2983",
        "https://prosea.prota4u.org/view.aspx?id=3595"
      ]
    },
    {
      candidate: "T03",
      presetId: "v8:koompassia-malaccensis",
      species: "koompassia-malaccensis",
      scientificName: "Koompassia malaccensis",
      label: "Kempas",
      wave: 2,
      kind: "woody",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://communityrights.tropenbos.org/file.php/1511/tbiseries7-web.pdf",
        "https://www.nparks.gov.sg/florafaunaweb/flora/2/9/2984",
        "https://heritagetrees.nparks.gov.sg/heritagetrees/ht-2016-280/"
      ]
    },
    {
      candidate: "T04",
      presetId: "v8:richetia-faguetiana",
      species: "richetia-faguetiana",
      scientificName: "Richetia faguetiana",
      label: "\u539F Shorea faguetiana",
      wave: 4,
      kind: "woody",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://rimbundahan.org/genus-shorea/",
        "https://powo.science.kew.org/taxon/77298444-1"
      ]
    },
    {
      candidate: "T05",
      presetId: "v8:rubroshorea-leprosula",
      species: "rubroshorea-leprosula",
      scientificName: "Rubroshorea leprosula",
      label: "\u539F Shorea leprosula",
      wave: 4,
      kind: "woody",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://powo.science.kew.org/taxon/77298395-1",
        "https://www.nparks.gov.sg/florafaunaweb/flora/3/1/3124"
      ]
    },
    {
      candidate: "T06",
      presetId: "v8:dipterocarpus-grandiflorus",
      species: "dipterocarpus-grandiflorus",
      scientificName: "Dipterocarpus grandiflorus",
      label: "Dipterocarpus grandiflorus",
      wave: 2,
      kind: "woody",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://www.nparks.gov.sg/florafaunaweb/flora/2/8/2857"
      ]
    },
    {
      candidate: "T07",
      presetId: "v8:dryobalanops-aromatica",
      species: "dryobalanops-aromatica",
      scientificName: "Dryobalanops aromatica",
      label: "\u9F99\u8111\u9999 / Kapur",
      wave: 2,
      kind: "woody",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://www.nparks.gov.sg/florafaunaweb/flora/2/8/2862"
      ]
    },
    {
      candidate: "T08",
      presetId: "v8:hopea-odorata",
      species: "hopea-odorata",
      scientificName: "Hopea odorata",
      label: "Takhian",
      wave: 3,
      kind: "woody",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://www.nparks.gov.sg/florafaunaweb/flora/2/9/2959"
      ]
    },
    {
      candidate: "T09",
      presetId: "v8:pometia-pinnata",
      species: "pometia-pinnata",
      scientificName: "Pometia pinnata",
      label: "\u5C9B\u5C7F\u756A\u9F99\u773C / Matoa",
      wave: 1,
      kind: "woody",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://www.nparks.gov.sg/florafaunaweb/flora/3/0/3084"
      ]
    },
    {
      candidate: "T10",
      presetId: "v8:terminalia-superba",
      species: "terminalia-superba",
      scientificName: "Terminalia superba",
      label: "Limba",
      wave: 3,
      kind: "woody",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://powo.science.kew.org/taxon/urn%3Alsid%3Aipni.org%3Anames%3A171417-1/general-information",
        "https://www.worldfloraonline.org/taxon/wfo-0000408519"
      ]
    },
    {
      candidate: "T11",
      presetId: "v8:dinizia-excelsa",
      species: "dinizia-excelsa",
      scientificName: "Dinizia excelsa",
      label: "Angelim vermelho",
      wave: 4,
      kind: "woody",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://powo.science.kew.org/taxon/urn%3Alsid%3Aipni.org%3Anames%3A80468-2/general-information",
        "https://www.cam.ac.uk/research/news/expedition-finds-tallest-tree-in-the-amazon",
        "https://esajournals.onlinelibrary.wiley.com/doi/10.1002/fee.2085",
        "https://ainfo.cnptia.embrapa.br/digital/bitstream/doc/1153929/1/TS-RaphaelNeves.pdf"
      ]
    },
    {
      candidate: "T12",
      presetId: "v8:samanea-saman",
      species: "samanea-saman",
      scientificName: "Samanea saman",
      label: "\u96E8\u6811",
      wave: 2,
      kind: "woody",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://www.nparks.gov.sg/florafaunaweb/flora/3/1/3106"
      ]
    },
    {
      candidate: "T13",
      presetId: "v8:ficus-benghalensis",
      species: "ficus-benghalensis",
      scientificName: "Ficus benghalensis",
      label: "\u5370\u5EA6\u6995 / Banyan",
      wave: 1,
      kind: "woody",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://www.nparks.gov.sg/florafaunaweb/flora/2/8/2899"
      ]
    },
    {
      candidate: "T14",
      presetId: "v8:ficus-elastica",
      species: "ficus-elastica",
      scientificName: "Ficus elastica",
      label: "\u5370\u5EA6\u6A61\u80F6\u6995",
      wave: 2,
      kind: "woody",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://www.efloras.org/florataxon.aspx?flora_id=2&taxon_id=200006353",
        "https://www.nparks.gov.sg/florafaunaweb/flora/2/9/2906"
      ]
    },
    {
      candidate: "T15",
      presetId: "v7:ficus-virens",
      species: "ficus-virens",
      scientificName: "Ficus virens",
      label: "\u65E7\u5DE8\u578B\u7EDE\u6740\u6995\u91CD\u65B0\u8D44\u683C",
      wave: 3,
      kind: "woody",
      requalification: true,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://www.nparks.gov.sg/florafaunaweb/flora/4/1/4196"
      ]
    },
    {
      candidate: "T16",
      presetId: "v7:ficus-microcarpa",
      species: "ficus-microcarpa",
      scientificName: "Ficus microcarpa",
      label: "\u65E7\u5C0F\u53F6\u6995\u91CD\u65B0\u8D44\u683C",
      wave: 3,
      kind: "woody",
      requalification: true,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://www.efloras.org/florataxon.aspx?flora_id=2&taxon_id=200006364",
        "https://www.nparks.gov.sg/florafaunaweb/flora/2/9/2912"
      ]
    },
    {
      candidate: "T17",
      presetId: "v7:intsia-bijuga",
      species: "intsia-bijuga",
      scientificName: "Intsia bijuga",
      label: "\u65E7\u592A\u5E73\u6D0B\u94C1\u6728\u91CD\u65B0\u91CD\u5EFA",
      wave: 2,
      kind: "woody",
      requalification: true,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://www.nparks.gov.sg/florafaunaweb/flora/2/9/2971"
      ]
    },
    {
      candidate: "T18",
      presetId: "v8:artocarpus-altilis",
      species: "artocarpus-altilis",
      scientificName: "Artocarpus altilis",
      label: "\u9762\u5305\u6811",
      wave: 2,
      kind: "woody",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://www.ntbg.org/database/plants/detail/artocarpus-altilis",
        "https://ntbg.org/breadfruit/about-breadfruit/species/"
      ]
    },
    {
      candidate: "T19",
      presetId: "v7:barringtonia-asiatica",
      species: "barringtonia-asiatica",
      scientificName: "Barringtonia asiatica",
      label: "\u65E7\u5927\u53F6\u6D77\u5CB8\u6811\u91CD\u65B0\u91CD\u5EFA",
      wave: 3,
      kind: "woody",
      requalification: true,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://www.nparks.gov.sg/florafaunaweb/flora/2/7/2744",
        "https://heritagetrees.nparks.gov.sg/heritagetrees/ht-2012-189/",
        "https://www.mybis.gov.my/art/41"
      ]
    },
    {
      candidate: "T20",
      presetId: "v8:terminalia-catappa",
      species: "terminalia-catappa",
      scientificName: "Terminalia catappa",
      label: "\u6984\u4EC1\u6811",
      wave: 2,
      kind: "woody",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://www.nparks.gov.sg/florafaunaweb/flora/3/1/3181"
      ]
    },
    {
      candidate: "B01",
      presetId: "v8:musa-balbisiana",
      species: "musa-balbisiana",
      scientificName: "Musa balbisiana",
      label: "\u91CE\u8549 / B \u57FA\u56E0\u7EC4\u6765\u6E90\u79CD",
      wave: 1,
      kind: "zingiberales",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://powo.science.kew.org/taxon/urn%3Alsid%3Aipni.org%3Anames%3A797536-1/general-information"
      ]
    },
    {
      candidate: "B02",
      presetId: "v8:musa-textilis",
      species: "musa-textilis",
      scientificName: "Musa textilis",
      label: "\u9A6C\u5C3C\u62C9\u9EBB / Abac\xE1",
      wave: 2,
      kind: "zingiberales",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://plantuse.plantnet.org/en/Musa_textilis_%28PROTA%29",
        "https://plantuse.plantnet.org/en/Musa_textilis_%28PROSEA%29"
      ]
    },
    {
      candidate: "B03",
      presetId: "v8:musa-itinerans",
      species: "musa-itinerans",
      scientificName: "Musa itinerans",
      label: "\u6E38\u8D70\u578B\u91CE\u8549",
      wave: 2,
      kind: "zingiberales",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://www.iplant.cn/foc/pdf/Musaceae.pdf",
        "https://en.xtbg.ac.cn/rh/ss/hm/200802/P020090810511909859758.pdf"
      ]
    },
    {
      candidate: "B04",
      presetId: "v8:musa-ingens",
      species: "musa-ingens",
      scientificName: "Musa ingens",
      label: "\u5DE8\u578B\u5C71\u5730\u82AD\u8549",
      wave: 4,
      kind: "zingiberales",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://www.kew.org/read-and-watch/trees-new-guinea",
        "https://journals.rbge.org.uk/notes/article/download/3053/2873/13041",
        "https://records.data.kew.org/occurrences/39ef8fee-e345-47b2-ab17-2458515fd685"
      ]
    },
    {
      candidate: "B05",
      presetId: "v8:ensete-ventricosum",
      species: "ensete-ventricosum",
      scientificName: "Ensete ventricosum",
      label: "\u57C3\u585E\u4FC4\u6BD4\u4E9A\u8549\u7C7B / Enset",
      wave: 1,
      kind: "zingiberales",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://pza.sanbi.org/ensete-ventricosum"
      ]
    },
    {
      candidate: "B06",
      presetId: "v8:ensete-glaucum",
      species: "ensete-glaucum",
      scientificName: "Ensete glaucum",
      label: "\u8C61\u817F\u8549\u7C7B",
      wave: 3,
      kind: "zingiberales",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://www.nparks.gov.sg/florafaunaweb/flora/4/0/4089"
      ]
    },
    {
      candidate: "B07",
      presetId: "v8:ravenala-madagascariensis",
      species: "ravenala-madagascariensis",
      scientificName: "Ravenala madagascariensis",
      label: "\u65C5\u4EBA\u8549\uFF0C\u4E25\u683C\u79CD\u4E49",
      wave: 1,
      kind: "zingiberales",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://www.nature.com/articles/s41598-021-01161-1",
        "https://www.nparks.gov.sg/florafaunaweb/flora/3/1/3100"
      ]
    },
    {
      candidate: "B08",
      presetId: "v8:phenakospermum-guyannense",
      species: "phenakospermum-guyannense",
      scientificName: "Phenakospermum guyannense",
      label: "\u5357\u7F8E\u5DE8\u5927\u65C5\u4EBA\u8549\u7C7B",
      wave: 1,
      kind: "zingiberales",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://www.nparks.gov.sg/sbg/research/publications/-/media/sbg/gardenwise/2017-aug-gardenwise-vol-49.pdf",
        "https://powo.science.kew.org/taxon/urn%3Alsid%3Aipni.org%3Anames%3A77126725-1/general-information"
      ]
    },
    {
      candidate: "B09",
      presetId: "v8:strelitzia-nicolai",
      species: "strelitzia-nicolai",
      scientificName: "Strelitzia nicolai",
      label: "\u5DE8\u578B\u767D\u9E64\u671B\u5170",
      wave: 2,
      kind: "zingiberales",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://pza.sanbi.org/strelitzia-nicolai"
      ]
    },
    {
      candidate: "B10",
      presetId: "v8:heliconia-bihai",
      species: "heliconia-bihai",
      scientificName: "Heliconia bihai",
      label: "Heliconia bihai",
      wave: 3,
      kind: "zingiberales",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://www.nparks.gov.sg/florafaunaweb/flora/5/7/5745",
        "https://powo.science.kew.org/taxon/urn%3Alsid%3Aipni.org%3Anames%3A796925-1",
        "https://www.nparks.gov.sg/florafaunaweb/flora/4/2/4255"
      ]
    },
    {
      candidate: "B11",
      presetId: "v8:heliconia-caribaea",
      species: "heliconia-caribaea",
      scientificName: "Heliconia caribaea",
      label: "Heliconia caribaea",
      wave: 3,
      kind: "zingiberales",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://sweetgum.nybg.org/science/projects/saba/specimen-details/?irn=1116920",
        "https://powo.science.kew.org/taxon/urn%3Alsid%3Aipni.org%3Anames%3A796933-1"
      ]
    },
    {
      candidate: "B12",
      presetId: "v8:heliconia-latispatha",
      species: "heliconia-latispatha",
      scientificName: "Heliconia latispatha",
      label: "Heliconia latispatha",
      wave: 3,
      kind: "zingiberales",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://www.heliconia.org/_files/ugd/ef1aa2_1e02557e18b44bd2a0f1134427cd05f6.pdf",
        "https://www.nparks.gov.sg/florafaunaweb/flora/5/5/5507"
      ]
    },
    {
      candidate: "B13",
      presetId: "v8:heliconia-chartacea",
      species: "heliconia-chartacea",
      scientificName: "Heliconia chartacea",
      label: "Heliconia chartacea",
      wave: 3,
      kind: "zingiberales",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://www.nparks.gov.sg/florafaunaweb/flora/4/2/4285",
        "https://www.nparks.gov.sg/florafaunaweb/flora/2/0/2068"
      ]
    },
    {
      candidate: "B14",
      presetId: "v8:etlingera-elatior",
      species: "etlingera-elatior",
      scientificName: "Etlingera elatior",
      label: "\u706B\u70AC\u59DC",
      wave: 2,
      kind: "zingiberales",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://www.nparks.gov.sg/florafaunaweb/flora/1/9/1990"
      ]
    },
    {
      candidate: "B15",
      presetId: "v8:calathea-lutea",
      species: "calathea-lutea",
      scientificName: "Calathea lutea",
      label: "\u94F6\u80CC\u5927\u53F6\u7AF9\u828B\u7C7B",
      wave: 2,
      kind: "zingiberales",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://powo.science.kew.org/taxon/60458866-2",
        "https://www.nparks.gov.sg/florafaunaweb/flora/1/7/1751"
      ]
    },
    {
      candidate: "B16",
      presetId: "v8:megaphrynium-macrostachyum",
      species: "megaphrynium-macrostachyum",
      scientificName: "Megaphrynium macrostachyum",
      label: "Megaphrynium macrostachyum",
      wave: 3,
      kind: "zingiberales",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://powo.science.kew.org/taxon/urn%3Alsid%3Aipni.org%3Anames%3A565168-1/general-information"
      ]
    },
    {
      candidate: "B17",
      presetId: "v8:donax-canniformis",
      species: "donax-canniformis",
      scientificName: "Donax canniformis",
      label: "\u7AF9\u53F6\u8549",
      wave: 3,
      kind: "zingiberales",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://www.iplant.cn/foc/pdf/Marantaceae.pdf"
      ]
    },
    {
      candidate: "A01",
      presetId: "v8:leucocasia-gigantea",
      species: "leucocasia-gigantea",
      scientificName: "Leucocasia gigantea",
      label: "\u5DE8\u578B\u6D45\u8272\u828B\u7C7B",
      wave: 1,
      kind: "aroid",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://powo.science.kew.org/taxon/urn%3Alsid%3Aipni.org%3Anames%3A87427-1/general-information"
      ]
    },
    {
      candidate: "A02",
      presetId: "v8:cyrtosperma-merkusii",
      species: "cyrtosperma-merkusii",
      scientificName: "Cyrtosperma merkusii",
      label: "\u592A\u5E73\u6D0B\u6CBC\u6CFD\u5DE8\u828B",
      wave: 1,
      kind: "aroid",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://powo.science.kew.org/taxon/urn%3Alsid%3Aipni.org%3Anames%3A86811-1",
        "https://www.fao.org/4/i1950e/i1950e.pdf",
        "https://www.nparks.gov.sg/florafaunaweb/flora/5/9/5909"
      ]
    },
    {
      candidate: "A03",
      presetId: "v8:alocasia-robusta",
      species: "alocasia-robusta",
      scientificName: "Alocasia robusta",
      label: "\u5A46\u7F57\u6D32\u5DE8\u53F6\u6D77\u828B",
      wave: 4,
      kind: "aroid",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://powo.science.kew.org/taxon/urn%3Alsid%3Aipni.org%3Anames%3A84238-1"
      ]
    },
    {
      candidate: "A04",
      presetId: "v8:alocasia-odora",
      species: "alocasia-odora",
      scientificName: "Alocasia odora",
      label: "\u6D77\u828B",
      wave: 2,
      kind: "aroid",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://www.nparks.gov.sg/florafaunaweb/flora/3/3/3361",
        "https://www.nparks.gov.sg/florafaunaweb/resource/-/media/ffw/general/comparison-of-similar-plants/alocasia-macrorrhizos-vs-alocasia-odora---june-2025.pdf"
      ]
    },
    {
      candidate: "A05",
      presetId: "v8:xanthosoma-sagittifolium",
      species: "xanthosoma-sagittifolium",
      scientificName: "Xanthosoma sagittifolium",
      label: "\u7BAD\u53F6\u828B\u7C7B",
      wave: 2,
      kind: "aroid",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://www.nparks.gov.sg/florafaunaweb/flora/8/4/8443"
      ]
    },
    {
      candidate: "A06",
      presetId: "v8:monstera-deliciosa",
      species: "monstera-deliciosa",
      scientificName: "Monstera deliciosa",
      label: "\u9F9F\u80CC\u7AF9\uFF0C\u6210\u719F\u6500\u63F4\u4F53",
      wave: 3,
      kind: "aroid",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://www.nparks.gov.sg/florafaunaweb/flora/1/4/1453"
      ]
    },
    {
      candidate: "A07",
      presetId: "v8:rhaphidophora-decursiva",
      species: "rhaphidophora-decursiva",
      scientificName: "Rhaphidophora decursiva",
      label: "\u5DE8\u88C2\u53F6\u4E9A\u6D32\u6500\u63F4\u4F53",
      wave: 3,
      kind: "aroid",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://powo.science.kew.org/taxon/urn%3Alsid%3Aipni.org%3Anames%3A88471-1/general-information"
      ]
    },
    {
      candidate: "P01",
      presetId: "v8:nypa-fruticans",
      species: "nypa-fruticans",
      scientificName: "Nypa fruticans",
      label: "\u6C34\u6930",
      wave: 1,
      kind: "palm-or-pandanus",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://www.nparks.gov.sg/florafaunaweb/flora/2/6/2658"
      ]
    },
    {
      candidate: "P02",
      presetId: "v8:raphia-farinifera",
      species: "raphia-farinifera",
      scientificName: "Raphia farinifera",
      label: "\u62C9\u83F2\u68D5",
      wave: 2,
      kind: "palm-or-pandanus",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://powo.science.kew.org/taxon/urn%3Alsid%3Aipni.org%3Anames%3A669503-1/general-information",
        "https://prota.prota4u.org/protav8.asp?p=Raphia+farinifera",
        "https://plantuse.plantnet.org/en/Raphia_farinifera_%28PROTA%29"
      ]
    },
    {
      candidate: "P03",
      presetId: "v8:caryota-urens",
      species: "caryota-urens",
      scientificName: "Caryota urens",
      label: "\u5355\u5E72\u9C7C\u5C3E\u8475",
      wave: 3,
      kind: "palm-or-pandanus",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://www.fao.org/4/ag132e/ag132e07.pdf"
      ]
    },
    {
      candidate: "P04",
      presetId: "v8:corypha-utan",
      species: "corypha-utan",
      scientificName: "Corypha utan",
      label: "\u5DE8\u578B\u6247\u53F6\u68D5\u6988",
      wave: 1,
      kind: "palm-or-pandanus",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://powo.science.kew.org/taxon/urn%3Alsid%3Aipni.org%3Anames%3A666349-1/general-information"
      ]
    },
    {
      candidate: "P05",
      presetId: "v8:licuala-grandis",
      species: "licuala-grandis",
      scientificName: "Licuala grandis",
      label: "\u5706\u53F6\u76B1\u6247\u68D5",
      wave: 3,
      kind: "palm-or-pandanus",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://www.nparks.gov.sg/FloraFaunaWeb/Flora/5/1/5102"
      ]
    },
    {
      candidate: "P06",
      presetId: "v8:lodoicea-maldivica",
      species: "lodoicea-maldivica",
      scientificName: "Lodoicea maldivica",
      label: "\u585E\u820C\u5C14\u6D77\u6930\u5B50",
      wave: 4,
      kind: "palm-or-pandanus",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://powo.science.kew.org/taxon/urn%3Alsid%3Aipni.org%3Anames%3A668084-1",
        "https://www.sif.sc/sites/default/files/downloads/SIF%20Annual%20Report%202024%20Final%20%28LQ%29.pdf"
      ]
    },
    {
      candidate: "P07",
      presetId: "v8:arenga-pinnata",
      species: "arenga-pinnata",
      scientificName: "Arenga pinnata",
      label: "\u7CD6\u68D5",
      wave: 4,
      kind: "palm-or-pandanus",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://www.nparks.gov.sg/florafaunaweb/flora/3/2/3285"
      ]
    },
    {
      candidate: "P08",
      presetId: "v8:pandanus-tectorius",
      species: "pandanus-tectorius",
      scientificName: "Pandanus tectorius",
      label: "\u6D77\u5CB8\u9732\u515C\u6811",
      wave: 4,
      kind: "palm-or-pandanus",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://www.nparks.gov.sg/florafaunaweb/flora/5/2/5242"
      ]
    },
    {
      candidate: "F01",
      presetId: "v8:angiopteris-evecta",
      species: "angiopteris-evecta",
      scientificName: "Angiopteris evecta",
      label: "\u5927\u578B\u5408\u8F74\u8568\u7C7B",
      wave: 4,
      kind: "fern",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://www.nparks.gov.sg/florafaunaweb/flora/1/5/1539"
      ]
    },
    {
      candidate: "F02",
      presetId: "v8:sphaeropteris-lepifera",
      species: "sphaeropteris-lepifera",
      scientificName: "Sphaeropteris lepifera",
      label: "\u7B14\u686B\u6924",
      wave: 4,
      kind: "fern",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://www.efloras.org/florataxon.aspx?flora_id=3&taxon_id=200003202"
      ]
    },
    {
      candidate: "F03",
      presetId: "v8:asplenium-nidus",
      species: "asplenium-nidus",
      scientificName: "Asplenium nidus",
      label: "\u9E1F\u5DE2\u8568\uFF0C\u4E25\u683C\u8EAB\u4EFD\u6750\u6599",
      wave: 4,
      kind: "fern",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://www.nparks.gov.sg/florafaunaweb/flora/1/5/1541",
        "https://biodiversitysg.nparks.gov.sg/our-biodiversity/ferns/bird-s-nest-fern/"
      ]
    },
    {
      candidate: "F04",
      presetId: "v8:platycerium-coronarium",
      species: "platycerium-coronarium",
      scientificName: "Platycerium coronarium",
      label: "\u4E9A\u6D32\u5927\u578B\u9E7F\u89D2\u8568",
      wave: 4,
      kind: "fern",
      requalification: false,
      researchStatus: "reference-package-in-progress",
      visualAcceptance: "pending-user-review",
      record: "Docs/VegetationKnowledge/tropical-library-botanical-research-2026-10-02.md",
      referenceLinks: [
        "https://www.nparks.gov.sg/florafaunaweb/flora/1/5/1562",
        "https://biodiversitysg.nparks.gov.sg/our-biodiversity/ferns/staghorn-fern/"
      ]
    }
  ]
};

// ../current-site-source/checkout/src/TropicalLibrary/FloralIdentity76.ts
var FLORAL_SPECIES76 = /* @__PURE__ */ new Set(["etlingera-elatior", "heliconia-bihai", "heliconia-caribaea", "heliconia-latispatha", "heliconia-chartacea"]);

// ../current-site-source/checkout/src/TropicalLibrary/Materials76.ts
var MATERIAL_IDENTITY76 = {
  "artocarpus-altilis": { id: "lobed-cultivated-reference", label: "\u88C2\u53F6\u683D\u57F9\u53C2\u8003", scope: "unnamed lobed cultivated material; no cultivar/accession claim" },
  "cyrtosperma-merkusii": { id: "pacific-cultivated-reference", label: "\u592A\u5E73\u6D0B\u683D\u57F9\u53C2\u8003", scope: "bounded PROSEA cultivated reference; no named clone/accession claim" },
  "heliconia-bihai": { id: "lobster-claw-one", label: "Lobster Claw One", scope: "named horticultural material; not all wild H. bihai" },
  "heliconia-latispatha": { id: "orange-gyro", label: "Orange Gyro", scope: "named horticultural material; not all wild H. latispatha" },
  "heliconia-chartacea": { id: "sexy-scarlet", label: "Sexy Scarlet", scope: "named horticultural material; no Sexy Pink size substitution" }
};
var materialIdentity76 = (species) => MATERIAL_IDENTITY76[species] ?? { id: "wild-reference", label: "\u690D\u7269\u5B66\u53C2\u8003\u6750\u6599", scope: "species reference; authored reconstruction, no germplasm accession claim" };

// ../current-site-source/checkout/src/TropicalLibrary/Catalog76.ts
var TROPICAL_RESEARCH76 = research76_default.entries;
function researchEntry76(species) {
  const e = TROPICAL_RESEARCH76.find((e2) => e2.species === species);
  if (!e) throw Error("Unregistered tropical identity: " + species);
  return e;
}
function assertProfile76(p) {
  if (!p || p.profileVersion !== 8 || p.tropicalLibraryVersion !== 76 || ![74, 77, 78].includes(p.productionSystemVersion) || p.leafNaturalismVersion !== 73 || p.treeLeafVersion !== 75 || !["normal", "renewing"].includes(p.condition76)) throw Error("An explicit tropical library76 / production74 or 77 / leaf73+75 profile is required");
  researchEntry76(p.species);
  if (typeof p.reproductive76 !== "boolean" || p.reproductive76 && (!FLORAL_SPECIES76.has(p.species) || p.stage !== "adult")) throw Error("Unregistered native reproductive material or stage");
  if (!Number.isInteger(p.seed) || p.seed < 0 || p.seed > 4294967295 || !["juvenile", "establishing", "adult"].includes(p.stage) || !["sheltered", "competitive", "open-grown"].includes(p.habitatForm) || typeof p.material !== "string" || !p.material.trim()) throw Error("Invalid tropical identity, developmental stage or seed");
  if (p.material !== materialIdentity76(p.species).id) throw Error("This plant material has not been independently registered: " + p.material);
  if (p.support76) {
    const s = p.support76;
    if (s.supportVersion !== 76 || !["diagnostic-cylinder", "fixed-bark"].includes(s.kind) || !s.id || s.radius <= 0 || s.radius > 2 || s.height <= 0 || s.height > 20 || !Number.isFinite(s.radius + s.height) || s.position.length !== 3 || s.position.some((v) => !Number.isFinite(v))) throw Error("Invalid explicit native support");
    if (s.kind === "fixed-bark" && (!s.host76 || !s.host76.snapshotHash.match(/^[0-9a-f]{64}$/) || s.host76.guide.length < 2 || !(s.host76.geometry.positions instanceof Float32Array) || !(s.host76.geometry.indices instanceof Uint32Array) || !s.host76.geometry.barkCoordinates69 || s.host76.surfaces.bindings[0]?.role !== "wood")) throw Error("Explicit support requires final saved bark triangles and motion frames");
  }
}

// ../current-site-source/checkout/src/Authoring/NativeOrganIndex77.ts
var NativeOrganIndex77 = class {
  constructor(organs, counts) {
    this.organs = organs;
    this.counts = counts;
    if (!Number.isSafeInteger(counts.axes) || !Number.isSafeInteger(counts.blades) || counts.axes < 1 || counts.blades < 0 || counts.axes + counts.blades !== organs.length) throw Error("Invalid native77 organ table dimensions");
    this.validPaths = new Uint8Array(organs.length);
  }
  validPaths;
  expectedId(row) {
    return row < this.counts.axes ? "axis/" + row : "blade/" + (row - this.counts.axes);
  }
  row(id) {
    const axis = id.startsWith("axis/"), blade = id.startsWith("blade/");
    if (!axis && !blade) return;
    const n = Number(id.slice(axis ? 5 : 6)), limit = axis ? this.counts.axes : this.counts.blades;
    if (!Number.isSafeInteger(n) || n < 0 || n >= limit || id !== (axis ? "axis/" : "blade/") + n) return;
    const row = axis ? n : this.counts.axes + n;
    return this.organs[row]?.id === id ? row : void 0;
  }
  get(id) {
    const row = this.row(id);
    return row === void 0 ? void 0 : this.organs[row];
  }
  has(id) {
    return this.row(id) !== void 0;
  }
  pathValid(id) {
    const row = this.row(id);
    return row !== void 0 && this.validPaths[row] === 1;
  }
};

// ../current-site-source/checkout/src/Authoring/VegetationCategoryConstraints.ts
var axisKinds = /* @__PURE__ */ new Set(["trunk", "branch", "stem", "culm"]);
var foliageKinds = /* @__PURE__ */ new Set(["leaf", "blade", "frond"]);
var children = {
  root: ["root", "rhizome", "trunk", "branch", "stem", "culm", "petiole", "rachis", "frond", "leaf", "blade"],
  rhizome: ["root", "rhizome", "trunk", "branch", "stem", "culm", "petiole", "rachis", "frond", "leaf", "blade"],
  trunk: ["root", "branch", "stem", "petiole", "rachis", "frond", "leaf", "blade"],
  branch: ["root", "branch", "stem", "petiole", "rachis", "frond", "leaf", "blade"],
  stem: ["root", "branch", "stem", "petiole", "rachis", "frond", "leaf", "blade"],
  culm: ["root", "branch", "culm", "stem", "petiole", "leaf", "blade"],
  petiole: ["rachis", "frond", "leaf", "blade"],
  rachis: ["rachis", "petiole", "leaf", "blade"],
  frond: ["rachis", "petiole", "leaf", "blade"],
  leaf: [],
  blade: []
};
var categories = ["Tree", "Shrub", "Fern", "Grass", "Herb"];
var historicalCategoryArchitectures = /* @__PURE__ */ new Set(["coconut-pinnate/54", ...[52, 53, 59, 61].flatMap((v) => ["artocarpus-mariannensis", "calophyllum-inophyllum"].map((f) => `${f}/${v}`))]);
function attachmentStation(parent, child) {
  let nearest = Infinity, station = 0;
  const point = child.path[0].position;
  for (let i = 1; i < parent.path.length; i++) {
    const a = parent.path[i - 1].position, b = parent.path[i].position;
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], length = dx * dx + dy * dy + dz * dz;
    if (length === 0) continue;
    const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy + (point[2] - a[2]) * dz) / length));
    const distance = (point[0] - a[0] - dx * t) ** 2 + (point[1] - a[1] - dy * t) ** 2 + (point[2] - a[2] - dz * t) ** 2;
    if (distance < nearest) {
      nearest = distance;
      station = i - 1 + t;
    }
  }
  return station;
}
function validateVegetationCategory(input) {
  const issues = [];
  const reject = (code, message, organId) => issues.push({ code, message, ...organId ? { organId } : {} });
  const organs = input.organs, byId = input.productionSystemVersion === 77 ? new NativeOrganIndex77(organs, input.nativeOrganCounts77) : new Map(organs.map((o) => [o.id, o]));
  if (!categories.includes(input.category)) reject("category.unknown", "No category topology contract exists.");
  if (input.categoryConstraintVersion !== void 0 && ![1, 2].includes(input.categoryConstraintVersion)) reject("category.version", "Unregistered category constraint version.");
  if (input.categoryConstraintVersion === 1 && !historicalCategoryArchitectures.has(input.architecture)) reject("category.legacy-architecture", "Only explicitly frozen historical architectures may select the old category contract.");
  const bases = organs.filter((o) => o.parentId === null);
  if (bases.some((o) => !["root", "rhizome", "trunk", "stem", "culm"].includes(o.kind))) reject("category.basal-kind", "A leaf-bearing petiole, rachis, frond or branch cannot substitute for the basal plant axis.");
  for (const organ of organs) {
    const parent = organ.parentId === null ? void 0 : byId.get(organ.parentId);
    if (parent && !children[parent.kind]?.includes(organ.kind)) reject("category.organ-relation", `${parent.kind} cannot develop a ${organ.kind} as a support child.`, organ.id);
  }
  if (input.lifeStage === "bamboo-shoot") {
    if (input.category !== "Tree" || input.architecture !== "authored-bamboo-shoot-74") reject("category.lifecycle-unregistered", "Leafless admission requires the registered bamboo shoot architecture.");
    if (!organs.some((o) => o.kind === "culm") || organs.some((o) => !["rhizome", "root", "culm"].includes(o.kind))) reject("category.bamboo-shoot-organs", "A leafless bamboo shoot requires a rooted culm graph without a mature branching crown.");
    return { evidence: ["Checked explicitly registered leafless bamboo shoot development."], issues };
  }
  if (!organs.some((o) => foliageKinds.has(o.kind))) reject("category.living-foliage-missing", "A complete leafy specimen needs authored foliage connected to its basal support.");
  if (input.category === "Tree" || input.category === "Shrub") {
    const livingSupport = /* @__PURE__ */ new Set();
    if (!organs.some((o) => axisKinds.has(o.kind))) reject("category.standing-axis-missing", "A tree or shrub needs a persistent standing support axis.");
    for (const leaf of organs.filter((o) => foliageKinds.has(o.kind))) {
      let cursor = byId.get(leaf.parentId ?? "");
      const seen = /* @__PURE__ */ new Set();
      let supported = false;
      while (cursor && !seen.has(cursor.id)) {
        seen.add(cursor.id);
        livingSupport.add(cursor.id);
        supported ||= axisKinds.has(cursor.kind);
        cursor = byId.get(cursor.parentId ?? "");
      }
      if (!supported) reject("category.crown-support-missing", "Woody or palm crown foliage must descend from a standing axis.", leaf.id);
    }
    const births = /* @__PURE__ */ new Map();
    for (const child of organs) if (child.parentId !== null && (livingSupport.has(child.id) || foliageKinds.has(child.kind))) {
      const group = births.get(child.parentId) ?? [];
      group.push(child);
      births.set(child.parentId, group);
    }
    for (const axis of input.categoryConstraintVersion === 1 ? [] : organs.filter((o) => axisKinds.has(o.kind) && livingSupport.has(o.id))) {
      const lastLiving = Math.max(0, ...(births.get(axis.id) ?? []).map((child) => attachmentStation(axis, child)));
      for (let i = 1; i <= Math.min(Math.ceil(lastLiving - 1e-7), axis.path.length - 1); i++) {
        const fraction = Math.min(1, lastLiving - (i - 1)), radius = axis.path[i - 1].radius + fraction * (axis.path[i].radius - axis.path[i - 1].radius);
        if (radius < axis.path[i - 1].radius * 0.5)
          reject("category.living-axis-constriction", "A living standing support axis abruptly loses more than half its radius before its supported crown.", axis.id);
      }
    }
  }
  if (input.category === "Fern") {
    for (const leaf of organs.filter((o) => o.kind === "leaf" || o.kind === "blade")) {
      let cursor = byId.get(leaf.parentId ?? "");
      const seen = /* @__PURE__ */ new Set();
      let supported = false;
      while (cursor && !seen.has(cursor.id)) {
        seen.add(cursor.id);
        supported ||= ["petiole", "rachis", "frond"].includes(cursor.kind);
        cursor = byId.get(cursor.parentId ?? "");
      }
      if (!supported) reject("category.fern-frond-support-missing", "Every fern blade requires its own petiole or frond-axis ancestry.", leaf.id);
    }
    if (organs.some((o) => o.kind === "culm" || o.kind === "branch")) reject("category.fern-woody-branch", "Fern foliage must use frond axes, not woody branches or grass culms.");
    if (!organs.some((o) => ["petiole", "rachis", "frond"].includes(o.kind))) reject("category.fern-frond-axis-missing", "A fern requires a continuous frond or petiole/rachis axis.");
  }
  if (input.category === "Grass") {
    if (organs.some((o) => ["trunk", "petiole", "rachis", "frond"].includes(o.kind))) reject("category.grass-organ-kind", "Grass production needs culm/tiller and leaf organs rather than trunks or fronds.");
    if (!organs.some((o) => o.kind === "stem" || o.kind === "culm" || input.categoryConstraintVersion === 1 && o.kind === "rhizome")) reject("category.grass-tiller-missing", "Grass requires an authored tiller, culm or shoot sheath rather than blades directly on a runner.");
    for (const leaf of input.categoryConstraintVersion === 1 ? [] : organs.filter((o) => o.kind === "leaf" || o.kind === "blade")) {
      let cursor = byId.get(leaf.parentId ?? "");
      const seen = /* @__PURE__ */ new Set();
      let supported = false;
      while (cursor && !seen.has(cursor.id)) {
        seen.add(cursor.id);
        supported ||= cursor.kind === "stem" || cursor.kind === "culm";
        cursor = byId.get(cursor.parentId ?? "");
      }
      if (!supported) reject("category.grass-blade-support-missing", "Every grass blade requires its own tiller, culm or shoot-sheath ancestry.", leaf.id);
    }
  }
  if (input.category === "Herb" && organs.some((o) => ["trunk", "branch", "culm"].includes(o.kind))) reject("category.herb-organ-kind", "This non-grass herb contract uses stems, rhizomes and petioles, not woody axes or culms.");
  return { evidence: [`Checked ${input.category} organ roles, basal support and living foliage across ${organs.length} authored organs.`], issues };
}

// ../current-site-source/checkout/src/Authoring/VegetationProductionGate.ts
var kinds = /* @__PURE__ */ new Set(["root", "rhizome", "trunk", "branch", "stem", "culm", "petiole", "rachis", "leaf", "frond", "blade"]);
var terminalKinds = /* @__PURE__ */ new Set(["leaf", "blade"]);
var distanceSquared = (a, b) => a.reduce((sum, n, i) => sum + (n - b[i]) ** 2, 0);
function attached(base, parent) {
  const path = parent.path;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const delta = b.position.map((n, axis) => n - a.position[axis]);
    const lengthSquared = delta.reduce((sum, n) => sum + n * n, 0);
    if (lengthSquared <= 0) continue;
    const t = Math.max(0, Math.min(1, delta.reduce((sum, n, axis) => sum + (base.position[axis] - a.position[axis]) * n, 0) / lengthSquared));
    const nearest = a.position.map((n, axis) => n + t * delta[axis]);
    const radius = a.radius + t * (b.radius - a.radius);
    if (distanceSquared(base.position, nearest) <= (radius + 1e-7) ** 2) return true;
  }
  return false;
}
function validateProductionOrganGraph(organs, nativeCounts77) {
  const issues = [];
  const fail = (code, message, organId) => issues.push({ code, message, ...organId === void 0 ? {} : { organId } });
  if (organs.length === 0) fail("organs.missing", "No authored organ graph was provided.");
  const native = nativeCounts77 ? new NativeOrganIndex77(organs, nativeCounts77) : void 0;
  const byId = native ?? /* @__PURE__ */ new Map();
  const validPaths = native ? { has: (id) => native.pathValid(id), add: (id) => {
    const row = native.row(id);
    if (row !== void 0) native.validPaths[row] = 1;
  } } : /* @__PURE__ */ new Set();
  for (let row = 0; row < organs.length; row++) {
    const organ = organs[row];
    if (!organ.id.trim() || (native ? organ.id !== native.expectedId(row) : byId.has(organ.id))) fail("organs.identity", "Organ IDs must be nonempty and unique.", organ.id);
    if (byId instanceof Map) byId.set(organ.id, organ);
    if (!kinds.has(organ.kind)) fail("organs.kind", "Unregistered organ kind.", organ.id);
    const path = organ.path;
    let valid = path.length >= 2;
    for (const p of path) valid = valid && p.position.length === 3 && p.position.every(Number.isFinite) && Number.isFinite(p.radius) && p.radius > 0;
    if (valid) {
      for (let i = 1; i < path.length; i++) {
        if (distanceSquared(path[i - 1].position, path[i].position) <= 0) valid = false;
      }
    }
    if (!valid) fail("organs.dimensions", "Every organ requires finite coordinates, positive local radii and nonzero path segments.", organ.id);
    else validPaths.add(organ.id);
  }
  const roots = organs.filter((organ) => organ.parentId === null);
  if (roots.length !== 1) fail("organs.root", "A specimen requires exactly one connected basal support; multiple stems must share a root or rhizome.");
  if (roots.some((organ) => terminalKinds.has(organ.kind))) fail("organs.root-kind", "A terminal leaf cannot be the basal support.");
  for (const organ of organs) {
    if (organ.parentId !== null) {
      const parent = byId.get(organ.parentId);
      if (!parent) fail("organs.parent", "The supporting parent is missing.", organ.id);
      else {
        if (terminalKinds.has(parent.kind)) fail("organs.terminal-parent", "A terminal leaf cannot support a new axis.", organ.id);
        if (validPaths.has(organ.id) && validPaths.has(parent.id) && !attached(organ.path[0], parent)) fail("organs.detached", "The attachment is outside its parent local 3-D envelope.", organ.id);
      }
    }
    const seen = /* @__PURE__ */ new Set();
    let cursor = organ;
    while (cursor) {
      if (seen.has(cursor.id)) {
        fail("organs.cycle", "The support graph contains a cycle.", organ.id);
        break;
      }
      seen.add(cursor.id);
      cursor = cursor.parentId === null ? void 0 : byId.get(cursor.parentId);
    }
  }
  return { evidence: organs.length ? [`Checked ${organs.length} authored organ paths and their local 3-D attachments.`] : [], issues };
}
function runValidator(validator, input, layer) {
  if (!validator) return { status: "failed", evidence: [], issues: [{ code: `${layer}.unregistered`, message: `No explicit ${layer} validator is registered.` }] };
  try {
    const result = validator(input);
    if (!result || !Array.isArray(result.evidence) || !Array.isArray(result.issues)) throw new Error("Validator must return evidence and issues.");
    const evidence = result.evidence.filter((item) => typeof item === "string" && item.trim().length > 0);
    const issues = [...result.issues];
    if (!evidence.length) issues.push({ code: `${layer}.evidence-missing`, message: "An empty evidence set cannot establish acceptance." });
    return { status: issues.length ? "failed" : "passed", evidence, issues };
  } catch (error) {
    return { status: "failed", evidence: [], issues: [{ code: `${layer}.validator-error`, message: error instanceof Error ? error.message : String(error) }] };
  }
}
var blocked = (layer) => ({ status: "blocked", evidence: [], issues: [{ code: `${layer}.blocked`, message: "A preceding layer did not pass; this validator was not run." }] });
function evaluateVegetationProduction(input, strategies2) {
  let support;
  try {
    if (input.productionSystemVersion === 77 && !input.nativeOrganCounts77) throw Error("Explicit native77 organ tables are required");
    support = validateProductionOrganGraph(input.organs, input.productionSystemVersion === 77 ? input.nativeOrganCounts77 : void 0);
  } catch (error) {
    support = { evidence: [], issues: [{ code: "organs.identity", message: error instanceof Error ? error.message : String(error) }] };
  }
  const topology = support.issues.length ? { evidence: [], issues: [] } : validateVegetationCategory(input);
  const graph = { evidence: [...support.evidence, ...topology.evidence], issues: [...support.issues, ...topology.issues] };
  const common = !Number.isInteger(input.seed) || input.seed < 0 || input.seed > 4294967295 ? { ...graph, issues: [...graph.issues, { code: "seed.invalid", message: "Seed must be a uint32." }] } : graph;
  let category2;
  if (common.issues.length) category2 = { ...common, status: "failed" };
  else {
    const specific = runValidator(Object.hasOwn(strategies2.category, input.category) ? strategies2.category[input.category] : void 0, input, "category");
    category2 = { ...specific, evidence: [...common.evidence, ...specific.evidence] };
  }
  const architecture = category2.status === "passed" ? runValidator(Object.hasOwn(strategies2.architecture, input.architecture) ? strategies2.architecture[input.architecture] : void 0, input, "architecture") : blocked("architecture");
  const seed2 = architecture.status === "passed" ? runValidator(strategies2.seed, input, "seed") : blocked("seed");
  return { categoryConstraintVersion: input.categoryConstraintVersion ?? 2, category: input.category, architecture: input.architecture, seed: input.seed, status: seed2.status === "passed" ? "passed" : "failed", layers: { category: category2, architecture, seed: seed2 }, visualAcceptance: "unreviewed", hardwareAcceptance: "unvalidated" };
}

// ../current-site-source/checkout/src/TropicalLibrary/SupportSurface76.ts
import { Triangle, Vector3 as Vector32 } from "../vendor/three.module.min.js";

// ../current-site-source/checkout/src/Generator/HostContactSurface.ts
import { Ray, Vector3 } from "../vendor/three.module.min.js";
var HostContactSurface = class {
  constructor(positions, indices, barkCount, cell = 0.8, completeCells76 = false) {
    this.positions = positions;
    this.indices = indices;
    this.cell = cell;
    this.completeCells76 = completeCells76;
    const { a, b, c } = this;
    for (let i = 0; i < barkCount; i += 3) {
      a.fromArray(positions, indices[i] * 3);
      b.fromArray(positions, indices[i + 1] * 3);
      c.fromArray(positions, indices[i + 2] * 3);
      const lo = a.clone().min(b).min(c).divideScalar(cell).floor(), hi = a.clone().max(b).max(c).divideScalar(cell).floor();
      for (let x = lo.x; x <= hi.x; x++) for (let y = lo.y; y <= hi.y; y++) for (let z = lo.z; z <= hi.z; z++) {
        const key = `${x},${y},${z}`, list = this.cells.get(key) ?? [];
        list.push(i);
        this.cells.set(key, list);
      }
    }
  }
  cells = /* @__PURE__ */ new Map();
  a = new Vector3();
  b = new Vector3();
  c = new Vector3();
  hit = new Vector3();
  project(center, outward, radius) {
    const reach = radius * 1.7 + 0.3, normal = outward.clone().normalize(), origin = center.clone().addScaledVector(normal, reach), ray = new Ray(origin, normal.clone().negate());
    const seen = /* @__PURE__ */ new Set(), { a, b, c, hit } = this;
    let best = reach * 2, result;
    for (let distance = 0; distance <= reach * 2; distance += this.cell * 0.45) {
      const q = ray.at(distance, new Vector3()).divideScalar(this.cell).floor();
      const margin = this.completeCells76 ? 1 : 0;
      for (let x = q.x - margin; x <= q.x + margin; x++) for (let y = q.y - margin; y <= q.y + margin; y++) for (let z = q.z - margin; z <= q.z + margin; z++) for (const i of this.cells.get(`${x},${y},${z}`) ?? []) {
        if (seen.has(i)) continue;
        seen.add(i);
        a.fromArray(this.positions, this.indices[i] * 3);
        b.fromArray(this.positions, this.indices[i + 1] * 3);
        c.fromArray(this.positions, this.indices[i + 2] * 3);
        if (!ray.intersectTriangle(a, b, c, false, hit)) continue;
        const d = origin.distanceTo(hit), n = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
        if (d >= best || n.dot(normal) < 0.05 || hit.distanceTo(center) > radius * 1.7 + 0.12) continue;
        best = d;
        result = { point: hit.clone().addScaledVector(n, 0.016), normal: n };
      }
    }
    return result;
  }
};

// ../current-site-source/checkout/src/TropicalLibrary/SupportSurface76.ts
var surfaces = /* @__PURE__ */ new WeakMap();
var contacts = /* @__PURE__ */ new WeakMap();
var cell76 = 0.4;
function supportDistance76(s, p) {
  if (s.kind === "diagnostic-cylinder") return Math.abs(Math.hypot(p[0] - s.position[0], p[2] - s.position[2]) - s.radius);
  const host = s.host76;
  let cells = contacts.get(s);
  const triangle = new Triangle(), point = new Vector32(...p), hit = new Vector32(), g = host.geometry;
  const read = (i) => {
    triangle.a.fromArray(g.positions, g.indices[i] * 3);
    triangle.b.fromArray(g.positions, g.indices[i + 1] * 3);
    triangle.c.fromArray(g.positions, g.indices[i + 2] * 3);
  };
  if (!cells) {
    cells = /* @__PURE__ */ new Map();
    for (let i = 0; i < g.indices.length; i += 3) {
      read(i);
      const lo = triangle.a.clone().min(triangle.b).min(triangle.c).divideScalar(cell76).floor(), hi = triangle.a.clone().max(triangle.b).max(triangle.c).divideScalar(cell76).floor();
      for (let x = lo.x; x <= hi.x; x++) for (let y = lo.y; y <= hi.y; y++) for (let z = lo.z; z <= hi.z; z++) {
        const key = `${x},${y},${z}`, list = cells.get(key) ?? [];
        list.push(i);
        cells.set(key, list);
      }
    }
    contacts.set(s, cells);
  }
  const base = point.clone().divideScalar(cell76).floor(), seen = /* @__PURE__ */ new Set();
  let nearest = Infinity;
  for (let x = base.x - 1; x <= base.x + 1; x++) for (let y = base.y - 1; y <= base.y + 1; y++) for (let z = base.z - 1; z <= base.z + 1; z++) for (const i of cells.get(`${x},${y},${z}`) ?? []) {
    if (seen.has(i)) continue;
    seen.add(i);
    read(i);
    triangle.closestPointToPoint(point, hit);
    nearest = Math.min(nearest, point.distanceTo(hit));
  }
  return nearest;
}
function supportPoint76(s, y, angle) {
  const normal = new Vector32(Math.cos(angle), 0, Math.sin(angle)), centre = new Vector32(s.position[0], y, s.position[2]);
  if (s.kind === "diagnostic-cylinder") return { point: centre.addScaledVector(normal, s.radius), normal };
  const host = s.host76;
  if (!host) throw Error("Missing fixed final bark support");
  const guide = host.guide;
  let radius = s.radius;
  for (let i = 1; i < guide.length; i++) {
    const a = guide[i - 1], b = guide[i];
    if (y < a.position[1] || y > b.position[1]) continue;
    const t = (y - a.position[1]) / (b.position[1] - a.position[1]);
    centre.fromArray(a.position).lerp(new Vector32(...b.position), t);
    radius = a.radius * (1 - t) + b.radius * t;
    break;
  }
  let surface = surfaces.get(s);
  if (!surface) {
    surface = new HostContactSurface(host.geometry.positions, host.geometry.indices, host.geometry.indices.length, 0.8, true);
    surfaces.set(s, surface);
  }
  const hit = surface.project(centre, normal, Math.max(radius, s.radius * 1.8));
  if (!hit) throw Error(`Dependent organ has no contact with final saved bark at y=${y}, azimuth=${angle}`);
  return { point: hit.point.addScaledVector(hit.normal, -0.016), normal: hit.normal };
}
function supportSnapshot76(s) {
  return s.host76 ? { geometry: s.host76.geometry, surfaces: s.host76.surfaces, guide: s.host76.guide, assetId: s.host76.assetId, contentHash: s.host76.contentHash } : void 0;
}

// ../current-site-source/checkout/src/TropicalLibrary/WoodDevelopment77.ts
import { Vector3 as Vector37 } from "../vendor/three.module.min.js";

// ../current-site-source/checkout/src/TropicalLibrary/Growth76.ts
import { Vector3 as Vector33, Quaternion } from "../vendor/three.module.min.js";

// ../current-site-source/checkout/src/Authoring/ProductionSystem77.ts
function leafPitchResidual77(leaves) {
  const n = leaves.length, x = leaves.reduce((s, l) => s + l.age, 0) / n, y = leaves.reduce((s, l) => s + l.pitch, 0) / n, variance = leaves.reduce((s, l) => s + (l.age - x) ** 2, 0), slope = variance ? leaves.reduce((s, l) => s + (l.age - x) * (l.pitch - y), 0) / variance : 0;
  return Math.sqrt(leaves.reduce((s, l) => s + (l.pitch - y - slope * (l.age - x)) ** 2, 0) / n);
}

// ../current-site-source/checkout/src/TropicalLibrary/StemSurface76.ts
import { Color } from "../vendor/three.module.min.js";
var STEM_SPECIES76 = /* @__PURE__ */ new Set(["phenakospermum-guyannense", "ravenala-madagascariensis", "strelitzia-nicolai", "corypha-utan", "raphia-farinifera", "arenga-pinnata", "caryota-urens", "licuala-grandis", "lodoicea-maldivica", "pandanus-tectorius", "sphaeropteris-lepifera"]);
var stemAxes76 = (g) => STEM_SPECIES76.has(g.profile.species) ? g.axes.filter((a) => a.kind === "stem" && a.role === "support-axis") : [];

// ../current-site-source/checkout/src/Authoring/TropicalForestForms.ts
var TROPICAL_FOREST_SPECIES = [
  "artocarpus-mariannensis",
  "horsfieldia-palauensis",
  "semecarpus-venenosus",
  "calophyllum-inophyllum",
  "barringtonia-asiatica",
  "intsia-bijuga",
  "guettarda-speciosa",
  "eugenia-reinwardtiana",
  "scaevola-taccada",
  "pemphis-acidula",
  "premna-serratifolia",
  "ixora-casei"
];

// ../current-site-source/checkout/src/Authoring/TropicalProductionAdmission.ts
var TROPICAL_REBUILD_CANDIDATES = ["artocarpus-mariannensis", "calophyllum-inophyllum"];
var RETIRED_TROPICAL_FOREST_SPECIES = TROPICAL_FOREST_SPECIES.filter((family) => !isTropicalRebuildCandidate(family));
function isTropicalRebuildCandidate(family) {
  return TROPICAL_REBUILD_CANDIDATES.includes(family);
}

// ../current-site-source/checkout/src/TropicalLibrary/AxisColumns77.ts
function path77() {
  return this.readPath77();
}
var AxisView77 = class {
  #points;
  #offset;
  #count;
  constructor(properties, points, offset, count) {
    this.#points = points;
    this.#offset = offset;
    this.#count = count;
    Object.assign(this, properties);
    Object.defineProperty(this, "path", { enumerable: true, get: path77 });
  }
  readPath77() {
    return Array.from({ length: this.#count }, (_, j) => this.#points.point(this.#offset + j));
  }
};
var savedPoints77 = /* @__PURE__ */ new WeakMap();
function savedAxisView77(properties, paths, offset, count) {
  let points = savedPoints77.get(paths);
  if (!points) {
    points = { point(index2) {
      const i = index2 * 4;
      return { position: [paths[i], paths[i + 1], paths[i + 2]], radius: paths[i + 3] };
    } };
    savedPoints77.set(paths, points);
  }
  return new AxisView77(properties, points, offset, count);
}

// ../current-site-source/checkout/src/TropicalLibrary/EventColumns77.ts
var names = ["birth", "expanded", "ground-contact", "support-contact", "unfolding", "leaf-base-scar"];
function views77(length, read, write) {
  const numeric = (key) => typeof key === "string" && /^(0|[1-9][0-9]*)$/.test(key) ? Number(key) : void 0;
  return new Proxy([], {
    get(target, key, receiver) {
      if (key === "length") return length();
      const i = numeric(key);
      return i === void 0 ? Reflect.get(target, key, receiver) : read(i);
    },
    has(target, key) {
      const i = numeric(key);
      return i === void 0 ? Reflect.has(target, key) : i < length();
    },
    set(_target, key, value) {
      if (key === "length") {
        if (value !== length()) throw Error("Event columns cannot truncate birth history");
        return true;
      }
      const i = numeric(key);
      if (i === void 0) throw Error("Invalid event column edit");
      write(i, value);
      return true;
    }
  });
}
function savedEvents77(data, axes) {
  return views77(() => data.length / 3, (i) => {
    if (i >= data.length / 3) return void 0;
    const k = i * 3, organ = data[k + 1];
    return { at: data[k], organ: organ < axes ? "axis/" + organ : "blade/" + (organ - axes), event: names[data[k + 2]] };
  }, () => {
    throw Error("Saved birth history is immutable");
  });
}

// ../current-site-source/checkout/src/TropicalLibrary/GrowthCodec76.ts
var kinds2 = ["root", "rhizome", "trunk", "branch", "stem", "culm", "petiole", "rachis", "leaf", "frond", "blade"];
var roles = ["basal-axis", "absorbing-root", "support-axis", "leaf-sheath", "pseudostem", "petiole", "rachis", "frond", "buttress", "aerial-root", "grounded-prop", "climbing-axis", "floral-axis"];
var outlines = ["oblong", "elliptic", "arrow", "peltate", "lobed", "fishtail", "strap", "fan", "monstera-adult", "rhaphidophora-adult", "breadfruit-lobed", "platycerium-shield", "fern-pinnatifid", "asymmetric-retuse"];
var bladeRoles = ["lamina", "leaflet", "pinna", "shield", "cataphyll", "bract"];
var events = ["birth", "expanded", "ground-contact", "support-contact", "unfolding", "leaf-base-scar"];
function writeBlade76(a, k, b, parent) {
  a.set([parent, bladeRoles.indexOf(b.role), outlines.indexOf(b.outline), b.length, b.width, b.insertion, b.camber, b.droop, b.twist, b.age, b.state75, b.birth, b.folds ?? 0, Number(b.folds !== void 0), ...b.attachment, ...b.direction, ...b.normal, ...b.path[0].position, b.path[0].radius, ...b.path[1].position, b.path[1].radius, kinds2.indexOf(b.kind), b.fanAngle ?? 0, b.distalDivision ?? -1, b.roll ?? 0, ...b.bractColour ?? [0, 0, 0], Number(!!b.bractColour), ...b.bractMargin ?? [0, 0, 0], Number(!!b.bractMargin), b.baseAsymmetry ?? 0], k);
}
function packGrowth76(g) {
  const reference = (id, kind, length) => {
    if (!id.startsWith(kind + "/")) throw Error("Invalid native organ identity");
    const i = Number(id.slice(kind.length + 1));
    if (!Number.isInteger(i) || i < 0 || i >= length || id !== kind + "/" + i) throw Error("Unknown native organ identity");
    return i;
  };
  const axes = new Float64Array(g.axes.length * 15), paths = new Float64Array(g.axes.reduce((n, a) => n + a.path.length * 4, 0)), blades = new Float64Array(g.blades.length * 44), eventData = new Float64Array(g.events.length * 3);
  let cursor = 0;
  for (let i = 0; i < g.axes.length; i++) {
    const a = g.axes[i];
    if (a.id !== "axis/" + i) throw Error("Native axis IDs must retain their birth sequence");
    const parent = a.parentId === null ? -1 : reference(a.parentId, "axis", g.axes.length);
    const offset = cursor / 4;
    for (const p of a.path) {
      paths[cursor++] = p.position[0];
      paths[cursor++] = p.position[1];
      paths[cursor++] = p.position[2];
      paths[cursor++] = p.radius;
    }
    axes.set([kinds2.indexOf(a.kind), roles.indexOf(a.role), parent, a.order, a.birth, a.age, Number(a.fixed), a.section?.lobes ?? 0, a.section?.amplitude ?? 0, a.section?.phase ?? 0, offset, a.path.length, Number(!!a.section), a.buttressHeight ?? 0, 0], i * 15);
  }
  for (let i = 0; i < g.blades.length; i++) {
    const b = g.blades[i], parent = reference(b.parentId, "axis", g.axes.length);
    if (b.id !== "blade/" + i || b.path.length !== 2) throw Error("Invalid native blade birth or support");
    writeBlade76(blades, i * 44, b, parent);
  }
  for (let i = 0; i < g.events.length; i++) {
    const e = g.events[i], organ = e.organ.startsWith("axis/") ? reference(e.organ, "axis", g.axes.length) : g.axes.length + reference(e.organ, "blade", g.blades.length);
    eventData.set([e.at, organ, events.indexOf(e.event)], i * 3);
  }
  const scars76 = new Float64Array(g.scars76.length * 6);
  for (let i = 0; i < g.scars76.length; i++) {
    const s = g.scars76[i];
    scars76.set([reference(s.axisId, "axis", g.axes.length), s.travel, s.azimuth, s.width, s.age, s.birth], i * 6);
  }
  return { codecVersion: 76, scars76, profile: g.profile, category: g.category, architecture: g.architecture, cohort: g.cohort, evidence: g.evidence, axes, axisPaths: paths, blades, events: eventData };
}
function index(list, n) {
  if (!Number.isInteger(n) || n < 0 || n >= list.length) throw Error("Invalid native organ enum");
  return list[n];
}
var ColumnBlade76 = class _ColumnBlade76 {
  #table;
  #row;
  #identity;
  constructor(table, row, identity = row) {
    this.#table = table;
    this.#row = row;
    this.#identity = identity;
  }
  value(column) {
    return this.#table[this.#row * 44 + column];
  }
  point(column) {
    return [this.value(column), this.value(column + 1), this.value(column + 2)];
  }
  get id() {
    return "blade/" + this.#identity;
  }
  get parentId() {
    return "axis/" + this.value(0);
  }
  get kind() {
    return index(kinds2, this.value(31));
  }
  get role() {
    return index(bladeRoles, this.value(1));
  }
  get outline() {
    return index(outlines, this.value(2));
  }
  get length() {
    return this.value(3);
  }
  get width() {
    return this.value(4);
  }
  get insertion() {
    return this.value(5);
  }
  get camber() {
    return this.value(6);
  }
  get droop() {
    return this.value(7);
  }
  get twist() {
    return this.value(8);
  }
  get age() {
    return this.value(9);
  }
  get state75() {
    return this.value(10);
  }
  get birth() {
    return this.value(11);
  }
  get folds() {
    return this.value(13) ? this.value(12) : void 0;
  }
  get attachment() {
    return this.point(14);
  }
  get direction() {
    return this.point(17);
  }
  get normal() {
    return this.point(20);
  }
  get path() {
    return [{ position: this.point(23), radius: this.value(26) }, { position: this.point(27), radius: this.value(30) }];
  }
  get fanAngle() {
    return this.value(32) || void 0;
  }
  get distalDivision() {
    return this.value(33) >= 0 ? this.value(33) : void 0;
  }
  get roll() {
    return this.value(34) || void 0;
  }
  get bractColour() {
    return this.value(38) ? this.point(35) : void 0;
  }
  get bractMargin() {
    return this.value(42) ? this.point(39) : void 0;
  }
  get baseAsymmetry() {
    return this.value(43) || void 0;
  }
  matchesChunk77(other, row, identity) {
    return other instanceof _ColumnBlade76 && other.#table === this.#table && other.#row === row && other.#identity === identity;
  }
  chunk77(count) {
    if (this.#row !== 0) throw Error("Blade chunk must begin at its first row");
    return this.#table.subarray(0, count * 44);
  }
};
function materializeBlade76(b) {
  if (!(b instanceof ColumnBlade76)) return b;
  const keys = ["id", "kind", "parentId", "role", "outline", "length", "width", "insertion", "camber", "droop", "twist", "age", "state75", "birth", "folds", "attachment", "direction", "normal", "path", "fanAngle", "distalDivision", "roll", "bractColour", "bractMargin", "baseAsymmetry"];
  return Object.fromEntries(keys.flatMap((key) => b[key] === void 0 ? [] : [[key, b[key]]]));
}
function unpackGrowth76(p, compactOrgans76 = false) {
  if (!p || p.codecVersion !== 76 || ![p.axes, p.axisPaths, p.blades, p.events, p.scars76].every((a) => a instanceof Float64Array && a.every(Number.isFinite)) || p.axes.length % 15 || p.axisPaths.length % 4 || p.blades.length % 44 || p.events.length % 3 || p.scars76.length % 6 || !growthTableSizes76([p.axes.length, p.axisPaths.length, p.blades.length, p.events.length, p.scars76.length], p.profile?.productionSystemVersion)) throw Error("Invalid lossless native growth table");
  const axes = [], blades = [], point = (a, i) => [a[i], a[i + 1], a[i + 2]];
  for (let i = 0; i < p.axes.length / 15; i++) {
    const k = i * 15, a = p.axes, parent = a[k + 2], offset = a[k + 10], count = a[k + 11];
    if (!Number.isInteger(parent) || parent < -1 || parent >= p.axes.length / 15 || !Number.isInteger(offset) || !Number.isInteger(count) || count < 2 || offset < 0 || (offset + count) * 4 > p.axisPaths.length) throw Error("Invalid native axis path reference");
    const properties = { id: "axis/" + i, kind: index(kinds2, a[k]), role: index(roles, a[k + 1]), parentId: parent < 0 ? null : "axis/" + parent, order: a[k + 3], birth: a[k + 4], age: a[k + 5], fixed: a[k + 6] === 1, ...a[k + 13] ? { buttressHeight: a[k + 13] } : {}, ...a[k + 12] ? { section: { lobes: a[k + 7], amplitude: a[k + 8], phase: a[k + 9] } } : {} };
    axes.push(compactOrgans76 && [77, 78].includes(p.profile.productionSystemVersion) ? savedAxisView77(properties, p.axisPaths, offset, count) : { ...properties, path: Array.from({ length: count }, (_, j) => ({ position: point(p.axisPaths, (offset + j) * 4), radius: p.axisPaths[(offset + j) * 4 + 3] })) });
  }
  for (let i = 0; i < p.blades.length / 44; i++) {
    const k = i * 44, a = p.blades, parent = a[k];
    if (!Number.isInteger(parent) || parent < 0 || parent >= axes.length) throw Error("Invalid native blade support reference");
    const kind = index(kinds2, a[k + 31]);
    if (kind !== "leaf" && kind !== "blade") throw Error("Invalid terminal organ kind");
    index(bladeRoles, a[k + 1]);
    index(outlines, a[k + 2]);
    blades.push(compactOrgans76 ? new ColumnBlade76(a, i) : { id: "blade/" + i, kind, parentId: "axis/" + parent, role: index(bladeRoles, a[k + 1]), outline: index(outlines, a[k + 2]), length: a[k + 3], width: a[k + 4], insertion: a[k + 5], camber: a[k + 6], droop: a[k + 7], twist: a[k + 8], age: a[k + 9], state75: a[k + 10], birth: a[k + 11], ...a[k + 13] ? { folds: a[k + 12] } : {}, ...a[k + 32] ? { fanAngle: a[k + 32] } : {}, ...a[k + 33] >= 0 ? { distalDivision: a[k + 33] } : {}, ...a[k + 34] ? { roll: a[k + 34] } : {}, ...a[k + 38] ? { bractColour: point(a, k + 35) } : {}, ...a[k + 42] ? { bractMargin: point(a, k + 39) } : {}, ...a[k + 43] ? { baseAsymmetry: a[k + 43] } : {}, attachment: point(a, k + 14), direction: point(a, k + 17), normal: point(a, k + 20), path: [{ position: point(a, k + 23), radius: a[k + 26] }, { position: point(a, k + 27), radius: a[k + 30] }] });
  }
  const compactEvents = compactOrgans76 && [77, 78].includes(p.profile.productionSystemVersion), births = compactEvents ? savedEvents77(p.events, axes.length) : [];
  for (let i = 0; i < p.events.length; i += 3) {
    const organ = p.events[i + 1];
    if (!Number.isInteger(organ) || organ < 0 || organ >= axes.length + blades.length) throw Error("Invalid native event reference");
    const event = index(events, p.events[i + 2]);
    if (!compactEvents) births.push({ at: p.events[i], organ: organ < axes.length ? "axis/" + organ : "blade/" + (organ - axes.length), event });
  }
  const scars76 = [];
  for (let i = 0; i < p.scars76.length; i += 6) {
    const a = p.scars76;
    if (!Number.isInteger(a[i]) || !axes[a[i]]) throw Error("Invalid native leaf-base history");
    scars76.push({ axisId: "axis/" + a[i], travel: a[i + 1], azimuth: a[i + 2], width: a[i + 3], age: a[i + 4], birth: a[i + 5] });
  }
  return { scars76, profile: p.profile, category: p.category, architecture: p.architecture, cohort: p.cohort, evidence: p.evidence, axes, blades, events: births };
}
function growthTableSizes76(lengths, productionVersion = 74) {
  const strides = [15, 4, 44, 3, 6], bufferLimit = ([77, 78].includes(productionVersion) ? 8 : 2) * 1073741824, totalLimit = ([77, 78].includes(productionVersion) ? 32 : 16) * 1073741824;
  return lengths.length === strides.length && lengths.every((v, i) => Number.isSafeInteger(v) && v >= 0 && v % strides[i] === 0 && v * 8 <= bufferLimit) && lengths.reduce((n, v) => n + v * 8, 0) <= totalLimit;
}
function packGrowth77(g) {
  if (![77, 78].includes(g.profile.productionSystemVersion)) throw Error("Segmented growth requires production77");
  const ref = (id, kind, length) => {
    if (!id.startsWith(kind + "/")) throw Error("Invalid native organ identity");
    const i = Number(id.slice(kind.length + 1));
    if (!Number.isInteger(i) || i < 0 || i >= length || id !== kind + "/" + i) throw Error("Unknown native organ identity");
    return i;
  };
  const axes = new Float64Array(g.axes.length * 15), paths = new Float64Array(g.axes.reduce((n, a) => n + a.path.length * 4, 0)), eventData = new Float64Array(g.events.length * 3), bladeChunks77 = [];
  let cursor = 0;
  for (let i = 0; i < g.axes.length; i++) {
    const a = g.axes[i];
    if (a.id !== "axis/" + i) throw Error("Native axis IDs must retain their birth sequence");
    const parent = a.parentId === null ? -1 : ref(a.parentId, "axis", g.axes.length), offset = cursor / 4;
    for (const p of a.path) {
      paths[cursor++] = p.position[0];
      paths[cursor++] = p.position[1];
      paths[cursor++] = p.position[2];
      paths[cursor++] = p.radius;
    }
    axes.set([kinds2.indexOf(a.kind), roles.indexOf(a.role), parent, a.order, a.birth, a.age, Number(a.fixed), a.section?.lobes ?? 0, a.section?.amplitude ?? 0, a.section?.phase ?? 0, offset, a.path.length, Number(!!a.section), a.buttressHeight ?? 0, 0], i * 15);
  }
  for (let start = 0; start < g.blades.length; start += 4096) {
    const count = Math.min(4096, g.blades.length - start), first = g.blades[start];
    let direct = first instanceof ColumnBlade76;
    for (let j = 0; direct && j < count; j++) direct = first.matchesChunk77(g.blades[start + j], j, start + j);
    if (direct) {
      const table = first.chunk77(count);
      for (let j = 0; j < count; j++) if (!Number.isInteger(table[j * 44]) || table[j * 44] < 0 || table[j * 44] >= g.axes.length) throw Error("Invalid native blade support");
      bladeChunks77.push(table);
    } else {
      const table = new Float64Array(count * 44);
      for (let j = 0; j < count; j++) {
        const b = g.blades[start + j];
        if (b.id !== "blade/" + (start + j) || b.path.length !== 2) throw Error("Invalid native blade birth or support");
        writeBlade76(table, j * 44, b, ref(b.parentId, "axis", g.axes.length));
      }
      bladeChunks77.push(table);
    }
  }
  for (let i = 0; i < g.events.length; i++) {
    const e = g.events[i], organ = e.organ.startsWith("axis/") ? ref(e.organ, "axis", g.axes.length) : g.axes.length + ref(e.organ, "blade", g.blades.length);
    eventData.set([e.at, organ, events.indexOf(e.event)], i * 3);
  }
  const scars76 = new Float64Array(g.scars76.length * 6);
  for (let i = 0; i < g.scars76.length; i++) {
    const s = g.scars76[i];
    scars76.set([ref(s.axisId, "axis", g.axes.length), s.travel, s.azimuth, s.width, s.age, s.birth], i * 6);
  }
  return { codecVersion: 77, scars76, profile: g.profile, category: g.category, architecture: g.architecture, cohort: g.cohort, evidence: g.evidence, axes, axisPaths: paths, bladeChunks77, events: eventData };
}
function unpackGrowth77(p, compactOrgans77 = true) {
  if (p?.codecVersion !== 77 || ![77, 78].includes(p.profile?.productionSystemVersion) || !Array.isArray(p.bladeChunks77) || p.bladeChunks77.length > 65536 || p.bladeChunks77.some((a, i) => !(a instanceof Float64Array) || !a.length || a.length % 44 || a.length > 4096 * 44 || i < p.bladeChunks77.length - 1 && a.length !== 4096 * 44 || !a.every(Number.isFinite))) throw Error("Invalid segmented growth77 table");
  const bladeCount = p.bladeChunks77.reduce((n, a) => n + a.length / 44, 0), bytes = [p.axes, p.axisPaths, p.events, p.scars76, ...p.bladeChunks77].reduce((n, a) => n + a.byteLength, 0);
  if (bytes > 64 * 1073741824 || !Number.isSafeInteger(bladeCount)) throw Error("Segmented growth77 exceeds its complete-data envelope");
  const base = unpackGrowth76({ ...p, codecVersion: 76, blades: new Float64Array(), events: new Float64Array() }, compactOrgans77), blades = [];
  for (const table of p.bladeChunks77) for (let k = 0; k < table.length; k += 44) {
    const parent = table[k], kind = index(kinds2, table[k + 31]);
    if (!Number.isInteger(parent) || parent < 0 || parent >= base.axes.length || !["leaf", "blade"].includes(kind)) throw Error("Invalid segmented blade support or kind");
    index(bladeRoles, table[k + 1]);
    index(outlines, table[k + 2]);
    const b = new ColumnBlade76(table, k / 44, blades.length);
    blades.push(compactOrgans77 ? b : materializeBlade76(b));
  }
  if (!(p.events instanceof Float64Array) || p.events.length % 3 || !p.events.every(Number.isFinite)) throw Error("Invalid segmented birth events");
  for (let i = 0; i < p.events.length; i += 3) {
    const organ = p.events[i + 1];
    if (!Number.isInteger(organ) || organ < 0 || organ >= base.axes.length + blades.length) throw Error("Invalid segmented event reference");
    index(events, p.events[i + 2]);
  }
  const births = compactOrgans77 ? savedEvents77(p.events, base.axes.length) : Array.from({ length: p.events.length / 3 }, (_, i) => {
    const k = i * 3, organ = p.events[k + 1];
    return { at: p.events[k], organ: organ < base.axes.length ? "axis/" + organ : "blade/" + (organ - base.axes.length), event: index(events, p.events[k + 2]) };
  });
  return { ...base, blades, events: births };
}
var packNativeGrowth76 = (g) => [77, 78].includes(g.profile.productionSystemVersion) ? packGrowth77(g) : packGrowth76(g);
var unpackNativeGrowth76 = (p, compact = false) => p.codecVersion === 77 ? unpackGrowth77(p, compact) : unpackGrowth76(p, compact);

// ../current-site-source/checkout/src/Authoring/ProductionSystem78.ts
var hasProduction78 = (p) => p.productionSystemVersion === 78;
function assertLaminaMeasure78(measure, id) {
  const { area, length, width, span: span2, projectedArea, divided, unfolding } = measure;
  if (![area, length, width, span2, projectedArea].every(Number.isFinite) || length <= 0 || width <= 0) throw Error("Production78 non-finite lamina evidence: " + id);
  if (area < length * width * (divided ? 0.12 : 0.3) || area > length * width * 4) throw Error("Production78 saved lamina area contradicts its registered dimensions: " + id);
  if (!unfolding && !divided && (span2 < 0.65 || projectedArea < length * width * 0.2)) throw Error("Production78 expanded lamina is folded or narrowed into a strip: " + id);
}

// ../current-site-source/checkout/src/TropicalLibrary/Wood76.ts
import { Vector3 as Vector35 } from "../vendor/three.module.min.js";

// ../current-site-source/checkout/src/TropicalLibrary/CrownDevelopment76.ts
import { Vector3 as Vector34 } from "../vendor/three.module.min.js";

// ../current-site-source/checkout/src/TropicalLibrary/CompoundWood76.ts
import { Vector3 as Vector36 } from "../vendor/three.module.min.js";

// ../current-site-source/checkout/src/TropicalLibrary/WoodDevelopment77.ts
var WOOD_STRATEGIES77 = [
  { species: "ceiba-pentandra", height: 37, radius: 0.92, lift: 0.46, width: 0.7, depth: 0.4, primary: 7, buttresses: 6, crown: "dome", leaf: "palmate", length: 0.16, breadth: 0.038 },
  { species: "koompassia-excelsa", height: 59, radius: 0.86, lift: 0.64, width: 0.4, depth: 0.29, primary: 6, buttresses: 5, crown: "high-subcrowns", leaf: "odd-pinnate", length: 0.04, breadth: 0.016, leafAxis: 0.2, pairs: 5 },
  { species: "koompassia-malaccensis", height: 43, radius: 0.8, lift: 0.49, width: 0.63, depth: 0.38, primary: 7, buttresses: 6, crown: "high-subcrowns", leaf: "odd-pinnate", length: 0.09, breadth: 0.038, leafAxis: 0.35, pairs: 5 },
  { species: "richetia-faguetiana", height: 51, radius: 0.7, lift: 0.58, width: 0.47, depth: 0.35, primary: 7, buttresses: 4, crown: "high-subcrowns", leaf: "simple", length: 0.08, breadth: 0.03 },
  { species: "rubroshorea-leprosula", height: 43, radius: 0.73, lift: 0.48, width: 0.6, depth: 0.42, primary: 8, buttresses: 5, crown: "dome", leaf: "simple", length: 0.13, breadth: 0.062 },
  { species: "dipterocarpus-grandiflorus", height: 36, radius: 0.65, lift: 0.44, width: 0.68, depth: 0.4, primary: 7, buttresses: 4, crown: "dome", leaf: "simple", length: 0.17, breadth: 0.105 },
  { species: "dryobalanops-aromatica", height: 39, radius: 0.72, lift: 0.52, width: 0.56, depth: 0.39, primary: 8, buttresses: 5, crown: "high-subcrowns", leaf: "simple", length: 0.058, breadth: 0.032 },
  { species: "hopea-odorata", height: 28, radius: 0.53, lift: 0.34, width: 0.48, depth: 0.54, primary: 8, buttresses: 4, crown: "ascending", leaf: "simple", length: 0.12, breadth: 0.055 },
  { species: "pometia-pinnata", height: 32, radius: 0.74, lift: 0.35, width: 0.7, depth: 0.44, primary: 7, buttresses: 5, crown: "dome", leaf: "even-pinnate", length: 0.18, breadth: 0.058, leafAxis: 0.84, pairs: 6 },
  { species: "terminalia-superba", height: 41, radius: 0.74, lift: 0.65, width: 0.75, depth: 0.26, primary: 6, buttresses: 5, crown: "umbrella", leaf: "simple", length: 0.16, breadth: 0.085, terminal: true },
  { species: "dinizia-excelsa", height: 52, radius: 0.89, lift: 0.57, width: 0.6, depth: 0.35, primary: 7, buttresses: 5, crown: "high-subcrowns", leaf: "bipinnate", length: 0.024, breadth: 0.0105, leafAxis: 0.3, pairs: 4, secondPairs: 9 },
  { species: "samanea-saman", height: 18, radius: 0.85, lift: 0.24, width: 1.55, depth: 0.48, primary: 5, buttresses: 5, crown: "umbrella", leaf: "bipinnate", length: 0.048, breadth: 0.024, leafAxis: 0.27, pairs: 3, secondPairs: 5 },
  { species: "ficus-benghalensis", height: 15.5, radius: 0.72, lift: 0.29, width: 1.55, depth: 0.53, primary: 7, buttresses: 5, crown: "dome", leaf: "simple", length: 0.19, breadth: 0.105, props: "many" },
  { species: "ficus-elastica", height: 21, radius: 0.7, lift: 0.39, width: 0.85, depth: 0.51, primary: 6, buttresses: 4, crown: "ascending", leaf: "simple", length: 0.27, breadth: 0.115, props: "few" },
  { species: "ficus-virens", height: 26, radius: 0.84, lift: 0.34, width: 0.98, depth: 0.49, primary: 7, buttresses: 5, crown: "dome", leaf: "simple", length: 0.15, breadth: 0.065, props: "basal" },
  { species: "ficus-microcarpa", height: 18.5, radius: 0.7, lift: 0.29, width: 1.22, depth: 0.49, primary: 8, buttresses: 4, crown: "dome", leaf: "simple", length: 0.08, breadth: 0.038, props: "curtain" },
  { species: "intsia-bijuga", height: 31, radius: 0.83, lift: 0.37, width: 0.73, depth: 0.44, primary: 7, buttresses: 5, crown: "dome", leaf: "even-pinnate", length: 0.14, breadth: 0.09, leafAxis: 0.21, pairs: 2 },
  { species: "artocarpus-altilis", height: 13.5, radius: 0.59, lift: 0.29, width: 0.98, depth: 0.58, primary: 6, buttresses: 4, crown: "dome", leaf: "breadfruit", length: 0.52, breadth: 0.35, terminal: true },
  { species: "barringtonia-asiatica", height: 15.8, radius: 0.55, lift: 0.25, width: 1.07, depth: 0.6, primary: 6, buttresses: 0, crown: "dome", leaf: "simple", length: 0.39, breadth: 0.18, terminal: true },
  { species: "terminalia-catappa", height: 18, radius: 0.53, lift: 0.2, width: 0.88, depth: 0.67, primary: 4, buttresses: 3, crown: "tiers", leaf: "simple", length: 0.26, breadth: 0.14, terminal: true }
];
var strategies = new Map(WOOD_STRATEGIES77.map((d) => [d.species, d]));
var hasWoodStrategy77 = (species) => strategies.has(species);

// ../current-site-source/checkout/src/TropicalLibrary/CrownCapacity77.ts
function crownCapacity77(g) {
  const trunk = g.axes.find((a) => a.kind === "trunk");
  if (!trunk) return [];
  const regions = new Map((g.evidence.crownTerritories77 ?? []).map((r) => [r.primary, r]));
  const lineage = /* @__PURE__ */ new Map(), rows = [];
  for (const a of g.axes) {
    const index2 = a.kind === "branch" && a.parentId === trunk.id ? rows.length : lineage.get(a.parentId) ?? -1;
    if (index2 === rows.length) rows.push({ id: a.id, units: 0, blades: 0, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity], bins: new Float64Array(216), area: 0, outside: 0 });
    lineage.set(a.id, index2);
    if (index2 >= 0 && a.kind === "petiole") rows[index2].units++;
  }
  for (const leaf of g.blades) {
    const r = rows[lineage.get(leaf.parentId)];
    if (!r) continue;
    r.blades++;
    const region = regions.get(r.id);
    let squared = 0;
    for (let k = 0; k < 3; k++) {
      r.min[k] = Math.min(r.min[k], leaf.attachment[k]);
      r.max[k] = Math.max(r.max[k], leaf.attachment[k]);
      if (region) squared += ((leaf.attachment[k] - region.centre[k]) / (region.extent[k] + region.margin)) ** 2;
    }
    if (!region || !Number.isFinite(squared) || squared > 1.3 ** 2) r.outside++;
  }
  for (const leaf of g.blades) {
    const r = rows[lineage.get(leaf.parentId)];
    if (!r) continue;
    let cell = 0, multiplier = 1;
    for (let k = 0; k < 3; k++) {
      cell += Math.max(0, Math.min(5, Math.floor((leaf.attachment[k] - r.min[k]) / Math.max(1e-9, r.max[k] - r.min[k]) * 6))) * multiplier;
      multiplier *= 6;
    }
    const area = leaf.length * leaf.width * 0.58;
    r.bins[cell] += area;
    r.area += area;
  }
  return rows.map((r) => ({ primary: r.id, leafUnits: r.units, blades: r.blades, effectiveCells: r.area * r.area / Math.max(1e-12, r.bins.reduce((n, v) => n + v * v, 0)), minimumCells: r.units < 64 ? 0 : Math.min(48, r.units * 0.06), outsideEnvelope: r.outside }));
}

// ../current-site-source/checkout/src/TropicalLibrary/Constraints77.ts
var span = (a) => {
  const path = a.path;
  return path.slice(1).reduce((v, p, j) => v + Math.hypot(...p.position.map((x, k) => x - path[j].position[k])), 0);
};
function inspectGrowth77(g, scope = "all") {
  const issues = [], fail = (code, message, organId) => issues.push({ code: "production77." + code, message, organId }), byId = new Map(g.axes.map((a) => [a.id, a]));
  let leafArea = 0;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const leaf of g.blades) {
    if (scope !== "architecture" && (leaf.length <= 0 || leaf.width <= 0 || !Number.isFinite(leaf.length + leaf.width + leaf.age) || leaf.age < 0 || leaf.age > 1)) fail("blade-dimensions", "Actual leaf dimensions and organ age must be finite and bounded", leaf.id);
    if (scope !== "architecture" && (!leaf.direction.every(Number.isFinite) || !leaf.normal.every(Number.isFinite) || Math.abs(leaf.direction.reduce((n, v, k) => n + v * leaf.normal[k], 0)) > 1e-6)) fail("blade-frame", "The authored blade frame must remain orthogonal", leaf.id);
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], leaf.attachment[k]);
      max[k] = Math.max(max[k], leaf.attachment[k]);
    }
    leafArea += leaf.length * leaf.width * 0.58;
    if (scope !== "category" && leaf.outline === "peltate" && (leaf.insertion <= 0.15 || leaf.insertion >= 0.45)) fail("peltate-insertion", "The closed-sinus leaf requires its real internal petiole insertion", leaf.id);
  }
  const dimensions = max.map((v, k) => v - min[k]), wood = WOOD_STRATEGIES77.find((d) => d.species === g.profile.species), metrics = { axes: g.axes.length, blades: g.blades.length, leafAreaAuthoringProxy: leafArea, leafAttachmentBounds: dimensions };
  if (scope !== "category" && g.category === "Herb") {
    const groups = /* @__PURE__ */ new Map();
    for (const leaf of g.blades) {
      if (leaf.role !== "lamina" || leaf.outline === "fan") continue;
      let parent = byId.get(leaf.parentId);
      while (parent?.kind === "petiole") parent = byId.get(parent.parentId);
      if (!parent) continue;
      const list = groups.get(parent.id) ?? [];
      list.push({ age: leaf.age, pitch: Math.asin(Math.max(-1, Math.min(1, leaf.direction[1]))) });
      groups.set(parent.id, list);
    }
    for (const [id, leaves] of groups) if (leaves.length >= 4 && leafPitchResidual77(leaves) < 1e-4) fail("age-only-pose", "A whole living shoot cannot assign every inclination solely by organ age", id);
  }
  if (wood && scope !== "category") {
    const capacity = crownCapacity77(g);
    Object.assign(metrics, { subcrownCapacity77: capacity });
    for (const row of capacity) if (row.effectiveCells < row.minimumCells) fail("subcrown-capacity", "Actual leaf area is crowded into too few local subcrown cells despite valid total crown dimensions", row.primary);
    for (const row of capacity) if (row.outsideEnvelope) fail("subcrown-envelope", "Leaf birth attachments must remain within their own registered rounded growth territory", row.primary);
    if (g.evidence.productionContract77 !== "spatial-growth-units-and-descendant-load" || g.evidence.independentStrategy77 !== g.profile.species) fail("independent-wood", "A production77 species requires its actual independently allocated growth-unit graph");
    const trunk = g.axes.find((a) => a.kind === "trunk"), height = trunk?.path.at(-1).position[1] ?? 0;
    if (height <= 0) fail("standing-wood", "A rooted standing bole is required");
    if (g.blades.length && dimensions[1] < height * (wood.crown === "tiers" ? 0.3 : 0.12)) fail("crown-depth", "The living crown cannot collapse into a single thin leaf shelf");
    const authoredHeight = wood.height * (g.profile.stage === "juvenile" ? 0.095 : g.profile.stage === "establishing" ? 0.37 : 1) * g.cohort.vigour;
    if (max[1] > authoredHeight * 1.08) fail("inherited-territory", "Descendant crown territories cannot accumulate beyond the allocated developmental height");
    if (Math.min(dimensions[0], dimensions[2]) < height * wood.width * 0.35) fail("crown-volume", "Species crown spread requires occupied three-dimensional growth units");
    for (const a of g.axes.filter((a2) => a2.kind === "branch")) {
      if (span(a) > Math.max(0.06, a.path[0].radius * 180)) fail("unsupported-span", "A long supporting branch cannot be a hair-thin rod", a.id);
      const parent = byId.get(a.parentId);
      if (parent) {
        const point = a.path[0].position, path = parent.path;
        let nearest = Infinity, radius = 0;
        for (let j = 1; j < path.length; j++) {
          const p = path[j - 1], q = path[j], d = q.position.map((n, k) => n - p.position[k]), l2 = d.reduce((n, v) => n + v * v, 0), t = Math.max(0, Math.min(1, point.reduce((n, v, k) => n + (v - p.position[k]) * d[k], 0) / l2)), distance = point.reduce((n, v, k) => n + (v - p.position[k] - t * d[k]) ** 2, 0);
          if (distance < nearest) {
            nearest = distance;
            radius = p.radius * (1 - t) + q.radius * t;
          }
        }
        if (a.path[0].radius > radius * 1.35) fail("junction-load", "The child carrying crown load cannot exceed its actual local supporting radius", a.id);
      }
    }
    for (const a of g.axes.filter((a2) => a2.role === "grounded-prop")) {
      const parent = byId.get(a.parentId);
      if (!parent || a.path[0].radius > Math.max(...parent.path.map((p) => p.radius)) * 0.8) fail("prop-age-load", "A developed prop must preserve a bounded relation to its actual living crown support", a.id);
    }
  }
  return { evidence: [`Production77 measured ${g.axes.length} real axes, ${g.blades.length} blades, local frames and species crown/load relationships`], issues, metrics };
}

// ../current-site-source/checkout/src/TropicalLibrary/TreeFernDimensions77.ts
import { Vector3 as Vector38 } from "../vendor/three.module.min.js";
function inspectTreeFernDimensions77(g) {
  if (![77, 78].includes(g.profile.productionSystemVersion) || g.profile.species !== "sphaeropteris-lepifera" || g.profile.stage !== "adult") return [];
  const byId = new Map(g.axes.map((a) => [a.id, a])), children2 = /* @__PURE__ */ new Map(), blades = /* @__PURE__ */ new Map(), length = (a) => a.path.slice(1).reduce((s, p, i) => s + new Vector38(...p.position).distanceTo(new Vector38(...a.path[i].position)), 0), issues = [];
  for (const a of g.axes) if (a.parentId) {
    const list = children2.get(a.parentId) ?? [];
    list.push(a);
    children2.set(a.parentId, list);
  }
  for (const b of g.blades) blades.set(b.parentId, 1 + (blades.get(b.parentId) ?? 0));
  const stems = g.axes.filter((a) => a.kind === "stem"), stipe = g.axes.filter((a) => a.kind === "petiole" && byId.get(a.parentId)?.kind === "stem");
  if (stems.length !== 1 || stems[0].path[0].radius * 2 < 0.15 || stems[0].path[0].radius * 2 > 0.201) issues.push("stem-diameter");
  if (stems.length === 1 && stipe.some((a) => new Vector38(...a.path[0].position).distanceTo(new Vector38(...stems[0].path.at(-1).position)) > 0.501)) issues.push("living-apical-zone");
  for (const petiole of stipe) {
    const rachis = (children2.get(petiole.id) ?? []).find((a) => a.kind === "rachis");
    if (!rachis || length(petiole) < 0.4 || length(petiole) > 1.001 || length(rachis) < 1.5 || length(rachis) > 2.501) {
      issues.push("stipe-blade-scale");
      continue;
    }
    const pinnae = (children2.get(rachis.id) ?? []).filter((a) => a.kind === "rachis");
    if (pinnae.length < 32 || pinnae.length > 60 || Math.max(...pinnae.map(length)) < 0.5 || Math.max(...pinnae.map(length)) > 0.801) issues.push("primary-pinna-scale");
    for (const pinna of pinnae) {
      const leaves = (children2.get(pinna.id) ?? []).filter((a) => a.kind === "petiole").reduce((n, a) => n + (blades.get(a.id) ?? 0), 0);
      if (leaves < 60 || leaves > 74) issues.push("pinnule-pairs");
    }
  }
  if (!stipe.length) issues.push("missing-fronds");
  return [...new Set(issues)];
}

// ../current-site-source/checkout/src/TropicalLibrary/Constraints78.ts
import { Vector3 as Vector311 } from "../vendor/three.module.min.js";

// ../current-site-source/checkout/src/TropicalLibrary/LeafCohortGate78.ts
function leafCohortGate78(g) {
  const axes = new Map(g.axes.map((a) => [a.id, a])), groups = /* @__PURE__ */ new Map();
  for (const leaf of g.blades) {
    if (leaf.role !== "lamina" || leaf.outline === "fan" || (leaf.roll ?? 0) > 0.5) continue;
    let parent = axes.get(leaf.parentId);
    while (parent && (parent.kind === "petiole" || parent.role === "leaf-sheath")) parent = axes.get(parent.parentId);
    if (!parent) continue;
    const list = groups.get(parent.id) ?? [];
    list.push({ age: leaf.age, pitch: Math.asin(Math.max(-1, Math.min(1, leaf.direction[1]))) });
    groups.set(parent.id, list);
  }
  const rows = [...groups].filter(([, leaves]) => leaves.length >= 4).map(([axis, leaves]) => ({ axis, count: leaves.length, residualRadians: leafPitchResidual77(leaves) }));
  const minimumResidualRadians = 0.012;
  return { status: rows.some((r) => !Number.isFinite(r.residualRadians) || r.residualRadians < minimumResidualRadians) ? "failed" : "passed", rows, minimumResidualRadians };
}

// ../current-site-source/checkout/src/TropicalLibrary/CrownFrontWitness78.ts
function crownFrontWitness78(g) {
  const regions = g.evidence.crownTerritories77 ?? [], lineage = /* @__PURE__ */ new Map(), hasBranch = new Set(g.axes.filter((a) => a.kind === "branch").map((a) => a.parentId)), byPrimary = new Map(regions.map((r) => [r.primary, { region: r, sectors: Array.from({ length: 12 }, () => []), terminals: 0 }]));
  for (const a of g.axes) {
    const primary = byPrimary.has(a.id) ? a.id : lineage.get(a.parentId);
    if (!primary) continue;
    lineage.set(a.id, primary);
    if (a.kind !== "branch" || hasBranch.has(a.id)) continue;
    const row = byPrimary.get(primary), p = a.path.at(-1).position, r = row.region, x = (p[0] - r.centre[0]) / r.extent[0], z = (p[2] - r.centre[2]) / r.extent[2], angle = (Math.atan2(z, x) + Math.PI) / (2 * Math.PI);
    row.sectors[Math.min(11, Math.floor(angle * 12))].push(Math.hypot(x, z));
    row.terminals++;
  }
  return [...byPrimary].flatMap(([primary, row]) => {
    if (row.terminals < 96 || row.sectors.some((s) => s.length < 4)) return [];
    const front = row.sectors.map((s) => s.sort((a, b) => a - b)[Math.floor((s.length - 1) * 0.9)]), mean = front.reduce((a, b) => a + b, 0) / front.length;
    return [{ primary, terminals: row.terminals, front, relativeRange: (Math.max(...front) - Math.min(...front)) / Math.max(1e-3, mean) }];
  });
}
function inspectCrownFront78(g) {
  const rows = crownFrontWitness78(g), ranges = rows.map((r) => r.relativeRange).sort((a, b) => a - b), median = ranges.length ? ranges[Math.floor(ranges.length / 2)] : null;
  return { rows, medianRelativeRange: median, minimumMedianRelativeRange: 0.12, status: rows.length >= 3 && median < 0.12 ? "failed" : "passed" };
}

// ../current-site-source/checkout/src/TropicalLibrary/PropRootDevelopment78.ts
import { Vector3 as Vector39 } from "../vendor/three.module.min.js";
var FIGS78 = /* @__PURE__ */ new Set(["ficus-benghalensis", "ficus-elastica", "ficus-virens", "ficus-microcarpa"]);
function inspectPropRoots78(g) {
  const issues = [];
  if (!FIGS78.has(g.profile.species)) return issues;
  const axes = new Map(g.axes.map((a) => [a.id, a]));
  for (const root of g.axes) {
    if (root.role !== "grounded-prop" && root.role !== "aerial-root") continue;
    const fail = (code, message) => issues.push({ code, message, organId: root.id }), first = new Vector39(...root.path[0].position), last = new Vector39(...root.path.at(-1).position), drop = first.y - last.y;
    if (drop <= 0 || root.path.some((p, i) => i > 0 && p.position[1] > root.path[i - 1].position[1] + 1e-6)) fail("root-descent", "A free aerial root must develop downward before soil contact.");
    if (root.path.some((p) => Math.hypot(p.position[0] - first.x, p.position[2] - first.z) > 0.1 * (first.y - p.position[1]) + 0.025)) fail("radial-prop-cone", "Ficus descending roots cannot inherit the crown radial spread as outward stilt poles.");
    const parent = axes.get(root.parentId);
    let separation = Infinity;
    if (parent) for (let i = 1; i < parent.path.length; i++) {
      const a = new Vector39(...parent.path[i - 1].position), d = new Vector39(...parent.path[i].position).sub(a), t = Math.max(0, Math.min(1, first.clone().sub(a).dot(d) / Math.max(1e-12, d.lengthSq())));
      separation = Math.min(separation, first.distanceTo(a.addScaledVector(d, t)));
    }
    if (separation > 1e-5) fail("root-parent-contact", "Aerial root birth must lie on its actual supporting branch path.");
    if (root.role === "grounded-prop") {
      if (Math.abs(last.y) > 1e-6 || !root.fixed || !g.events.some((e) => e.organ === root.id && e.event === "ground-contact")) fail("root-soil-contact", "A supporting prop needs actual basal soil contact and a recorded contact event.");
    } else if (root.path.some((p) => p.radius > 0.015) || last.y <= 0 || root.fixed) fail("premature-root-thickening", "A hanging root must remain a thin free root until actual soil contact.");
  }
  return issues;
}

// ../current-site-source/checkout/src/TropicalLibrary/CrownSlots78.ts
import { Vector3 as Vector310 } from "../vendor/three.module.min.js";
function usesContinuousSlots78(d) {
  return ["simple", "breadfruit", "palmate", "odd-pinnate", "even-pinnate", "bipinnate"].includes(d.leaf);
}
function inspectCrownSlotPoints78(groups) {
  const rows = groups.filter((r) => r.points.length >= 512).map((row) => ({ primary: row.primary, terminals: row.points.length, gaps: [0, 1, 2].map((k) => {
    const coords = row.points.map((p) => p[k]).sort((a, b) => a - b), start = Math.floor(coords.length * 0.1), end = Math.ceil(coords.length * 0.9);
    let gap = 0;
    for (let i = start + 1; i < end; i++) gap = Math.max(gap, coords[i] - coords[i - 1]);
    return gap / Math.max(1e-6, row.region.extent[k] * 2);
  }) }));
  const rejected = rows.filter((r) => Math.max(...r.gaps) > 0.04);
  return { rows, maximumInteriorPlaneGap: 0.04, rejectedPrimaries: rejected.length, status: rejected.length >= 2 ? "failed" : "passed" };
}
function inspectCrownSlots78(g) {
  const strategy = WOOD_STRATEGIES77.find((d) => d.species === g.profile.species);
  if (!strategy || !usesContinuousSlots78(strategy) || strategy.crown === "tiers") return inspectCrownSlotPoints78([]);
  const regions = g.evidence.crownTerritories77 ?? [], lineage = /* @__PURE__ */ new Map(), hasBranch = new Set(g.axes.filter((a) => a.kind === "branch").map((a) => a.parentId)), groups = new Map(regions.map((r) => [r.primary, { primary: r.primary, region: r, points: [] }]));
  for (const a of g.axes) {
    const primary = groups.has(a.id) ? a.id : lineage.get(a.parentId);
    if (!primary) continue;
    lineage.set(a.id, primary);
    if (a.kind === "branch" && !hasBranch.has(a.id)) groups.get(primary).points.push(a.path.at(-1).position);
  }
  return inspectCrownSlotPoints78([...groups.values()]);
}

// ../current-site-source/checkout/src/TropicalLibrary/Constraints78.ts
var MUSOID78 = /* @__PURE__ */ new Set(["ensete-ventricosum", "ensete-glaucum", "musa-balbisiana", "musa-textilis", "musa-itinerans", "musa-ingens"]);
var TERMINAL_CROWN78 = /* @__PURE__ */ new Set(["corypha-utan", "raphia-farinifera", "arenga-pinnata", "caryota-urens", "licuala-grandis", "lodoicea-maldivica", "sphaeropteris-lepifera", "ravenala-madagascariensis", "strelitzia-nicolai", "phenakospermum-guyannense"]);
function inspectGrowth78(g) {
  if (!hasProduction78(g.profile)) return [];
  const issues = [], fail = (code, message, organId) => issues.push({ code: "production78." + code, message, organId });
  if (!hasWoodStrategy77(g.profile.species)) {
    const cohorts = leafCohortGate78(g);
    for (const row of cohorts.rows) if (!Number.isFinite(row.residualRadians) || row.residualRadians < cohorts.minimumResidualRadians) fail("leaf-cohort", "Actual whole-shoot leaf poses must express maturation beyond an age-only line or negligible angle noise.", row.axis);
  }
  if (TERMINAL_CROWN78.has(g.profile.species)) for (const stem of g.axes.filter((a) => a.role === "support-axis")) {
    const top = stem.path.at(-1).position[1], height = top - stem.path[0].position[1];
    if (height < 1) continue;
    for (const petiole of g.axes.filter((a) => a.kind === "petiole" && a.parentId === stem.id)) if (top - petiole.path[0].position[1] > 0.56) fail("terminal-crown", "Live crown insertions cannot lengthen down an older standing axis with its historical scars.", petiole.id);
  }
  if (["monstera-deliciosa", "rhaphidophora-decursiva"].includes(g.profile.species) && g.profile.support76) {
    const host = g.profile.support76, stem = g.axes.find((a) => a.role === "climbing-axis");
    if (stem) for (const petiole of g.axes.filter((a) => a.kind === "petiole" && a.parentId === stem.id)) {
      const start = new Vector311(...petiole.path[0].position), end = new Vector311(...petiole.path.at(-1).position), normal = supportPoint76(host, start.y, Math.atan2(start.z - host.position[2], start.x - host.position[0])).normal;
      if (end.sub(start).dot(normal) < -1e-3) fail("host-facing-leaf", "Climbing leaf petioles must be born toward open space, not through the supporting host.", petiole.id);
    }
  }
  if (inspectCrownSlots78(g).status === "failed") fail("planar-crown-slabs", "Repeated empty planes across dense living subcrowns reveal centred birth slots or uniform subdivision shrinkage.");
  for (const issue of inspectPropRoots78(g)) fail(issue.code, issue.message, issue.organId);
  if (hasWoodStrategy77(g.profile.species)) {
    if (g.profile.species !== "terminalia-catappa" && inspectCrownFront78(g).status === "failed") fail("smooth-crown-front", "Most densely sampled subcrowns still fill smooth ellipsoid fronts instead of distinct living growth sectors.");
    const trunk = g.axes.find((a) => a.kind === "trunk");
    if (trunk) {
      const top = new Vector311(...trunk.path.at(-1).position), continuations = g.axes.filter((a) => a.kind === "branch" && a.parentId === trunk.id && new Vector311(...a.path[0].position).distanceTo(top) < 1e-3);
      if (!continuations.some((a) => a.path.at(-1).position[1] > top.y + 5e-3)) fail("living-continuation", "The terminal trunk must develop an ascending living continuation; a downward return into a crown ball is not an apex.", trunk.id);
    }
  }
  if (MUSOID78.has(g.profile.species)) {
    for (const stem of g.axes.filter((a) => a.role === "pseudostem")) {
      const sheaths = g.axes.filter((a) => a.role === "leaf-sheath" && a.parentId === stem.id), height = stem.path.at(-1).position[1] - stem.path[0].position[1], top = new Vector311(...stem.path.at(-1).position);
      for (const sheath of sheaths) {
        const delta = top.y - sheath.path.at(-1).position[1];
        if (delta > Math.min(height * 0.25, 0.95) + 1e-3) fail("active-apex", "Living leaf bases must occupy the active apex, not the entire historical sheath axis", sheath.id);
      }
      if (stem.path.at(-1).radius > stem.path[0].radius * 0.4) fail("living-neck", "Persistent sheaths must gather into their living neck instead of ending in an adult-width pipe", stem.id);
    }
  }
  return issues;
}

// ../current-site-source/checkout/src/TropicalLibrary/Production76.ts
function inspect(input, check, scope = "architecture") {
  const g = input.evidence.nativeGrowth76, issues = [];
  if (!g || g.architecture !== input.architecture || g.profile.seed !== input.seed) return { evidence: ["Inspected native growth identity"], issues: [{ code: "library76.native-evidence", message: "The native graph and input identity must agree" }] };
  const native = [77, 78].includes(g.profile.productionSystemVersion) ? void 0 : [...g.axes, ...g.blades];
  if (g.axes.length + g.blades.length !== input.organs.length || input.organs.some((o, i) => o !== (native ? native[i] : i < g.axes.length ? g.axes[i] : g.blades[i - g.axes.length]))) issues.push({ code: "library76.graph-source", message: "Validate the actual generated native organs, not a substitute graph" });
  check(g, (code, message) => issues.push({ code: "library76." + code, message }));
  if ([77, 78].includes(g.profile.productionSystemVersion) && scope !== "seed") issues.push(...inspectGrowth77(g, scope).issues);
  if (scope === "architecture") issues.push(...inspectGrowth78(g));
  return { evidence: [`Measured actual ${g.architecture} axes and supporting leaf attachments`], issues };
}
var ensete = (i) => inspect(i, (g, fail) => {
  const stems = g.axes.filter((a) => a.role === "pseudostem");
  if (stems.length !== 1 || g.axes.filter((a) => a.kind === "rhizome").length !== 1) fail("ensete-solitary", "Natural Ensete requires one sheath pseudostem, without induced suckering");
  const stem = stems[0];
  if (stem && stem.path[0].radius / stem.path.at(-1).radius < 1.3) fail("ensete-swollen-base", "The actual Ensete pseudostem must retain its swollen base");
  if (g.blades.some((l) => l.outline !== "oblong" || l.length > 5.01 || l.width > 1.51)) fail("ensete-lamina", "Ensete requires bounded oblong-lanceolate laminae");
});
var musa = (i) => inspect(i, (g, fail) => {
  const stems = g.axes.filter((a) => a.role === "pseudostem"), rhizomes = g.axes.filter((a) => a.kind === "rhizome");
  if (stems.length < (g.profile.stage === "juvenile" ? 1 : 2) || rhizomes.length !== stems.length) fail("musa-connected-daughters", "Every mother or daughter pseudostem needs its actual connected rhizome");
  if (g.blades.some((l) => l.length > 2.91 || l.width > 0.91)) fail("musa-blade-scale", "Balbisiana cannot inherit mountain giant Musa leaf dimensions");
  const ages = new Set(stems.map((a) => a.age));
  if (stems.length > 1 && ages.size < 2) fail("musa-age-allocation", "Mother and daughter axes cannot be an equal-age clone array");
});
var leucocasia = (i) => inspect(i, (g, fail) => {
  if (g.axes.filter((a) => a.kind === "rhizome").length !== 1 || g.axes.some((a) => a.role === "pseudostem")) fail("leucocasia-short-axis", "Leucocasia uses a coarse short basal axis, without Musa pseudostems or long runners");
  if (g.blades.some((l) => l.outline !== "peltate" || l.insertion < 0.15 || l.insertion > 0.4)) fail("leucocasia-insertion", "The petiole insertion must be authored within its actual peltate lamina");
  if (g.blades.some((l) => l.length > 1.51 || l.width > 1.11)) fail("leucocasia-scale", "Lamina must remain within the selected wild-reference limits");
});
var phenakospermum = (i) => inspect(i, (g, fail) => {
  if (g.axes.some((a) => a.role === "pseudostem") || g.axes.filter((a) => a.kind === "stem").length !== 1) fail("phenakospermum-axis", "A persistent support stem is required; Musa sheath pseudostems are not interchangeable");
  const directions = g.blades.map((b) => Math.atan2(b.direction[2], b.direction[0])), plane = directions[0];
  if (directions.some((a) => Math.abs(Math.sin(a - plane)) > 0.1) || directions.length < 4) fail("phenakospermum-distichy", "Leaf births must follow the actual two ranks");
});
var nypa = (i) => inspect(i, (g, fail) => {
  if (g.axes.filter((a) => a.kind === "stem").some((a) => a.path.some((p) => p.position[1] > 0.02)) || g.axes.some((a) => a.kind === "trunk")) fail("nypa-underground-axis", "Nypa cannot acquire a coconut above-ground trunk");
  if (g.blades.some((b) => b.role !== "leaflet" || b.outline !== "strap" || b.length > 1.31 || b.width > 0.081)) fail("nypa-pinnae", "Nypa fronds require bounded individual pinnae on rachises");
  if (g.axes.filter((a) => a.role === "rachis").length < 4) fail("nypa-fronds", "The underground axis must support its own continuous frond axes");
});
var corypha = (i) => inspect(i, (g, fail) => {
  if (g.blades.some((b) => b.outline !== "fan" || !b.folds || b.width > 3.51)) fail("corypha-continuous-fan", "Corypha needs continuous folded costapalmate blades, with bounded distal divisions");
  if (g.axes.some((a) => a.role === "rachis") || g.axes.filter((a) => a.kind === "stem").length !== 1) fail("corypha-single-axis", "A vegetative Corypha must retain one persistent axis and petiole-supported fans");
});
var ceiba = (i) => inspect(i, (g, fail) => {
  if (g.axes.filter((a) => a.kind === "trunk").length !== 1 || g.axes.filter((a) => a.role === "buttress").length < 3) fail("ceiba-rooted-bole", "Ceiba requires one persistent trunk and its connected basal buttresses");
  if (g.axes.some((a) => a.kind === "rachis") || g.blades.some((b) => b.role !== "leaflet")) fail("ceiba-palmate", "Ceiba must retain actual palmate leaflets on their common petiole");
  const counts = /* @__PURE__ */ new Map();
  for (const blade of g.blades) counts.set(blade.parentId, 1 + (counts.get(blade.parentId) ?? 0));
  if ([...counts.values()].some((n) => n !== 5 && n !== 7)) fail("ceiba-leaflets", "Every Ceiba compound leaf requires its independently born five or seven leaflets");
});
var koompassia = (i) => inspect(i, (g, fail) => {
  const trunk = g.axes.find((a) => a.kind === "trunk");
  if (!trunk || g.axes.filter((a) => a.role === "buttress").length < 3) fail("koompassia-rooted-bole", "Koompassia needs its own continuous bole and root plates");
  if (g.profile.stage === "adult" && trunk) {
    const top = Math.max(...trunk.path.map((p) => p.position[1])), births = g.axes.filter((a) => a.kind === "branch" && a.parentId === trunk.id);
    if (births.some((a) => a.path[0].position[1] < top * 0.5)) fail("koompassia-high-crown", "Adult K. excelsa cannot inherit low open-grown generic tree branches");
  }
  if (!g.axes.some((a) => a.kind === "rachis") || g.blades.some((b) => b.role !== "leaflet" || b.length > 0.0421 || b.width > 0.0171)) fail("koompassia-small-pinnate", "Small alternate leaflets must retain the independently sourced PROSEA dimensions and their real rachises");
  const leaves = /* @__PURE__ */ new Map();
  for (const b of g.blades) {
    const group = leaves.get(b.parentId) ?? [];
    group.push(b);
    leaves.set(b.parentId, group);
  }
  for (const rachis of g.axes.filter((a) => a.kind === "rachis")) {
    const group = leaves.get(rachis.id) ?? [], tip = rachis.path.at(-1).position;
    if (group.length !== 11 || !group.some((b) => b.attachment.every((n, i2) => Math.abs(n - tip[i2]) < 1e-8))) fail("koompassia-terminal-leaflet", "An alternate Koompassia compound leaf requires its real terminal leaflet");
  }
});
var textilis = (i) => inspect(i, (g, fail) => {
  const n = g.axes.filter((a) => a.role === "pseudostem").length;
  if (n !== g.axes.filter((a) => a.kind === "rhizome").length || g.profile.stage === "adult" && n < 5) fail("textilis-clump", "Abaca requires a dense connected age-separated short-rhizome clump");
  if (g.blades.some((b) => b.length > 2.11 || b.width > 0.56)) fail("textilis-blades", "Abaca cannot inherit giant mountain leaf sizes");
});
var itinerans = (i) => inspect(i, (g, fail) => {
  if (g.evidence.taxonScope !== "species reference; not var. xishuangbannaensis" || g.blades.some((b) => b.length > 3.11 || b.width > 0.91)) fail("itinerans-material", "Keep species-scale itinerans separate from giant named variety material");
  if (g.profile.stage === "adult" && !g.axes.some((a) => a.kind === "rhizome" && a.path.some((p) => Math.hypot(p.position[0], p.position[2]) > 1.2))) fail("itinerans-wandering", "Actual long spaced connected daughter paths are required");
});
var ingens = (i) => inspect(i, (g, fail) => {
  const stems = g.axes.filter((a) => a.role === "pseudostem");
  if (!stems.length || stems.some((a) => a.path.at(-1).position[1] - a.path[0].position[1] > 15.01 || a.path[0].radius * 2 * Math.PI > 2.01) || g.blades.some((b) => b.length > 5.01)) fail("ingens-size-mouth", "Musa ingens must retain mountain-material height and circumference bounds");
  if (g.evidence.elevationMetres?.toString() !== "1000,2100") fail("ingens-habitat", "Mountain habitat identity must be explicit");
});
var glaucum = (i) => inspect(i, (g, fail) => {
  if (g.axes.filter((a) => a.role === "pseudostem").length !== 1 || g.axes.filter((a) => a.kind === "rhizome").length !== 1 || g.blades.some((b) => b.length > 1.801 || b.width > 0.601)) fail("glaucum-solitary-scale", "Asian Ensete retains one swollen axis and bounded shorter waxy laminae");
});
var ravenala = (i) => inspect(i, (g, fail) => {
  if (g.axes.some((a) => a.role === "pseudostem") || g.evidence.taxonScope !== "Ravenala madagascariensis emended 2021") fail("ravenala-anatomy", "Strict Ravenala must retain its independently identified persistent axes");
  if (g.blades.some((b) => b.length > 2.001 || b.width > 1.001)) fail("ravenala-strict-lamina", "The old horticultural aggregate 4 m blade is not strict madagascariensis");
  const stems = g.axes.filter((a) => a.kind === "stem");
  if (g.profile.stage !== "juvenile" && stems.length < 2) fail("ravenala-suckering", "The emended species requires connected persistent sucker axes");
  const direction = g.blades[0]?.direction;
  if (direction && g.blades.some((b) => Math.abs(direction[0] * b.direction[2] - direction[2] * b.direction[0]) > 0.15)) fail("ravenala-ranks", "The actual crowns must preserve two leaf ranks");
});
var strelitzia = (i) => inspect(i, (g, fail) => {
  const stems = g.axes.filter((a) => a.kind === "stem");
  if (g.axes.some((a) => a.role === "pseudostem") || !stems.length || g.profile.stage === "adult" && stems.length < 2) fail("strelitzia-clump", "Persistent unequal-age multi-axis stems are required");
  if (g.blades.some((b) => b.length > 2.01)) fail("strelitzia-lamina", "S. nicolai cannot borrow Ravenala long-petiole proportions");
});
var pometia = (i) => inspect(i, (g, fail) => {
  const groups = /* @__PURE__ */ new Map();
  for (const blade of g.blades) {
    const group = groups.get(blade.parentId) ?? [];
    group.push(blade);
    groups.set(blade.parentId, group);
  }
  if (!g.axes.some((a) => a.kind === "rachis") || [...groups.values()].some((n) => n.length !== 12) || g.blades.some((b) => b.role !== "leaflet")) fail("pometia-paripinnate", "Selected Pometia requires six pairs on real rachises; no terminal leaflet");
  for (const a of g.axes.filter((a2) => a2.kind === "rachis")) {
    const tip = a.path.at(-1).position;
    if (groups.get(a.id)?.some((b) => b.attachment.every((v, i2) => v === tip[i2]))) fail("pometia-terminal", "A terminal leaflet contradicts the confirmed paripinnate material");
  }
});
function propNetwork(g, fail) {
  const axisById = new Map(g.axes.map((a) => [a.id, a]));
  for (const root of g.axes.filter((a) => a.role === "grounded-prop")) {
    const parent = axisById.get(root.parentId);
    if (root.kind !== "root" || !root.fixed || Math.abs(root.path.at(-1).position[1]) > 1e-3 || parent?.kind !== "branch" || !g.blades.some((b) => {
      let a = axisById.get(b.parentId);
      while (a) {
        if (a.id === parent?.id) return true;
        a = axisById.get(a.parentId);
      }
      return false;
    })) fail("prop-living-network", "Every grounded woody prop must reach actual ground and support a living crown continuation");
    const first = root.path[0].position, last = root.path.at(-1).position, dx = last[0] - first[0], dy = last[1] - first[1], dz = last[2] - first[2], length = Math.hypot(dx, dy, dz);
    let deviation = 0;
    for (const p of root.path) {
      const vx = p.position[0] - first[0], vy = p.position[1] - first[1], vz = p.position[2] - first[2];
      deviation = Math.max(deviation, Math.hypot(vy * dz - vz * dy, vz * dx - vx * dz, vx * dy - vy * dx) / length);
    }
    if (root.path[0].radius > 0.1 && deviation < Math.max(0.08, length * 0.018)) fail("prop-straight-rod", "Thick developed support roots require sustained authored curvature");
  }
}
var benghalensis = (i) => inspect(i, (g, fail) => {
  propNetwork(g, fail);
  if (g.profile.stage === "adult" && !g.axes.some((a) => a.role === "grounded-prop")) fail("benghalensis-props", "The selected mature spreading banyan must retain grounded props");
  if (g.blades.some((b) => b.length > 0.201 || b.role !== "lamina")) fail("benghalensis-leaves", "Broad simple leaves cannot become rubber-fig giant leaves or compound foliage");
});
var elastica = (i) => inspect(i, (g, fail) => {
  propNetwork(g, fail);
  if (g.blades.some((b) => b.length > 0.301 || b.width > 0.151 || b.role !== "lamina") || g.axes.some((a) => a.kind === "rachis")) fail("elastica-large-simple", "Rubber fig requires actual thick simple spiral leaves on its own steep shoots");
});
var catappa = (i) => inspect(i, (g, fail) => {
  const trunk = g.axes.find((a) => a.kind === "trunk"), limbs = g.axes.filter((a) => a.kind === "branch" && a.parentId === trunk?.id), heights = new Set(limbs.map((a) => a.path[0].position[1].toFixed(4)));
  if (heights.size < 3 || limbs.some((a) => Math.abs(a.path.at(-1).position[1] - a.path[0].position[1]) > 1)) fail("catappa-tiers", "Catappa must execute multiple nearly horizontal whorled branch tiers");
  if (g.blades.some((b) => b.length > 0.381 || b.width > 0.191) || g.axes.some((a) => a.kind === "rachis")) fail("catappa-leaves", "Catappa retains large simple terminal leaf groups");
});
function simpleEmergent(species, lift, length, width, buttresses, strategy) {
  return (i) => inspect(i, (g, fail) => {
    const trunk = g.axes.find((a) => a.kind === "trunk"), primaries = g.axes.filter((a) => a.kind === "branch" && a.parentId === trunk?.id);
    if (!trunk || g.axes.filter((a) => a.role === "buttress").length < (g.profile.stage === "juvenile" ? 3 : buttresses) || primaries.length < 2) fail("emergent-support", "A persistent rooted bole and independently attached crown limbs are required");
    if (g.evidence.allocationStrategy !== strategy || g.blades.some((b) => b.role !== "lamina" || b.outline !== "elliptic" || b.length > length + 1e-4 || b.width > width + 1e-4) || g.axes.some((a) => a.kind === "rachis")) fail("emergent-leaf-identity", species + " must retain its own simple-leaf strategy and measured bounds");
    const stageLift = [77, 78].includes(g.profile.productionSystemVersion) ? g.profile.stage === "juvenile" ? 0.12 : g.profile.stage === "establishing" ? lift * 0.4 : lift * 0.7 : lift * 0.7;
    if (trunk && primaries.some((a) => a.path[0].position[1] < trunk.path.at(-1).position[1] * stageLift)) fail("emergent-crown-lift", "Actual primary birth heights contradict the independently allocated stage and bole");
  });
}
var malaccensis = (i) => inspect(i, (g, fail) => {
  const groups = /* @__PURE__ */ new Map();
  for (const b of g.blades) groups.set(b.parentId, 1 + (groups.get(b.parentId) ?? 0));
  if (g.evidence.allocationStrategy !== "subcrowns" || !groups.size || [...groups.values()].some((n) => n !== 11) || g.blades.some((b) => b.role !== "leaflet" || b.length > 0.0901 || b.width > 0.0381)) fail("malaccensis-compound", "Malaccensis requires longer alternate leaflets and a terminal leaflet on its own subcrowns");
});
function bipinnate(species, pinnaPairs, leafletPairs, length, width) {
  return (i) => inspect(i, (g, fail) => {
    const axes = new Map(g.axes.map((a) => [a.id, a])), pinnae = g.axes.filter((a) => a.kind === "rachis" && axes.get(a.parentId)?.kind === "rachis"), groups = /* @__PURE__ */ new Map();
    for (const b of g.blades) groups.set(b.parentId, 1 + (groups.get(b.parentId) ?? 0));
    const primary = g.axes.filter((a) => a.kind === "rachis" && axes.get(a.parentId)?.kind === "petiole"), pinnaIds = new Set(pinnae.map((a) => a.id));
    const counts = /* @__PURE__ */ new Map();
    for (const a of pinnae) counts.set(a.parentId, 1 + (counts.get(a.parentId) ?? 0));
    if (!primary.length || counts.size !== primary.length || [...counts.values()].some((n) => n !== pinnaPairs * 2) || [...groups.values()].some((n) => n !== leafletPairs * 2) || g.blades.some((b) => !pinnaIds.has(b.parentId) || b.length > length + 1e-4 || b.width > width + 1e-4)) fail("bipinnate-support", species + " requires a real petiole, primary rachis, supporting pinnae and independently attached leaflets");
  });
}
var dinizia = bipinnate("Dinizia excelsa", 4, 9, 0.025, 0.011);
var samanea = bipinnate("Samanea saman", 3, 5, 0.049, 0.025);
var intsia = (i) => inspect(i, (g, fail) => {
  const groups = /* @__PURE__ */ new Map();
  for (const b of g.blades) groups.set(b.parentId, 1 + (groups.get(b.parentId) ?? 0));
  if (!groups.size || [...groups.values()].some((n) => n !== 4) || g.blades.some((b) => b.role !== "leaflet" || b.length > 0.1401 || b.width > 0.0901)) fail("intsia-paired-leaflets", "Requalified Intsia must execute few large paired leaflets, without a terminal leaflet");
  if (g.evidence.requalification !== "new76 skeleton; historical v7 reader remains frozen") fail("intsia-requalification", "Old admission cannot substitute for the new architecture");
});
var odora = (i) => inspect(i, (g, fail) => {
  if (g.blades.some((b) => b.outline !== "peltate" || b.insertion !== 0.29 || b.length > 1.3001 || b.width > 1.0001) || g.axes.some((a) => a.role === "pseudostem")) fail("odora-closed-sinus", "Odora must retain its closed sinus, short corm and independently connected short stolons");
});
var xanthosoma = (i) => inspect(i, (g, fail) => {
  if (g.blades.some((b) => b.outline !== "arrow" || b.insertion !== 0.32 || b.length > 0.8601 || b.width > 0.5701) || g.evidence.attachment !== "basal sinus; not shield/peltate") fail("xanthosoma-sinus", "Yautia must retain its real basal sinus and downward sagittate blade");
});
var cyrtosperma = (i) => inspect(i, (g, fail) => {
  if (g.profile.material !== "pacific-cultivated-reference" || g.blades.some((b) => b.outline !== "arrow" || b.insertion !== 0.55 || b.length > 1.3001 || b.width > 0.8001) || g.evidence.petiole !== "unarmed cultivated reference, not random cultivar spininess") fail("cyrtosperma-material", "Keep the selected bounded cultivated material and long posterior lobes; seed cannot change cultivar identity");
});
var robusta = (i) => inspect(i, (g, fail) => {
  const juvenile = g.profile.stage === "juvenile";
  if (g.evidence.taxonScope !== "Alocasia robusta M. Hotta; Hay 1998 revision" || g.blades.some((b) => b.outline !== (juvenile ? "peltate" : "arrow") || b.length > (juvenile ? 0.3001 : 4.0001) || b.width > 2.5001)) fail("robusta-heteroblasty", "Hay 1998 robusta requires genuinely peltate small juvenile blades and sagittate adult lamina reaching the sinus");
});
var heliconiaLimits76 = [{ species: "heliconia-bihai", material: "lobster-claw-one", leafLength: 0.6, leafWidth: 0.19, leaves: 6 }, { species: "heliconia-caribaea", material: "wild-reference", leafLength: 1.4, leafWidth: 0.35, leaves: 5 }, { species: "heliconia-latispatha", material: "orange-gyro", leafLength: 0.95, leafWidth: 0.25, leaves: 5 }, { species: "heliconia-chartacea", material: "sexy-scarlet", leafLength: 1, leafWidth: 0.28, leaves: 6 }];
var heliconiaValidators = Object.fromEntries(heliconiaLimits76.map((d) => [d.species + "/76", ((i) => inspect(i, (g, fail) => {
  const axes = new Map(g.axes.map((a) => [a.id, a])), groups = /* @__PURE__ */ new Map();
  for (const leaf of g.blades.filter((b) => b.role !== "bract")) {
    let stem = axes.get(axes.get(leaf.parentId)?.parentId ?? "");
    if (stem?.role === "leaf-sheath") stem = axes.get(stem.parentId);
    if (!stem || stem.role !== "pseudostem") {
      fail("heliconia-sheath-support", "Leaves must belong to their actual sheath shoot");
      continue;
    }
    const group = groups.get(stem.id) ?? [];
    group.push(leaf);
    groups.set(stem.id, group);
  }
  if (g.profile.material !== d.material || g.blades.some((b) => b.role !== "bract" && (b.outline !== "oblong" || b.length > d.leafLength + 1e-4 || b.width > d.leafWidth + 1e-4))) fail("heliconia-material-bounds", "Species and selected cultivar organ bounds must remain independent of seed");
  for (const leaves of groups.values()) {
    const first = leaves[0].direction;
    if (leaves.some((b) => Math.abs(first[0] * b.direction[2] - first[2] * b.direction[0]) > 0.01) || leaves.length !== (g.profile.stage === "juvenile" ? 3 : d.leaves)) fail("heliconia-two-ranks", "Actual sheath shoot must execute its independently registered two-rank leaf count");
  }
}))]));
var etlingera = (i) => inspect(i, (g, fail) => {
  const counts = /* @__PURE__ */ new Map(), axes = new Map(g.axes.map((a) => [a.id, a]));
  for (const b of g.blades.filter((b2) => b2.role !== "bract")) {
    let stem = axes.get(axes.get(b.parentId)?.parentId ?? "");
    if (stem?.role === "leaf-sheath") stem = axes.get(stem.parentId);
    const id = stem?.id ?? "";
    counts.set(id, 1 + (counts.get(id) ?? 0));
  }
  if (g.blades.filter((b) => b.role !== "bract").some((b) => b.length > 0.8501 || b.width > 0.1801) || g.profile.stage !== "juvenile" && [...counts.values()].some((n) => n < 14 || n > 34)) fail("etlingera-leafy-axis", "Torch ginger requires many short-petioled stem leaves; a banana terminal rosette is rejected");
});
var calathea = (i) => inspect(i, (g, fail) => {
  if (g.axes.some((a) => a.role === "pseudostem") || g.blades.some((b) => b.length > 1.5001 || b.width > 0.6001) || !g.axes.some((a) => a.kind === "petiole" && a.path.at(-2).radius > a.path[0].radius)) fail("calathea-pulvinus", "Wax-backed Calathea retains short aerial axes and the actual distal pulvinus swelling");
});
var megaphrynium = (i) => inspect(i, (g, fail) => {
  const counts = /* @__PURE__ */ new Map(), axes = new Map(g.axes.map((a) => [a.id, a]));
  for (const b of g.blades) {
    const id = axes.get(b.parentId)?.parentId ?? "";
    counts.set(id, 1 + (counts.get(id) ?? 0));
  }
  if ([...counts.values()].some((n) => n !== 1) || g.blades.some((b) => b.length > 0.9001) || g.axes.some((a) => a.role === "pseudostem")) fail("megaphrynium-single-leaves", "Each connected rhizome shoot has its own solitary long-petioled leaf, without a Musa crown");
});
var donax = (i) => inspect(i, (g, fail) => {
  const axes = new Map(g.axes.map((a) => [a.id, a]));
  if (!g.axes.some((a) => a.kind === "stem" && axes.get(a.parentId)?.kind === "stem") || g.axes.some((a) => a.role === "pseudostem" || a.kind === "culm") || g.blades.some((b) => b.length > 0.2501 || b.width > 0.4501)) fail("donax-upper-forks", "Donax requires cane-like basal stem, upper living stem forks and cauline leaves");
});
function pinnatePalm76(species, length, width) {
  return (i) => inspect(i, (g, fail) => {
    if (g.axes.filter((a) => a.kind === "stem").length !== 1 || g.axes.some((a) => a.kind === "branch" || a.kind === "trunk") || g.blades.some((b) => b.outline !== "strap" || b.role !== "leaflet" || b.length > length + 1e-4 || b.width > width + 1e-4)) fail("palm-pinnate", species + " requires a persistent palm axis and actual one-level pinnate leaf supports");
  });
}
var caryota = (i) => inspect(i, (g, fail) => {
  const axes = new Map(g.axes.map((a) => [a.id, a]));
  if (g.axes.filter((a) => a.kind === "stem").length !== 1 || g.blades.some((b) => b.outline !== "fishtail" || axes.get(axes.get(b.parentId)?.parentId ?? "")?.kind !== "rachis")) fail("caryota-two-levels", "Solitary Caryota urens needs actual two-level rachises before terminal fishtail blades");
});
var licuala = (i) => inspect(i, (g, fail) => {
  if (g.axes.filter((a) => a.kind === "stem").length !== 1 || g.blades.some((b) => b.outline !== "fan" || b.fanAngle !== Math.PI * 2 || b.distalDivision !== 0.023 || b.width > 0.9001)) fail("licuala-entire-fan", "Licuala grandis must remain one continuous near-circular fan with only short distal margin incisions");
});
var lodoicea = (i) => inspect(i, (g, fail) => {
  if (g.evidence.nativeRegion !== "Praslin and Curieuse, Seychelles" || g.blades.some((b) => b.outline !== "fan" || b.width > 4.0001) || g.profile.stage === "juvenile" && g.blades.some((b) => !b.roll && b.width < 2)) fail("lodoicea-ontogeny", "Near-ground giant juvenile fans and Seychelles identity cannot be replaced by a uniformly scaled adult Corypha");
});
var pandanus = (i) => inspect(i, (g, fail) => {
  if (g.axes.some((a) => a.kind === "trunk" || a.kind === "branch" || a.role === "rachis") || g.blades.some((b) => b.outline !== "strap" || b.length > 1.8001 || b.width > 0.0801) || g.profile.stage !== "juvenile" && g.axes.filter((a) => a.role === "grounded-prop").length < 3) fail("pandanus-independent", "Pandanus requires branched persistent stems, terminal spiral strap leaves and actual oblique ground-contact roots");
});
var altilis = (i) => inspect(i, (g, fail) => {
  if (g.profile.material !== "lobed-cultivated-reference" || g.axes.some((a) => a.kind === "rachis") || g.blades.some((b) => b.outline !== "breadfruit-lobed" || b.length > 0.7001) || g.evidence.ordinaryHeight !== 13.5) fail("altilis-cultivated", "Independently rooted cultivated breadfruit requires its own large lobed terminal leaves; mariannensis is not a substitute");
});
var barringtonia = (i) => inspect(i, (g, fail) => {
  if (g.axes.some((a) => a.role === "buttress")) fail("barringtonia-unbuttressed", "Selected NParks coastal material is unbuttressed");
  if (g.blades.some((b) => b.length > 0.5201 || b.width > 0.2101) || g.axes.some((a) => a.kind === "rachis") || g.evidence.requalification !== "independent coastal crown76, not withdrawn historical generic skeleton") fail("barringtonia-terminal", "Requalified coastal Barringtonia retains large simple terminal clusters and its new living crown");
});
var virens = (i) => inspect(i, (g, fail) => {
  propNetwork(g, fail);
  if (g.blades.some((b) => b.length > 0.2001 || b.width > 0.0901) || g.evidence.rootStrategy !== "unequal limb-base rooted props and younger hanging roots") fail("virens-network", "Virens must retain its own taller coarse crown, thin leathery leaf bounds and independently rooted limb supports");
});
var microcarpa = (i) => inspect(i, (g, fail) => {
  propNetwork(g, fail);
  if (g.blades.some((b) => b.length > 0.1401 || b.width > 0.0901) || g.profile.stage === "adult" && g.axes.filter((a) => a.role === "aerial-root").length < 10) fail("microcarpa-root-curtain", "Microcarpa needs its own small-leaf crown and numerous young hanging roots preceding fewer living props");
});
function explicitSupport76(g, fail) {
  const s = g.profile.support76;
  if (!s || g.evidence.support === void 0) {
    fail("support-missing", "Dependent organs require an explicit saved support and measured contact");
    return;
  }
  const contacts2 = g.axes.filter((a) => a.role === "absorbing-root").map((a) => a.path.at(-1).position);
  if (!contacts2.length) contacts2.push(g.axes[0].path[0].position);
  for (const p of contacts2) {
    try {
      if (supportDistance76(s, p) > 3e-3 || p[1] < s.position[1] || p[1] > s.position[1] + s.height) fail("support-three-dimensional-contact", "Actual attachment-root endpoints must reach the saved final supporting surface in three dimensions");
    } catch {
      fail("support-three-dimensional-contact", "Saved supporting triangles do not provide a valid contact");
    }
  }
}
var monstera = (i) => inspect(i, (g, fail) => {
  explicitSupport76(g, fail);
  if (g.axes.filter((a) => a.role === "climbing-axis").length !== 1 || g.blades.some((b) => b.width > 0.9001 || b.outline !== (g.profile.stage === "juvenile" ? "arrow" : "monstera-adult"))) fail("monstera-natural-holes", "Ground-started juvenile entire leaves and naturally fenestrated climbing adult leaves require separate saved development");
});
var rhaphidophora = (i) => inspect(i, (g, fail) => {
  explicitSupport76(g, fail);
  const large = g.blades.filter((b) => b.role === "lamina");
  if (large.some((b) => b.length > 1.0001 || b.width > 0.5001 || b.outline !== (g.profile.stage === "juvenile" ? "arrow" : "rhaphidophora-adult")) || g.profile.stage !== "juvenile" && g.blades.filter((b) => b.role === "cataphyll").length < large.length * 2) fail("rhaphidophora-node-sequence", "Retain entire juvenile leaves, asymmetrically divided mature leaves and intervening cataphyll nodes");
});
var angiopteris = (i) => inspect(i, (g, fail) => {
  if (g.axes.some((a) => a.kind === "stem" || a.kind === "trunk") || g.blades.some((b) => b.role !== "pinna" || b.length > 0.2001 || b.width > 0.0251) || !g.axes.some((a) => a.kind === "rachis" && g.axes.find((p) => p.id === a.parentId)?.kind === "rachis")) fail("angiopteris-fleshy-bipinnate", "Angiopteris needs a fleshy short rhizome and real two-level fern axes, not a woody tree-fern trunk");
});
var sphaeropteris = (i) => inspect(i, (g, fail) => {
  if (g.axes.filter((a) => a.kind === "stem").length !== 1 || g.axes.some((a) => a.kind === "trunk" || a.kind === "branch") || g.blades.some((b) => b.outline !== "fern-pinnatifid" || b.length > 0.1501 || b.width > 0.0231)) fail("sphaeropteris-nonwood-axis", "Lepifera must retain its non-woody standing fern axis and connected tripinnatifid divisions within pinnule bounds");
  for (const code of inspectTreeFernDimensions77(g)) fail("sphaeropteris-measured-" + code, "Actual adult frond graph must retain independently sourced stipe, blade, pinna and pinnule dimensions");
});
var asplenium = (i) => inspect(i, (g, fail) => {
  explicitSupport76(g, fail);
  if (g.axes.some((a) => a.kind === "rachis" || a.kind === "stem") || g.blades.some((b) => b.outline !== "strap" || b.length > 1.6001 || b.width > 0.2101)) fail("asplenium-strict-entire", "Strict nidus reference requires a short attached rhizome and simple entire nest fronds");
});
var platycerium = (i) => inspect(i, (g, fail) => {
  explicitSupport76(g, fail);
  if (!g.blades.some((b) => b.role === "shield") || !g.axes.some((a) => a.role === "frond" && a.kind === "rachis") || !g.blades.some((b) => b.role === "lamina" && b.outline === "strap")) fail("platycerium-two-frond-roles", "Retain functional nest shields and the actual repeatedly forked fertile ribbons; generic pinnae are rejected");
});
var ARCHITECTURE_VALIDATORS76 = {
  "ensete-ventricosum/76": ensete,
  "musa-balbisiana/76": musa,
  "leucocasia-gigantea/76": leucocasia,
  "phenakospermum-guyannense/76": phenakospermum,
  "nypa-fruticans/76": nypa,
  "corypha-utan/76": corypha,
  "ceiba-pentandra/76": ceiba,
  "koompassia-excelsa/76": koompassia,
  "musa-textilis/76": textilis,
  "musa-itinerans/76": itinerans,
  "musa-ingens/76": ingens,
  "ensete-glaucum/76": glaucum,
  "ravenala-madagascariensis/76": ravenala,
  "strelitzia-nicolai/76": strelitzia,
  "pometia-pinnata/76": pometia,
  "ficus-benghalensis/76": benghalensis,
  "ficus-elastica/76": elastica,
  "terminalia-catappa/76": catappa,
  "koompassia-malaccensis/76": malaccensis,
  "richetia-faguetiana/76": simpleEmergent("Richetia faguetiana", 0.56, 0.08, 0.03, 4, "reiterating-dipterocarp"),
  "rubroshorea-leprosula/76": simpleEmergent("Rubroshorea leprosula", 0.47, 0.13, 0.062, 5, "reiterating-dipterocarp"),
  "dipterocarpus-grandiflorus/76": simpleEmergent("Dipterocarpus grandiflorus", 0.43, 0.17, 0.105, 4, "horizontal-dome"),
  "dryobalanops-aromatica/76": simpleEmergent("Dryobalanops aromatica", 0.52, 0.058, 0.032, 5, "reiterating-dipterocarp"),
  "hopea-odorata/76": simpleEmergent("Hopea odorata", 0.38, 0.12, 0.055, 4, "ascending-cone"),
  "terminalia-superba/76": simpleEmergent("Terminalia superba", 0.61, 0.16, 0.085, 5, "flat-terminalia"),
  "dinizia-excelsa/76": dinizia,
  "samanea-saman/76": samanea,
  "intsia-bijuga/76": intsia,
  "alocasia-odora/76": odora,
  "xanthosoma-sagittifolium/76": xanthosoma,
  "cyrtosperma-merkusii/76": cyrtosperma,
  "alocasia-robusta/76": robusta,
  ...heliconiaValidators,
  "etlingera-elatior/76": etlingera,
  "calathea-lutea/76": calathea,
  "megaphrynium-macrostachyum/76": megaphrynium,
  "donax-canniformis/76": donax,
  "raphia-farinifera/76": pinnatePalm76("Raphia farinifera", 2, 0.08),
  "arenga-pinnata/76": pinnatePalm76("Arenga pinnata", 1, 0.065),
  "caryota-urens/76": caryota,
  "licuala-grandis/76": licuala,
  "lodoicea-maldivica/76": lodoicea,
  "pandanus-tectorius/76": pandanus,
  "artocarpus-altilis/76": altilis,
  "barringtonia-asiatica/76": barringtonia,
  "ficus-virens/76": virens,
  "ficus-microcarpa/76": microcarpa,
  "monstera-deliciosa/76": monstera,
  "rhaphidophora-decursiva/76": rhaphidophora,
  "angiopteris-evecta/76": angiopteris,
  "sphaeropteris-lepifera/76": sphaeropteris,
  "asplenium-nidus/76": asplenium,
  "platycerium-coronarium/76": platycerium
};
var category = (i) => inspect(i, (g, fail) => {
  if (g.category === "Tree" && g.axes.some((a) => a.kind === "trunk")) {
    const byId = new Map(g.axes.map((a) => [a.id, a]));
    for (const trunk of g.axes.filter((a) => a.kind === "trunk")) {
      const tip = trunk.path.at(-1).position, apices = g.axes.filter((a) => a.kind === "branch" && a.parentId === trunk.id && a.path[0].position.every((v, i2) => Math.abs(v - tip[i2]) < 1e-8));
      if (!apices.length || !g.blades.some((blade) => {
        let a = byId.get(blade.parentId);
        while (a) {
          if (apices.some((t) => t.id === a.id)) return true;
          a = byId.get(a.parentId);
        }
        return false;
      })) fail("category-apical-crown", "A living standing bole must end in its actual species leaf-bearing continuation, not an exposed capped pole");
    }
  }
  if (!g.blades.length || !g.axes.length) fail("category-complete-specimen", "Complete living organs are required");
  if (g.axes.some((a) => a.role === "petiole" && a.kind !== "petiole")) fail("category-petiole-role", "Petiole role and organ kind must agree");
}, "category");
var seed = (i) => inspect(i, (g, fail) => {
  if (g.cohort.version !== 76 || g.cohort.allocatedBeforeBirth !== true || g.cohort.form !== g.profile.habitatForm) fail("cohort-allocation", "Freeze the correlated cohort before the first organ birth");
  if (g.profile.condition76 === "renewing" && (!g.events.some((e) => e.event === "unfolding") || !g.blades.some((b) => b.roll && b.age < 0.1))) fail("renewal-development", "Renewing profiles require a physically unexpanded living cohort");
  if (g.profile.reproductive76 !== g.blades.some((b) => b.role === "bract") || g.profile.reproductive76 && !g.axes.some((a) => a.role === "floral-axis")) fail("reproductive-support", "Reproductive state requires its own live support axes and modified leaf bracts");
  if (g.scars76.some((s) => !g.axes.some((a) => a.id === s.axisId && a.kind === "stem") || !Number.isFinite(s.travel + s.azimuth + s.width + s.age + s.birth) || s.travel < 0 || s.width <= 0 || s.age < 0 || s.age > 1)) fail("leaf-base-history", "Saved scars must remain bounded events on actual persistent axes");
  if (g.blades.some((b) => b.roll !== void 0 && (!Number.isFinite(b.roll) || b.roll < 0 || b.roll > 1))) fail("renewal-roll", "Saved unfolding bounds are invalid");
  if (g.events.reduce((n, e) => n + Number(e.event === "birth"), 0) !== g.axes.length + g.blades.length) fail("birth-events", "Each real organ must retain its own birth event");
  const ids = [77, 78].includes(g.profile.productionSystemVersion) ? new NativeOrganIndex77(i.organs, { axes: g.axes.length, blades: g.blades.length }) : new Set([...g.axes, ...g.blades].map((o) => o.id));
  if (g.events.some((e) => !ids.has(e.organ))) fail("birth-identity", "Events cannot refer to nonexistent organs");
}, "seed");
function evaluateGrowth76(g) {
  return evaluateVegetationProduction({ ...[77, 78].includes(g.profile.productionSystemVersion) ? { productionSystemVersion: 77, nativeOrganCounts77: { axes: g.axes.length, blades: g.blades.length } } : {}, categoryConstraintVersion: 2, category: g.category, architecture: g.architecture, seed: g.profile.seed, organs: [...g.axes, ...g.blades], evidence: { nativeGrowth76: g } }, { category: { Tree: category, Herb: category, Fern: category, Shrub: category, Grass: category }, architecture: ARCHITECTURE_VALIDATORS76, seed });
}

// ../current-site-source/checkout/src/TropicalLibrary/GeometryWitness77.ts
import { Vector3 as Vector314 } from "../vendor/three.module.min.js";

// ../current-site-source/checkout/src/TropicalLibrary/FanGeometry78.ts
import { Vector3 as Vector312 } from "../vendor/three.module.min.js";
function inspectSavedFan78(b, positions, start, count) {
  const columns = (b.folds ?? 48) * 2, rings = 10, root = new Vector312(...b.attachment), axis = new Vector312(...b.direction), side = axis.clone().cross(new Vector312(...b.normal)).normalize();
  if (count !== columns * (rings + 1) * 2) throw Error("Production78 fan chart provenance mismatch: " + b.id);
  for (let k = 0; k < columns; k++) for (let sideIndex = 0; sideIndex < 2; sideIndex++) {
    let previous = -1;
    for (let j = 0; j <= rings; j++) {
      const delta = new Vector312().fromArray(positions, (start + k * (rings + 1) * 2 + j * 2 + sideIndex) * 3).sub(root), radius = Math.hypot(delta.dot(axis) / b.length, delta.dot(side) / (b.width * 0.5));
      if (!Number.isFinite(radius) || radius < previous - 2e-5) throw Error("Production78 saved fan folds inward across its split boundary: " + b.id);
      previous = radius;
    }
  }
}

// ../current-site-source/checkout/src/TropicalLibrary/ArrowGeometry78.ts
import { Vector3 as Vector313 } from "../vendor/three.module.min.js";
function inspectSavedArrow78(b, positions, start, count) {
  const columns = b.width > 0.4 ? 8 : b.width < 0.09 ? 2 : 4, stride = columns + 1;
  if (count % (2 * stride) || count < 4 * stride) throw Error("Production78 arrow chart provenance mismatch: " + b.id);
  const reference = new Vector313().fromArray(positions, (start + count / 2 - stride) * 3), tolerance = Math.max(2e-5, b.length * 1e-5, reference.length() * 2e-7);
  for (const end of [start + count / 2, start + count]) for (let v = end - stride; v < end; v++) {
    const point = new Vector313().fromArray(positions, v * 3);
    if (!Number.isFinite(point.lengthSq()) || point.distanceTo(reference) > tolerance) throw Error("Production78 saved arrow tip is an artificial fin: " + b.id);
  }
}

// ../current-site-source/checkout/src/TropicalLibrary/GeometryWitness77.ts
function inspectBladeGeometry77(s) {
  if (![77, 78].includes(s.growth.profile.productionSystemVersion)) return;
  const g = s.geometry, ranges = g.bladeRanges77;
  if (!g.backendId.endsWith("/production-system-" + s.growth.profile.productionSystemVersion) || !(ranges instanceof Uint32Array) || ranges.length !== s.growth.blades.length * 4) throw Error("Production77 requires saved per-blade geometry provenance");
  let triangles = 0;
  s.growth.blades.forEach((b, i) => {
    const [start, count, first, length] = ranges.subarray(i * 4, i * 4 + 4), end = start + count;
    if (count < 3 || length < 3 || length % 3 || end > g.positions.length / 3 || first + length > g.indices.length) throw Error("Production77 invalid saved blade range: " + b.id);
    if (hasProduction78(s.growth.profile) && b.outline === "fan") inspectSavedFan78(b, g.positions, start, count);
    if (hasProduction78(s.growth.profile) && b.outline === "arrow") inspectSavedArrow78(b, g.positions, start, count);
    let area = 0, projectedArea = 0, nearest = Infinity, minT = Infinity, maxT = -Infinity, minS = Infinity, maxS = -Infinity;
    const root = new Vector314(...b.attachment), axis = new Vector314(...b.direction), normal = new Vector314(...b.normal), side = axis.clone().cross(normal).normalize();
    for (let v = start; v < end; v++) {
      const p = new Vector314().fromArray(g.positions, v * 3), delta = p.clone().sub(root), anchor = new Vector314().fromArray(g.windAnchors, v * 3);
      if (anchor.distanceTo(root) > Math.max(2e-5, b.length * 1e-5)) throw Error("Production77 saved blade lost its actual organ wind anchor: " + b.id);
      nearest = Math.min(nearest, delta.length());
      const t = delta.dot(axis) / b.length + b.insertion, w = delta.dot(side) / b.width;
      minT = Math.min(minT, t);
      maxT = Math.max(maxT, t);
      minS = Math.min(minS, w);
      maxS = Math.max(maxS, w);
    }
    for (let k = first; k < first + length; k += 3) {
      const ids = [g.indices[k], g.indices[k + 1], g.indices[k + 2]];
      if (ids.some((v) => v < start || v >= end)) throw Error("Production77 saved blade uses another organ mesh: " + b.id);
      const a = new Vector314().fromArray(g.positions, ids[0] * 3), c = new Vector314().fromArray(g.positions, ids[1] * 3), d = new Vector314().fromArray(g.positions, ids[2] * 3), cross = c.sub(a).cross(d.sub(a));
      area += cross.length() * 0.5;
      projectedArea += Math.abs(cross.dot(normal)) * 0.5;
    }
    if (area <= b.length * b.width * 0.035) throw Error("Production77 saved lamina collapsed despite positive authored dimensions: " + b.id);
    if (hasProduction78(s.growth.profile)) assertLaminaMeasure78({ area, length: b.length, width: b.width, span: maxS - minS, projectedArea, divided: ["breadfruit-lobed", "platycerium-shield", "fern-pinnatifid", "monstera-adult", "rhaphidophora-adult", "fan", "arrow", "fishtail", "lobed"].includes(b.outline), unfolding: (b.roll ?? 0) > 0.5 }, b.id);
    if (b.outline === "peltate") {
      if (nearest > Math.max(2e-5, b.length * 1e-5) || minT > 0.025 || maxT < 0.975 || maxS - minS < ((b.roll ?? 0) > 0.5 ? 0.22 : 0.7)) throw Error("Production77 saved peltate blade lost its internal insertion or posterior lobes: " + b.id);
      const basal = [];
      for (let v = start; v < end; v++) {
        const q = new Vector314().fromArray(g.positions, v * 3).sub(root);
        if (q.dot(axis) / b.length + b.insertion < 0.05) basal.push(q.dot(side) / b.width);
      }
      if (!basal.some((x) => x < -0.07) || !basal.some((x) => x > 0.07)) throw Error("Production77 peltate metadata disguises an oval without two basal lobes: " + b.id);
    }
    triangles += length / 3;
  });
  if (triangles !== g.materialGroups.filter((m) => m.role === "foliage").reduce((n, m) => n + m.indexCount / 3, 0)) throw Error("Production77 blade provenance does not cover the full saved foliage");
}

// ../current-site-source/checkout/src/TropicalLibrary/FixedAsset76.ts
var packedSpecimen = (s) => ({ ...s, growth: packNativeGrowth76(s.growth) });
var content = (a) => ({ assetVersion: a.assetVersion, tropicalLibraryVersion: a.tropicalLibraryVersion, presetId: a.presetId, specimen: packedSpecimen(a.specimen) });
function inspectGeometry76(s) {
  inspectBladeGeometry77(s);
  const g = s.geometry, n = g.positions.length / 3, channelChunks = g.windChannelChunks77;
  if (channelChunks && (![77, 78].includes(s.growth.profile.productionSystemVersion) || g.windChannels !== void 0 || !Array.isArray(channelChunks) || !channelChunks.length || channelChunks.some((a, i) => !(a instanceof Float32Array) || !a.length || a.length % 4 || a.length > 16777216 || i < channelChunks.length - 1 && a.length !== channelChunks[0].length))) throw Error("Invalid complete native77 wind chunks");
  const channels = channelChunks ?? (g.windChannels ? [g.windChannels] : []), channelLength = channels.reduce((n2, a) => n2 + a.length, 0);
  if (!Number.isInteger(n) || n < 3 || !(g.positions instanceof Float32Array) || !(g.colors instanceof Float32Array) || !(g.indices instanceof Uint32Array) || g.colors.length !== n * 3 || g.normals?.length !== n * 3 || g.uvs?.length !== n * 2 || g.windAnchors?.length !== n * 3 || g.windLeafAxes?.length !== n * 3 || g.windLeafNormals?.length !== n * 3 || g.windWeights?.length !== n || channelLength !== n * 4 || g.indices.length % 3 || g.triangleCount !== g.indices.length / 3 || g.geometryCount !== s.growth.axes.length + s.growth.blades.length) throw Error("Incomplete full native geometry76");
  for (const array of [g.positions, g.normals, g.colors, g.uvs, g.windAnchors, g.windLeafAxes, g.windLeafNormals, g.windWeights, ...channels]) if (array.some((v) => !Number.isFinite(v))) throw Error("Nonfinite saved native geometry76");
  for (let i = 0; i < n; i++) {
    const length = Math.hypot(g.normals[i * 3], g.normals[i * 3 + 1], g.normals[i * 3 + 2]);
    if (Math.abs(length - 1) > 2e-3) throw Error("Native surface normal is not unit length");
    const axis = Math.hypot(g.windLeafAxes[i * 3], g.windLeafAxes[i * 3 + 1], g.windLeafAxes[i * 3 + 2]);
    if (axis > 0.1) {
      const normal = Math.hypot(g.windLeafNormals[i * 3], g.windLeafNormals[i * 3 + 1], g.windLeafNormals[i * 3 + 2]), dot = g.windLeafAxes[i * 3] * g.windLeafNormals[i * 3] + g.windLeafAxes[i * 3 + 1] * g.windLeafNormals[i * 3 + 1] + g.windLeafAxes[i * 3 + 2] * g.windLeafNormals[i * 3 + 2];
      if (Math.abs(axis - 1) > 2e-3 || Math.abs(normal - 1) > 2e-3 || Math.abs(dot) > 2e-3) throw Error("Native leaf wind frame is not orthonormal");
    }
    if (g.windWeights[i] < 0 || g.windWeights[i] > 1) throw Error("Native wind weight is outside its bound");
  }
  if (g.barkCoordinates69) {
    const frames = g.barkCoordinates69;
    if (frames.length % 4 || frames.length > n * 4 || frames.some((v) => !Number.isFinite(v))) throw Error("Invalid native bark growth chart");
    for (let i = 0; i < frames.length; i += 4) if (Math.abs(Math.hypot(frames[i], frames[i + 1]) - 1) > 2e-3 || frames[i + 3] <= 0) throw Error("Native bark chart loses cylindrical direction or radius");
  }
  if (g.indices.some((i) => i >= n)) throw Error("Native saved triangle index is out of bounds");
  let count = 0;
  for (const group of g.materialGroups ?? []) {
    if (group.firstIndex !== count || group.indexCount < 0 || group.indexCount % 3) throw Error("Native material groups are not contiguous");
    count += group.indexCount;
  }
  if (count !== g.indices.length) throw Error("Native material groups do not cover every saved triangle");
  for (let i = 0; i < g.indices.length; i += 3) {
    const [a, b, c] = [g.indices[i], g.indices[i + 1], g.indices[i + 2]], x1 = g.positions[b * 3] - g.positions[a * 3], y1 = g.positions[b * 3 + 1] - g.positions[a * 3 + 1], z1 = g.positions[b * 3 + 2] - g.positions[a * 3 + 2], x2 = g.positions[c * 3] - g.positions[a * 3], y2 = g.positions[c * 3 + 1] - g.positions[a * 3 + 1], z2 = g.positions[c * 3 + 2] - g.positions[a * 3 + 2];
    if (Math.hypot(y1 * z2 - z1 * y2, z1 * x2 - x1 * z2, x1 * y2 - y1 * x2) === 0) throw Error("Degenerate saved triangle");
  }
}
function inspectSurfaces76(s) {
  const surface = s.surfaces, hasWood = Boolean(s.geometry.barkCoordinates69);
  if (surface.surfaceVersion !== 76 || surface.species !== s.growth.profile.species || surface.review !== "unreviewed" || surface.bindings.map((b) => b.role).join(",") !== (hasWood ? "wood,support,foliage" : stemAxes76(s.growth).length ? "stem,support,foliage" : "support,foliage") + (s.growth.blades.some((b) => b.role === "bract") ? ",floral" : "")) throw Error("Mismatched native surface76 identity");
  const ids = /* @__PURE__ */ new Set();
  for (const r of surface.resources) {
    if (ids.has(r.id) || r.width < 1 || r.height < 1 || r.width > 1024 || r.height > 1024 || r.bytes.length !== r.width * r.height * 4 || !(r.bytes instanceof Uint8Array) || r.source.license !== "CC0-1.0" || !["procedural", "derived-cc0"].includes(r.source.kind) || !r.source.generator.startsWith("tropical-library-76/" + surface.species + "/")) throw Error("Invalid native resource76");
    if (r.source.kind === "derived-cc0" && (!r.source.uri?.startsWith("https://polyhaven.com/a/") || !r.source.asset || !r.source.botanicalReference?.startsWith("https://"))) throw Error("Native bark source provenance is incomplete");
    ids.add(r.id);
  }
  for (const b of surface.bindings) {
    for (const id of [b.albedo, b.normal, b.roughnessMap]) if (!ids.has(id)) throw Error("Missing native PBR resource");
    if (surface.resources.find((r) => r.id === b.albedo)?.colorSpace !== "srgb" || [b.normal, b.roughnessMap].some((id) => surface.resources.find((r) => r.id === id)?.colorSpace !== "linear")) throw Error("Native PBR colour spaces are incorrect");
  }
}
async function validateFixedAsset76(value) {
  const a = value;
  if (!a || a.assetVersion !== 8 || a.tropicalLibraryVersion !== 76 || !a.specimen || a.specimen.specimenVersion !== 76 || a.revision !== 1 || typeof a.name !== "string" || a.name.length > 500) throw Error("Unsupported native tropical fixed asset");
  assertProfile76(a.specimen.growth.profile);
  const entry = researchEntry76(a.specimen.growth.profile.species);
  if (a.presetId !== entry.presetId) throw Error("Native preset identity mismatch");
  const support = a.specimen.growth.profile.support76;
  if (support?.kind === "fixed-bark" && await hashNative76(supportSnapshot76(support)) !== support.host76.snapshotHash) throw Error("Final host wood or inherited motion has changed");
  inspectGeometry76(a.specimen);
  inspectSurfaces76(a.specimen);
  if (evaluateGrowth76(a.specimen.growth).status !== "passed" || a.specimen.acceptance.structure !== "passed" || a.specimen.acceptance.visual !== "pending-user-review" || a.specimen.acceptance.hardware !== "unmeasured") throw Error("Saved production evidence or acceptance state is invalid");
  if (await hashNative76(a.specimen.geometry) !== a.geometryHash || await hashNative76(content(a)) !== a.contentHash || a.assetId !== "plant76-" + a.contentHash.slice(0, 24)) throw Error("Native fixed asset hash mismatch");
  return a;
}
async function loadFixedAsset76(blob, options = {}) {
  const file = await decodeNativeArchive76(blob);
  if (file.kind !== "tropical-fixed-asset" || ![76, 77].includes(file.formatVersion) || !file.asset?.specimen || file.formatVersion === 77 && ![77, 78].includes(file.asset.specimen.growth.profile.productionSystemVersion)) throw Error("Not a tropical library76 fixed asset");
  return validateFixedAsset76({ ...file.asset, specimen: { ...file.asset.specimen, growth: unpackNativeGrowth76(file.asset.specimen.growth, options.compactOrgans76 ?? [77, 78].includes(file.asset.specimen.growth.profile.productionSystemVersion)) } });
}

// ../current-site-source/checkout/src/TropicalLibrary/FixedMesh76.ts
import { Color as Color3, DataTexture, DoubleSide, Group, LinearFilter, LinearMipmapLinearFilter, LinearSRGBColorSpace, Mesh as Mesh2, MeshStandardMaterial, RepeatWrapping, RGBAFormat, SRGBColorSpace } from "../vendor/three.module.min.js";

// ../current-site-source/checkout/src/TropicalLibrary/BarkMaterial76.ts
import { Color as Color2, Vector2 } from "../vendor/three.module.min.js";
function installBarkMaterial76(material, binding) {
  const p = binding.bark76;
  if (!p || !material.normalMap || binding.role !== "wood") throw Error("Incomplete saved native bark material");
  const old = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    old.call(material, shader, renderer);
    Object.assign(shader.uniforms, { barkPhase76: { value: new Vector2(...p.phase) }, barkMetres76: { value: binding.uvMetres }, barkNormal76: { value: p.normalStrength }, barkYoung76: { value: new Color2(p.youngColour) } });
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nattribute vec4 barkFrame69;varying vec4 vBarkFrame76;").replace("#include <uv_vertex>", "#include <uv_vertex>\nvBarkFrame76=barkFrame69;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>
varying vec4 vBarkFrame76;uniform vec2 barkPhase76;uniform float barkMetres76;uniform float barkNormal76;uniform vec3 barkYoung76;
vec2 barkUv76,barkDx76,barkDy76;vec4 barkPacked76;float barkMature76;
vec3 barkBasis76(vec3 N,vec3 nm){vec3 q0=dFdx(-vViewPosition),q1=dFdy(-vViewPosition),p1=cross(q1,N),p0=cross(N,q0),T=p1*barkDx76.x+p0*barkDy76.x,B=p1*barkDx76.y+p0*barkDy76.y;float d=max(dot(T,T),dot(B,B));return normalize(T*inversesqrt(max(d,1e-12))*nm.x+B*inversesqrt(max(d,1e-12))*nm.y+N*nm.z);}
`).replace("#include <map_fragment>", `
vec2 f76=vBarkFrame76.xy;float q76=max(dot(f76,f76),1e-8),k76=1.0/6.28318530718;
barkUv76=vec2(atan(f76.y,f76.x)*k76,vBarkFrame76.z/barkMetres76)+barkPhase76;
vec2 df76=dFdx(f76),dg76=dFdy(f76);
barkDx76=vec2((f76.x*df76.y-f76.y*df76.x)*k76/q76,dFdx(vBarkFrame76.z)/barkMetres76);
barkDy76=vec2((f76.x*dg76.y-f76.y*dg76.x)*k76/q76,dFdy(vBarkFrame76.z)/barkMetres76);
vec3 bc76=textureGrad(map,barkUv76,barkDx76,barkDy76).rgb;
barkPacked76=textureGrad(normalMap,barkUv76,barkDx76,barkDy76);
barkMature76=smoothstep(.025,.195,vBarkFrame76.w);
diffuseColor.rgb*=mix(barkYoung76,bc76,barkMature76*.88+.12);
`).replace("#include <roughnessmap_fragment>", "float roughnessFactor=roughness*mix(.84,clamp(barkPacked76.b,.45,.98),barkMature76);").replace("#include <normal_fragment_maps>", "vec2 n76=(barkPacked76.rg*2.0-1.0)*barkNormal76*(.1+.9*barkMature76);normal=barkBasis76(normal,vec3(n76,sqrt(max(.01,1.0-dot(n76,n76)))));");
  };
  material.customProgramCacheKey = () => `native-bark76/${p.evidence}`;
}

// ../current-site-source/checkout/src/TropicalLibrary/Wind76.ts
import { Vector3 as Vector315 } from "../vendor/three.module.min.js";
var WIND_MAX76 = 1;
function windDisplacement76(point, height, time, strength) {
  const y = Math.max(0, point.y), q = y / Math.max(0.1, height), gain = Math.min(0.42, height * 0.012) * Math.min(WIND_MAX76, Math.max(0, strength)) * q * q;
  return new Vector315(Math.sin(time * 0.75 + y * 0.05) * gain, 0, Math.sin(time * 0.58 + y * 0.045 + 0.8) * gain * 0.65);
}
function installWind76(material, wind) {
  const old = material.onBeforeCompile, key = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    old.call(material, shader, renderer);
    Object.assign(shader.uniforms, { nativeTime76: wind.time, nativeStrength76: wind.strength, nativeHeight76: wind.height });
    shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>
attribute vec3 nativeAnchor76;attribute vec3 nativeLeafAxis76;attribute vec3 nativeLeafNormal76;attribute float nativeWeight76;
uniform float nativeTime76;uniform float nativeStrength76;uniform float nativeHeight76;
vec3 nativeTurn76(vec3 p,vec3 a,float t){return p*cos(t)+cross(a,p)*sin(t)+a*dot(a,p)*(1.0-cos(t));}
vec3 nativeDisplacement76(vec3 p){float y=max(0.0,p.y),q=y/max(.1,nativeHeight76),gain=min(.42,nativeHeight76*.012)*clamp(nativeStrength76,0.0,1.0)*q*q;return vec3(sin(nativeTime76*.75+y*.05)*gain,0.0,sin(nativeTime76*.58+y*.045+.8)*gain*.65);}
vec3 nativeDerivative76(vec3 p){float y=max(0.0,p.y),h=max(.1,nativeHeight76),c=min(.42,nativeHeight76*.012)*clamp(nativeStrength76,0.0,1.0)/(h*h);return vec3(c*(2.0*y*sin(nativeTime76*.75+y*.05)+y*y*.05*cos(nativeTime76*.75+y*.05)),0.0,c*.65*(2.0*y*sin(nativeTime76*.58+y*.045+.8)+y*y*.045*cos(nativeTime76*.58+y*.045+.8)));}
float nativeFlutter76(){return sin(nativeTime76*1.8+nativeAnchor76.x*.21+nativeAnchor76.y*.31)*clamp(nativeStrength76,0.0,1.0)*.06;}
`).replace("#include <beginnormal_vertex>", `#include <beginnormal_vertex>
vec3 nativeMoved76=position;
if(dot(nativeLeafAxis76,nativeLeafAxis76)>.1){vec3 hinge=normalize(cross(nativeLeafAxis76,nativeLeafNormal76));float angle=nativeFlutter76();objectNormal=nativeTurn76(objectNormal,hinge,angle);nativeMoved76=nativeAnchor76+nativeTurn76(position-nativeAnchor76,hinge,angle);}
vec3 nativeSlope76=nativeDerivative76(nativeMoved76);objectNormal=normalize(vec3(objectNormal.x,objectNormal.y-nativeSlope76.x*objectNormal.x-nativeSlope76.z*objectNormal.z,objectNormal.z));
`).replace("#include <begin_vertex>", `#include <begin_vertex>
if(dot(nativeLeafAxis76,nativeLeafAxis76)>.1){vec3 hinge=normalize(cross(nativeLeafAxis76,nativeLeafNormal76));transformed=nativeAnchor76+nativeTurn76(transformed-nativeAnchor76,hinge,nativeFlutter76());}
transformed+=nativeDisplacement76(transformed);
`);
  };
  material.customProgramCacheKey = () => key + "/native-wind76";
}

// ../current-site-source/checkout/src/TropicalLibrary/FixedGeometryBatches77.ts
import { BufferAttribute, BufferGeometry, Mesh } from "../vendor/three.module.min.js";
var attributes = [["position", "positions", 3], ["normal", "normals", 3], ["color", "colors", 3], ["uv", "uvs", 2], ["nativeAnchor76", "windAnchors", 3], ["nativeLeafAxis76", "windLeafAxes", 3], ["nativeLeafNormal76", "windLeafNormals", 3], ["nativeWeight76", "windWeights", 1], ["barkFrame69", "barkCoordinates69", 4]];
function fixedGeometryBatches77(g, maxVertices77 = 2e6) {
  if (!Number.isInteger(maxVertices77) || maxVertices77 < 3) throw Error("Invalid complete geometry batch size");
  const vertices = g.positions.length / 3, groups = g.materialGroups;
  const single = () => {
    const geometry = new BufferGeometry();
    for (const [name, key, size] of attributes) {
      const data = g[key];
      if (data) geometry.setAttribute(name, new BufferAttribute(data, size));
    }
    geometry.setIndex(new BufferAttribute(g.indices, 1));
    for (const r of groups) geometry.addGroup(r.firstIndex, r.indexCount, r.materialIndex);
    return [geometry];
  };
  if (!/\/production-system-(77|78)$/.test(g.backendId) || vertices <= maxVertices77) return single();
  const blocks = Math.ceil(vertices / maxVertices77), slots = groups.length, counts = new Float64Array((blocks + 1) * slots), bucket = (a, b, c) => {
    const q = Math.floor(a / maxVertices77);
    return q === Math.floor(b / maxVertices77) && q === Math.floor(c / maxVertices77) ? q : blocks;
  };
  for (let slot = 0; slot < slots; slot++) {
    const r = groups[slot];
    for (let i = r.firstIndex; i < r.firstIndex + r.indexCount; i += 3) counts[bucket(g.indices[i], g.indices[i + 1], g.indices[i + 2]) * slots + slot] += 3;
  }
  const buffers = [], offsets = new Float64Array(counts.length), cursors = new Float64Array(counts.length), geometries = [], crosses = [];
  let sourceIds = [], sourceMap = /* @__PURE__ */ new Map(), crossIndices = [], crossGroups = [];
  for (let block = 0; block < blocks; block++) {
    let n = 0;
    for (let slot = 0; slot < slots; slot++) {
      offsets[block * slots + slot] = n;
      cursors[block * slots + slot] = n;
      n += counts[block * slots + slot];
    }
    if (!n) continue;
    buffers[block] = new Uint32Array(n);
    const geometry = new BufferGeometry();
    geometry.userData.completeBatch77 = true;
    geometry.userData.savedVertexOffset77 = block * maxVertices77;
    for (let slot = 0; slot < slots; slot++) if (counts[block * slots + slot]) geometry.addGroup(offsets[block * slots + slot], counts[block * slots + slot], groups[slot].materialIndex);
    geometries[block] = geometry;
  }
  const flushCross = () => {
    if (!crossIndices.length) return;
    const geometry = new BufferGeometry();
    geometry.userData.completeBatch77 = true;
    geometry.userData.savedVertexIds77 = new Uint32Array(sourceIds);
    for (const [name, key, size] of attributes) {
      const data = g[key];
      if (!data) continue;
      const packed = new Float32Array(sourceIds.length * size);
      for (let j = 0; j < sourceIds.length; j++) for (let k = 0; k < size; k++) packed[j * size + k] = data[sourceIds[j] * size + k] ?? 0;
      geometry.setAttribute(name, new BufferAttribute(packed, size));
    }
    geometry.setIndex(new BufferAttribute(new Uint32Array(crossIndices), 1));
    geometry.groups = crossGroups;
    crosses.push(geometry);
    sourceIds = [];
    sourceMap = /* @__PURE__ */ new Map();
    crossIndices = [];
    crossGroups = [];
  };
  const local = (source) => {
    let id = sourceMap.get(source);
    if (id === void 0) {
      id = sourceIds.length;
      sourceMap.set(source, id);
      sourceIds.push(source);
    }
    return id;
  };
  for (let slot = 0; slot < slots; slot++) {
    const r = groups[slot];
    for (let i = r.firstIndex; i < r.firstIndex + r.indexCount; i += 3) {
      const a = g.indices[i], b = g.indices[i + 1], c = g.indices[i + 2], block = bucket(a, b, c), index2 = block * slots + slot, at = cursors[index2];
      if (block === blocks) {
        const extra = Number(!sourceMap.has(a)) + Number(!sourceMap.has(b)) + Number(!sourceMap.has(c));
        if (sourceIds.length + extra > maxVertices77 || crossIndices.length + 3 > maxVertices77 * 6) flushCross();
        const last = crossGroups.at(-1);
        if (last?.materialIndex === r.materialIndex) last.count += 3;
        else crossGroups.push({ start: crossIndices.length, count: 3, materialIndex: r.materialIndex });
        crossIndices.push(local(a), local(b), local(c));
      } else {
        const first = block * maxVertices77, out = buffers[block];
        out[at] = a - first;
        out[at + 1] = b - first;
        out[at + 2] = c - first;
        cursors[index2] += 3;
      }
    }
  }
  flushCross();
  for (let block = 0; block < blocks; block++) {
    const geometry = geometries[block];
    if (!geometry) continue;
    const start = block * maxVertices77, end = Math.min(vertices, start + maxVertices77);
    for (const [name, key, size] of attributes) {
      const data = g[key];
      if (data && start * size < data.length) geometry.setAttribute(name, new BufferAttribute(data.subarray(start * size, Math.min(data.length, end * size)), size));
    }
    geometry.setIndex(new BufferAttribute(buffers[block], 1));
  }
  const result = [...geometries.filter((g2) => Boolean(g2)), ...crosses];
  if (result.reduce((n, g2) => n + g2.index.count, 0) !== g.indices.length) throw Error("Complete batch submission lost a saved triangle");
  return result;
}
function releaseCompletedBatch77(mesh) {
  return mesh;
}
function renderCompleteFixedScene77(renderer, scene, camera) {
  const windows = [], ordinary = [];
  scene.traverseVisible((o) => {
    if (o instanceof Mesh && o.geometry.userData.completeBatch77) windows.push(o);
    else if (o.isMesh || o.isLine || o.isPoints) ordinary.push(o);
  });
  if (!windows.length) {
    renderer.render(scene, camera);
    return;
  }
  const autoClear = renderer.autoClear;
  try {
    for (const mesh of windows) mesh.visible = false;
    renderer.render(scene, camera);
    for (const object of ordinary) object.visible = false;
    renderer.autoClear = false;
    for (const mesh of windows) {
      mesh.visible = true;
      try {
        renderer.render(scene, camera);
        renderer.getContext().finish();
      } finally {
        mesh.visible = false;
        mesh.geometry.dispose();
      }
    }
  } finally {
    renderer.autoClear = autoClear;
    for (const object of ordinary) object.visible = true;
    for (const mesh of windows) mesh.visible = true;
  }
}

// ../current-site-source/checkout/src/TropicalLibrary/FixedMesh76.ts
function createFixedMesh76(asset) {
  const group = new Group(), wind = { time: { value: 0 }, strength: { value: 0 }, height: { value: Math.max(0.1, asset.specimen.growth.axes.reduce((h, a) => Math.max(h, ...a.path.map((p) => p.position[1])), 0)) } }, geometries = [], materials = [], textures = [];
  const add = (g, s) => {
    const batches = fixedGeometryBatches77(g);
    geometries.push(...batches);
    const texture = (id) => {
      const r = s.resources.find((r2) => r2.id === id);
      if (!r) throw Error("Missing saved native material pixels");
      const t = new DataTexture(r.bytes, r.width, r.height, RGBAFormat);
      t.colorSpace = r.colorSpace === "srgb" ? SRGBColorSpace : LinearSRGBColorSpace;
      t.wrapS = t.wrapT = RepeatWrapping;
      t.generateMipmaps = true;
      t.minFilter = LinearMipmapLinearFilter;
      t.magFilter = LinearFilter;
      t.needsUpdate = true;
      textures.push(t);
      return t;
    };
    const own = s.bindings.map((b) => {
      const m = new MeshStandardMaterial({ map: texture(b.albedo), normalMap: texture(b.normal), roughnessMap: texture(b.roughnessMap), roughness: b.roughness, color: new Color3(b.color), vertexColors: true, side: DoubleSide });
      if (b.bark76) installBarkMaterial76(m, b);
      if (b.role === "foliage") {
        const r = s.resources.find((r2) => r2.id === b.albedo), k = (Math.floor(r.height / 16) * r.width + Math.floor(r.width / 8)) * 4, front = new Color3().setRGB(r.bytes[k] / 255, r.bytes[k + 1] / 255, r.bytes[k + 2] / 255, SRGBColorSpace), back = new Color3(b.backColor), ratio = new Color3().setRGB(back.r / Math.max(1e-3, front.r), back.g / Math.max(1e-3, front.g), back.b / Math.max(1e-3, front.b));
        m.onBeforeCompile = (shader) => {
          shader.uniforms.nativeBack76 = { value: ratio };
          shader.fragmentShader = "uniform vec3 nativeBack76;\n" + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\nif(!gl_FrontFacing)diffuseColor.rgb*=nativeBack76;");
        };
        m.customProgramCacheKey = () => `native76-leaf/${b.backColor}`;
      }
      installWind76(m, wind);
      materials.push(m);
      return m;
    });
    for (const geometry of batches) group.add(releaseCompletedBatch77(new Mesh2(geometry, own)));
  };
  add(asset.specimen.geometry, asset.specimen.surfaces);
  const host = asset.specimen.growth.profile.support76?.host76;
  if (host) {
    add(host.geometry, host.surfaces);
    wind.height.value = Math.max(0.1, host.guide.at(-1).position[1]);
  }
  return { group, wind, dispose() {
    for (const x of geometries) x.dispose();
    for (const x of materials) x.dispose();
    for (const x of textures) x.dispose();
    group.clear();
  } };
}
export {
  createFixedMesh76,
  installWind76,
  loadFixedAsset76,
  renderCompleteFixedScene77,
  windDisplacement76
};
