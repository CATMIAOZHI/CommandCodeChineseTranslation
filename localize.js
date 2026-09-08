// Command Code 桌面版 一键汉化器（核心逻辑，Node 实现）
// 用法:
//   node localize.js apply    [安装目录]   应用词典汉化（先自动备份）
//   node localize.js restore  [安装目录]   从最近备份还原
//   node localize.js status   [安装目录]   查看汉化/备份状态
//   node localize.js dry      [安装目录]   试运行，只报告将替换多少处
//
// 安装目录解析优先级（后两者为空/失败时依次回退）:
//   1. 命令行参数: node localize.js apply "D:\path\to\Command Code"
//   2. 环境变量:   set CC_APP_DIR=D:\path\to\Command Code
//   3. 自动探测:   遍历常见安装位置（Program Files、AppData、D:\commandcodedesktop 等），
//                  匹配含 resources\app\out\main\index.js 特征的目录
//   4. 显式报错并提示传入路径
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// 常见安装位置候选（按平台）。命中条件为存在 Command Code 的 Electron 应用特征文件。
function detectAppDir() {
  const candidates = [];
  if (process.env.CC_APP_DIR) candidates.push(process.env.CC_APP_DIR);
  if (process.env.LOCALAPPDATA) candidates.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'Command Code'));
  if (process.env.PROGRAMFILES) candidates.push(path.join(process.env.PROGRAMFILES, 'Command Code'));
  if (process.env['PROGRAMFILES(X86)']) candidates.push(path.join(process.env['PROGRAMFILES(X86)'], 'Command Code'));
  if (process.env.APPDATA) candidates.push(path.join(process.env.APPDATA, 'Command Code'));
  if (process.platform === 'darwin') candidates.push('/Applications/Command Code.app/Contents/Resources/app');
  if (process.platform === 'linux') candidates.push('/opt/Command Code');
  // Windows 常见自定义安装盘（cdef...）下的 commandcodedesktop 目录
  for (const drive of 'CDEFGH'.split('')) {
    candidates.push(path.join(drive + ':\\', 'commandcodedesktop', 'Command Code'));
  }
  for (const c of candidates) {
    if (!c) continue;
    try {
      if (fs.existsSync(path.join(c, 'resources', 'app', 'out', 'main', 'index.js'))) return c;
    } catch {}
  }
  // 兜底：在常见根目录下找 commandcodedesktop/Command Code（如果上述盘符路径没拼对）
  return null;
}

const APP_DIR = process.argv[3] || detectAppDir();
const OUT_DIR = path.join(APP_DIR, 'resources', 'app', 'out');
const BACKUP_ROOT = path.join(__dirname, 'backups');
const DICT_PATH = path.join(__dirname, 'dict.json');

// 目标文件: 应用自有 UI 的 renderer chunk + main + harness 配置 schema。
// 白名单前缀(排除语法高亮/图表/数学等第三方库 chunk):
//   index-* (主 bundle, 但 index-Bxgrt3DT/mermaid、index-DqxT88dM/shiki 等库会被内容特征排除)
//   workspace-screen-* settings-panel-* terminal-* source-panel-*
//   auth-screen-* onboarding-screen-* browser-panel-*
// main/index.js 恒为应用主进程。
// harness/dist/index.js: Config 设置页文本源(label/description schema)。
//
// 应用更新后旧版本 chunk 会残留在 assets 目录中。同前缀多文件时
// 只取 mtime 最新的（当前激活版本），避免对已废弃的旧文件重复操作。
const UI_CHUNK_RE = /^(workspace-screen|settings-panel|terminal-|source-panel|auth-screen|onboarding-screen|browser-panel)/;

// assets 下同 UI 前缀的最新文件（升级后旧 chunk 残留时只取当前版本）
function newestByPrefix(assets) {
  const prefixes = ['workspace-screen', 'settings-panel', 'browser-panel', 'source-panel',
    'auth-screen', 'onboarding-screen', 'terminal', 'index'];
  const byPrefix = new Map();
  for (const prefix of prefixes) {
    let best = null;
    for (const f of fs.readdirSync(assets)) {
      if (!f.startsWith(prefix + '-') && !f.startsWith(prefix + '.')) continue;
      if (!f.endsWith('.js')) continue;
      const full = path.join(assets, f);
      const stat = fs.statSync(full);
      if (!best || stat.mtimeMs > best.mtime) best = { file: full, mtime: stat.mtimeMs };
    }
    if (best) byPrefix.set(prefix, best.file);
  }
  return [...byPrefix.values()];
}

