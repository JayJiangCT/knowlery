# 开发者说明

本页覆盖本地开发、build commands 和文档维护。

## 本地设置

安装依赖：

```bash
npm install
```

构建插件：

```bash
npm run build
```

启动文档站：

```bash
npm run docs:dev
```

构建文档站：

```bash
npm run docs:build
```

## Release Assets

插件 release 应包含：

- `main.js`
- `manifest.json`
- `styles.css`

现有 release workflow 会在 version tags 上运行，并将这些 assets 发布到 GitHub Releases。

## 文档架构

官方文档位于 `docs-site/`。

内部项目 notes、设计文档、Obsidian API references 和 test guides 仍然保留在 `docs/`。这样可以避免 public docs 混入内部草稿或过期 planning material。

## 双语结构

英文是默认 locale，位于 `/`。

简体中文位于 `/zh/`。

新增 public page 时，请同时添加两个语言版本，并更新 `docs-site/.vitepress/config.ts` 中的 sidebars。

## GitHub Pages

Docs workflow 会构建 VitePress site，并通过 GitHub Pages 部署。

对于 `https://<owner>.github.io/knowlery/` 这样的 project page，workflow 会设置：

```bash
KNOWLERY_DOCS_BASE=/knowlery/
```

本地 build 使用 `/` 作为 base path。

## 文档风格

推荐：

- 先解释产品用途，再进入内部机制。
- 使用短 section 和明确文件路径。
- 对可能演进的功能使用“当前行为”表述。
- 示例尽量能在 clean test vault 中成立。
- 英文和中文页面结构一致，但表达自然。

避免：

- 将内部设计草稿混进官方文档。
- 承诺尚不存在的自动化能力。
- 在可以查看源码时，仅凭记忆描述代码行为。
