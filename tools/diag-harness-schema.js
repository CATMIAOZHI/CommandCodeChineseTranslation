// 提取 harness 中 Config schema 文本(label/description/选项)及附近 UI 句子，供词典扩充
// 用法: node diag-harness-schema.js [安装目录]（或设置环境变量 CC_APP_DIR）
'use strict';
const fs = require('fs');
const path = require('path');

function detectAppDir() {
  if (process.env.CC_APP_DIR) return process.env.CC_APP_DIR;
  const candidates = [];
  if (process.env.LOCALAPPDATA) candidates.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'Command Code'));
  if (process.env.PROGRAMFILES) candidates.push(path.join(process.env.PROGRAMFILES, 'Command Code'));
  for (const drive of 'CDEFGH'.split('')) candidates.push(path.join(drive + ':\\', 'commandcodedesktop', 'Command Code'));
  for (const c of candidates) {
    try { if (fs.existsSync(path.join(c, 'resources', 'app', 'node_modules', '@commandcode', 'harness', 'dist', 'index.js'))) return c; } catch {}
  }
  return null;
}
const app = process.argv[2] || detectAppDir();
if (!app) { console.error('用法: node diag-harness-schema.js [安装目录]'); process.exit(1); }

const h = path.join(app, 'resources', 'app', 'node_modules', '@commandcode', 'harness', 'dist', 'index.js');
const s = fs.readFileSync(h, 'utf8');

// 1) 所有 schema 块: 从 { id: "xxx" 开始到最近的 group: "..." 截断
const out = [];
let idx = 0;
const idRe = /\{\s*id:\s*"([^"]+)"/g;
let m;
while ((m = idRe.exec(s))) {
  const start = m.index;
  const endMark = s.indexOf('\n    read:', start);
  const end = endMark === -1 ? start + 1200 : endMark;
  const chunk = s.slice(start, end);
  const label = chunk.match(/label:\s*"((?:[^"\\]|\\.)*)"/);
  const desc = chunk.match(/description:\s*"((?:[^"\\]|\\.)*)"/);
  const group = chunk.match(/group:\s*"([^"]+)"/);
  const kind = chunk.match(/kind:\s*"([^"]+)"/);
  const options = chunk.match(/options:\s*([A-Za-z_$][\w$]*)/);
  out.push({ id: m[1], label: label?.[1], desc: desc?.[1], group: group?.[1], kind: kind?.[1], optionsVar: options?.[1] });
}

// 2) 收集 options 变量定义(如 COMPACT_MODE_OPTIONS = [{label,value}...])
const optNames = new Set(out.map((o) => o.optionsVar).filter(Boolean));
const optBlocks = [];
for (const name of optNames) {
  const re = new RegExp('(?:const|let|var)\\s+' + name + '\\s*=\\s*(\\[[\\s\\S]{0,2000}?\\n\\s*\\]);', 'g');
  let mm;
  while ((mm = re.exec(s))) {
    const optRe = /\{?\s*label:\s*"((?:[^"\\]|\\.)*)"/g;
    let om;
    const labels = [];
    while ((om = optRe.exec(mm[1]))) labels.push(om[1]);
    if (labels.length) optBlocks.push({ name, labels });
  }
}

console.log('=== schema 项 (' + out.length + ') ===');
for (const o of out) {
  console.log(`\n[${o.group}/${o.kind}] id=${o.id}`);
  if (o.label) console.log('  label: ' + o.label);
  if (o.desc) console.log('  desc:  ' + o.desc.slice(0, 250));
}
console.log('\n\n=== 选项定义 (' + optBlocks.length + ') ===');
for (const ob of optBlocks) {
  console.log('\n' + ob.name + ':');
  for (const l of ob.labels) console.log('  - ' + l);
}

fs.writeFileSync(__dirname + '/../tools/harness-schema.txt', [
  '=== schema 项 ===',
  ...out.map((o) => `[${o.group}/${o.kind}] ${o.id}\n  label: ${o.label ?? '-'}\n  desc:  ${o.desc ?? '-'}`),
  '\n=== 选项 ===',
  ...optBlocks.flatMap((ob) => [ob.name + ':', ...ob.labels.map((l) => '  - ' + l)]),
].join('\n'), 'utf8');
