# CLI 工作流

完全用命令行运行 Knowlery 的端到端演练——不需要 Obsidian。这些工作流产出的
每个文件夹，之后都能零迁移地在 Obsidian 中打开。

一次性安装：

```bash
npm install -g knowlery
knowlery --version
```

## 从零到一个可用的知识库

```bash
# 1. 初始化工作区
knowlery init --dir ~/kb/research --platform claude-code --name "Research KB"

# 2. 注册它，让后续所有命令（和 MCP）都能按名字寻址
knowlery kb add research ~/kb/research

# 3. 验证
knowlery health --kb research
```

`init` 会搭好四个编译目录、`KNOWLEDGE.md`、`SCHEMA.md`、`INDEX.base`、内置
技能和 agent 平台配置。之后把原始笔记丢进文件夹任意位置，让 agent `/cook`
它们即可。

## 每日循环，无头模式

```bash
# 全貌一览——实时计算的定位地图
knowlery index --kb research

# 有什么在等着？
knowlery stale --kb research

# 提问（在任何目录下）
knowlery query --kb research "关于 rollout 我们决定了什么？"

# 搜索你拥有的一切
knowlery query --kb '*' "我在哪写过 backpressure？"
```

`stale` 是待办清单：被引用来源已变化的编译页面，加上从未编译的笔记。
选择性地 cook——许多笔记本来就不需要编译。

弃答（`No confident matches`）是结果，exit 0。脚本可以依赖 `--json`——
所有报告类命令都有稳定的输出形状。

## 升级之后

```bash
npm i -g knowlery@latest
knowlery sync --kb research        # 刷新技能和指令文件
```

`sync` 幂等且只在有变化时写入；如果工作区曾被*更新*的版本 sync 过，它会拒绝
运行（降级守卫）——过期的全局安装永远不会破坏已升级的工作区。

## 分享一片你的知识

```bash
# 1. 看看一个主题的图闭包会发出什么
knowlery bundle export retrieval-engine --kb research
# -> exit 1 并打印评审清单：未经评审的内容一律不发

# 2. 记录你的评审决定（刻意没有 approve-all）
knowlery bundle review retrieval-engine --kb research --list --json
knowlery bundle review retrieval-engine --kb research \
  --approve concepts/retrieval-engine concepts/scoring --flag Projects/meeting-notes

# 3. 导出，然后发布到 GitHub Release
knowlery bundle export retrieval-engine --kb research --zip
knowlery bundle publish retrieval-engine --kb research --repo you/knowledge-shelf
```

`publish` 会创建带 SHA-256 校验和的 Release，并打印**受众声明**——精确说明
谁能下载它、如何授权。发布到公开仓库需要再次确认风险项
（`--acknowledge-risks`）——公开发布是永久的。

## 安装并保持订阅

```bash
# 从 URL 安装（私有仓库通过你的 gh 登录访问）
knowlery bundle install https://github.com/you/knowledge-shelf/releases/download/you.retrieval-engine-v1.0.0/you.retrieval-engine-1.0.0.zip \
  --kb research --verify <sha256>

# 之后：有更新吗？
knowlery bundle check-updates --kb research     # 只读，绝不自动更新
knowlery bundle update some.bundle --kb research
```

更新走完整的门禁管线：版本必须递增、conformance 会被检查、对已安装包文件的
本地修改会让更新拒绝执行（并列出文件），除非传 `--force`。

## 把知识库服务给 agent

```bash
# 本地 agent（Claude Desktop/Code、Codex、Cursor、Antigravity）：stdio
claude mcp add knowlery -- knowlery mcp

# 另一台机器：隧道后的 HTTP
openssl rand -hex 32 > ~/.knowlery-mcp-token
knowlery mcp serve --port 8787 --token-file ~/.knowlery-mcp-token
cloudflared tunnel --url http://127.0.0.1:8787
```

完整的工具参考、写权限旗标和客户端配置见 [Agent 与 MCP](./agents-mcp)。

## 脚本编写须知

- 每个命令都接受 `--dir <path>`（默认当前目录）或 `--kb <name>`——绝不能
  同时传。registry 永远不是前置条件；`--dir` 工作流永久有效。
- 所有报告类命令都支持 `--json`；输出形状作为 1.0 契约的一部分被冻结。
- 退出码：`0` 成功（包括弃答和空报告）、`1` 操作失败（工作区不健康、门禁
  未过）、`2` 用法错误（旗标错误、缺参数）。
- 输出对管道安全：`knowlery query ... | head -1` 正常工作；提前关闭的管道是
  对话的正常结束，不是错误。
