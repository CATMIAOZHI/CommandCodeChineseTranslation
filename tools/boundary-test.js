// 单测：标识符边界替换逻辑
'use strict';
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function replaceBoundary(src, from, to) {
  const re = new RegExp(`(?<![A-Za-z0-9_$])${esc(from)}(?![A-Za-z0-9_$])`, 'g');
  return src.replace(re, to);
}

const cases = [
  ['onToggleTerminal:r', 'should NOT replace'],
  ['"Terminal"', 'should replace'],
  ['xTerminal', 'should NOT replace'],
  ['Terminal;', 'should replace'],
  ['"Hide Terminal"', 'should replace substring'],
  ['onSearchFiles()', 'should NOT replace'],
  ['"Search files"', 'should replace'],
];
let pass = 0;
for (const [s, exp] of cases) {
  const out = replaceBoundary(s, 'Terminal', '终端');
  const out2 = replaceBoundary(s, 'Search', '搜索');
  const termOk = out.includes('终端');
  console.log(`${termOk ? 'PASS' : 'INFO'} ${JSON.stringify(s)} -> ${JSON.stringify(out)}  (${exp})`);
  if (exp === 'should NOT replace' && termOk) console.log('  !! 误伤标识符');
  else pass++;
}
console.log(`\n完成 ${cases.length} 项`);
