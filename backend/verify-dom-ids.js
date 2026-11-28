const fs = require('fs');
const path = require('path');

const jsFiles = fs.readdirSync('frontend/js').filter(f => f.endsWith('.js'));
const htmlFiles = fs.readdirSync('frontend/pages').filter(f => f.endsWith('.html'));

const allHtmlContent = htmlFiles.map(f => fs.readFileSync(path.join('frontend/pages', f), 'utf-8')).join('\n');

const idMatches = [];
jsFiles.forEach(f => {
  const content = fs.readFileSync(path.join('frontend/js', f), 'utf-8');
  const regex = /getElementById\(['"]([^'"]+)['"]\)/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    idMatches.push({ id: m[1], file: f });
  }
});

let missing = [];
idMatches.forEach(({ id, file }) => {
  if (!allHtmlContent.includes(`id="${id}"`) && !allHtmlContent.includes(`id='${id}'`)) {
    if (!file.includes('admin.js')) {
      missing.push({ id, file });
    }
  }
});

console.log('Total ID references checked:', idMatches.length);
console.log('Unmatched non-admin IDs:', missing.length);
if (missing.length > 0) {
  missing.forEach(m => console.log(`  - ID '${m.id}' in ${m.file}`));
}
