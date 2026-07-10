# 安装 CLI

`knowlery` CLI（MCP 服务器也随它携带）在不同平台的最优安装路径不一样——
本页按操作系统分节。无论哪条路，最后都用这条验证：

```bash
knowlery --version
```

::: tip 不需要命令进 PATH？
所有 `knowlery <命令>` 都可以写成 `npx -y knowlery@^1 <命令>`，零安装可用——
MCP 客户端配置也可以直接用 npx 形式。安装是给想在终端里裸敲 `knowlery`
的人准备的。
:::

## macOS（及 Linux）

**前提：** Node.js ≥ 18（`node -v` 检查；通过 [nodejs.org](https://nodejs.org)、
Homebrew 或 nvm 安装）。

**推荐——一行安装脚本：**

```bash
curl -fsSL https://jayjiangct.github.io/knowlery/install.sh | sh
```

它做什么（以及刻意不做什么）：

- 装进隔离前缀（`~/.knowlery/cli`）——不用 `sudo`，不碰全局 npm；
- 把命令链接到 `~/.local/bin`；
- 如果该目录不在你的 PATH 上，它会展示确切的配置行并**征询同意后才碰
  shell 配置**——拒绝则打印手动指令。任何修改都不会静默发生；
- 重复运行同一行命令即原地升级。

装完后开一个新终端，运行 `knowlery --version`。

**备选——npm 全局安装：**

```bash
npm install -g knowlery
```

当你的 npm 全局前缀 `bin` 在 PATH 上时可用（nvm 用户恒为真）。如果装完
提示 `command not found`——那正是一行安装脚本存在的意义，改用它即可。

**卸载（脚本安装方式）：** `rm -rf ~/.knowlery/cli ~/.local/bin/knowlery`，
外加你当初同意添加的那一行带标记的 shell 配置。

## Windows

**前提：** Node.js ≥ 18——两种安装方式任选：

```powershell
winget install OpenJS.NodeJS.LTS
```

或从 [nodejs.org](https://nodejs.org) 下载安装器。两者都会自动把 npm 的
全局目录（`%AppData%\npm`）接到 PATH 上——所以 **Windows 上 npm 路线
天然顺滑**：

```powershell
npm install -g knowlery
knowlery --version
```

装完 Node 后记得**开新终端**再跑 npm。

**如果 `knowlery` 不被识别**：检查 `%AppData%\npm` 是否在 PATH 里
（设置 → 系统 → 关于 → 高级系统设置 → 环境变量），缺则补上，再开新终端。

**WSL 用户：** WSL 里就是 Linux——直接用上面 macOS/Linux 的一行安装脚本。

**Windows 上的 MCP 配置**与其他平台用同样的 JSON；如果要写绝对路径，
形如 `C:\\Users\\you\\AppData\\Roaming\\npm\\knowlery.cmd`（JSON 里反斜杠
要转义）——或者干脆用 `npx` 形式绕开路径问题。

> 原生的 PowerShell 一行安装器是已记录的候选项，尚未发布——Windows 上
> npm 路线不需要 PATH 手术，所以缺口比 macOS 小。

## 装完之后（任何系统）

```bash
knowlery init --dir ~/kb/main --platform claude-code --name "My KB"
knowlery kb add main ~/kb/main
knowlery index --kb main
```

然后[接入你的 Agent](../guides/connect-your-agent)——如果你是从 Obsidian
过来的，现有 vault 已经天然兼容：`knowlery kb add <名字> <vault路径>`，
所有命令即刻可用。
