# Knowlery 2.0 — Sources & Provenance

> 本文件说明文档取材和准确性边界；避免让下一位 Agent 误以为我们已经核定未决的 Schema 或具体实现。

## 直接依据

1. 项目提供的 `Knowlery 2.0 Goals.txt`（2026-10-29）：产品目标、五大目标、非目标、成功衡量及 North Star。转述见 [GOALS.md](./GOALS.md)。该文件是**整理稿**，不是逐字复制。
2. 2026-10-29 已确认的高层架构共识：Format-first、No full Core Runtime、CLI + Adapter、Agent Skills、可选 MCP、Obsidian Plugin UI、Markdown-first。见 [ARCHITECTURE.md](./ARCHITECTURE.md)。
3. 项目讨论材料 `仓库解耦建议.txt`、`讨论知识格式.txt`、`制定Knowlery架构计划.txt`：Format-first 取舍、Agent 自治治理、知识资产及格式候选机制。讨论中的具体字段/存储/身份方案未自动批准。
4. 已进行的 Pilot Wiki 研究：[Knowlery-Pilot](https://github.com/JayJiangCT/Knowlery-Pilot)；研究记录仓库：[knowlery-research-review](https://github.com/JayJiangCT/knowlery-research-review)。审查结论可启发实验，不代表本次重新核验整个 Vault。
5. 现有实现基线：[knowlery main @ 0e53802](https://github.com/JayJiangCT/knowlery/commit/0e53802c0c332ab23445b83651f15999e1ac89b8)，`package.json` / `manifest.json` 均为 1.6.2；保留现有发布配置。

## 本次资料限制

- 此次任务可用的是目标文档和前期讨论的文字材料；既有“高层架构两张原图”未以可直接提交的原始图片文件提供。因此 [ARCHITECTURE.md](./ARCHITECTURE.md) 中 Mermaid 图是**重绘**，不是图片原稿。
- 过去审查中的性能数字、194 篇 Wiki 分类、G0/G1 现象不能自动作为 2.0 的新评测结果。
- Knowledge Format 目前是 **v0 Working Draft**；没有经批准的最终字段表、统一笔记 ID 规则、版本快照实现或 Conformance Test 结果。
- 目录骨架是本轮 Bootstrap 的工程建议，不是 2.0 已经完成模块迁移的声明。

## 后续维护约定

外部研究、实验结果和 Owner 决定发生变化时，优先更新 [DECISIONS.md](./DECISIONS.md)，然后修订对应文档，并记录证据和时间。对有争议的内容保留其状态，不以文档写得流畅代替验证。
