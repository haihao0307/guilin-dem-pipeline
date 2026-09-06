# Yohei Nishitsuji 源码定位：castle to castle r6

核对日期：2026-09-06。所属体系：现有 DISTILLATION_CORE 与 TERRAIN_CORE 的来源证据，不创建新的生产线。

## 已取得的准确对象

用户链接：https://fragcoord.xyz/s/cltuv8os
公开记录标题：castle to castle -r6-
创建时间：2026-09-05T03:30:32.073521+00:00。
源码记录更新时间：2026-09-05T03:30:32.456181+00:00。
实际读取时间：2026-09-06T02:40:58.216447+00:00。
公开记录 visibility=public，tags 含 mit；Common 和 Main 源码均明确标注作者及 SPDX-License-Identifier: MIT。

普通网页与本地网络未能取得正文后，使用一次性GitHub Actions作公开GET读取，成功返回这一个精确slug的记录。使用的是网站匿名公开读取接口，没有登录用户帐号、提升权限或枚举其他作品。定位接口用到的第三方适配器只作文本读取，没有执行其中的Python。原着色器也没有执行。

执行证据：guilin-dem-pipeline Actions run 34007100513，job 101416232097，读取步骤 success。工作流仅 contents:read，不读取或修改生产资产，无schedule。该一次性读取不构成常驻监控或后台自主学习。

两段源码分别为Common 175字符、Main 1658字符，共1833字符，包含注释、辅助函数及声明；不能把这份展开版本写成267字符的完整应用。Common SHA256=cae77366408af08111543b61d6bb58208233a8d8921945c6f66f047b8921e25c；Main SHA256=f1a335ffde8fda9d5b16e9e285b949cdae2eb297dbe909d8d8c13e7b5daae61a。下方转录内容已在本地逐段计算SHA256，与读取结果一致。

作者官网明确列有the simualted reality -ocean-、macroscopic microscope等其他作品。本次cltuv8os只确认为上述castle作品，不把它冒称海洋或云的同一份源码。用户提供的X原帖2096005720827461975直接读取失败，本次未独立核验其正文与此版本是否逐字一致。

## 收敛到我们核心的内容

此Main通过100次外层视线取样、每次7轮空间变换构造画面。每轮先绕轴旋转，再计算abs(2*p)-2，以镜像、放大及偏移反复组织空间。折叠后的坐标进入一个环状截面表达，所得标量控制步进与亮度累加。7轮与100次是按代码预期初始化语义读取的次数；700次内层变换/像素只是名义计数，不是性能或帧率测试。

代码没有调用Perlin、Simplex或FFT，也没有纹理采样函数。它为我们的函数体系补充的是“坐标变换与重复构造”这一类生成操作，不能据此推定它实现了海岸、浮力、碰撞或真实地形拟合。hsv函数在当前Main中没有被调用，迁移时可考虑移除不使用的部分。

建议从同一个核心拆出三个职责：世界位置到局部结构坐标；局部坐标到形状/密度等明确语义；相机取样与颜色/深度输出。空间场不以相机位置或当前像素数作为对象身份。这个例子在时间变化时连折叠轴都改变，若借作静态地形原语，应把形态时间固定为配方参数；海洋动态仍按现有波浪、输运和状态关系实现。

优先吸收可读、可参数化和可测试的规则，不追求继续压短字符。正式迁移需核对矩阵左乘/右乘约定、输入单位、有限值、显式循环初始化、场函数语义和实际场景深度。源码称distance estimate，但当前未证明它是真实有符号距离，也没有给出通用安全步长保证；不能直接作为地形碰撞距离。

初始化属于环境合同：GLSL ES规范允许未初始化变量值未定义，WebGL 1.0最新规范另行保证这些变量置零。不能只见局部变量未显式赋值就断言网页必坏。本次未运行FragCoord编译器；移植到自己的运行时采用明确初始化，便于跨环境复核。依据：
https://registry.khronos.org/webgl/specs/latest/1.0/index.html
https://registry.khronos.org/OpenGL/specs/es/3.2/GLSL_ES_Specification_3.20.html

