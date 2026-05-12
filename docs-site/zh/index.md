---
layout: home

hero:
  name: Knowlery
  text: 把你的 vault 烹饪成 AI 可读的知识库。
  tagline: "Knowlery 将 Obsidian 变成一个温暖、有结构的 AI 知识库控制台：初始化 vault、管理 skills 与 rules、检查健康状态，并为 Claude Code 与 OpenCode 准备 agent 可理解的知识层。"
  image:
    src: /knowlery-pot.svg
    alt: Knowlery Knowledge Pot logo
  actions:
    - theme: brand
      text: 快速开始
      link: /zh/getting-started/
    - theme: alt
      text: 理解核心概念
      link: /zh/concepts/

features:
  - title: 知识烹饪
    details: 将原始笔记整理成 entities、concepts、comparisons、queries，并持续维护 SCHEMA.md 的 taxonomy 与 conventions。
  - title: Agent Skills
    details: 管理用于整理笔记、提问、探索连接、挑战假设、审计 vault 的 prompt skills。
  - title: 平台配置
    details: 为 Claude Code 或 OpenCode 生成配置，让 agent 从第一轮对话就理解这个 vault 的约定。
  - title: Vault Health
    details: 检查孤立笔记、损坏 wikilinks、缺失 frontmatter、设置缺口与配置漂移。
---

<section class="knowlery-panel">

## Knowlery 是什么

Knowlery 是一个 Obsidian 插件，适合那些希望笔记不只是 markdown 文件堆积的人。它在你、vault 和 AI coding agents 之间建立一个共享工作层。

你的自由笔记仍然属于你。Knowlery 给 agent 一个结构化工作区：`entities/`、`concepts/`、`comparisons/`、`queries/`、`KNOWLEDGE.md`、`SCHEMA.md`、`INDEX.base`、skills、rules 和平台配置。

</section>

<section class="knowlery-grid">
  <div class="knowlery-card">
    <h3>面向 Obsidian 用户</h3>
    <p>初始化 vault，保持结构可见，并通过 dashboard 管理 skills、rules 和健康检查。</p>
  </div>
  <div class="knowlery-card">
    <h3>面向 agent 工作流</h3>
    <p>为 Claude Code 或 OpenCode 提供持久的说明和稳定的知识地图，而不是每次会话都重新堆上下文。</p>
  </div>
</section>

## 从哪里开始

- 第一次使用 Knowlery？从 [快速开始](/zh/getting-started/) 开始。
- 想先理解模型？阅读 [核心概念](/zh/concepts/)。
- 遇到问题？打开 [故障排查](/zh/troubleshooting/)。
- 需要精确文件路径和行为？查看 [参考](/zh/reference/)。
