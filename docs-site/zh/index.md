---
layout: home

hero:
  name: Knowlery
  text: 把你的 vault 变成一个以 review 为中心的知识空间。
  tagline: "Knowlery 为 Claude Code 和 OpenCode 提供一个行动优先的 review surface，并把 setup、diagnostics、rules、skills 维护放在 settings 中。"
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
  - title: 行动优先的 Dashboard
    details: 在一个页面里查看 Today's move、Suggested moves、当前笔记、最近活动和 weekly summary。
  - title: 当前笔记 Review
    details: 打开一篇 Markdown 笔记后，准备一个用于连接旧笔记、comparisons 和可复用结构的专注 prompt。
  - title: Freshness Review
    details: 准备本地 request JSON，导入 agent 写出的结果，并在批准后才应用 scalar freshness metadata。
  - title: Weekly Summary
    details: 基于最近活动生成本地 HTML 报告，必要时再交给 companion agent 打磨。
  - title: Settings 维护
    details: 在 Obsidian settings 中运行诊断、维护 rules/schema、切换平台并管理 Skills library。
---

<section class="knowlery-panel">

## Knowlery 是什么

Knowlery 是一个 Obsidian 插件，适合那些希望在 vault 上叠一层 review 导向工作面的人。

你的自由笔记仍然属于你。Knowlery 给 agent 一个结构化工作区：`entities/`、`concepts/`、`comparisons/`、`queries/`、`KNOWLEDGE.md`、`SCHEMA.md`、`INDEX.base`、skills、rules、activity receipts、review requests 和平台配置。

</section>

<section class="knowlery-grid">
  <div class="knowlery-card">
    <h3>面向 Obsidian 用户</h3>
    <p>初始化 vault，保持结构可见，并通过 dashboard review 笔记、活跃线程、freshness suggestions 和 weekly 输出。</p>
  </div>
  <div class="knowlery-card">
    <h3>面向 agent 工作流</h3>
    <p>为 Claude Code 或 OpenCode 提供持久说明、activity receipts 和稳定的知识地图，而不是每次会话都重新堆上下文。</p>
  </div>
</section>

## 从哪里开始

- 第一次使用 Knowlery？从 [快速开始](/zh/getting-started/) 开始。
- 想先理解模型？阅读 [核心概念](/zh/concepts/)。
- 遇到问题？打开 [故障排查](/zh/troubleshooting/)。
- 需要精确文件路径和行为？查看 [参考](/zh/reference/)。
