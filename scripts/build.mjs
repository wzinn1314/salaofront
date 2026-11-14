import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const assets={};
for(const [route,file,type] of [['/','index.html','text/html; charset=utf-8'],['/styles.css','styles.css','text/css; charset=utf-8'],['/script.js','script.js','text/javascript; charset=utf-8'],['/admin','admin.html','text/html; charset=utf-8'],['/admin.js','admin.js','text/javascript; charset=utf-8']])assets[route]={body:readFileSync('frontend/'+file,'utf8'),type};
mkdirSync('dist/server',{recursive:true});
writeFileSync('dist/server/index.js','const assets='+JSON.stringify(assets)+';\n'+readFileSync('backend/worker.mjs','utf8'));
console.log('Worker e páginas preparados.');
