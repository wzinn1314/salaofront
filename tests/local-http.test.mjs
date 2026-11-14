import {spawn} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {passwordHash,salonNow,CALENDAR_CLIENTS} from '../server/worker.mjs';

const dataDir=path.resolve('outputs/test-runs',randomUUID());mkdirSync(dataDir,{recursive:true});
const password='local-test-password-123456';const hash=await passwordHash(password);
let child,origin,log='';
async function start(){log='';child=spawn(process.execPath,['scripts/dev-server.mjs'],{env:{...process.env,PORT:'0',LOCAL_DATA_DIR:dataDir,ADMIN_BOOTSTRAP_HASH:hash},windowsHide:true,stdio:['ignore','pipe','pipe']});origin=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Timeout iniciando servidor: '+log)),10000);child.stdout.on('data',chunk=>{log+=chunk;const m=log.match(/Agendamento: (http:\/\/localhost:\d+)/);if(m){clearTimeout(timeout);resolve(m[1])}});child.stderr.on('data',chunk=>log+=chunk);child.once('error',error=>{clearTimeout(timeout);reject(error)});child.once('exit',code=>{clearTimeout(timeout);reject(new Error('Servidor encerrou: '+code+' '+log))})})}
async function stop(){if(!child||child.exitCode!==null)return;const exited=new Promise(resolve=>child.once('exit',resolve));child.kill();await exited;}
async function request(route,{method='GET',body,cookie,otherOrigin}={}){return fetch(origin+route,{method,headers:{...(method!=='GET'?{Origin:otherOrigin||origin,'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})})}
async function login(p=password){const r=await request('/api/admin/login',{method:'POST',body:{password:p}});assert.equal(r.status,200);const c=r.headers.get('set-cookie');assert.match(c,/jaiane_admin_local=/);assert.match(c,/HttpOnly/);assert(!c.includes('; Secure'));return c.split(';')[0]}
try{
await start();for(const [route,type] of [['/','text/html'],['/admin','text/html'],['/admin/','text/html'],['/styles.css','text/css'],['/script.js','text/javascript'],['/admin.js','text/javascript']]){const r=await request(route);assert.equal(r.status,200,route);assert(r.headers.get('content-type').includes(type),route)}
assert.equal((await request('/public/index.html')).url,origin+'/index.html');assert.equal((await request('/dist/admin.html')).url,origin+'/admin.html');assert.equal((await request('/not-a-page')).status,404);
assert.equal((await request('/api/admin/bookings')).status,401);assert.equal((await request('/api/admin/login',{method:'POST',body:{password:'wrong'}})).status,401);
assert.equal((await request('/api/admin/login',{method:'POST',body:{password},otherOrigin:'https://other.test'})).status,403);
let cookie=await login();
let d=new Date(salonNow().date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);while(d.getUTCDay()!==2)d.setUTCDate(d.getUTCDate()+1);const date=d.toISOString().slice(0,10);
const booking={service:'progressiva',hairLength:'curto',name:'Cliente isolada',phone:'11999999999',date,time:'08:00'};
let r=await request('/api/bookings',{method:'POST',body:booking});assert.equal(r.status,201);const created=await r.json();assert.equal(created.price,130);
const conflict=await request('/api/bookings',{method:'POST',body:booking});assert.equal(conflict.status,409);
r=await request('/api/bookings',{method:'POST',body:{...booking,service:'selagem',time:'17:30'}});assert.equal(r.status,201);assert.equal((await request('/api/bookings',{method:'POST',body:booking})).status,409);
const available=await (await request('/api/availability?month='+date.slice(0,7))).json();assert.equal(available.bookings.length,2);assert.deepEqual(Object.keys(available.bookings[0]).sort(),['date','duration','time']);
const oldOrigin=origin;await stop();await start();cookie=await login();const list=await (await request('/api/admin/bookings',{cookie})).json();assert.equal(list.bookings.filter(b=>!b.manual).length,2);assert.equal(list.bookings.filter(b=>b.manual).length,CALENDAR_CLIENTS.length);assert.equal(list.bookings[0].name,'Cliente isolada');
await request('/api/admin/bookings/'+created.id,{method:'DELETE',cookie});r=await request('/api/bookings',{method:'POST',body:booking});assert.equal(r.status,201);
const newPassword='changed-local-password-456';assert.equal((await request('/api/admin/password',{method:'POST',cookie,body:{currentPassword:password,password:newPassword}})).status,200);assert.equal((await request('/api/admin/bookings',{cookie})).status,401);cookie=await login(newPassword);await request('/api/admin/logout',{method:'POST',cookie,body:{}});assert.equal((await request('/api/admin/bookings',{cookie})).status,401);
console.log('PASS: HTTP real, rotas e arquivos, autenticação e cookies locais, CSRF, duas reservas, conflitos, privacidade, persistência após reiniciar, cancelamento, nova vaga, troca de senha e logout. Banco isolado.');
}finally{await stop()}
