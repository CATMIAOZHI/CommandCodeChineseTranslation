// 统计 harness/dist/index.js 中的配置 schema label（Config 页面文本源）
// 用法: node diag-harness.js [安装目录]（或设置环境变量 CC_APP_DIR）
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
if (!app) { console.error('用法: node diag-harness.js [安装目录]'); process.exit(1); }

const h = path.join(app, 'resources', 'app', 'node_modules', '@commandcode', 'harness', 'dist', 'index.js');
const s = fs.readFileSync(h, 'utf8');
console.log('harness size KB:', Math.round(s.length / 1024));

const labelRe = /label:\s*"([^"]{1,80})"/g;
const uniq = new Map();
let m;
while ((m = labelRe.exec(s))) {
  uniq.set(m[1], (uniq.get(m[1]) || 0) + 1);
}
const rows = [...uniq.entries()].sort((a, b) => b[1] - a[1]);
console.log('唯一 label 数:', rows.length);
for (const [k, v] of rows) console.log(v + 'x  ' + k);

const descRe = /description:\s*"([^"]{10,300})"/g;
let dcount = 0;
while (descRe.exec(s)) dcount++;
console.log('description 字段总数:', dcount);

const groupRe = /group:\s*"([^"]+)"/g;
const groups = new Map();
while ((m = groupRe.exec(s))) groups.set(m[1], (groups.get(m[1]) || 0) + 1);
console.log('group 值:', [...groups.entries()].map(([k, v]) => k + '(' + v + ')').join(', '));
