import {spawnSync} from 'node:child_process';
const suites=['tests/server.test.mjs','tests/frontend.test.mjs','tests/local-http.test.mjs'];
let failures=0;
for(const suite of suites){console.log('\nExecutando '+suite);const result=spawnSync(process.execPath,[suite],{stdio:'inherit',windowsHide:true});if(result.status!==0){failures++;console.error('FALHOU: '+suite)}}
console.log(`\nResultado: ${suites.length-failures}/${suites.length} suítes passaram.`);process.exitCode=failures?1:0;
