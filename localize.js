// Command Code 桌面版 一键汉化器（核心逻辑，Node 实现）
// 用法:
//   node localize.js apply    [安装目录]   应用词典汉化（先自动备份）
//   node localize.js restore  [安装目录]   从最近备份还原
//   node localize.js status   [安装目录]   查看汉化/备份状态
//   node localize.js dry      [安装目录]   试运行，只报告将替换多少处
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const APP_DEFAULT = 'D:\\commandcodedesktop\\Command Code';
const APP_DIR = process.argv[3] || APP_DEFAULT;
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
const UI_CHUNK_RE = /^(workspace-screen|settings-panel|terminal-|source-panel|auth-screen|onboarding-screen|browser-panel)/;

// 备份/还原时的相对基准目录(resources/app)
const APP_RES_ROOT = path.join(APP_DIR, 'resources', 'app');

function targetFiles() {
  const files = [];
  const assets = path.join(OUT_DIR, 'renderer', 'assets');
  if (fs.existsSync(assets)) {
    for (const f of fs.readdirSync(assets)) {
      if (!f.endsWith('.js')) continue;
      const base = f.replace(/\.js$/, '');
      // 屏幕级 UI chunk（白名单前缀）
      if (UI_CHUNK_RE.test(base)) { files.push(path.join(assets, f)); continue; }
      // index-* 主入口: 只收录真正含应用 UI 的(体积>700KB 且非语言/图表库)
      if (base.startsWith('index-')) {
        const code = fs.readFileSync(path.join(assets, f), 'utf8');
        const stat = fs.statSync(path.join(assets, f));
        if (stat.size > 700 * 1024 && !/mermaid|shiki|textmate|oniguruma/i.test(code.slice(0, 500))) {
          files.push(path.join(assets, f));
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

// 计算目标文件相对 resources/app 的路径(用于备份目录)
function relPath(f) {
  const rel = path.relative(APP_RES_ROOT, f);
  return rel.startsWith('..') ? path.basename(f) : rel;
}

function dict() {
  return JSON.parse(fs.readFileSync(DICT_PATH, 'utf8')).terms;
}

function isChineseApp() {
  // 统计连续的 2+ 中文字符片段数量（排除 KaTeX/Unicode 数学符号等零星字符）
  for (const f of targetFiles()) {
    try {
      const s = fs.readFileSync(f, 'utf8');
      const runs = (s.match(/[\u4e00-\u9fff]{2,}/g) || []).length;
      if (runs > 200) return true;
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

function cmdRestore() {
  const list = findBackups();
  if (list.length === 0) { console.log('没有找到备份，无法还原。'); return; }
  const latest = path.join(BACKUP_ROOT, list[0]);
  console.log('使用备份: ' + latest);
  let restored = 0;
  for (const f of targetFiles()) {
    // 新备份以 resources/app 为基准; 兼容旧备份(以 out 为基准, 即去掉 out/ 前缀)
    let src = path.join(latest, relPath(f));
    if (!fs.existsSync(src)) {
      const relOut = path.relative(OUT_DIR, f);
      if (!relOut.startsWith('..')) {
        const alt = path.join(latest, relOut);
        if (fs.existsSync(alt)) src = alt;
      }
    }
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, f);
      restored++;
    } else {
      console.log('  警告: 备份中缺少 ' + path.basename(f) + '，跳过');
    }
  }
  console.log(`已还原 ${restored} 个文件。`);
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
switch (cmd) {
  case 'apply': cmdApply(); break;
  case 'restore': cmdRestore(); break;
  case 'dry': cmdDry(); break;
  case 'status': cmdStatus(); break;
  default:
    console.log('用法: node localize.js <apply|restore|status|dry> [安装目录]');
}
