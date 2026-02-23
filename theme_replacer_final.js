const fs = require('fs');
const path = require('path');

const replacements = {
  'bg-[#1A2E2A] text-white': 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900',
  'bg-[#E2E8E5]': 'bg-border',
  'border-[#E2E8E5]': 'border-border',
  'bg-white/5': 'bg-white/10 dark:bg-white/5',
  'fill="#F8FAF9"': 'fill="currentColor" className="text-background"',
  'border-[#1B6B4A]': 'border-primary',
  'bg-primary-50 text-[#1B6B4A]': 'bg-primary-50 text-primary',
  'focus:ring-[#1B6B4A]/20': 'focus:ring-primary/20',
  'focus:border-[#1B6B4A]': 'focus:border-primary',
  'text-[#1B6B4A] border-[#1B6B4A]': 'text-primary border-primary',
};

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let originalContent = content;
      for (const [search, replace] of Object.entries(replacements)) {
        content = content.split(search).join(replace);
      }
      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content);
      }
    }
  }
}
processDirectory(path.join(__dirname, 'src'));
