// 清理 dict.json: 去重、剔除 from===to、剔除含 $ 的模板串、排序。写回。
'use strict';
const fs = require('fs');
const path = require('path');
const fp = path.join(__dirname, 'dict.json');
const d = JSON.parse(fs.readFileSync(fp, 'utf8'));
const seen = new Set();
const out = [];
const dropped = [];
for (const t of d.terms) {
  if (seen.has(t.from)) { dropped.push('dup: ' + t.from); continue; }
  if (t.from === t.to) { dropped.push('self: ' + t.from); continue; }
  if (t.from.includes('$')) { dropped.push('tpl: ' + t.from); continue; }
  seen.add(t.from);
  out.push(t);
}
out.sort((a, b) => b.from.length - a.from.length); // 长串优先，避免短串先替换破坏长串
d.terms = out;
fs.writeFileSync(fp, JSON.stringify(d, null, 2), 'utf8');
console.log('kept=' + out.length + ' dropped=' + dropped.length);
for (const x of dropped) console.log('  drop ' + x);
