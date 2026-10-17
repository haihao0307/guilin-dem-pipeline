// Reverses the documented, lossless PPF frame transport. Never interpolates.
export function decodeFrames(bytes, vertexCount, frameCount) {
  const frameWords = vertexCount * 3, wordCount = frameWords * frameCount;
  if (bytes.length !== wordCount * 4) throw Error('PPF frame block has the wrong size');
  const words = new Uint32Array(wordCount);
  for (let i = 0; i < wordCount; i++) {
    const value = (bytes[i] | bytes[wordCount+i]<<8 | bytes[wordCount*2+i]<<16 | bytes[wordCount*3+i]<<24) >>> 0;
    words[i] = i < frameWords ? value : value ^ words[i-frameWords];
  }
  return new Float32Array(words.buffer);
}

export async function gunzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function digest(bytes) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n=>n.toString(16).padStart(2,'0')).join('');
}

export class FrameStore {
  constructor(base, manifest, {signal, onTransfer=()=>{}}={}) {
    this.base = new URL(base, location.href); this.manifest = manifest;
    this.signal = signal; this.onTransfer = onTransfer; this.cache = new Map();
    this.pending = new Map(); this.disposed = false; this.bytes = 0;
  }
  async read(entry) {
    const response = await fetch(new URL(entry.file, this.base), {signal:this.signal});
    if (!response.ok) throw Error(`PPF data HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (this.disposed) throw new DOMException('Scene closed','AbortError');
    if (bytes.length !== entry.bytes || await digest(bytes) !== entry.sha256) throw Error('PPF transfer checksum mismatch');
    this.bytes += bytes.length; this.onTransfer(this.bytes);
    const raw = await gunzip(bytes);
    if (this.disposed) throw new DOMException('Scene closed','AbortError');
    if (raw.length !== entry.decodedBytes || await digest(raw) !== entry.decodedSha256) throw Error('PPF decoded checksum mismatch');
    return raw;
  }
  async frame(index) {
    if (this.disposed) throw new DOMException('Scene closed','AbortError');
    if (!Number.isInteger(index) || index < 0 || index >= this.manifest.frames) throw Error('Frame outside original recording');
    const chunk = this.manifest.chunks.find(c=>index >= c.firstFrame && index < c.firstFrame+c.frameCount);
    let decoded = this.cache.get(chunk.firstFrame);
    if (decoded) { this.cache.delete(chunk.firstFrame); this.cache.set(chunk.firstFrame, decoded); }
    else {
      if (!this.pending.has(chunk.firstFrame)) this.pending.set(chunk.firstFrame, (async()=>{
        const raw = await this.read(chunk);
        if (this.disposed) throw new DOMException('Scene closed','AbortError');
        const result = decodeFrames(raw, this.manifest.vertexCount, chunk.frameCount);
        if (await digest(result.buffer) !== chunk.sourceSha256) throw Error('PPF source-frame checksum mismatch');
        if (this.disposed) throw new DOMException('Scene closed','AbortError');
        this.cache.set(chunk.firstFrame, result);
        while (this.cache.size > 3) this.cache.delete(this.cache.keys().next().value);
        return result;
      })());
      try { decoded = await this.pending.get(chunk.firstFrame); }
      finally { this.pending.delete(chunk.firstFrame); }
    }
    const offset = (index-chunk.firstFrame)*this.manifest.vertexCount*3;
    return decoded.subarray(offset, offset+this.manifest.vertexCount*3);
  }
  dispose() { this.disposed = true; this.cache.clear(); this.pending.clear(); this.manifest=null; }
}
