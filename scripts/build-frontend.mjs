import { accessSync } from 'node:fs';

for (const file of ['index.html', 'admin.html', 'styles.css', 'script.js', 'admin.js']) {
  accessSync('frontend/' + file);
}
console.log('Frontend validado e pronto para publicar em frontend/.');
