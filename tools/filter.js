// 辅助: 从 strings-report.json 过滤出候选 UI 句子到 ui-candidates.txt
// 用法: node filter.js [模式] 模式: ui(默认)/all
'use strict';
const fs = require('fs');
const path = require('path');

const report = require(path.join(__dirname, 'strings-report.json'));
const mode = process.argv[2] || 'ui';
const BAD = /[{}()[\]<>=/;:`$@#*+&|!%^~\\"]/;

function keep(t) {
  if (!t || t.length < 3 || t.length > 70) return false;
  if (/[\u4e00-\u9fff]/.test(t)) return false;        // 非中文原文
  if (BAD.test(t)) return false;
  if (/^[\s\W\d]/.test(t)) return false;
  // 纯 tailwind 类名等
  if (/^[a-z][a-z0-9-]*(\[|:)/.test(t)) return false;
  if (mode === 'ui') {
    if (!/\s/.test(t)) return false;                  // 必须含空格(句子)
    const words = t.split(/\s+/);
    if (words.length < 2 || words.length > 9) return false;
    if (!/[A-Z]/.test(t)) return false;               // 必须含大写(像标题/句子)
    // 排除明显行内类名串
    if (/^[a-z-]+ [a-z-]+(\s[a-z-]+)*$/.test(t)) return false;
    return true;
  }
  return true;
}

const rows = report.filter((x) => keep(x.text)).sort((a, b) => b.count - a.count);
const out = rows.map((x) => `${x.count}\t${x.text}`).join('\n');
fs.writeFileSync(path.join(__dirname, 'ui-candidates.txt'), out, 'utf8');
console.log('lines=' + rows.length);
