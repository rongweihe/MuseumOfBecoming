# 收藏照片功能

默认面向单馆主，并保持 GitHub Pages 纯静态架构。图片保存在连接仓库的 public/uploads 目录，故事文本和图片引用保存在浏览器。上传凭证只在当前页面内存中保留。

功能包括：每件最多六张、本地预览与压缩、格式与容量限制、说明与排序、可选照片封面、详情照片组、放大及左右键浏览、旧备份迁移和新版图片引用恢复。

## 失败保护

- 选择图片只做本地处理，保存时才写入 GitHub。
- 串行上传避免 Contents 接口并发提交冲突。
- 每张成功后保存仓库引用，失败不增加正式馆藏、不播放揭幕。
- 重试复用已完成文件，网络结果不明确时通过路径与 Git blob SHA 核对，不覆盖不同内容。
- 固定提交 SHA 的图片链接在分支更新后仍然可用。
- 不自动删除仓库文件，移除照片只移除收藏里的引用。
- 备份明确限定主机、路径和提交格式，不接受任意图片 URL、SVG 或 HTML。

## 验收范围

2026-10-07：`npm test` 17 项全部通过，`npm run test:e2e` 13 项全部通过，TypeScript 检查、生产构建和 `git diff --check` 通过。

单元测试覆盖真实 base64 写入请求、哈希核对、重复上传复用、冲突重试、权限失败、私人仓库拒绝、断开连接、旧备份迁移和危险路径拒绝。

浏览器验收使用模拟 GitHub 接口，覆盖：选择与压缩、连接对话框不提交外层表单、照片上传与展示、无需登录的刷新展示、照片封面、灯箱左右键、照片引用导出导入、部分失败重试、带 Blob 草稿刷新恢复、360px 预览、格式与数量限制。未使用真实令牌，也没有向远程仓库写入测试照片。

真实仓库写入需由馆主在「连接图片仓库」填写有效的 fine-grained token：仅选择目标公开仓库，并授予 Contents Read and write，分支需允许直接提交。

## 预览截图

- [照片录入与预览](screenshots/05-photo-editor.png)
- [收藏详情照片组](screenshots/06-photo-exhibit.png)
- [360px 手机照片预览](screenshots/07-mobile-photo-preview.png)

参考：[GitHub Contents API](https://docs.github.com/en/rest/repos/contents)、[令牌权限设置](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)。
