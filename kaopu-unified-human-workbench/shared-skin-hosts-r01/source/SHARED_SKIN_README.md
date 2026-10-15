# 统一全身程序皮肤接线

使用用户指定 50f9dd769893584dedb62f0bc62db07ebcb1dcc0 的 SKIN-FULLBODY-R02 七个原始模块；source SHA256 由构建器逐文件验证。官方主线 HUMAN-INTEGRATED-R07 已包含同样的皮肤。宿主沿用自己的顶点、面、骨架、发根和裁片，仅替换皮肤表面函数。

构建入口是 build-skin-host.cjs；皮肤模块位于 kaopu-unified-human-workbench/human-integrated-r07。skin-host-adapter.js 恢复宿主的观察光线、视角和预设界面，将肤质按钮接至新皮肤；缺少皮肤字段的旧档案保留当前新皮肤，而明确保存的字段保持原值。动作修改原材质同一对象时，通过 version 和 cache key 使程序皮肤同步重新编译。动作绑定直接使用 viewer.skin.material，避免对材质数组调用编译器。

file:// 的 Blob 模块线程和二次 import 会产生无 message 的错误事件；离线传输保存原 Blob，并把资源前缀与原 IIFE 线程直接拼成 classic Worker。原始发束/布料算法未改。

新鲜证据与前态备份：../Human-Skin-Integration-20261015/qa、delivery、before、ACTIVE_CHANGES.json。公开浏览器四模块均通过，HTMLPreview 宿主 favicon 的独立 404 单独记录。测试不代替用户的视觉验收；保留有界 RGB 组织传输、原网格和原服装物理的既有限制。

当前完整发型构建器先校验冻结原人物并保留纹理兼容补丁，再注入共享皮肤；发型初始化在皮肤实际 GPU 链接之后接管渲染器。不得只修改未被构建器读取的参考 HTML。服装集合页使用 r08-ccccfd5ca9c1-skin-r02 稳定副本，保留 r08-ccccfd5ca9c1 原发布不动。最终完整离线四页和公网头发/服装动作均通过，最终证据见 DELIVERY_RECEIPT_R2.json。