## 其他已确认的作者原始入口

作者官网：https://yoheinishitsuji.com/
其海洋作品指向：https://x.com/YoheiNishitsuji/status/1965760241754312833
其macroscopic microscope指向：https://x.com/YoheiNishitsuji/status/1880561598982668452
其云作品指向：https://x.com/YoheiNishitsuji/status/1880399305196073072

作者本人在Codrops的2025-02-18文章中提供了Emptiness, your infinity的短码、展开注释版，以及macroscopic microscope短码。正文已读，未运行文章示例；网页排版中的短横/自减符号需要回到原始源码核对，不直接执行排版后的代码。
https://tympanus.net/codrops/2025/02/18/rendering-the-simulation-theory-exploring-fractals-glsl-and-the-nature-of-reality/

## Common原文

```glsl
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 @YoheiNishitsuji
//[LICENSE] https://opensource.org/licenses/MIT

uniform float u_time; //Seconds since playback started
```

## Main原文

```glsl
uniform vec2 u_resolution; //Pass resolution in pixels

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 @YoheiNishitsuji
//[LICENSE] https://opensource.org/licenses/MIT

vec3 hsv(float h,float s,float v){
  vec4 t=vec4(1.,2./3.,1./3.,3.);
  vec3 p=abs(fract(vec3(h)+t.xyz)*6.-vec3(t.w));
  return v*mix(vec3(t.x),clamp(p-vec3(t.x),0.,1.),s);
}

// 2D rotation matrix
mat2 rotate2D(float a){ return mat2(cos(a),-sin(a),sin(a),cos(a)); }

// 3D rotation around an arbitrary axis
mat3 rotate3D(float angle, vec3 axis){
  vec3 a=normalize(axis);
  float s=sin(angle), c=cos(angle), k=1.-c;
  return mat3(
    a.x*a.x*k+c,     a.y*a.x*k+a.z*s, a.z*a.x*k-a.y*s,
    a.x*a.y*k-a.z*s, a.y*a.y*k+c,     a.z*a.y*k+a.x*s,
    a.x*a.z*k+a.y*s, a.y*a.z*k-a.x*s, a.z*a.z*k+c
  );
}

void main(){
  vec2 r=u_resolution;
  vec2 FC=gl_FragCoord.xy;
  float t=u_time;
  vec4 o=vec4(0,0,0,1);

  // ---- Volumetric raymarch ----
  for(float i,e,g; i++<1e2; ){

    // Ray sample point
    vec3 p=vec3((FC.xy-r*.5)/r.y*g, g-4.3);

    // Slow tumble of the whole volume around the x axis over time.
    p.zy*=rotate2D(t*.2);

    // ---- Folding IFS ---- 
    // Each pass rotates by 90 deg about an axis whose y-tilt breathes with time
    // (smoothstep(sin(t))), then mirror-folds space (abs(p+p)-2) -> self-similar shape.
    for(int j; j++<7; )
      p*=rotate3D(1.57, vec3(1, 1.5*smoothstep(-1.,1.,sin(t*.4))-.5, 0)),
      p=abs(p+p)-2.;

    // Distance estimate to a torus-like surface built from the folded coords,
    // normalized for the march step.
    g+=e=(length(vec2(length(p.xz)-2., (p.y-p.x)*.7))-.6)/8e2;

    o+=exp(-e*2e3)/4e1;
  }

  fragColor=o;
}
```

## 随源码保留的MIT许可

Copyright (c) 2026 @YoheiNishitsuji

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## 本轮状态

exact_source_retrieved=true；local_transcription_sha256_match=true；public_read_job=success；original_shader_execution=not_run；browser_and_gpu_tests=not_run；world_query_extraction=design_only；production_integration=false。只保存这一件用户指定作品的短源码及必要分析。未修改任何生产线或DEM，没有认定其他Mother已读，也没有把源码读取当作视觉验收。
