const fs = require('fs');
const path = require('path');

const replacements = {
  // Focus and Border variants
  'focus:ring-[#1B6B4A]/20': 'focus:ring-primary/20',
  'focus:border-[#1B6B4A]': 'focus:border-primary',
  'border-[#1B6B4A]': 'border-primary',
  'hover:border-[#1B6B4A]': 'hover:border-primary',
  'group-hover:text-[#1B6B4A]': 'group-hover:text-primary',
  'hover:text-[#1B6B4A]': 'hover:text-primary',
  
  // Specific Backgrounds/Colors
  'bg-[#0F4A33]': 'bg-primary-dark',
  'text-[#0F4A33]': 'text-primary-dark',
  'bg-[#2D8F65]': 'bg-primary-light',
  'text-[#2D8F65]': 'text-primary-light',

  // Inline CSS gradient that needs variables? CSS gradients don't easily use Tailwind colors without config,
  // but let's replace the missing ones I saw in svg paths
  'fill="#F8FAF9"': 'fill="currentColor" className="text-background"',
};

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let originalContent = content;
      
      for (const [search, replace] of Object.entries(replacements)) {
        content = content.split(search).join(replace);
      }
      
      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content);
        console.log(`Updated: ${fullPath}`);
      }
    }
  }
}

// Process 'src' directory
const targetDir = path.join(__dirname, 'src');
processDirectory(targetDir);
console.log('Second pass Done!');
