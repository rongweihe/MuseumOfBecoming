# 来时路 · Museum of Becoming

**那些走过的路，正在成为你。**

一座个人经历的数字展馆。将困难、行动、结果和意义留成藏品，在疲惫时重新看见自己走过的路。第一版是纯前端应用，没有账号、后端、线上 AI、分析 SDK 或故事上传。

## 本地运行

需要 Node.js **22.12+**（推荐 Node 22 最新补丁版）。

```bash
npm ci
npm run dev
```

打开终端显示的本地地址，默认 `http://127.0.0.1:5173/`。

```bash
npm run build      # TypeScript 检查及生产构建，输出 dist/
npm run preview    # 预览生产构建
npm test           # 数据校验与 IndexedDB 事务测试
npm run test:e2e   # 浏览器流程与截图验收；先构建生产包
npm run format    # 整理源码格式
```

浏览器验收优先使用本机 Chrome；也可运行 `npx playwright install chromium` 安装测试浏览器。开发服务由 Playwright 自动启动，也可复用正在运行的 5173 服务。测试使用独立临时浏览器，不会读取或修改你的真实馆藏。

## 开始收藏

1. 首次打开的是**演示展馆**：六段固定日期的虚构故事，明确标注且只读。
2. 点击「建立我的展馆」，写下馆主名和可选馆序，进入空馆藏。
3. 点击「收藏一个瞬间」，只需标题、日期和结果，即可收入馆藏。
4. 选择五款内置 SVG 物件和三款配色；可补充背景、困难、行动、意义、证据与信笺。
5. 新建保存成功后揭幕；编辑不会重复揭幕。精选最多三件，满额时需明确替换一件。
6. 随时通过搜索、主题、时间长廊或「随便看看」重访。

日期支持某天或某月，不会把月精度记录显示成假定的某一天。所有记录渲染为纯文本；证据链接只接受 HTTPS，也不会自动访问。

## 数据与恢复

个人配置和正式馆藏保存在当前**同源浏览器的 IndexedDB**。草稿单独存储，450ms 自动保存，未收入馆藏不会影响计数。离开表单可继续、保留或明确丢弃草稿；无法保存时可以下载草稿文本。

**本地存储不是跨设备同步。换设备前，请导出备份。** 更换域名、协议、端口、设备或浏览器不会带来原有记录；清除站点数据可能丢失馆藏。展品链接只能定位当前浏览器的记录，不是分享链接。浏览器存储不可用时，页面明确进入临时模式，需要及时导出；不会声称已永久保存。

「数据与备份」可导出可读 JSON，包含馆主、正式馆藏与精选，不包含草稿或演示。导入只支持**整体恢复**：先验证并展示预览，再由你确认替换，也可以先备份当前馆藏。文件上限 5 MiB、1000 件展品。校验涵盖版本、字段、长度、真实日历日期、枚举、UUID、ID 唯一性、精选引用和 HTTPS 链接。未知字段不进入应用。完整事务成功后才更新页面；失败保留现有数据。

如果启用了浏览器的临时模式，收藏只保存在本次页面的内存中。请先导出 JSON，恢复存储权限后重新打开应用，再导入恢复。

## GitHub Pages

工作流已准备在 `.github/workflows/pages.yml`，**没有执行发布或推送**。它只通过 `workflow_dispatch` 手动运行，不会因为提交自动发布。

准备发布时：

1. 将源码放入你确认的 GitHub 仓库。
2. 在仓库 **Settings → Pages → Build and deployment** 选择 **GitHub Actions**。
3. 在 **Actions → Deploy Museum of Becoming → Run workflow** 明确触发发布。
4. 项目站点地址为 `https://<用户名>.github.io/<实际仓库名>/`；用户主页仓库则为根路径。

Vite 的 `base: './'` 使用相对资源路径，因此无需硬编码仓库名。所有路由为 hash，如 `#/museum`、`#/exhibit/<UUID>`、`#/timeline`、`#/settings`，静态部署直达和刷新都无需重写。浏览器验收会把生产文件放在 `/Museum_of_Becoming/` 路径下检查资源与 hash 详情刷新。

工作流构建任务只读仓库，部署任务单独获得 `pages: write`、`id-token: write`。不要把真实故事或备份文件提交进仓库；公开页面包含的只有程序和虚构演示。私有仓库不能替代网页访问控制。

## 项目结构

```text
src/
  App.tsx                 导航、演示隔离、草稿流程和收藏状态
  model.ts                模型、日期、搜索和备份校验
  storage.ts              IndexedDB 持久化与原子事务
  demo.ts                 六件只读虚构展品
  components/
    Artifact.tsx          五款可信内置 SVG 藏品
    Card.tsx              物件卡片与铭牌
    ExhibitForm.tsx       低负担录入与即时预览
    Settings.tsx          馆主设置、备份导入导出
    Modal.tsx             原生 dialog 与焦点恢复
  styles.css              响应式展馆空间、聚光和减少动态效果
```

关键状态、边界条件和失败保护使用中文注释。依赖采用精确版本，`package-lock.json` 固定安装结果。

## 验收与截图

见 [验收记录](docs/acceptance.md)。四张截图在 `docs/screenshots/`：

- [桌面展厅](docs/screenshots/01-desktop-museum.png)
- [桌面展品详情](docs/screenshots/02-desktop-exhibit.png)
- [360px 手机展厅](docs/screenshots/03-mobile-museum.png)
- [新建收藏揭幕](docs/screenshots/04-new-exhibit-unveiling.png)

后续候选功能（纪念卡、图片附件、跨设备同步、私密分享、AI 整理）不属于本版。

参考：[Vite](https://vite.dev/guide/)、[React](https://react.dev/reference/react)、[IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB)、[GitHub Pages 工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。
