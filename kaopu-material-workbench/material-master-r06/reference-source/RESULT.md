# R06 Adobe 原实现数值契约与响应表

## 结论

- 10 个非零代表材质、每个 3 个视向 × 4096 次确定性采样，共 **122,880 次尝试**：121,407 个有效样本、1,473 个合法零 PDF；**1,337,640 条检查，0 失败**。
- 这些 case 实际调用了 `openpbr_prepare / openpbr_sample / openpbr_eval / openpbr_pdf`，覆盖默认介质、rough diffuse、钢、F82 tint + 各向异性金属、coat 钢、coat 介质、fuzz、表面染色实体透射、有体积参数的实体透射、薄壁透射。体积属性只准备和检查有限性，没有积分体积路径。
- **全套结果不是全部通过**：加上两个黑色边界用例，总 147,456 次尝试，139,844 个有效样本、7,612 个零 PDF；默认零 coat roughness 的全黑边界有 2,016 条 PDF 一致性失败。最终程序真实退出码为 1。所有这些失败的响应仍严格为 0，有限值、权重响应一致性均通过。不得只截取通过部分而隐去这个边界。
- 实测生成了 **1,980 条共同粗糙度**参考响应与 **660 条 R05 原双粗糙度**扩展响应；2640 条全部有限非负。两个覆盖率端点的混合顺序误差为 0。

## 对 R05/R06 适配的实际意义

R05 paint=(.085,.12,.105)，steel=(.30,.32,.31) 是自有线性调色输入，没有实测反射率标定。这里将 paint 与 steel 当作未解析、并排覆盖的两种相，而非透明 coat。

原先先混颜色 C=(1−b)Cp+bCs，再 metalness=b，会在 Three 的 diffuse=(1−b)C 与 F0=(1−b).04+bC 中产生交叉项。分开混合 coverageDiffuse 与 coverageF0 可以去掉这类颜色交叉项；但它仍保留 Three 的 BRDF、单一 roughness 和环境照明近似，不能等价于完整 Adobe 分层实现。

一个真实 Adobe 例子：共同 roughness=.4、view=30°、light=−30°、steel coverage=.5。

- 逐相 BSDF 后混合 RGB：[0.622323871, 0.662872195, 0.642938018]
- 先混参数再求 BSDF RGB：[0.444661856, 0.497590721, 0.473531604]
- RGB L2 相对差：26.5756%。单位为 BSDF×light cosine 的 sr⁻¹，没有 tone mapping。
- 同条件 Three CPU 方程转写的逐相响应：[0.621815443, 0.662350714, 0.642427623]；先混参数响应：[0.444684923, 0.497578114, 0.473535717]。

这些数据明确分离“混合顺序差异”和“Adobe/Three 方程差异”。它们不是 R05/R06 最终渲染像素误差，也不证明所有材质都应按面积混合。固定 50% coverage 的整个共同 roughness 网格中，混合顺序相对差中位数为约 22.27%，最大约 97.54%；最大值在较暗的非高光方向，不能冒充感知差异。

## 数据交付

`openpbr-reference.json`：主网页集成文件。

- `source`：完整 Adobe/GLM SHA、API、方向/单位、生成器、原始输出哈希、R05/Three 版本。
- `materialInputs`：两个端点及共用输入；所有其他字段来自官方默认初始化。
- `samples`：共同 roughness={.2,.4,.7} × view={0,30,60,80}° × light={−80…80，步长5}° × coverage={0,.25,.5,.75,1}，1980 条。
- `phaseMixed` = (1−b)×Adobe(paint) + b×Adobe(steel)；`parameterMixed` = Adobe(mix(colors), metalness=b)。两个数组来自真实 C++ 原实现调用。
- `relativeError` = norm(parameterMixed−phaseMixed)/max(norm(phaseMixed),1e−12)，RGB 欧氏范数，无量纲。
- `threePhaseMixed / threeParameterMixed`：实际 R05 vendored shader 的 CPU 方程转写，**不是 GPU 实测**。
- `extendedSamples`：R05 原 paint roughness=.43、steel=.34 的660条，独立 scenario；不得与共同 roughness 混同解释。
- 视线、光线离开表面，normal +Z，角度在 XZ 平面。输入方向单位化；RGB 线性；返回量已含 light cosine，网页不可再乘一次 cosine。
- 正式参数名 roughness 在 JSON 舍入为 .2/.4/.7 便于 UI；底层运算使用 C++ float，原始浮点值保存在 `coverage-reference.raw.json`。

## 契约方法与容差

源码是固定头文件，只用已存在的 g++，无系统安装、无第三方构建脚本、无渲染器或 HIP。

每 case 用视线0°、45°、80°；LCG seed=12345，逐句抽取3个随机数到 [0,1)，每视线4096次。固定查询另含上下半球方向和±90°的 float 三角函数近似；没有声称精确零余弦边界覆盖。

