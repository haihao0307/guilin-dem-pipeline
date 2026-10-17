# Adobe 原实现参考：执行、适配与边界

固定 Adobe OpenPBR c91aad1d1ce1693e803f039d7c92c2965c4eb013（OpenPBR1.1.1，Apache-2.0），GLM6f14f4792a0cde5d0cf2c910506724d61cb95834。已有g++14.2，隔离目录直接编译，无系统安装和外部模型。先运行未经修改的官方最小例，stdout四行与官方预期逐字节一致，编译和运行exit0。

## 真正执行的契约检查

自有 contract_tests.cpp 调用真实 prepare/eval/sample/pdf。10个非黑代表材质，每个12,288次采样；合计122,880次尝试、121,407有效样本、1,473合法零PDF，1,337,640条检查零失败。包括有限值、单位方向、sample/query PDF一致以及weight×PDF=eval。不能由此推断所有参数、平台或后端正确。

全套另含黑色吸收体边界，仍保留失败：base_weight与specular_weight为0，未使用coat默认roughness=0时出现2,016条PDF一致性失败；响应恒0且有限。该退化采样路径涉及零权重选择回退和极窄峰。把未使用coat roughness设.25后该特例通过，只作为隔离诊断，不替换原失败。全套退出码1及原始结果保留，不写全库通过。详见reference-source/contract-results.json和初始结果。

## 可交互数据

参考生成器实际调用prepare/eval，两个纯相分别求值后按覆盖率混合，与先混颜色/metalness后再求值对照。225条显示数据来自1980条共同roughness网格的明确子集，无虚构或插值结果。主例是油漆与钢，不把油漆叫氧化物。纯相端点误差0。

输入采用R05艺术参数，不是实测材料。RGB线性，eval已经包含入射余弦，单位sr^-1；不再乘一次余弦。相对误差是RGB向量L2相对差，既非感知误差也非实际场景像素误差。面积混合假设是未分辨的并列材质小区，不等于透明涂层纵向叠层。

## 一项实际网页适配

metal-surface.mjs在Three lights_physical_fragment之后独立装配各相coverageDiffuse与coverageF0，防止先混色再混metalness产生交叉污染。其他GGX遮蔽、能量补偿、粗糙度混合、法线、环境光仍按浏览器近似，未完整接入Adobe BSDF。参考页和实际材质页均需真实浏览器验收。

## 许可与复现

官方实现：https://github.com/adobe/openpbr-bsdf/tree/c91aad1d1ce1693e803f039d7c92c2965c4eb013
官方依赖：https://github.com/g-truc/glm/tree/6f14f4792a0cde5d0cf2c910506724d61cb95834
Adobe完整许可见reference-source/ADOBE_OPENPBR_LICENSE.txt。自有测试源码公开，不包含完整第三方依赖headers或大型LUT；按固定链接准备依赖后编译。原始官方代码归原权利人，不冒称KAOPU自有或官方背书。

测试内附的Three CPU方程转写另保留reference-source/THREE-LICENSE.txt，不把MIT来源变成Apache独占；本页显示表只用Adobe真实eval列，Three CPU列没有冒称GPU测量。
