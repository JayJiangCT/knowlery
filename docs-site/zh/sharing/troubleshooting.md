# 分享故障排查

## "同事打开链接是 404"——是权限问题，不是链接坏了

这是最常见的困惑，所以放在第一条：**发布知识包不会授予任何人访问权。**如果
知识包放在私有 GitHub 仓库里，没有读权限的人访问链接得到的就是 404——GitHub
刻意不区分"不存在"和"无权限"。

解决方式，按推荐顺序：

1. **团队配置**：把知识包托管在组织所有的仓库里，base permission 设为 Read——
   所有组织成员自动有权限。参见[组织货架](./index#团队推荐配置组织货架)。
2. **个人邀请**：把对方邀请为仓库 collaborator（仓库 → Settings →
   Collaborators），对方接受邀请后重试。
3. 接收者下载时还必须是*已认证*状态：CLI 路径需要 `gh auth login`，手动路径
   需要浏览器已登录。

## "gh is not installed"

`gh` 只在**私有**来源时需要。要么安装它（[cli.github.com](https://cli.github.com)）
并运行 `gh auth login`，要么走浏览器降级路径：从 Release 页面下载 zip，然后
`knowlery bundle install <本地文件>`。

## "Integrity check failed"

下载的字节与 `--verify` 校验和不匹配。可能原因：分享者在公布哈希后更新了资产、
链接指向了错误的资产、或传输被篡改。请分享者重新公布当前哈希；什么都没有被安装。

## 非 GitHub URL 返回 "Download failed: HTTP 404"

该 URL 没有直接返回文件。常见于网盘类服务的"分享链接"——它们打开的是网页而
不是文件，你需要的是能直接返回 zip 字节流的**直链**。
