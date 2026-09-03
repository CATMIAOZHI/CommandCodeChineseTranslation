// 全量语法校验：对所有汉化目标文件跑 node --check
// 用法: node syntax-check.js [安装目录]
// 安装目录缺省时继承 localize.js 的自动探测逻辑（CC_APP_DIR / 常见位置）
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

function detectAppDir() {
  const candidates = [];
  if (process.env.CC_APP_DIR) candidates.push(process.env.CC_APP_DIR);
  if (process.env.LOCALAPPDATA) candidates.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'Command Code'));
  if (process.env.PROGRAMFILES) candidates.push(path.join(process.env.PROGRAMFILES, 'Command Code'));
  if (process.env['PROGRAMFILES(X86)']) candidates.push(path.join(process.env['PROGRAMFILES(X86)'], 'Command Code'));
  if (process.env.APPDATA) candidates.push(path.join(process.env.APPDATA, 'Command Code'));
  if (process.platform === 'darwin') candidates.push('/Applications/Command Code.app/Contents/Resources/app');
  if (process.platform === 'linux') candidates.push('/opt/Command Code');
  for (const drive of 'CDEFGH'.split('')) candidates.push(path.join(drive + ':\\', 'commandcodedesktop', 'Command Code'));
  for (const c of candidates) {
    if (!c) continue;
    try { if (fs.existsSync(path.join(c, 'resources', 'app', 'out', 'main', 'index.js'))) return c; } catch {}
  }
  return null;
}

const APP_DIR = process.argv[2] || detectAppDir();
if (!APP_DIR) {
  console.error('用法: node syntax-check.js [安装目录]（或设置环境变量 CC_APP_DIR）');
  process.exit(1);
}
const APP_RES_ROOT = path.join(APP_DIR, 'resources', 'app');
const OUT_DIR = path.join(APP_RES_ROOT, 'out');
const UI_CHUNK_RE = /^(workspace-screen|settings-panel|terminal-|source-panel|auth-screen|onboarding-screen|browser-panel)/;

const list = [];
const assets = path.join(OUT_DIR, 'renderer', 'assets');
if (fs.existsSync(assets)) {
  for (const f of fs.readdirSync(assets)) {
    if (!f.endsWith('.js')) continue;
    const base = f.replace(/\.js$/, '');
    if (UI_CHUNK_RE.test(base)) { list.push(path.join(assets, f)); continue; }
    if (base.startsWith('index-')) {
      const stat = fs.statSync(path.join(assets, f));
      if (stat.size > 700 * 1024) {
        const head = fs.readFileSync(path.join(assets, f), 'utf8').slice(0, 500);
        if (!/mermaid|shiki|textmate|oniguruma/i.test(head)) list.push(path.join(assets, f));
      }
    }
  }
}
const main = path.join(OUT_DIR, 'main', 'index.js');
if (fs.existsSync(main)) list.push(main);
const harness = path.join(APP_RES_ROOT, 'node_modules', '@commandcode', 'harness', 'dist', 'index.js');
if (fs.existsSync(harness)) list.push(harness);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-syntax-'));
let fail = 0;
list.forEach((src, i) => {
  const tmp = path.join(dir, 'f' + i + '.mjs');
  fs.copyFileSync(src, tmp);
  try {
    execSync(`node --check "${tmp}"`, { stdio: 'pipe' });
  } catch (e) {
    fail++;
    console.log('FAIL:', path.basename(src));
    console.log((e.stderr || '').toString().slice(0, 300));
  }
});
fs.rmSync(dir, { recursive: true, force: true });
console.log(fail === 0 ? `全部 ${list.length} 文件语法通过` : '失败 ' + fail);
process.exit(fail === 0 ? 0 : 1);
