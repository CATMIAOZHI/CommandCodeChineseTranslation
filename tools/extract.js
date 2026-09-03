// 汉化辅助：扫描 Command Code 打包产物中的候选 UI 字符串（只读，不改动应用）。
// 用法: node extract.js [安装目录] [输出json]
'use strict';
const fs = require('fs');
const path = require('path');

const APP_DIR = process.argv[2] || 'D:\\commandcodedesktop\\Command Code';
const OUT_FILE = process.argv[3] || path.join(__dirname, 'strings-report.json');

// 已知属于语法高亮/语言包的 chunk 前缀（无需翻译）
const NOISE_PREFIX = /^(abap|abnfDiagram|actionscript|ada|angular|apache|apex|apl|applescript|ara-|arc-|asciidoc|asm|astro|aurora|awk|ballerina|bat-|beancount|berry|bibtex|bicep|bird2|blade|blockDiagram|bsl|c3-|c4Diagram|cadence|cairo|catppuccin|channel|classDiagram|clarity|clojure|cmake|cobol|coffee|common-lisp|coq|cose-|cpp|crystal|css-|cue|cynefin|csv|cytoscape|d-85|dagre|dart|dax|defaultLocale|desktop-|diagram-|diff-|docker|dotenv|dracula|dream-maker|d-|ebnfDiagram|edge-|elixir|elm|emacs-lisp|erDiagram|erb-|erlang|everforest|fish-|flowDiagram|fluent|fortran|fsharp|ganttDiagram|gdresource|gdscript|gdshader|genie|gherkin|git-commit|git-rebase|gitGraphDiagram|gleam|glimmer|glsl|gn-|gnuplot|go-|graph-|graphql|groovy|gruvbox|hack-|haml|handlebars|haskell|haxe|hcl|highlighted-body|hjson|hlsl|horizon|houston|html-|http-|hurl|hxml|hy-|imba|infoDiagram|ini-|ishikawaDiagram|java-|javascript|jinja|jison|journeyDiagram|json|jssm|jsx-|julia|just-|kanagawa|kanban|katex|kdl|kotlin|kusto|laserwave|latex|layout-|lean-|less-|light-plus|linear|liquid|llvm|log-|logo-|lua|luau|make-|map-|markdown|marko|material-theme|matlab|mdc-|mdx|mermaid|mindmap|min-dark|min-light|mipsasm|mojo|monokai|moonbit|move-|narrat|nextflow|nginx|night-owl|nim-|nix-|nord-|nushell|objective-c|ocaml|odin-|one-dark|one-light|openscad|ordinal|pascal|pegDiagram|perl-|php-|pieDiagram|pierre|pkl-|plsql|plastic|po-|poimandres|polar-|postcss|powerquery|powershell|prisma|prolog|proto-|pug-|puppet|purescript|python|qml|qss-|quadrantDiagram|r-|racket|railroadDiagram|raku|razor|red-|reg-|regexp|rel-|requirementDiagram|riscv|ron-|rose-pine|rosmsg|rst-|ruby|rust|sankeyDiagram|sas-|sass|scala|scheme|scss|sdbl|sequenceDiagram|shaderlab|shellscript|shellsession|sizeCapture|slack-|smalltalk|snazzy|solarized|solidity|soy-|sparql|splunk|sql-|ssh-config|stateDiagram|stata-|stylus|surrealql|svelte|swift|swimlanes|synthwave|system-verilog|systemd|talonscript|tasl|tcl-|templ|terminal-settings|terraform|tex-|timeline-definition|tokyo-night|toml-|ts-tags|tsv-|tsx-|turtle|twig|typescript|typespec|typst|vala|vb-|vennDiagram|verilog|vesper|vhdl|viml-|vitesse|vue|vyper|wardleyDiagram|wasm-|wenyan|wgsl|wikitext|wit-|wolfram|xml-|xychartDiagram|yaml-|zenscript|zig-)/;

// 常见单字按钮/菜单词（无空格但也算 UI 文案）
const SHORT_UI_WORDS = new Set(('Ok OK Yes No Cancel Save Close Delete Copy Cut Paste Undo Redo Retry Submit Browse Done Back Next Skip Restart Reload Update Install Open Settings Search Clear Reset Apply Add Remove Enable Disable Allow Deny Accept Reject Continue Exit Quit Stop Start Pause Resume Refresh Name Type Size Date Path Error Warning Info Success Failed Loading Ready Sync Syncing Editing Viewing Creating Deleting Renaming Moving Downloading Uploading Sending Receiving Connecting Disconnected Connected Offline Online Default Custom Advanced Basic General Model Theme Font Layout Tools Help About Support Documentation License Terms Privacy New All None Auto Manual Local Remote File Folder Directory Chat Thread Message Title Body Content Text Code Image Audio Video Agent Task Todo Plan Mode Terminal Workspace Project Repository Branch Commit Issue Pull Review Test Build Run Debug Deploy Release Version Update Download Install Uninstall Login Logout Sign Signup Register Username Password Email Account Profile Avatar Billing Plan Team Member Role Admin Owner Editor Viewer Comment Mention Reaction Share Export Import Copy Link Link Name Description Summary Details Status Progress Percentage Count Total Length Width Height Color Background Foreground Accent Border Radius Margin Padding Position Left Right Top Bottom Center Middle Align Bold Italic Underline Strike Code Block Quote List Item Order Checkbox Radio Input Select Option Value Min Max Step Range Toggle Switch Button Icon Badge Tab Panel Popup Dialog Modal Toast Banner Card Row Column Grid Cell Table Header Footer Sidebar Toolbar Menu Item Action Trigger Shortcut Key Combo Group Sort Filter Search Query Result Match Replace Insert Delete Merge Split Move Up Down Increase Decrease Expand Collapse Show Hide Select All Deselect Invert Clear All Apply Reset Confirm Cancel Done').toLowerCase().split(/\s+/));

