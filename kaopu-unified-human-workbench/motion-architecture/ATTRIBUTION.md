# 来源与权利边界

本目录的 `motion_contract.py`、`native_packet.mjs` 和测试为本项目新编写的适配/验证代码，没有复制五个老师的网络、训练器、权重或数据。研究说明链接到固定源版本，以便读者核验。代码许可不替代模型和数据许可。

- GEM-X：NVIDIA，Apache-2.0源码；关联模型见其NVIDIA Open Model条款及第三方attributions。
- SOMA-X：NVIDIA，Apache-2.0源码；optional MHR/Anny/SMPL-family/MANO等后端资源独立条款。
- Kimodo：NVIDIA/nv-tlabs，Apache-2.0源码；SOMA/G1与SMPL-X模型条款不同，见固定版本README与各模型卡。
- ProtoMotions：NVIDIA及贡献者，Apache-2.0源码；机器人、SMPL等bundled资源见该仓库legal目录和checkpoint model card。
- StableMotion：Yuxuan Mu及论文作者，MIT源码；SMPL/AMASS/TMR和checkpoint许可仍需独立核验。

完整source链接/版本/阅读内容SHA-256在 [SOURCE-INDEX.json](SOURCE-INDEX.json)。许可证链接：

1. https://github.com/NVlabs/GEM-X/blob/32992550dba114c62243fb55e361311972dce8f9/LICENSE
2. https://github.com/NVlabs/SOMA-X/blob/d6aa640f7787498009c4e3d57fcc14a243905d10/LICENSE
3. https://github.com/nv-tlabs/kimodo/blob/58e781898b3d7e328a676a75d3e338c45dce3ad9/LICENSE
4. https://github.com/NVlabs/ProtoMotions/blob/7a8417a9f55b1586b0d6e8f46578c5bc9d7ce1f1/LICENSE.md
5. https://github.com/Murrol/StableMotion/blob/45d8836ce5cd7ae70f0065fdac672debfdfd6066/LICENSE

测试fixture为自有解析几何，不是模型输出或动作捕捉。原生packet测试只读取主台已有被保留的授权人物与自有程序动作；没有将它们作为外部老师复现证据。
