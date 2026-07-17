# 技术架构

Knowlery 的组装方式：一个平台无关的核心、三个薄壳层，以及一套全员共享的、
基于纯 markdown 的工作区格式。

## 一核三壳

```
                    ┌─────────────────────────────┐
                    │        src/core/            │
                    │   检索 · 陈旧检测 · 同步 ·   │
                    │   初始化 · 知识包 · 注册表 · │
                    │      MCP 处理器             │
                    └──────┬───────┬───────┬──────┘
                           │       │       │
              ┌────────────┴─┐  ┌──┴────┐  └──────────────┐
              │ Obsidian     │  │ CLI   │  │ MCP 服务器    │
              │ 插件         │  │       │  │ (stdio/HTTP)  │
              │ (main.js)    │  │       │  │               │
              └──────────────┘  └───────┘  └───────────────┘
```

- **核心**（`src/core/`）承载全部生命周期逻辑：初始化、同步、检索、陈旧
  检测、知识包导出/安装/发布/更新、KB 注册表、MCP 工具处理器。它从不以值
  的形式导入 Obsidian API——有一个测试
  （`tests/core/core-purity.test.ts`）枚举所有倒置模块，任何非 type-only 的
  `import ... from 'obsidian'` 都会让它失败。
- **Obsidian 插件**（`src/main.ts`、views、modals）添加评审 UI：dashboard、
  导出/安装弹窗、设置。
- **CLI**（`src/cli/`）是薄薄的 argv/prompt/输出层。命令只解析旗标然后委托；
  壳层里不放生命周期逻辑。
- **MCP 服务器**（`src/core/mcp/`）把同样的操作暴露为工具、提示词和资源。
  stdio 壳（`knowlery mcp`）和 HTTP 壳（`knowlery mcp serve`）提供传输层；
  处理器不知道自己运行在哪个传输层上。

一个仓库产出两个 esbuild 产物：`main.js`（插件）和 `knowlery-cli.mjs`
（CLI + MCP）。MCP SDK 只打进 CLI 产物——插件包里没有任何 MCP 代码。

## 文件系统倒置

核心通过 `VaultFs` 接口（`src/core/vault-fs.ts`）访问磁盘，有两个实现：

| 实现 | 底层 | 使用方 |
| --- | --- | --- |
| `obsidianVaultFs` | Obsidian `App` vault API | 插件 |
| `nodeVaultFs` | `node:fs` | CLI、MCP、测试 |

`loggingVaultFs` 可以包装任意一个，记录一次 sync 实际写了哪些路径——`sync`
的文件清单和测试里的幂等性证明都来自它。Wikilink 解析同样分裂：插件用
Obsidian 的 `metadataCache`；无头代码扫描文件，且有歧义的 basename 解析为
空而不是猜测。

## 工作区格式

Knowlery 工作区就是一个普通文件夹：

```
KNOWLEDGE.md          # 面向 agent 的操作指南
SCHEMA.md             # 活的分类约定
INDEX.base            # Obsidian Bases 索引
entities/ concepts/ comparisons/ queries/    # 编译层（agent 层级）
inbox/                # MCP capture 落点（用户层级，按需创建）
Library/<bundle-id>/  # 已安装知识包（只读参考）
.knowlery/            # manifest、bundles.json、导出、活动、报告
.agents/skills/ .claude/skills/              # 已安装技能包
```

页面是带 frontmatter 的 markdown。扫描器（`src/core/query/scan.ts`）把每个
页面归入层级：`agent`（四个编译目录）、`user`（其余一切），以及 `Library/`
下的知识包材料。这个层级驱动检索加权、陈旧检测和 MCP 资源白名单。

manifest（`.knowlery/manifest.json`）记录平台、KB 名称和 `lastSyncedBy`——
降级守卫背后的版本戳。

## 检索引擎

`src/core/query/` 是纯 TypeScript，除初始扫描外没有任何 I/O：

1. **分词**：拉丁词带轻量词形变体，CJK 子串和短语。
2. **打分**：字段加权——标题和别名权重最高，其次 tag、描述、正文。当编译
   页面引用（`sources:`）的原始笔记命中问题时，该编译页面获得加分——跨语言
   提问就是这样抵达编译层答案的。
3. **门禁**：top 候选必须过置信线——结构化字段命中且特异性加权的词覆盖率
   足够、散文覆盖强，或纯 source-graph 触达。否则判定为
   `no-confident-match`，引擎弃答而不是排列噪音。

