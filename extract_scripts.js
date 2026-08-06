const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const jsDir = path.join(publicDir, 'js');

if (!fs.existsSync(jsDir)) {
  fs.mkdirSync(jsDir, { recursive: true });
}

const htmlFiles = fs.readdirSync(publicDir).filter(file => file.endsWith('.html'));

htmlFiles.forEach(file => {
  const filePath = path.join(publicDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  const baseName = path.basename(file, '.html');
  const jsFilePath = path.join(jsDir, `${baseName}.js`);
  
  // Extract all <script> tags that do NOT have a src attribute (inline scripts)
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let extractedJs = '';
  
  // Also we want to ensure app-core.js is in <head>
  const headEndRegex = /<\/head>/i;
  if (content.match(headEndRegex) && !content.includes('js/app-core.js')) {
    content = content.replace(headEndRegex, `  <script src="js/app-core.js"></script>\n</head>`);
  }
  
  // Replace inline scripts with the external JS file
  let match;
  let newContent = content;
  
  let inlineScriptsFound = 0;
  
  while ((match = scriptRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const scriptBody = match[1];
    
    // If it's an inline script (no src="" except maybe FontAwesome or Tailwind which we should keep)
    if (!fullMatch.includes('src=')) {
      extractedJs += scriptBody + '\n\n';
      // Remove this script tag from HTML
      newContent = newContent.replace(fullMatch, '');
      inlineScriptsFound++;
    }
  }
  
  if (inlineScriptsFound > 0) {
    fs.writeFileSync(jsFilePath, extractedJs.trim(), 'utf-8');
    
    // Inject the new external script at the end of body if not there
    const bodyEndRegex = /<\/body>/i;
    if (newContent.match(bodyEndRegex) && !newContent.includes(`js/${baseName}.js`)) {
      newContent = newContent.replace(bodyEndRegex, `  <script src="js/${baseName}.js"></script>\n</body>`);
    } else if (!newContent.match(bodyEndRegex)) {
       newContent += `\n<script src="js/${baseName}.js"></script>`;
    }
    
    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log(`Extracted scripts for ${file} -> js/${baseName}.js`);
  }
});

console.log('Script extraction complete.');