function targetFiles() {
  const files = [];
  const assets = path.join(OUT_DIR, 'renderer', 'assets');
  if (fs.existsSync(assets)) {
    // 1) 每个 UI 前缀只取最新文件（避免旧版残留干扰）
    for (const f of newestByPrefix(assets)) {
      const base = path.basename(f);
      if (UI_CHUNK_RE.test(base)) { files.push(f); continue; }
      // index-* 主入口: 只收录真正含应用 UI 的(体积>700KB 且非语言/图表库)
      if (base.startsWith('index-')) {
        const code = fs.readFileSync(f, 'utf8');
        const stat = fs.statSync(f);
        if (stat.size > 700 * 1024 && !/mermaid|shiki|textmate|oniguruma/i.test(code.slice(0, 500))) {
          files.push(f);
        }
      }
    }
  }
  const main = path.join(OUT_DIR, 'main', 'index.js');
  if (fs.existsSync(main)) files.push(main);
  // harness 包: Config 设置页 schema 文本源
  const harness = path.join(APP_DIR, 'resources', 'app', 'node_modules', '@commandcode', 'harness', 'dist', 'index.js');
  if (fs.existsSync(harness)) files.push(harness);
  return files;
}

// 备份/还原时的相对基准目录(resources/app)
const APP_RES_ROOT = path.join(APP_DIR, 'resources', 'app');

// 计算目标文件相对 resources/app 的路径(用于备份目录)
function relPath(f) {
  const rel = path.relative(APP_RES_ROOT, f);
  return rel.startsWith('..') ? path.basename(f) : rel;
}

function dict() {
  return JSON.parse(fs.readFileSync(DICT_PATH, 'utf8')).terms;
}

function isChineseApp() {
  // 统计简体中文 UI 特征。仅统计 CJK 片段会误伤 zod 等库的日文 locale 数据
  // （日文假名在 U+3040–30FF 区，但日文汉字与中文同区）。这里要求片段含
  // 简体中文高频用字（的/了/是/在/与/这/进/请 等），或片段总量显著超过
  // 日文 locale 规模（zod 日文约 200 段，但整文件中文会轻松上千段）。
  for (const f of targetFiles()) {
    try {
      const s = fs.readFileSync(f, 'utf8');
      const runs = (s.match(/[\u4e00-\u9fff]{2,}/g) || []).length;
      if (runs > 200) {
        // 简体特征字（日文 locale 几乎不含这些简体字）
        const zhCount = (s.match(/[的了是在与进这请会话文件设置打开发送取消确认删除保存新增管理需要可以内容模式工具命令]/g) || []).length;
        // 日文假名（zod ja locale 的特征）
        const jaCount = (s.match(/[\u3040-\u30ff]/g) || []).length;
        // 简体字多且假名少 → 真汉化；假名多 → 日语 locale（如 zod ja/zh-TW 变体）
        if (zhCount > 100 && jaCount < zhCount) return true;
      }
    } catch {}
  }
  return false;
}

function findBackups() {
  if (!fs.existsSync(BACKUP_ROOT)) return [];
  return fs.readdirSync(BACKUP_ROOT)
    .filter((d) => d.startsWith('backup-'))
    .sort()
    .reverse();
}

function backupDirName() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return `backup-${ts}`;
}

