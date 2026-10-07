import fs from 'node:fs';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {AnnyModel} from './source/kaopu-anny-workbench/r02/src/AnnyModel.js';
import {GNMHeadModel,parseContainer} from './source/kaopu-unified-human-workbench/src/GNMModel.js';
import {MHREngine,unpackModel} from './source/kaopu-mhr-workbench/engine.mjs';
export const source=new URL('./source/',import.meta.url);
export function json(rel){return JSON.parse(fs.readFileSync(new URL(rel,source)));}
export function bytes(rel){const b=fs.readFileSync(new URL(rel,source));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}
export function gunzip(rel){const b=zlib.gunzipSync(fs.readFileSync(new URL(rel,source)));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}
export function loadAnny(){const meta=json('kaopu-anny-workbench/assets/anny-model.json'),facial=json('kaopu-anny-workbench/r02/assets/facial-actions.json');return new AnnyModel(meta,bytes('anny-model.raw.bin'),facial,gunzip('kaopu-anny-workbench/r02/assets/facial-actions.bin.gz'));}
export function loadGNM(){const g=parseContainer(bytes('kaopu-face-workbench/assets/gnm_head_web.bin'));return new GNMHeadModel(g.meta,g.sections);}
export function loadMHR(){const meta=json('kaopu-mhr-workbench/assets/model.json');return new MHREngine(meta,unpackModel(meta,bytes('mhr-model.raw.bin')));}
