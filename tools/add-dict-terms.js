// 向 dict.json 追加 harness Config 页相关词条（幂等）
'use strict';
const fs = require('fs');
const path = require('path');

const fp = path.join(__dirname, '..', 'dict.json');
const d = JSON.parse(fs.readFileSync(fp, 'utf8'));
const have = new Set(d.terms.map((t) => t.from));

// 注意: 文件中的 \u2014 是字面 6 字符(\ u 2 0 1 4), JSON 中需写成 \\u2014
const add = [
  // --- Config General 标题/选项 ---
  { from: 'Force OAuth', to: '强制 OAuth 登录' },
  { from: 'Zero data retention', to: '零数据保留' },
  { from: 'Tree default filter', to: '目录树默认筛选' },
  { from: 'On-demand command explanations', to: '按需命令解释' },
  { from: 'Skip branch summary prompt', to: '跳过分支摘要询问' },
  { from: 'Image vision', to: '图像视觉' },
  { from: 'Default export format', to: '默认导出格式' },
  { from: 'Default share gist format', to: '默认分享 Gist 格式' },
  { from: 'Taste learning (user)', to: '偏好学习（用户级）' },
  { from: 'Taste learning (this project)', to: '偏好学习（当前项目）' },
  { from: 'Feature models', to: '功能模型' },
  { from: 'Session titles', to: '会话标题' },
  { from: 'Compaction', to: '上下文压缩' },
  { from: 'Command explanations', to: '命令解释' },
  { from: 'Default permission mode', to: '默认权限模式' },
  { from: 'Ask on first use', to: '首次使用时询问' },

  // --- 描述文本(整句) ---
  { from: 'Require OAuth login and block API-key authentication.', to: '要求 OAuth 登录并阻止 API 密钥认证。' },
  {
    from: 'Assert zero-data-retention and no prompt-training on every request, and let the gateway refuse rather than route to an upstream that honors neither. Some models have no qualifying upstream and are replaced by one that does, which can cost more \\u2014 the config screen lists what changes.',
    to: '在每次请求中断言零数据保留且不进行提示词训练；若上游服务两者皆不满足，网关将拒绝而非转发。部分模型没有符合要求的上游，会被替换为符合的模型（费用可能更高）——配置页会列出具体变化。'
  },
  { from: 'Default filter when opening /tree.', to: '打开 /tree 时默认应用的筛选条件。' },
  {
    from: 'Explain shell commands on permission prompts only when you press ctrl+e (default). Turn off to generate every explanation upfront.',
    to: '仅在按下 ctrl+e 时于权限提示中解释 shell 命令（默认）。关闭后则每次提前生成解释。'
  },
  { from: 'Never ask about summarizing when switching branches in /tree.', to: '在 /tree 中切换分支时从不询问是否总结。' },
  {
    from: 'Learn your coding style from your sessions, user-wide (same setting as /taste).',
    to: '从你的会话中学习编码风格（用户级，与 /taste 设置相同）。'
  },
  {
    from: 'Format a bare /export (no format or path) writes \\u2014 an explicit /export html|jsonl|md|<path> always overrides.',
    to: '不带格式或路径的 /export 的默认写入格式——显式指定 /export html|jsonl|md|<路径> 时始终覆盖。'
  },
  {
    from: 'Format a bare /share gist (no format argument) posts \\u2014 an explicit /share gist html|jsonl|md always overrides.',
    to: '不带格式参数的 /share gist 的默认发布格式——显式指定 /share gist html|jsonl|md 时始终覆盖。'
  },
];

let added = 0;
for (const t of add) {
  if (!have.has(t.from)) {
    d.terms.push(t);
    have.add(t.from);
    added++;
  } else {
    console.log('skip(已有):', t.from.slice(0, 50));
  }
}
d.terms.sort((a, b) => b.from.length - a.from.length);
fs.writeFileSync(fp, JSON.stringify(d, null, 2), 'utf8');
console.log('added', added, '| total', d.terms.length);
