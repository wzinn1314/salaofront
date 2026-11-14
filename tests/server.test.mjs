import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import worker,{passwordHash,salonNow,allowedTimes,validSlot,CLOSED_DATES,MANUAL_RESERVATIONS,PENDING_DATES} from '../server/worker.mjs';
const sql=new DatabaseSync(':memory:');sql.exec(readFileSync('drizzle/0000_booking.sql','utf8').replaceAll('--> statement-breakpoint',''));sql.exec(readFileSync('drizzle/0001_booking_price.sql','utf8'));
function stmt(query,args=[]){const p=sql.prepare(query);return {bind(...values){return stmt(query,values)},async first(){return p.get(...args)||null},async all(){return {results:p.all(...args)}},async run(){return p.run(...args)},_run(){return p.run(...args)}}}
const DB={prepare:stmt,async batch(list){sql.exec('BEGIN');try{const out=list.map(s=>s._run());sql.exec('COMMIT');return out}catch(e){sql.exec('ROLLBACK');throw e}}};
const env={DB,ADMIN_BOOTSTRAP_HASH:await passwordHash('test-password-strong-123')},ctx={waitUntil(p){p.catch(console.error)}};
async function request(path,method='GET',body,cookie='',origin='https://salon.test'){return worker.fetch(new Request('https://salon.test'+path,{method,headers:{...(method!=='GET'?{'Origin':origin,'Content-Type':'application/json'}:{}),Cookie:cookie,'CF-Connecting-IP':'127.0.0.1'},...(body?{body:JSON.stringify(body)}:{})}),env,ctx)}
assert.equal((await request('/api/admin/bookings')).status,401);
assert.equal((await request('/api/admin/login','POST',{password:'wrong'})).status,401);
assert.equal((await request('/api/admin/login','POST',{password:'test-password-strong-123'},'','https://evil.test')).status,403);
let r=await request('/api/admin/login','POST',{password:'test-password-strong-123'});assert.equal(r.status,200);const cookie=r.headers.get('set-cookie').split(';')[0];assert.match(r.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
let d=new Date(salonNow().date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);while(d.getUTCDay()!==2)d.setUTCDate(d.getUTCDate()+1);const date=d.toISOString().slice(0,10);
const booking={service:'progressiva',date,time:'08:00',name:'Cliente Teste',phone:'11999999999',hairLength:'longo',price:1};
r=await request('/api/bookings','POST',booking);assert.equal(r.status,201);const b=await r.json();assert.equal(b.price,170);assert.equal(sql.prepare('SELECT price FROM bookings').get().price,170);
assert.equal((await request('/api/bookings','POST',{...booking,time:'08:00'})).status,409);
assert.equal(sql.prepare('SELECT count(*) AS count FROM bookings').get().count,1);
assert.equal((await request('/api/bookings','POST',{...booking,time:'14:00'})).status,400);
assert.equal((await request('/api/bookings','POST',{...booking,hairLength:'invalid'})).status,400);
r=await request('/api/availability?month='+date.slice(0,7));const publicData=await r.json();assert.deepEqual(Object.keys(publicData.bookings[0]).sort(),['date','duration','time']);
r=await request('/api/admin/bookings','GET',null,cookie);const privateData=await r.json();assert.equal(privateData.bookings[0].hair_length,'longo');assert.equal(privateData.bookings[0].name,'Cliente Teste');
assert.equal((await request('/api/admin/bookings/'+b.id,'DELETE',null,cookie)).status,200);assert.equal(sql.prepare('SELECT count(*) AS count FROM occupied_slots').get().count,0);for(const [hairLength,price] of Object.entries({retoque3:100,retoque6:120,curto:130,medio:150,longo:170,extralongo:200})){const response=await request('/api/bookings','POST',{...booking,hairLength});assert.equal(response.status,201);const saved=await response.json();assert.equal(saved.price,price);await request('/api/admin/bookings/'+saved.id,'DELETE',null,cookie);}

for(const pair of [['progressiva','progressiva'],['progressiva','selagem'],['selagem','selagem']]){
 sql.exec('DELETE FROM rate_limits');
 const responses=await Promise.all([request('/api/bookings','POST',{...booking,service:pair[0],time:'08:00'}),request('/api/bookings','POST',{...booking,service:pair[1],time:'17:30'}),request('/api/bookings','POST',{...booking,service:'selagem',time:'08:00'})]);
 assert.deepEqual(responses.map(r=>r.status).sort(),[201,201,409]);
 assert.equal(sql.prepare('SELECT count(*) AS count FROM bookings WHERE date=?').get(date).count,2);
 assert.equal(sql.prepare('SELECT count(*) AS count FROM occupied_slots WHERE date=?').get(date).count,4);
 const full=await request('/api/bookings','POST',{...booking,time:'08:00'});assert.equal(full.status,409);assert.match((await full.json()).error,/limite de 2/);
 const rows=sql.prepare('SELECT id FROM bookings WHERE date=?').all(date);
 await request('/api/admin/bookings/'+rows[0].id,'DELETE',null,cookie);
 assert.equal((await request('/api/bookings','POST',{...booking,time:'08:00'})).status,201);
 for(const row of sql.prepare('SELECT id FROM bookings').all())await request('/api/admin/bookings/'+row.id,'DELETE',null,cookie);
}
console.log('PASS: daily capacity of two for all service combinations, simultaneous requests, no orphan slots and cancellation reopening.');

const monday=new Date(date+'T12:00:00Z');monday.setUTCDate(monday.getUTCDate()-1);const mondayDate=monday.toISOString().slice(0,10);assert.deepEqual(allowedTimes(mondayDate),[]);for(const time of ['08:00','14:00','17:30'])assert.equal((await request('/api/bookings','POST',{...booking,date:mondayDate,time})).status,400);console.log('PASS: Monday closed for every time.');
const saturday=new Date(date+'T12:00:00Z');saturday.setUTCDate(saturday.getUTCDate()+4);const sunday=new Date(saturday);sunday.setUTCDate(sunday.getUTCDate()+1);
assert.deepEqual(allowedTimes(date),['08:00','17:30']);assert.deepEqual(allowedTimes(saturday.toISOString().slice(0,10)),['08:00','14:00']);assert.deepEqual(allowedTimes(sunday.toISOString().slice(0,10)),['08:00','14:00']);
const today=date,validToday=allowedTimes(today)[0],minute=Number(validToday.slice(0,2))*60+Number(validToday.slice(3));assert.equal(validSlot(today,validToday,120,{date:today,minutes:minute}),false);assert.equal(validSlot(today,validToday,120,{date:today,minutes:minute-1}),true);
for(const weekend of [saturday,sunday]){sql.exec('DELETE FROM rate_limits');const weekendDate=weekend.toISOString().slice(0,10);assert.equal((await request('/api/bookings','POST',{...booking,date:weekendDate,time:'17:30'})).status,400);for(const time of ['08:00','14:00'])assert.equal((await request('/api/bookings','POST',{...booking,date:weekendDate,time})).status,201);for(const row of sql.prepare('SELECT id FROM bookings').all())await request('/api/admin/bookings/'+row.id,'DELETE',null,cookie);}
// A reservation from the previous timetable must still prevent an overlap.
sql.exec('DELETE FROM rate_limits');sql.prepare('INSERT INTO bookings (id,service,date,time,duration,name,phone,hair_length,created_at,price) VALUES (?,?,?,?,?,?,?,?,?,?)').run('legacy','Progressiva',date,'17:00',120,'Anterior','11999999999','longo',Date.now(),170);assert.equal((await request('/api/bookings','POST',{...booking,time:'17:30'})).status,409);assert.equal(sql.prepare('SELECT count(*) AS count FROM bookings').get().count,1);await request('/api/admin/bookings/legacy','DELETE',null,cookie);
console.log('PASS: weekday 08:00/17:30, Saturday and Sunday 08:00/14:00, passed slots and legacy overlapping bookings.');
for(const [date,free] of [['2026-12-03','17:30'],['2026-12-05','14:00'],['2026-12-06','08:00'],['2026-12-10','17:30']]){assert.deepEqual(allowedTimes(date),[free]);if(date>=salonNow().date){sql.exec('DELETE FROM rate_limits');const blocked=MANUAL_RESERVATIONS.find(b=>b.date===date);assert.equal((await request('/api/bookings','POST',{...booking,date,time:blocked.time})).status,400);const response=await request('/api/bookings','POST',{...booking,date,time:free});assert.equal(response.status,201);assert.equal((await request('/api/bookings','POST',{...booking,date,time:free})).status,409);await request('/api/admin/bookings/'+(await response.json()).id,'DELETE',null,cookie);assert.deepEqual(allowedTimes(date),[free]);}}
for(const date of PENDING_DATES){assert.deepEqual(allowedTimes(date),[]);for(const time of ['08:00','14:00','17:30'])assert.equal(validSlot(date,time,120,{date:'2026-11-13',minutes:0}),false)}
const december=await (await request('/api/availability?month=2026-12')).json();assert.deepEqual(december.pendingDates,PENDING_DATES);assert.equal(december.bookings.filter(b=>b.date==='2026-12-03'&&b.time==='08:00').length,1);console.log('PASS: existing December reservations, remaining slots, cancellation preserves old bookings, pending times never invented.');

assert.equal((await request('/api/admin/password','POST',{currentPassword:'test-password-strong-123',password:'new-strong-password-456'},cookie)).status,200);
assert.equal((await request('/api/admin/bookings','GET',null,cookie)).status,401);
assert.equal((await request('/api/admin/login','POST',{password:'test-password-strong-123'})).status,401);
assert.equal((await request('/api/admin/login','POST',{password:'new-strong-password-456'})).status,200);
console.log('PASS: server auth, CSRF, HttpOnly sessions, booking validation, atomic conflicts, privacy, hair length, cancellation, password changes and session revocation.');

for(const date of CLOSED_DATES){assert.deepEqual(allowedTimes(date),[]);for(const time of ['08:00','14:00','17:30'])assert.equal(validSlot(date,time,120,{date:'2026-11-13',minutes:0}),false)}
const blockedMonth=await (await request('/api/availability?month=2026-12')).json();assert.deepEqual(blockedMonth.closedDates,CLOSED_DATES);console.log('PASS: December 4, 13, 19 and 20 blocked in server and public availability.');


// End of the seasonal booking period is enforced even for direct API calls.
for(const date of ['2026-12-28','2026-12-29','2027-01-02']){
 assert.deepEqual(allowedTimes(date),[]);
 assert.equal(validSlot(date,'08:00',120,{date:'2026-11-14',minutes:0}),false);
}
const named=await (await request('/api/admin/login','POST',{password:'new-strong-password-456'})).headers.get('set-cookie');
const calendar=await (await request('/api/admin/bookings?date=2026-12-27','GET',null,named.split(';')[0])).json();
assert.equal(calendar.bookings[0].name,'Vit\u00f3ria');assert.equal(calendar.bookings[0].time,'');
assert(!JSON.stringify(december).includes('C\u00edntia'));
assert.equal(december.lastWorkingDate,'2026-12-27');
console.log('PASS: season cutoff, named private calendar and pending time preserved.');
