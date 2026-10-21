const fs = require('fs');
const path = require('path');

function searchDir(dir, pattern) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'build' || entry.name === '.next') continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        searchDir(fullPath, pattern);
      } else if (entry.isFile()) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (pattern.test(content)) {
            console.log('MATCH:', fullPath);
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
              if (pattern.test(line)) {
                console.log(`  L${idx + 1}: ${line.trim()}`);
              }
            });
          }
        } catch (e) {}
      }
    }
  } catch (e) {}
}

console.log('Searching User-Panel-Dashbord...');
searchDir('C:\\Users\\HP\\OneDrive\\Desktop\\User Panel\\User-Panel-Dashbord', /71,?126/);
console.log('Done.');
