// Read-only comparison of semantic labels with the frozen growth domain.
import fs from 'node:fs';import zlib from 'node:zlib';import crypto from 'node:crypto';
import {buildNativeSurface,growth} from '../kernel/NativeSurface.mjs';
import {ZONES,zoneAt} from '../src/HairStyleProfile.mjs';
const base=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,base)),load=p=>JSON.parse(zlib.gunzipSync(read(p))),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const surface=buildNativeSurface(load('inputs/native-input.json.gz')),lab=load('assets/structure.json.gz');
const zones=ZONES.map(([id,label],index)=>{const roots=surface.roots.filter(r=>zoneAt(r.chartP,growth(r.chartP))===index);return{id,label,candidates:roots.length,eligible:roots.filter(r=>r.active).length,styleActive:roots.filter(r=>lab.activeMask[r.id]).length,guides:lab.guides.filter(g=>g.zone===index).length};});
const report={reviewedUTC:new Date().toISOString(),runtimeSHA256:JSON.parse(read('BUILD_MANIFEST.json')).htmlSHA256,structureSHA256:sha(read('assets/structure.json.gz')),sourceLock:lab.sourceDomain.sourceLock,growthDomainModified:false,zones,findings:['left-temple/right-temple denote the authored sideburn/preauricular strip, not the whole temporal area.','Frontotemporal recess, temporal peak and infratemple do not yet have separate semantic IDs.','Candidate/eligible/style counts are sparse computational samples, not measured follicles or hairs per square centimetre.','The approved boundary remains read-only; new literature is used for comparison, not an unreviewed replacement contour.']};
fs.writeFileSync(new URL('evidence/temple-region-review.json',base),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
