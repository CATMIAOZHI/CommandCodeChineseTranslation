// 统计 harness/dist/index.js 中的配置 schema label（Config 页面文本源）
'use strict';
const fs = require('fs');

const h = 'D:/commandcodedesktop/Command Code/resources/app/node_modules/@commandcode/harness/dist/index.js';
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
