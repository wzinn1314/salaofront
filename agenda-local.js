// Browser-only agenda. Passwords and sessions are a local convenience, not server security.
window.AgendaLocal = (() => {
  const storageKey = 'jaiane-agenda-local-v2';
  const passwordKey = 'jaiane-local-password-v1';
  const sessionKey = 'jaiane-local-session-v1';
  const lastWorkingDate = '2026-12-27';
  const closedDates = ['2026-12-04', '2026-12-13', '2026-12-19', '2026-12-20'];
  const prices = {retoque3:100, retoque6:120, curto:130, medio:150, longo:170, extralongo:200};
  const services = {progressiva:'Progressiva', selagem:'Selagem'};
  const seed = window.AgendaCaderno;
  const read = () => {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return structuredClone(seed);
    const data = JSON.parse(stored);
    if (!Array.isArray(data)) throw new Error('Dados locais inválidos. Preserve os dados deste navegador.');
    return data;
  };
  const save = data => localStorage.setItem(storageKey, JSON.stringify(data));
  const result = (data, status=200) => ({ok:status<400, status, json:async()=>data});
  const failure = (error, status=400) => result({error},status);
  const minutes = time => Number(time.slice(0,2))*60+Number(time.slice(3));
  function slots(date, bookings) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
    const d = new Date(date+'T12:00:00Z');
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0,10)!==date || date>lastWorkingDate) return [];
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
    const today = `${parts.year}-${parts.month}-${parts.day}`;
    if (date<today) return [];
    const booked = bookings.filter(b=>b.date===date);
    if (booked.length>=2 || booked.some(b=>!b.time)) return [];
    const day = d.getUTCDay();
    const times = ['2026-12-07','2026-12-14'].includes(date)?['08:00','17:30']:day===1?[]:day===0||day===6?['08:00','14:00']:['08:00','17:30'];
    return times.filter(time => (date!==today || minutes(time)>Number(parts.hour)*60+Number(parts.minute)) && !booked.some(b=>b.time && minutes(time)<minutes(b.time)+b.duration && minutes(time)+120>minutes(b.time)));
  }
  async function hash(password, salt) {
    const bytes = new TextEncoder();
    const key = await crypto.subtle.importKey('raw',bytes.encode(password),'PBKDF2',false,['deriveBits']);
    const value = await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:bytes.encode(salt),iterations:100000},key,256);
    return Array.from(new Uint8Array(value),b=>b.toString(16).padStart(2,'0')).join('');
  }
  const credential = () => JSON.parse(localStorage.getItem(passwordKey)||'null');
  const loggedIn = () => {const c=credential();return !!c && sessionStorage.getItem(sessionKey)===c.hash;};
  async function execute(path, options={}) {
    const method = options.method || 'GET';
    const url = new URL(path,'https://agenda.local');
    const body = options.body ? JSON.parse(options.body) : {};
    if (url.pathname==='/api/availability' && method==='GET') {
      const month = url.searchParams.get('month');
      return result({lastWorkingDate,closedDates:closedDates.filter(d=>d.startsWith(month)&&read().filter(b=>b.date===d).length>=2),pendingDates:[...new Set(read().filter(b=>!b.time&&b.date.startsWith(month)).map(b=>b.date))],bookings:read().filter(b=>b.date.startsWith(month)).map(({date,time,duration})=>({date,time,duration}))});
    }
    if (url.pathname==='/api/bookings' && method==='POST') {
      if (!services[body.service] || !Object.hasOwn(prices,body.hairLength) || typeof body.name!=='string' || body.name.trim().length<2 || body.name.length>100 || !/^\d{10,11}$/.test(String(body.phone).replace(/\D/g,''))) return failure('Confira nome, WhatsApp e serviço.');
      const bookings = read();
      if (!slots(body.date,bookings).includes(body.time)) return failure('Este horário não está disponível. Escolha outro.',409);
      const booking = {id:crypto.randomUUID(),name:body.name.trim(),phone:body.phone.replace(/\D/g,''),service:services[body.service],hair_length:body.hairLength,price:prices[body.hairLength],date:body.date,time:body.time,duration:120,status:'confirmed',manual:false};
      save([...bookings,booking]);
      return result(booking,201);
    }
    if (url.pathname==='/api/admin/login' && method==='POST') {
      if (typeof body.password!=='string' || body.password.length>128) return failure('Senha inválida.',401);
      let c = credential();
      if (!c) {
        if (body.password.length<12) return failure('No primeiro acesso, crie uma senha local com pelo menos 12 caracteres.');
        const salt = crypto.randomUUID();
        c = {salt,hash:await hash(body.password,salt)};
        localStorage.setItem(passwordKey,JSON.stringify(c));
      } else if (await hash(body.password,c.salt)!==c.hash) return failure('Senha incorreta.',401);
      sessionStorage.setItem(sessionKey,c.hash);
      return result({ok:true});
    }
    if (!loggedIn()) return failure('Entre com sua senha local.',401);
    if (url.pathname==='/api/admin/bookings' && method==='GET') return result({bookings:read()});
    if (url.pathname==='/api/admin/logout') {sessionStorage.removeItem(sessionKey);return result({ok:true});}
    if (url.pathname==='/api/admin/password' && method==='POST') {
      const c = credential();
      if (typeof body.currentPassword!=='string' || await hash(body.currentPassword,c.salt)!==c.hash) return failure('Senha atual incorreta.',401);
      if (typeof body.password!=='string' || body.password.length<12 || body.password.length>128) return failure('Use uma senha entre 12 e 128 caracteres.');
      const salt=crypto.randomUUID();
      localStorage.setItem(passwordKey,JSON.stringify({salt,hash:await hash(body.password,salt)}));
      sessionStorage.removeItem(sessionKey);
      return result({ok:true});
    }
    if (url.pathname.startsWith('/api/admin/bookings/') && method==='DELETE') {
      const id=decodeURIComponent(url.pathname.split('/').pop()),bookings=read();
      save(bookings.filter(b=>b.id!==id));
      return result({ok:true});
    }
    return failure('Não encontrado.',404);
  }
  async function request(path,options) {
    try {
      return navigator.locks ? await navigator.locks.request('jaiane-agenda-local',()=>execute(path,options)) : await execute(path,options);
    } catch {
      return failure('Não foi possível acessar os dados locais. Verifique se o navegador permite armazenamento.',503);
    }
  }
  return {request,needsPassword:()=>!localStorage.getItem(passwordKey)};
})();
