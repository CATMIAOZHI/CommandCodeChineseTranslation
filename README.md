# Command Code 中文汉化工具

将 **Command Code 桌面应用**（Windows 版）的界面从英文汉化为简体中文。

> 词典 948 条词条，覆盖 renderer 各 UI 屏幕 + 主进程 + harness 配置包，
> 实测替换 1000+ 处。工具只修改安装目录内的文件，**自动备份、一键还原**。

## 快速使用

### 汉化

双击 **`汉化.bat`**，或命令行执行：

```bat
node localize.js apply
```

- 默认应用目录：`D:\commandcodedesktop\Command Code`
- 自定义目录：`node localize.js apply "D:\你的安装路径"`
- 汉化前自动把原文件备份到 `backups\` 目录（每次独立时间戳，可还原到任意历史版本）
- 汉化后**需完全退出并重启 Command Code** 生效

### 还原英文版

双击 **`还原.bat`**，或命令行执行：

```bat
node localize.js restore
```

从最近一次备份恢复全部文件。

### 查看状态 / 预演

```bat
node localize.js status
node localize.js dry        % 只打印将要替换的内容，不写入
```

## 工作原理

Command Code 是 Electron 应用，界面文字硬编码在打包后的 JS 文件中，没有语言包。
本工具采用**词典驱动整串替换**：

1. 只处理应用自身的 UI 文件：
   - `out/renderer/assets/` 下的界面 chunk（`workspace-screen-*`、`settings-panel-*`、
     `browser-panel-*`、`source-panel-*`、`auth-screen-*`、`onboarding-screen-*`、
     主 bundle `index-*.js`）
   - `out/main/index.js`（Electron 主进程：原生菜单、对话框、IPC 错误文案）
   - `node_modules/@commandcode/harness/dist/index.js`（Config 设置项 schema、权限弹窗选项）
   - **跳过**语法高亮（Shiki）、图表（mermaid）、日期（dayjs）、xterm 等第三方库 chunk；
2. 用 `dict.json` 的中英对照词条做精确整串匹配；
3. 替换带**标识符边界保护**：词条前后不得紧邻 `[A-Za-z0-9_$]`，
   避免把 `onToggleTerminal` 这类代码标识符误伤成 `onToggle终端`；
4. 词法感知：预扫描注释/字符串/模板串区间，**跳过注释内的文本**；
5. 每个文件替换后自动做语法校验（`node --check`）与中文污染扫描；
6. 词典只收录**多词短语/完整句子**，不收 `Terminal`、`Search` 等易误伤的单英文词。

### 文件说明

| 文件 | 作用 |
| --- | --- |
| `汉化.bat` / `还原.bat` | 双击一键操作 |
| `localize.js` | 核心逻辑：apply / restore / status / dry |
| `dict.json` | 中英翻译词典（948 条，可自行增删词条） |
| `backups/` | 汉化前自动备份（按时间戳，不入库） |
| `tools/extract.js` | 扫描应用 JS 提取候选英文字符串（只读） |
| `tools/filter.js` | 从扫描报告过滤 UI 句子候选 |
| `tools/clean-dict.js` | 词典去重/清理 |
| `tools/syntax-check.js` | 对改动文件批量语法校验 |
| `tools/boundary-test.js` | 边界替换逻辑测试 |

## 词典维护

`dict.json` 结构：

```json
{
  "meta": { "updated": "2026-09-03", "count": 948 },
  "terms": [
    { "from": "New chat", "to": "新建会话" },
    { "from": "Rename chat", "to": "重命名会话" }
  ]
}
```

新增词条注意事项：

- **只加多词短语或句子**（含空格），不加 `Save`、`Open` 这类单英文词；
- 不要翻译模型名（Claude Opus、DeepSeek 等）、主题/字体名、语言名、slash 命令名、
  CLI 工具 schema 描述；
- 词条必须是代码中完整的字符串字面量（先跑 `tools/extract.js` 确认存在，
  注意 minified 代码的精确写法：引号类型、是否带 `label:`/`title:` 前缀）；
- 词典内词条按长度降序处理，长词条优先匹配。

## 汉化范围与边界

已汉化（用户可见 GUI）：

- 设置页：分区标题、导航、MCP 表单、主题详情、快捷键表、账户/用量卡片
- 主工作区：会话列表状态/分组、视图菜单、回退/删除/停止等对话框、toast、
  终端任务状态、更新横幅、命令面板
- 内置浏览器设计面板：样式工具栏、浏览器工具栏、空态说明
- 文件树：Git 状态说明、搜索占位
- 主进程：原生应用菜单、更新对话框、链接预览拦截提示、IPC 错误文案
- harness：Config 设置项、权限弹窗选项、计划模式/视觉引导选择器

刻意不翻译：

- 模型/品牌/主题/字体名、语言名、快捷键键值（`CmdOrCtrl+O` 等）
- slash 命令名与 CLI/工具 schema 描述（`/help` 的终端帮助）
- 第三方库内部（zod 多语言错误、xterm、mermaid、Shiki、dayjs 等）
- SVG path、代码标识符、内部日志

## 注意事项

- **应用更新会覆盖汉化**：官方更新后需重新运行汉化脚本；
- 汉化修改的是安装目录内的文件，属**可逆操作**，任何时刻可 `restore`；
- 建议在 Command Code **未运行**时执行汉化；
- 词典未覆盖到的文字仍是英文，欢迎补充词条（见上方维护说明）。

## 免责声明

本项目为个人使用的非官方汉化工具，与 Command Code 官方无关。
修改的是本地安装文件，请在理解风险的前提下使用。
