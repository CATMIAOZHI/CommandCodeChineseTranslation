// 最终全量语法校验
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-final-'));
const list = [
  'D:/commandcodedesktop/Command Code/resources/app/out/renderer/assets/auth-screen-DGYMW_SY.js',
  'D:/commandcodedesktop/Command Code/resources/app/out/renderer/assets/browser-panel-Bh7N3B-j.js',
  'D:/commandcodedesktop/Command Code/resources/app/out/renderer/assets/index-7CIkdgkT.js',
  'D:/commandcodedesktop/Command Code/resources/app/out/renderer/assets/onboarding-screen-CSMQ-pot.js',
  'D:/commandcodedesktop/Command Code/resources/app/out/renderer/assets/settings-panel-_CHJsezy.js',
  'D:/commandcodedesktop/Command Code/resources/app/out/renderer/assets/source-panel-ByoHhwtP.js',
  'D:/commandcodedesktop/Command Code/resources/app/out/renderer/assets/terminal-BQ8RwLF8.js',
  'D:/commandcodedesktop/Command Code/resources/app/out/renderer/assets/workspace-screen-BA_E8WBE.js',
  'D:/commandcodedesktop/Command Code/resources/app/out/main/index.js',
  'D:/commandcodedesktop/Command Code/resources/app/node_modules/@commandcode/harness/dist/index.js',
];
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
