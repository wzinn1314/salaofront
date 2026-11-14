// Apenas a sessão de login fica no aparelho. As reservas ficam no Firebase.
window.AgendaAPI = (() => {
  const sessionKey='jaiane-api-session-v1';
  const fail=error=>({ok:false,status:503,json:async()=>({error})});
  async function request(path,options={}){
    const base=window.AGENDA_API_URL;
    if(!base)return fail('A agenda online ainda precisa da URL do backend em config.js.');
    let url;
    try{
      const root=new URL(base);
      if(root.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(root.hostname))throw new Error();
      if(root.username||root.password||!path.startsWith('/api/'))throw new Error();
      url=new URL(path,root.origin);
    }catch{return fail('Endereço do backend inválido.');}
    const headers={'Content-Type':'application/json',...options.headers};
    const token=sessionStorage.getItem(sessionKey);
    if(path.startsWith('/api/admin/')&&token)headers.Authorization='Bearer '+token;
    try{
      const r=await fetch(url,{...options,headers,cache:'no-store',signal:AbortSignal.timeout(15000)});
      if(!(r.headers.get('content-type')||'').includes('application/json'))return fail('O backend não respondeu como API. Confira a URL e a publicação.');
      if(r.status===401)sessionStorage.removeItem(sessionKey);
      if(r.ok&&path==='/api/admin/login'){
        const data=await r.clone().json();
        sessionStorage.setItem(sessionKey,data.token);
      }
      if(r.ok&&['/api/admin/logout','/api/admin/password'].includes(path))sessionStorage.removeItem(sessionKey);
      return r;
    }catch{return fail('Não foi possível conectar à agenda online. Confira a conexão e tente novamente.');}
  }
  return {request};
})();
