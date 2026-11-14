import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';

function context(html, script, fetch) {
  const ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
  for(const m of script.matchAll(/\$\('([^']+)'\)/g)) assert(ids.has(m[1]),`Elemento ausente: ${m[1]}`);
  function element(){return {value:'',children:[],attributes:{},hidden:true,className:'',textContent:'',classList:{add(){}},setAttribute(k,v){this.attributes[k]=v},replaceChildren(){this.children=[]},append(...items){this.children.push(...items);if(!this.value&&items[0]?.value)this.value=items[0].value},addEventListener(){},showModal(){this.open=true},close(){this.open=false}}}
  const elements=new Map([...ids].map(id=>[id,element()]));
  const sandbox={document:{getElementById:id=>elements.get(id),createElement:element},window:{addEventListener(){}},fetch,console,confirm:()=>false};
  vm.createContext(sandbox);vm.runInContext(script,sandbox);return {run:s=>vm.runInContext(s,sandbox),elements};
}
let failFetch=false;
const client=context(readFileSync('public/index.html','utf8'),readFileSync('public/script.js','utf8'),async()=>{if(failFetch)throw new Error('Sem conexão');return {ok:true,json:async()=>({bookings:[]})}});
await client.run('loadAvailability()');
assert.equal(client.elements.get('service').children.length,2);
const monday=new Date();monday.setDate(monday.getDate()+7);while(monday.getDay()!==1)monday.setDate(monday.getDate()+1);
const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const dates={monday:iso(monday)};for(const [name,offset] of [['tuesday',1],['saturday',5],['sunday',6]]){const d=new Date(monday);d.setDate(d.getDate()+offset);dates[name]=iso(d)}
client.run('var testDates='+JSON.stringify(dates));
assert.equal(client.run('slotsFor(testDates.monday).length'),0);
assert.deepEqual(Array.from(client.run('slotsFor(testDates.tuesday)')),['08:00','17:30']);
for(const name of ['saturday','sunday'])assert.deepEqual(Array.from(client.run(`slotsFor(testDates.${name})`)),['08:00','14:00']);
client.run("busyBookings=[{date:testDates.tuesday,time:'08:00',duration:120}]");
assert.deepEqual(Array.from(client.run('slotsFor(testDates.tuesday)')),['17:30']);
client.run("busyBookings.push({date:testDates.tuesday,time:'17:30',duration:120});selectedDate=testDates.tuesday;renderTimes()");
assert.equal(client.elements.get('times').children.length,0);assert.match(client.elements.get('timeHint').textContent,/limite de 2/);
client.run("busyBookings=[{date:testDates.tuesday,time:'17:00',duration:120}]");assert.deepEqual(Array.from(client.run('slotsFor(testDates.tuesday)')),['08:00']);
for(const [option,price] of Object.entries({retoque3:100,retoque6:120,curto:130,medio:150,longo:170,extralongo:200})){client.elements.get('hairLength').value=option;client.run('updateSummary()');assert.match(client.elements.get('price').textContent,new RegExp(String(price)))}
failFetch=true;await client.run('loadAvailability()');assert.equal(client.run('availabilityReady'),false);assert.equal(client.run('slotsFor(testDates.tuesday).length'),0);assert.match(client.elements.get('timeHint').textContent,/Sem conexão/);
console.log('PASS: elementos e inicialização do formulário, serviços, calendário, horários, segunda fechada, lotação, sobreposição, seis preços e falha de conexão.');

const admin=context(readFileSync('public/admin.html','utf8'),readFileSync('public/admin.js','utf8'),async()=>({ok:false,status:401,json:async()=>({error:'Entre com a senha'})}));
await new Promise(resolve=>setImmediate(resolve));assert.equal(admin.elements.get('adminPanel').hidden,true);
admin.run('allBookings='+JSON.stringify([{name:'Márcia',phone:'11999999999',service:'Progressiva',date:dates.tuesday,time:'08:00',hair_length:'longo',price:170},{name:'Ana',phone:'11888888888',service:'Selagem',date:dates.saturday,time:'14:00',hair_length:'curto',price:130}]));
admin.elements.get('searchClient').value='marcia';assert.equal(admin.run('filteredBookings().length'),1);
admin.elements.get('searchClient').value='8888';assert.equal(admin.run('filteredBookings()[0].name'),'Ana');
admin.elements.get('searchClient').value='';admin.elements.get('filterService').value='Selagem';assert.equal(admin.run('filteredBookings()[0].name'),'Ana');
admin.elements.get('filterDate').value=dates.tuesday;assert.equal(admin.run('filteredBookings().length'),0);
admin.elements.get('clearFilter').onclick();assert.equal(admin.elements.get('adminBookings').children.length,2);
assert.equal(admin.elements.get('totalCount').textContent,2);
admin.run('showLogin()');assert.equal(admin.elements.get('adminBookings').children.length,0);assert.equal(admin.run('allBookings.length'),0);
console.log('PASS: painel sem autenticação, busca sem acentos, busca por telefone, filtros combinados, limpeza dos filtros, cartões e limpeza de dados ao sair.');

client.run("availabilityReady=true;closedDates=['2026-12-04','2026-12-13','2026-12-19','2026-12-20']");for(const date of ['2026-12-04','2026-12-13','2026-12-19','2026-12-20'])assert.equal(client.run('slotsFor('+JSON.stringify(date)+').length'),0);console.log('PASS: December full-day closures hide every time slot.');

client.run("availabilityReady=true;renderCalendar()");
assert.equal(client.run("slotsFor('2026-12-29').length"),0);
client.run("viewMonth=new Date(2026,11,1);renderCalendar()");
assert.equal(client.elements.get('nextMonth').disabled,true);
admin.run('allBookings='+JSON.stringify([{name:'Cliente do caderno',phone:'',date:'2026-12-27',time:'',service:'Procedimento a confirmar',manual:true}]));
admin.elements.get('filterDate').value='';admin.elements.get('filterService').value='';admin.run('render()');
assert.equal(admin.elements.get('adminBookings').children.length,1);
console.log('PASS: cutoff navigation and manual client without invented time or phone.');
