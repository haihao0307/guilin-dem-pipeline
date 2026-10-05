# 人 · 女性与原头 · 程序皮肤和毛发

单页共用一个 GNM 模型、官方 UV、皮肤实例与头皮绑定。默认女性 A，可在画面上方切换女性 B 或原头；身份和表情分开控制。

- 女性 A/B 是官方 GNM FEMALE 采样器的固定身份，不是 TEN24 原扫描
- 切换身份保留表情、镜头、皮肤贴图、材质参数及毛发设置
- 官方 UV 只把渲染网格展开为 18,437 顶点；形状求值与发根绑定保留原 17,821 顶点
- 默认使用已审看的材质棚拍灯；可以切回 R8 原冷暖灯对照
- 程序皮肤含过滤后的微凹陷、唇纹与微表面近似，不是扫描贴图或完整皮下多重散射
- 皮肤贴图导入在当前浏览器内完成，不上传；需要与官方 GNM UV 匹配
- 原老师曲线及两种沿线长度变化共用 R8 毛发材质；旧短发作为另列的结构对照

## 当前验证

CPU 同实例／恢复测试 21 项通过。原头 → 女性 A → 女性 B → 原头重复切换后，原头顶点、法线、发根和毛发曲线精确回到已接受的 R9 几何哈希。女性四态中心线验证通过；有限发丝半径的完整接触认证尚未完成。

统一界面的实际浏览器验证由 tests/unified-browser.cjs 进行，分 core（身份／表情／同实例／精确恢复）和 controls（导图／重复取消清除／毛发／镜头／移动布局），可用于 FILE 或固定 PUBLIC 地址。完成后以实际结果为准，不把 CPU 检查当成浏览器通过。

## 维护接口

- setIdentityProfile('neutral' | 'female-a' | 'female-b')：只改变身份
- setCase('neutral' | 'smile' | 'surprise')：只改变表情并保持身份
- GnmIdentityProfiles 保存固定身份系数；不创建新模型、UV、材质或 iframe
- FemaleGroomSafety 只在女性身份执行局部实际接触修正；原头恢复 R9 几何

原 R9 页面保持不变。GNM 及其官方 UV 使用 Apache 2.0，舌头网格保留 MIT 通知；Three.js 使用 MIT；老师毛发数据保留 Daniel Bystedt 的 CC BY-SA 署名与来源。见 licenses/ 和 TEACHER-GROOM-PROVENANCE.json。