检查：公开 prepared 的 emission/volume 有限；fixed eval/PDF 有限非负；sample PDF 有限非负；仅当 PDF>0 时读取方向、权重和 flags；方向长度误差≤5e−5；diffuse/specular 各3通道分别 weight×returned PDF≈eval；returned PDF≈queried PDF。使用原样采样方向，不再次归一化。

统一混合容差：abs(a−b) ≤ 1e−5 + 5e−4×max(abs(a),abs(b))。容差在首轮执行前写入，不为失败放宽。10代表 case 的最大 PDF 容差比仅 .057902，最大响应容差比 .029734；最大方向长度偏差1.1921e−7。PDF/响应绝对误差最大分别 .000900269/.000211716，发生在较大密度/响应值处，不能单看绝对数误判。

PDF 可大于1。零 PDF 是合法拒绝事件，不是失败；代码不读取其余未定义输出，不重采样、不按有效样本重新归一化。此次没有做白炉能量估计、PDF积分或无条件互易断言。

## 黑色边界：保留失败及来源

输入官方默认值，仅 base_weight=0、specular_weight=0。所有其他能量层权重为0，coat_roughness 默认0。

初版测试错误地要求所有黑色样本 PDF=0。真实运行证明这个要求不成立，初版程序/JSON/二进制保存在 `contract_tests.initial.cpp / contract-results.initial.json / contract_tests.initial`，不可作为最终合同判断。修正版删除这条错误前提，保留全部普通 PDF 对照并要求黑色响应与采样权重为0。

源码解释：`openpbr_coat_reflection_probability` 与 `openpbr_sheen_probability` 在分子分母都为0时各自 safe_divide 回退0.5，因此仍可能生成零贡献的 coat/fuzz 方向。默认未使用 coat roughness=0 在公开 prepare 中被钳制到极小 alpha=1e−6；这个零贡献窄峰的 sample/pdf 对方向重建浮点误差敏感。

实测默认黑色 case 12,288 次尝试中 9,237 有效、3,051 拒绝，2,016 次 PDF 不一致。例：view45°、sample4，returned PDF=3,422,615,552，query PDF=3,459,877,120，响应与权重均0。这是当前固定代码、编译器和测试输入下的观测，不能从中推论普通非黑材质错误。

控制变量：同一黑色输入只把未使用 coat_roughness 改 .25，12,288 次中9,200有效、3,088拒绝，所有检查通过。该控制支持“零贡献默认窄峰数值条件”解释，但不是补丁或上游修复证明；依赖源码完全未改。

源码定位：
- https://github.com/adobe/openpbr-bsdf/blob/c91aad1d1ce1693e803f039d7c92c2965c4eb013/impl/openpbr_coating_lobe.h#L139-L158
- https://github.com/adobe/openpbr-bsdf/blob/c91aad1d1ce1693e803f039d7c92c2965c4eb013/impl/openpbr_fuzz_lobe.h#L395-L412
- https://github.com/adobe/openpbr-bsdf/blob/c91aad1d1ce1693e803f039d7c92c2965c4eb013/impl/openpbr_bsdf.h#L462-L472

## 固定版本、重现和证据

- Adobe：c91aad1d1ce1693e803f039d7c92c2965c4eb013，OpenPBR模型1.1.1。
- GLM：6f14f4792a0cde5d0cf2c910506724d61cb95834，headers版本1.1.0。
- g++：Debian14.2.0，C++17，`-O2`，未使用 fast-math。
- 从 contracts 目录编译：`g++ -std=c++17 -O2 -I../openpbr-bsdf -I../glm contract_tests.cpp -o contract_tests`。
- 运行契约：`./contract_tests > contract-results.json`，预期当前 exit1，因已记录黑色窄峰边界。
- 生成响应：`./contract_tests --reference > coverage-reference.raw.json`，exit0；再 `python3 package_reference.py`。
- 首次与重复执行的契约输出逐字节相同；修正测试前提前后生成的参考原始输出也逐字节相同。
- `logs/` 保存命令、编译版本、时间和退出码。`provenance.json` 保存生成物 SHA256。
- `dependency-verification.json`：全部485个 Adobe/GLM文件与先前固定清单 SHA256 相符，0修改。
- `NOTICE.md` 与 `licenses/` 保存署名和许可证；R05文件未修改，未外部发布。

## 本轮没有验证的范围

没有完整renderer、同光照全场景基准、GPU版 Adobe BSDF、所有输入空间、所有编译后端、背面视线、极低粗糙度一般材质、精确delta、色散、薄膜、SSS真实路径积分、opacity宿主行为或全部能量/互易关系。公开 prepare 此版本禁用delta；默认coat/fuzz非互易，透射方向交换需处理介质和adjoint约定。这些均不能用本次通过的代表样本替代。

SideFX仍只有文档研究；本机没有可用Houdini运行环境与已确认许可，未下载/执行HIP。下一合理接入是网页显示这份真实CPU响应网格，并继续独立标明当前Three近似。