function doBackup() {
  const dir = path.join(BACKUP_ROOT, backupDirName());
  fs.mkdirSync(dir, { recursive: true });
  for (const f of targetFiles()) {
    const rel = relPath(f);
    const dest = path.join(dir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(f, dest);
  }
  return dir;
}

// 扫描 JS 中注释区间(行注释 // 与块注释 /* */)，返回 [start,end] 数组(半开区间)。
// 简易词法: 需跳过字符串/模板串/正则字面量内的 // 与 /*，避免误判。
// 正则识别用启发式: / 前一个有效字符为 ( , = : [ ! & | ? { } ; 等(或行首)则视为正则。
function scanComments(code) {
  const ranges = [];
  const n = code.length;
  let i = 0;
  let state = 'code'; // code | line | block | str | tpl | regex
  let strQuote = '';
  let start = 0;
  const isRegexStart = (pos) => {
    let j = pos - 1;
    while (j >= 0 && /\s/.test(code[j])) j--;
    if (j < 0) return true;
    const c = code[j];
    return '([{:;,=!?&|+-*%^~<>'.includes(c);
  };
  while (i < n) {
    const c = code[i];
    const nx = code[i + 1];
    if (state === 'code') {
      // // 行注释(排除协议:// )
      if (c === '/' && nx === '/' && code[i - 1] !== ':') { state = 'line'; start = i; i += 2; continue; }
      if (c === '/' && nx === '*') { state = 'block'; start = i; i += 2; continue; }
      if (c === '/' && isRegexStart(i)) { state = 'regex'; i++; continue; }
      if (c === '"' || c === "'") { state = 'str'; strQuote = c; i++; continue; }
      if (c === '`') { state = 'tpl'; i++; continue; }
      i++;
    } else if (state === 'line') {
      if (c === '\n') { ranges.push([start, i]); state = 'code'; }
      i++;
    } else if (state === 'block') {
      if (c === '*' && nx === '/') { ranges.push([start, i + 2]); state = 'code'; i += 2; continue; }
      i++;
    } else if (state === 'str') {
      if (c === '\\') { i += 2; continue; }
      if (c === strQuote) state = 'code';
      i++;
    } else if (state === 'regex') {
      if (c === '\\') { i += 2; continue; }
      if (c === '/') { state = 'code'; } // 正则结束(忽略 flags)
      // 正则含换行不常见, 若跨行则保守结束避免吞代码
      else if (c === '\n') { state = 'code'; }
      i++;
    } else if (state === 'tpl') {
      if (c === '\\') { i += 2; continue; }
      if (c === '`') state = 'code';
      i++;
    }
  }
  if (state === 'line') ranges.push([start, n]);
  return ranges;
}

function applyOnce(dry) {
  const terms = dict();
  const files = targetFiles();
  const report = { files: {}, totalReplaced: 0, appliedTerms: 0, missedTerms: [] };

  // 转义正则特殊字符
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  for (const f of files) {
    let code;
    try { code = fs.readFileSync(f, 'utf8'); } catch (e) { console.error('无法读取', f, e.message); continue; }
    let replaced = 0;
    // 注释区间(基于原 code, 偏移与下方一次大替换的回调 offset 一致)
    const comments = scanComments(code);
    const inComment = (pos) => {
      for (const [s, e] of comments) {
        if (pos >= s && pos < e) return true;
        if (pos < s) return false;
      }
      return false;
    };
    // 单次交替正则(按长度降序保证长词条优先), 一次替换保证偏移一致
    const sorted = [...terms].sort((a, b) => b.from.length - a.from.length);
    const applied = new Map(); // from -> 命中次数
    const re = new RegExp(sorted.map((t) => esc(t.from)).join('|'), 'g');
    const changed = code.replace(re, (match, offset) => {
      // 标识符边界(词条自身两侧) 与 注释跳过
      const before = offset > 0 ? code[offset - 1] : '';
      const afterEnd = offset + match.length;
      const after = afterEnd < code.length ? code[afterEnd] : '';
      if (/[A-Za-z0-9_$]/.test(before) || /[A-Za-z0-9_$]/.test(after)) return match;
      if (inComment(offset)) return match;
      const term = sorted.find((t) => t.from === match);
      if (!term) return match;
      applied.set(term.from, (applied.get(term.from) || 0) + 1);
      return term.to;
    });
    for (const [from, cnt] of applied) {
      replaced += cnt;
      report.appliedTerms++;
      if (!report.files[path.basename(f)]) report.files[path.basename(f)] = { replaced: 0, terms: [] };
      report.files[path.basename(f)].replaced += cnt;
      report.files[path.basename(f)].terms.push(from);
    }
    if (changed !== code) {
      if (!dry) {
        fs.writeFileSync(f, changed, 'utf8');
      }
      const tag = relPath(f).replace(/\\/g, '/');
      console.log(`  ${dry ? '[试运行] ' : ''}${tag}: ${replaced} 处`);
    }
  }
  report.totalReplaced = Object.values(report.files).reduce((a, x) => a + x.replaced, 0);
  return report;
}

function cmdApply() {
  if (isChineseApp()) {
    console.log('检测到目标文件已包含大量中文（可能已汉化）。如需重新汉化请先执行 restore 还原。');
    process.exitCode = 2;
    return;
  }
  // 提醒先退出正在运行的应用
  if (process.platform === 'win32') {
    try {
      const out = execSync('tasklist /FI "IMAGENAME eq Command Code.exe" /FO CSV /NH', { encoding: 'utf8' });
      if (/Command Code\.exe/.test(out)) {
        console.log('提示: 检测到 Command Code 正在运行。建议先退出应用再汉化，汉化会在重启应用后生效。');
      }
    } catch {}
  }
  console.log('扫描目标文件…');
  const files = targetFiles();
  console.log('目标文件数: ' + files.length);
  console.log('词典词条数: ' + dict().length);
  const backup = doBackup();
  console.log('已备份原文件到: ' + backup);
  const report = applyOnce(false);
  console.log(`\n完成！共替换 ${report.totalReplaced} 处，涉及 ${report.appliedTerms} 个词条。`);
  console.log('请重启 Command Code 查看效果。如需还原: node localize.js restore');
}

// 简体字特征计数(用于识别备份里的英文原版/汉化中间态;
// settings 等 chunk 内嵌 zod 中文 locale, 故不设固定阈值, 而同文件比较取最少者)
function zhFeatureCount(code) {
  return (code.match(/[的了是在与进这请会话文件设置打开发送取消确认删除保存新增管理需要可以内容模式工具命令]/g) || []).length;
}

// 在备份目录中定位某目标文件的副本(兼容旧备份的 out 相对布局)
function backupCopyPath(dir, f) {
  const p1 = path.join(BACKUP_ROOT, dir, relPath(f));
  if (fs.existsSync(p1)) return p1;
  const relOut = path.relative(OUT_DIR, f);
  if (!relOut.startsWith('..')) {
    const p2 = path.join(BACKUP_ROOT, dir, relOut);
    if (fs.existsSync(p2)) return p2;
  }
  const p3 = path.join(BACKUP_ROOT, dir, path.basename(f));
  return fs.existsSync(p3) ? p3 : null;
}

function cmdRestore() {
  const dirs = findBackups(); // 已按时间倒序
  if (dirs.length === 0) { console.log('没有找到备份，无法还原。'); return; }
  const files = targetFiles();
  const assets = path.join(OUT_DIR, 'renderer', 'assets');
  // 当前激活的 renderer 文件名集合(用于判定备份是否同 build)
  let active = [];
  try { active = fs.readdirSync(assets); } catch {}
  const sameBuild = (dir) => {
    const ad = path.join(BACKUP_ROOT, dir, 'out', 'renderer', 'assets');
    try {
      const names = fs.readdirSync(ad);
      return active.some((a) => names.includes(a));
    } catch { return false; }
  };
  let restored = 0, skipped = 0;
  for (const f of files) {
    const isChunk = path.dirname(f) === assets;
    // 逐文件从"同 build 且英文原版"的备份中取副本:
    // 应用更新/稀疏备份/汉化中间态都会留下干扰项, 这里取简体字特征最少的那个
    let best = null; // { src, zh }
    for (const dir of dirs) {
      const p = backupCopyPath(dir, f);
      if (!p) continue;
      if (isChunk && path.basename(p) !== path.basename(f)) continue; // 旧版 chunk 文件名不同
      if (!isChunk && !sameBuild(dir)) continue; // 主进程/harness 需同 build 的备份目录
      const zh = zhFeatureCount(fs.readFileSync(p, 'utf8'));
      if (!best || zh < best.zh) best = { src: p, zh };
    }
    if (!best) {
      console.log('  警告: 备份中没有可用于还原 ' + path.basename(f) + ' 的同版本文件，跳过');
      skipped++;
      continue;
    }
    if (best.zh > 100) {
      console.log('  警告: ' + path.basename(f) + ' 的备份均为汉化后状态(特征字 ' + best.zh + ')，无法还原英文版，跳过');
      skipped++;
      continue;
    }
    fs.copyFileSync(best.src, f);
    restored++;
  }
  console.log(`已还原 ${restored} 个文件。` + (skipped ? `（跳过 ${skipped} 个，详见上方警告）` : ''));
}

function cmdStatus() {
  console.log('应用目录: ' + APP_DIR);
  console.log('备份: ' + (findBackups().length ? findBackups().map((d) => path.join(BACKUP_ROOT, d)).join('\n  ') : '无'));
  const cn = isChineseApp();
  console.log('汉化状态: ' + (cn ? '已汉化' : '未汉化（英文原版）'));
}

function cmdDry() {
  const report = applyOnce(true);
  console.log(`\n[试运行] 将替换 ${report.totalReplaced} 处，涉及 ${report.appliedTerms} 个词条。未写入任何文件。`);
}

const cmd = process.argv[2] || 'status';
if (!APP_DIR || !fs.existsSync(path.join(APP_DIR, 'resources', 'app', 'out', 'main', 'index.js'))) {
  console.error('未找到 Command Code 安装目录。请通过以下任一方式指定:');
  console.error('  1. 命令行参数: node localize.js ' + cmd + ' "D:\\path\\to\\Command Code"');
  console.error('  2. 环境变量:   set CC_APP_DIR=D:\\path\\to\\Command Code');
  process.exit(1);
}
switch (cmd) {
  case 'apply': cmdApply(); break;
  case 'restore': cmdRestore(); break;
  case 'dry': cmdDry(); break;
  case 'status': cmdStatus(); break;
  default:
    console.log('用法: node localize.js <apply|restore|status|dry> [安装目录]');
}
