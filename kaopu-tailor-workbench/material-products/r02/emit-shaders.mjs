import fs from 'node:fs';import path from 'node:path';import {testAPI} from './solid-textiles.mjs';
const dir=path.dirname(new URL(import.meta.url).pathname)+'/qa-shaders';fs.mkdirSync(dir,{recursive:true});
const prefix=`#version 300 es
precision highp float;precision highp int;precision highp sampler2D;
#define attribute in
#define varying out
attribute vec3 position;attribute vec3 normal;attribute vec2 uv;
`;
for(const [name,source]of [['yarn',testAPI.yarnShader],['leather',testAPI.leatherShader]])fs.writeFileSync(dir+'/'+name+'.vert',prefix+source+'\nvoid main(){vec3 p,n;solidVertex(p,n);gl_Position=vec4(p+n*.0,1.);}\n');
fs.writeFileSync(dir+'/material.frag',`#version 300 es
precision highp float;in vec3 vSolidColour;in vec3 vSolidCoord;out vec4 outputColor;void main(){outputColor=vec4(vSolidColour+vSolidCoord*.0,1.);}\n`);
