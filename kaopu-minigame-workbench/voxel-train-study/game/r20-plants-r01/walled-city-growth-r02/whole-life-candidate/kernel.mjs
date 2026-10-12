import fs from 'node:fs';import {wholeLifeScalarSource} from './kernel-transform.mjs';
export const SCALAR_SOURCE=wholeLifeScalarSource(fs.readFileSync(new URL('../spatial-candidate/kernel.mjs',import.meta.url),'utf8'));
const k=await import('data:text/javascript;base64,'+Buffer.from(SCALAR_SOURCE).toString('base64'));
export const {querySettlement,cpuKernel,geometryWGSL,geoObjectTransform}=k;
