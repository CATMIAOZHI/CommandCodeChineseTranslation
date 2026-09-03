// 一次性转换脚本: 将 localize-tool 下 bat 转为 GBK 编码 + CRLF 行尾（供 cmd 在中文 Windows 原生解析）
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const psScript = `
$enc = [System.Text.Encoding]::GetEncoding(936)
foreach ($f in @('汉化.bat', '还原.bat')) {
  $p = Join-Path $args[0] $f
  $text = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)
  $text = $text -replace "\`r\`n", "\`n"
  $text = $text -replace "\`n", "\`r\`n"
  [System.IO.File]::WriteAllText($p, $text, $enc)
  Write-Output ("converted " + $f)
}
`;
const psPath = path.join(__dirname, '_conv.ps1');
fs.writeFileSync(psPath, psScript, 'utf8');
try {
  const out = execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psPath, root], { encoding: 'utf8' });
  console.log(out);
} finally {
  fs.unlinkSync(psPath);
}
