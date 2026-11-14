import { cpSync, mkdirSync } from 'node:fs';

mkdirSync('dist/frontend', { recursive: true });
for (const file of ['index.html', 'admin.html', 'styles.css', 'script.js', 'admin.js']) {
  cpSync('frontend/' + file, 'dist/frontend/' + file);
}
console.log('Frontend preparado em dist/frontend.');