// 单字符扫描提取全部字符串字面量（含引号形式信息），不做启发式误判
function scanStrings(code) {
  const out = [];
  const n = code.length;
  let i = 0;
  while (i < n) {
    const ch = code[i];
    if (ch !== '"' && ch !== "'" && ch !== '`') { i++; continue; }
    const quote = ch;
    let j = i + 1;
    let raw = '';
    let closed = false;
    while (j < n) {
      const c = code[j];
      if (c === '\\') { raw += code.slice(j, j + 2); j += 2; continue; }
      if (c === quote) { closed = true; break; }
      raw += c; j++;
    }
    if (!closed) { i = Math.max(j, i + 1); continue; }
    // 转义还原
    let val;
    try {
      if (quote === '"') val = JSON.parse('"' + raw + '"');
      else if (quote === "'") val = raw.replace(/\\'/g, "'").replace(/\\\\/g, '\\').replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t');
      else val = raw;
    } catch { val = raw; }
    out.push({ val, quote, start: i, end: j + 1 });
    i = j + 1;
  }
  return out;
}

function looksLikeUi(val) {
  if (!val || val.length < 1 || val.length > 80) return false;
  if (/[\u4e00-\u9fff]/.test(val)) return false;            // 已是中文
  if (/^[\s\d\W_]+$/.test(val)) return false;               // 纯符号/数字
  if (/[a-zA-Z]/.test(val) === false) return false;
  // 排除技术形态
  if (/^(https?:|file:|data:|blob:|chrome-extension:|\/|\.\/|\.\.\/|\\|\$|#|\?)/.test(val)) return false;
  if (/\.(js|ts|jsx|tsx|json|css|html|png|svg|ico|woff2?|ttf|map|md|yml|yaml)$/i.test(val)) return false;
  if (/^[a-zA-Z_$][\w$]*(\.[a-zA-Z_$][\w$]*)+$/.test(val)) return false;  // a.b.c
  if (/^[a-zA-Z_$][\w$]*$/.test(val)) return SHORT_UI_WORDS.has(val.toLowerCase()); // 单标识符需在白名单
  if (/\s/.test(val) === false) {
    // 无空格: 只保留常见短词/键位说明/变量形态之外的内容
    return false;
  }
  // 含空格: 排除全小写命令句; 允许句子/标签
  const words = val.split(/\s+/).filter(Boolean);
  if (words.length > 12) return false;
  const first = words[0];
  if (/^[a-z0-9_$]/.test(first) && first === first.toLowerCase()) {
    // 小写开头，可能是代码/报错。但普通句也可能小写。仅排除明显代码形态
    if (/^[a-z][\w$]*$/.test(first) && words.length >= 2 && words.slice(1).every(w => /^[a-z][\w$]*$/.test(w) || /^[A-Z][a-zA-Z0-9]*$/.test(w))) {
      // 形如 "fooBar baz" 的标识符串排除，形如普通句子保留
      if (/^[a-z]+([A-Z][a-z]*)+$/.test(first)) return false;
    }
  }
  return true;
}

function main() {
  const outDir = path.join(APP_DIR, 'resources', 'app', 'out');
  if (!fs.existsSync(outDir)) {
    console.error('未找到应用 out 目录: ' + outDir);
    process.exit(1);
  }
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.js') && e.name !== 'index.js') files.push(p);
      else if (e.isFile() && (e.name === 'index.js')) files.push(p);
    }
  };
  // 只遍历 out/main 与 out/renderer/assets（跳过 preload 小文件与高亮包需要过滤，但 renderer/assets 里很多语法高亮 chunk——按 NOISE_PREFIX 排除）
  walk(path.join(outDir, 'main'));
  const assets = path.join(outDir, 'renderer', 'assets');
  for (const f of fs.readdirSync(assets)) {
    if (!f.endsWith('.js')) continue;
    const base = f.replace(/\.js$/, '');
    if (NOISE_PREFIX.test(base)) continue;
    files.push(path.join(assets, f));
  }

  const globalMap = new Map(); // val -> {count, files:{file:count}}
  for (const f of files) {
    let code;
    try { code = fs.readFileSync(f, 'utf8'); } catch { continue; }
    for (const s of scanStrings(code)) {
      if (!looksLikeUi(s.val)) continue;
      let e = globalMap.get(s.val);
      if (!e) { e = { count: 0, files: new Map() }; globalMap.set(s.val, e); }
      e.count++;
      e.files.set(path.basename(f), (e.files.get(path.basename(f)) || 0) + 1);
    }
  }

  const rows = [...globalMap.entries()].sort((a, b) => b[1].count - a[1].count);
  const report = rows.map(([val, info]) => ({
    text: val,
    count: info.count,
    files: Object.fromEntries([...info.files.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)),
  }));
  fs.writeFileSync(OUT_FILE, JSON.stringify(report, null, 2), 'utf8');
  console.log('扫描文件数: ' + files.length + ', 候选词条: ' + rows.length);
  console.log('报告已写出: ' + OUT_FILE);
}

main();
