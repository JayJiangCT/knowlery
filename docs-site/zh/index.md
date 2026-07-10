---
layout: home

hero:
  name: Knowlery
  text: 让你的 agent 住进知识库。
  tagline: "一种纯 markdown 工作区，三个壳层：MCP 服务器和 CLI 面向 Codex、Claude、Cursor、Antigravity——Obsidian 插件是它最丰富的人类界面。Obsidian 让它能力最大化，但它不依赖 Obsidian。"
  image:
    src: /knowlery-pot.svg
    alt: Knowlery Knowledge Pot logo
  actions:
    - theme: brand
      text: 快速开始
      link: /zh/getting-started/
    - theme: alt
      text: 接入你的 Agent
      link: /zh/guides/connect-your-agent
    - theme: alt
      text: 理解核心概念
      link: /zh/concepts/

features:
  - title: 常驻每一次对话
    details: 九个 MCP 工具让知识库在 Codex、Claude、Cursor、Antigravity 里随手可及——建库、注册、捕获、查询、维护，全部用对话完成。
  - title: 确定性检索
    details: 质量可测量、代码保证的检索引擎，回答带引用——没有可信匹配时诚实弃答，而不是排列噪音。质量由 CI 守护，不靠运气。
  - title: capture → cook → ask 循环
    details: "\"记住这个\"落进 inbox；/cook 把它编译成带引用的知识页面；提问得到带来源的回答。"
  - title: 知识包
    details: 把评审过的知识切片作为便携 bundle 分享——发布到 GitHub Releases、从 URL 安装、订阅更新。
  - title: 想要时就有的评审 UI
    details: Obsidian 插件在同一工作区上提供行动优先的 dashboard、Knowledge health、Freshness Review 和知识包分享流程。
  - title: semver 之下冻结
    details: 工作区格式、CLI 表面和 MCP 契约已 1.0 冻结并由契约测试钉住——你搭在上面的东西不会塌。
---

<section class="knowlery-panel">

## Knowlery 是什么

Knowlery 是为 agent 时代构建的知识库方案。你的自由笔记仍然属于你；agent
获得一个结构化、可检索的层——`entities/`、`concepts/`、`comparisons/`、
`queries/`——由评审管线从你的材料编译而来，外加让它们成为好协作者的技能
与行为准则。

一切都是普通文件夹里的纯 markdown：通过 MCP 和 CLI 服务给 agent，想要最
丰富的视图时用 Obsidian 打开。

</section>

<section class="knowlery-grid">
  <div class="knowlery-card">
    <h3>从你的 agent 开始</h3>
    <p>一段 MCP 配置之后，一切都是对话："帮我建个知识库"、"记住这个"、"我知道些什么关于……"。不需要 Obsidian。</p>
  </div>
  <div class="knowlery-card">
    <h3>从 Obsidian 开始</h3>
    <p>安装插件、跑设置向导、可视化地评审你的知识——同一个工作区自动对所有 agent 按名字可用。</p>
  </div>
</section>

## 从哪里开始

- 第一次使用 Knowlery？从 [快速开始](/zh/getting-started/) 开始——它分叉到两条路。
- 从 agent 生态过来？先[接入你的 Agent](/zh/guides/connect-your-agent)，然后[用对话使用知识库](/zh/guides/talk-to-your-kb)。
- 想先理解模型？阅读 [核心概念](/zh/concepts/)。
- 遇到问题？打开 [故障排查](/zh/troubleshooting/)。
- 需要精确文件、命令和承诺？查看 [参考](/zh/reference/) 与 [稳定性契约](/zh/reference/stability)。
