# renderer 索引

职责：

* 承载 React 界面层

当前目录文件：

* `README.md`
  * 当前目录索引
* `index.html`
  * renderer HTML 入口
* `index.tsx`
  * React 入口
  * 核心导出：无，负责挂载 `AppRoot`
* `vite-env.d.ts`
  * renderer 端类型声明，包含 `window.viboApp`

当前子目录：

* `app/`
  * 应用级装配与顶层状态
* `features/`
  * 按功能拆分的界面模块
* `icons/`
  * 文件图标主题、官方品牌资产与 agent 品牌标识
* `theme/`
  * 全局样式、design token 与 renderer appearance 应用层
