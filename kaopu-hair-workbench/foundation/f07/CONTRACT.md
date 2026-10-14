# F07 形体、导向与表现交接

| 层 | 权威 | 已实现 |
| --- | --- | --- |
| 人物 | 固定完整清俊P01运行时 | 同一网格、骨架和材质，不拼独立头 |
| 观察 | HairDesign.study | 单张正面人工观察；侧后方推定；原图不发布 |
| 大型 | hair-shape-volume@1 | 连续放样、九组、肩部静态裁整、UV |
| 导向 | GuideGroom@3 | 192导向、3067根点覆盖、原生绑定、分缝内混合 |
| 运动规则 | hair-style-rules@1 | 固定根、段长、逐点工程权重、活动包络 |
| 表现 | body/fringe材质槽 | 基础素模及材质替换入口；最终资产待接入 |
| 动态 | 独立物理工作台 | 本版未新增求解器或材料标定 |

共同人物网格25,417顶点/50,624面，拓扑、实际索引SHA256和适配器指纹继承F06。数据坐标为`native-common-viewer-Yup`：取原人物viewer.geometry的共同网格前缀，米。人物内部的Z-up数组不能冒充相同坐标。绘制沿用viewer.mesh矩阵一次。

导向消费：

```javascript
import {nativeDisplayHead,attachGroom} from './src/GuideExchange.mjs';
const {controller,viewer}=fullCommonWorkbench.motion();
const current=nativeDisplayHead(controller.model,viewer);
const attached=await attachGroom(current,pack);
// attached.guides[].points在当前人物mesh的局部显示坐标中。
```

`extensions.shapeVolume.positions`保存原创放样的工程构建坐标，不能直接当人物显示坐标。实际消费使用`nativeBinding`的固定原生面、重心坐标和`offsets`，按`nativeFrame`重建到当前人物显示坐标，再应用人物mesh矩阵。`triangles / faceGroups / uv`一一对应；相邻组共享连续表面。此大型锚点验证的是当前P01轻微转头，未证明任意表情/体型下的非刚性头部变形正确。

九个稳定分组ID：`crown-left / crown-right / curtain-left / curtain-right / back / fringe / tip-left / tip-right / tip-back`。`rootOwnership`将导向根点绑定到路径分组，包含原生面/重心坐标。发尾层继承父组；同组不是要求所有导向完全刚性同步。

大型UV：U沿环向，V从发顶到发尾。独立发束UV：U沿宽度，V由毛根0到发梢1。纹理、发卡和最终发丝应声明使用哪种UV，不能自动假定二者等价。更换材质不改变位置、索引、UV和人物实例。

```javascript
hairF07.attachAppearance({body: bodyMaterial, fringe: fringeMaterial});
// 材质必须为消费方的Three.js Material；外部材质由调用方释放。
hairF07.attachAppearance({}); // 恢复本版素模材质
```

这只是当前分组网格的替换入口；新造型重建后需重新应用。没有实现任意图片导入即自动变成正确发卡的功能。新表现资产需遵守原生目标、分组归属、导向流向与UV约定；若改几何，需额外检查轮廓、接触与覆盖。

`motionRules.guides[].segmentLengths`为逐段长度；`points[]`包含弧长、固定、保型、弯曲、发束联系、活动和包络权重。根点为pin=1/mobility=0。材料参数未标定时保持null；`solver.implemented=false`。消费方必须自己维护无应力参考、平衡和运动状态，不能把设计包当成已经求解的物理结果。

校验器拒绝目标、索引、坐标、根固定、规则数量、分组归属和UV不兼容的包。F06的HairDesign@2可迁移设置到HairDesign@3，未附带这次照片证据时不补造study。旧GuideGroom@2应经明确迁移后接入，不能直接换版本字符串。
