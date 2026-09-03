# Command Code 一键汉化工具

将 Command Code 桌面应用（Windows 版）的界面从英文汉化为简体中文。

> 当前版本：词典 573 条词条，覆盖 8 个 UI 文件 + 主进程 + harness 配置包，实测替换 899 处。
> 工具只改安装目录内文件，**自动备份、一键还原**，可随时恢复英文原版。

## 快速使用

### 汉化
双击 **`汉化.bat`**，或命令行执行：

```bat
node localize.js apply
```

- 默认应用目录：`D:\commandcodedesktop\Command Code`
- 自定义目录：`node localize.js apply "D:\你的安装路径"`
- 汉化前会自动把原文件备份到 `backups\` 目录
- 汉化后**需完全退出并重启 Command Code** 生效

### 还原英文版
双击 **`还原.bat`**，或命令行执行：

```bat
node localize.js restore
```

从最近一次备份恢复全部文件。

### 查看状态

```bat
node localize.js status
```

## 工作原理

Command Code 是 Electron 应用，界面文字硬编码在打包后的 JS 文件中，没有语言包。本工具采用**词典驱动整串替换**：

1. 只处理应用自身的 UI 文件（renderer 的屏幕 chunk + 主进程 main/index.js +
   `node_modules/@commandcode/harness/dist/index.js`（Config 设置页文本源）），
   **跳过**语法高亮、图表（mermaid）、数学（KaTeX/Shiki）等第三方库 chunk；
2. 用 `dict.json` 中的中英对照词条（573 条）做精确整串匹配；
3. 替换带**标识符边界保护**：词条前后不得紧邻 `[A-Za-z0-9_$]`，
   避免把 `onToggleTerminal` 这类代码标识符误伤成 `onToggle终端`；
4. 词法感知：预扫描注释区间（`//` 行注释与 `/* */` 块注释，含正则/字符串/模板串
   状态机与协议 `://` 排除），**跳过注释内的文本**，只替换真正的字符串字面量；
5. 词典只收录**多词短语/完整句子**，不收 `Terminal`、`Search`、`Copy` 等
   易误伤的单英文词；
6. 每个文件替换后经 `node --check` 语法校验，并做中文污染扫描对比。

### 文件说明

| 文件 | 作用 |
| --- | --- |
| `汉化.bat` / `还原.bat` | 双击一键操作 |
| `localize.js` | 核心逻辑：apply / restore / status / dry |
| `dict.json` | 中英翻译词典（可自行增删词条） |
| `backups/` | 汉化前自动备份（按时间戳） |
| `tools/extract.js` | 扫描应用 JS 提取候选英文字符串（只读） |
| `tools/filter.js` | 从扫描报告过滤 UI 句子候选 |
| `tools/clean-dict.js` | 词典去重/清理 |
| `tools/boundary-test.js` | 边界替换逻辑单测 |

## 词典维护

`dict.json` 结构：

```json
{
  "meta": { ... },
  "terms": [
    { "from": "New chat", "to": "新建会话" },
    { "from": "Rename chat", "to": "重命名会话" }
  ]
}
```

新增词条注意事项：

- **只加多词短语或句子**（含空格），不加 `Save`、`Open` 这类单英文词；
- 不要翻译模型名（Claude Opus、GPT-5 等）、语言名、主题名、代码关键词；
- 词条必须是代码中完整的字符串字面量（可先跑 `tools/extract.js` 确认存在）；
- 词典内词条会自动按长度降序处理，长词条优先。

## 注意事项

- **应用更新会覆盖汉化**：官方更新后需重新运行汉化脚本（自动重新备份）；
- 汉化修改的是安装目录内的文件，属**可逆操作**，任何时刻可 restore；
- 建议在 Command Code **未运行**时执行汉化（运行中修改不影响当前进程，
  但退出重开前请确认修改已写入）；
- 词典未覆盖到的文字仍是英文，欢迎补充词条（见上方维护说明）。

## 为什么只翻译 500+ 条？

扫描发现全部候选英文字符串超过 4900 条，但绝大部分属于：
Zod 等库的多语言错误串、模型名清单、代码高亮语言/主题名、SVG path、
MathML 符号等。这些**不该翻译**（翻译会破坏功能）。本词典只收
人工确认的界面文案，追求"安全优先、无破坏"。
