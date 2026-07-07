# 使用多个知识库

工作一个库、个人研究一个库、副业项目再一个——库一多，"我现在在哪个文件夹"就成了
摩擦。**KB 注册表**给知识库起名字。

```bash
knowlery kb add work ~/vaults/work-kb
knowlery kb add personal ~/vaults/personal

knowlery query --kb work "关于 rollout 我们定了什么？"
knowlery stale --kb personal
```

`--kb <name>` 对所有操作既有知识库的命令有效，在任何目录下都能用。`--dir` 的行为
完全不变——`--kb` 只是它之上的便利层，注册表永远不是必需品（`init` 不接受
`--kb`：先初始化，再注册）。

## 注册表

`~/.config/knowlery/registry.json`，一个纯粹的地址簿——名字和路径，仅此而已。

- `knowlery kb list` 显示每个库的实时状态：`ok`、`uninitialized`（文件夹在但不是
  工作区）、`missing`（被移动或删除——只标记，绝不自动清除）。
- `knowlery kb remove <name>` 只删除注册表条目；知识库的文件原封不动。
- 如果注册表文件损坏，Knowlery 会大声报错而**不会**重置它——那是你的知识库清单。

## 一次搜遍所有库

```bash
knowlery query --kb '*' "backpressure 我写在哪个库里了？"
```

对每个注册的库跑检索引擎，按分数归并，每行标注来源库：

```
  31.42  work: concepts/backpressure.md — Backpressure
   8.91  personal: concepts/flow-control.md — Flow Control
```

不可达或未初始化的库会被跳过并提示；所有库都没有可信匹配时，弃答消息会列出查询过
哪些库。

## Obsidian 里的 vault 会自动注册

用 Knowlery 插件初始化的 vault 会以它的知识库名自动注册（重名时加数字后缀）。
设置里的 **"Register vault for CLI/agent access"** 开关控制它；关掉只会移除插件
自己创建的那个条目——你手动注册的名字永远不会被动。