刻意**没有缓存、没有索引**：每次查询都是实时扫描。vault 规模的语料毫秒级
扫完，无状态则彻底消除了失效问题——正是这个性质后来让 MCP 服务器白拿了
重启安全。

同一份快照喂给**陈旧检测**（`staleness.ts`）：被引用来源的 mtime 比页面新
即为 stale；无人引用的用户笔记是"未编译"；指向不存在文件的引用是 dangling。
一切都从 mtime 现算——没有簿记状态。

检索质量**靠测量而非断言**：`evals/` 有 fixture vault 和黄金问题集；CI 对
冻结基线跑 recall@10 / MRR，低于基线的变更直接失败。

## 知识包（OKF）

知识包是一个 zip：已批准的编译页面，加 `knowlery-bundle.json`（manifest：
id、版本、创建者、内容哈希）、用于导航的 `index.md` 和 `agent-index.json`、
`_sources/` 下已批准的原始来源，以及只覆盖包内实际使用的 tag 的 schema。

管线（`src/core/okf/`）是门禁形状的：

- **导出**：种子主题 → 图闭包 → 逐项评审（approve/flag 带内容哈希，编辑会
  使批准自动失效）→ 风险扫描（邮箱、敏感 URL、凭证模式、人物页）→ 编译 →
  打包。
- **发布**：`gh` CLI 创建 GitHub Release，notes 里带 SHA-256；公开仓库需要
  对每个风险项二次确认。
- **安装**：本地路径或 URL；私有 Release 资产通过用户的 `gh` 登录下载；
  `--verify <sha256>` 校验完整性；写入前先做 conformance 结构校验。
- **更新**：`check-updates` 只读地查询 Release 源；`update` 要求版本递增、
  在临时目录 staging 新内容、按哈希检测本地修改、带备份的原子交换。

## KB 注册表

`~/.config/knowlery/registry.json` 把名字映射到规范路径——仅此而已。所有壳
层共享它：CLI 的 `--kb`、插件的自注册（带所有权追踪，绝不删除用户自己的
条目）、MCP 服务器的寻址层。名字在写入*和*读取时都校验（手改出的非法条目
是响亮的错误，绝不静默丢数据）。联邦查询遍历注册表、逐 KB 跑引擎、按分数
合并并逐条标注来源。

## MCP 服务器

`src/core/mcp/server.ts` 在 SDK 的 `McpServer` 上注册一切：

- **八个工具**——五读（`list_kbs`、`query`、`stale`、`health`、
  `list_bundles`）三写（`init_kb`、`capture`、`sync`）——每个都有 zod 输入
  schema（strict：拒绝未知字段），`structuredContent` 与 CLI 的 `--json`
  形状一致。
- **提示词**：九个精选技能，原样送出。
- **资源**：`knowlery://{kb}/{+path}`，读取白名单只覆盖精选层
  （`KNOWLEDGE.md`、编译目录、`Library/`）——先 canonicalize 再前缀检查，
  穿越和 symlink 逃逸都被拒绝。

访问是**结构性的**：`access` 选项决定哪些写工具被注册。stdio 注册全部
（调用方拥有这台机器）；HTTP 壳 fail closed，只注册 `--allow-*` 旗标明确
打开的。

HTTP 壳（`http-server.ts`）保持一个长命的 `node:http` server，但**每个请求
新建一对 McpServer + 无状态 transport**，随 response 一起关闭——这是 SDK
无状态模式的契约。认证是 bearer token，`timingSafeEqual` 比较哈希；token
从不落盘、从不进日志。

## 测试策略

| 层 | 方法 |
| --- | --- |
| 核心逻辑 | 纯函数单测（引擎、陈旧检测、zip、注册表） |
| 命令处理器 | 内存 `VaultFs` + 临时目录；对清理路径注入故障 |
| MCP | SDK 内存 transport 上的协议往返——无子进程 |
| 构建产物 | smoke 测试用发布入口构建 `knowlery-cli.mjs` 并端到端驱动：init → sync → query → bundles → 远程安装 → 注册表 → MCP stdio → HTTP serve |
| 检索质量 | eval harness，CI 强制基线 |
| 纯度 | 倒置模块清单，测试强制 |

## 版本与发布

插件和 CLI 版本 lockstep（同一个 `package.json`）。发布由版本 tag 触发；
npm 发布用 OIDC trusted publishing（CI 里无 token）带 provenance，且幂等——
重跑已发布的 tag 会绿色跳过。1.0 起，工作区格式、CLI 表面和 MCP 工具契约
在 semver 下冻结。
