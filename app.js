/* =========================================================================
   Greenlight app
   Login (soft gate)  ->  Dashboard of prospect projects  ->  share link
   Respondent enters email  ->  fills priorities + notes  ->  thank you
   Admin views aggregated results.
   ========================================================================= */
const CFG = window.GREENLIGHT_CONFIG || {};
const useSupabase = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
let sb = null;
if (useSupabase && window.supabase) sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);

/* Flick sample project — data in flick-data.js (sync with flick-mvp-spec.md + supabase-schema.sql) */
const FLICK_PROJECT = { id:'flick', owner: CFG.ADMIN_EMAIL || 'cody@gmail.com', title:'Flick, vertical film web app', data: FLICK_DATA };

/* ---------------- helpers ---------------- */
const root = document.getElementById('root');
document.getElementById('modeTag').textContent = useSupabase ? '\u25cf shared (Supabase)' : '\u25cb local mode';
function rid(n){ let s=''; const a='abcdefghijklmnopqrstuvwxyz0123456789'; for(let i=0;i<n;i++) s+=a[Math.floor(Math.random()*a.length)]; return s; }
function slug(s){ return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,46) || 'x'; }
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function go(h){ location.hash = h; }
function shareURL(id){ return location.origin + location.pathname + '#l/' + id; }
function toast(m){ const t=document.getElementById('toast'); t.textContent=m; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1600); }
function copy(v){ navigator.clipboard.writeText(v).then(()=>toast('Link copied')).catch(()=>toast('Copy failed')); }
function downloadText(filename, text){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));
  a.download=filename; a.click(); URL.revokeObjectURL(a.href);
}
window.go=go; window.copy=copy;

const PRIORITY_LABEL={mvp:'MVP',soon:'Soon',later:'Later'};
function initFeatureDefaults(cats, features){
  cats.forEach(c=>c.items.forEach(it=>{ if(it.default && features[it.id]==null) features[it.id]=it.default; }));
}
function scopeBlock(meta){
  if(!meta||(!meta.wedge&&!meta.howTo)) return '';
  return `<div class="scope-block">
    <button type="button" class="scope-toggle open" id="scopeToggle">Starting scope <span class="scope-chevron">&#9662;</span></button>
    <div class="scope-body" id="scopeBody">
      ${meta.wedge?`<p class="scope-wedge">${esc(meta.wedge)}</p>`:''}
      ${meta.howTo?`<p class="scope-how">${esc(meta.howTo)}</p>`:''}
      ${meta.productType?`<p class="scope-type">Product type: ${esc(meta.productType)}</p>`:''}
    </div>
  </div>`;
}
function bindScopeToggle(){
  const btn=root.querySelector('#scopeToggle'), body=root.querySelector('#scopeBody');
  if(!btn||!body) return;
  btn.onclick=()=>{ body.classList.toggle('hidden'); btn.classList.toggle('open'); };
}
function consensusPick(scores, n, threshold){
  if(!n) return null;
  const order=['mvp','soon','later'];
  for(const p of order){ if(scores[p]/n>=threshold) return p; }
  return order.reduce((a,b)=>scores[a]>=scores[b]?a:b);
}
function computeResultsData(cats, decisions, responses){
  const ALL=[]; cats.forEach(c=>c.items.forEach(it=>ALL.push({...it,cat:c.name})));
  const score={}; ALL.forEach(f=>score[f.id]={mvp:0,soon:0,later:0});
  responses.forEach(v=>{ for(const fid in v.features){ if(score[fid]) score[fid][v.features[fid]]++; } });
  const dtal={}; decisions.forEach(d=>{ dtal[d.id]={}; d.options.forEach(o=>dtal[d.id][o]=0); });
  responses.forEach(v=>{ for(const did in v.decisions){ const o=v.decisions[did]; if(dtal[did]&&dtal[did][o]!=null) dtal[did][o]++; } });
  const n=responses.length;
  const threshold=0.5;
  const ranked=ALL.map(f=>({f,s:score[f.id],consensus:consensusPick(score[f.id],n,threshold)})).filter(x=>x.s.mvp+x.s.soon+x.s.later>0)
    .sort((a,b)=>(b.s.mvp*2+b.s.soon)-(a.s.mvp*2+a.s.soon));
  return {ALL,score,dtal,n,ranked,threshold};
}
function buildExportPayload(project, responses){
  const {cats,decisions,meta}=project.data;
  const {ALL,score,dtal,n,ranked,threshold}=computeResultsData(cats,decisions,responses);
  const features=ALL.map(f=>{
    const s=score[f.id]; const t=s.mvp+s.soon+s.later;
    const consensus=t?consensusPick(s,n,threshold):null;
    return {id:f.id,name:f.name,category:f.cat,default:f.default||null,mvp:s.mvp,soon:s.soon,later:s.later,votes:t,consensus,differsFromDefault:consensus&&f.default&&consensus!==f.default};
  });
  return {project:{id:project.id,title:project.title,meta:meta||null},respondents:n,decisions:dtal,responses,features,lockedMvp:features.filter(f=>f.consensus==='mvp')};
}
function exportResultsJSON(project, responses){
  downloadText(slug(project.title)+'-results.json', JSON.stringify(buildExportPayload(project,responses), null, 2));
  toast('JSON exported');
}
function exportResultsCSV(project, responses){
  const {features}=buildExportPayload(project,responses);
  const rows=[['Category','Feature','Default','MVP votes','Soon votes','Later votes','Consensus','Differs from default']];
  features.forEach(f=>rows.push([f.category,f.name,f.default||'',f.mvp,f.soon,f.later,f.consensus||'',f.differsFromDefault?'yes':'']));
  const csv=rows.map(r=>r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n');
  downloadText(slug(project.title)+'-results.csv', csv);
  toast('CSV exported');
}
function exportLockedMvp(project, responses){
  const {lockedMvp,project:p}=buildExportPayload(project,responses);
  const lines=['# Locked MVP — '+p.title,'',...lockedMvp.map(f=>'- '+f.name+' ('+f.category+')')];
  if(!lockedMvp.length) lines.push('(No features reached MVP consensus yet)');
  downloadText(slug(project.title)+'-locked-mvp.txt', lines.join('\n'));
  toast('MVP list exported');
}

const MARK = `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="glc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5BEA95"/><stop offset="1" stop-color="#12B257"/></linearGradient><filter id="gls" x="-90%" y="-90%" width="280%" height="280%"><feGaussianBlur stdDeviation="15"/></filter></defs><circle cx="100" cy="100" r="40" fill="#2EE07A" opacity="0.30" filter="url(#gls)"/><circle cx="100" cy="100" r="62" fill="none" stroke="#F2F0E9" stroke-width="9"/><circle cx="100" cy="100" r="30" fill="url(#glc)"/><ellipse cx="90" cy="88" rx="13" ry="9" fill="#FFFFFF" opacity="0.35"/></svg>`;

function topbar(authed){
  return `<div class="topbar">
    <div class="logo" onclick="go('${authed?'':'l/'}')">${MARK}<span class="wm">Greenlight</span></div>
    <div class="nav">
      ${authed?`<a onclick="go('')">Projects</a><a onclick="go('new')">New</a><a onclick="signOut()">Sign out</a>`:''}
    </div>
  </div>`;
}

/* ---------------- auth (soft gate) ---------------- */
function isAuthed(){ return !!sessionStorage.getItem('gl_admin'); }
function adminEmail(){ return sessionStorage.getItem('gl_admin') || (CFG.ADMIN_EMAIL||''); }
function signOut(){ sessionStorage.removeItem('gl_admin'); go('login'); }
window.signOut=signOut;

/* ---------------- storage adapter ---------------- */
function localSeed(){
  if (useSupabase) return;
  const key='gl_proj:flick';
  let existing=null;
  try{ existing=JSON.parse(localStorage.getItem(key)); }catch(e){}
  if(!existing || !existing.data || !existing.data.meta){
    localStorage.setItem(key, JSON.stringify(FLICK_PROJECT));
  }
}
async function getProjects(owner){
  if (sb){
    const { data, error } = await sb.from('pb_projects').select('*').eq('owner', owner).order('created_at',{ascending:false});
    if (error){ console.error(error); return []; }
    return (data||[]).map(d=>({ id:d.id, owner:d.owner, title:d.title, data:d.data }));
  }
  localSeed();
  const out=[];
  for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i);
    if(k && k.indexOf('gl_proj:')===0){ try{ const o=JSON.parse(localStorage.getItem(k)); if(o.owner===owner) out.push(o);}catch(e){} } }
  return out;
}
async function getProject(id){
  if (sb){
    const { data, error } = await sb.from('pb_projects').select('*').eq('id', id).maybeSingle();
    if (error){ console.error(error); return null; }
    if (!data) return null;
    return { id:data.id, owner:data.owner, title:data.title, data:data.data };
  }
  localSeed();
  try{ const v=localStorage.getItem('gl_proj:'+id); return v?JSON.parse(v):null; }catch(e){ return null; }
}
async function createProject(obj){
  if (sb){
    const { error } = await sb.from('pb_projects').insert({ id:obj.id, owner:obj.owner, title:obj.title, data:obj.data, created_at:new Date().toISOString() });
    if (error){ console.error(error); throw error; }
  } else {
    localStorage.setItem('gl_proj:'+obj.id, JSON.stringify(obj));
  }
}
function emailKey(email){ return slug(String(email||'').trim()); }

async function getResponse(projectId, email){
  const key=emailKey(email);
  if (sb){
    const { data, error } = await sb.from('pb_responses').select('*')
      .eq('project_id', projectId).eq('email_key', key).maybeSingle();
    if (error){ console.error(error); return null; }
    if (!data) return null;
    return { email:data.email, decisions:data.decisions||{}, features:data.features||{}, notes:data.notes||'' };
  }
  try{
    const v=localStorage.getItem('gl_resp:'+projectId+':'+key);
    return v?JSON.parse(v):null;
  }catch(e){ return null; }
}
async function saveResponse(projectId, r){
  if (sb){
    const { error } = await sb.from('pb_responses').upsert({
      project_id:projectId, email_key:emailKey(r.email), email:r.email.trim(),
      decisions:r.decisions, features:r.features, notes:r.notes||'', updated_at:new Date().toISOString()
    }, { onConflict:'project_id,email_key' });
    if (error){ console.error(error); throw error; }
  } else {
    localStorage.setItem('gl_resp:'+projectId+':'+emailKey(r.email), JSON.stringify(r));
  }
}
async function getResponses(projectId){
  if (sb){
    const { data, error } = await sb.from('pb_responses').select('*').eq('project_id', projectId);
    if (error){ console.error(error); return []; }
    return (data||[]).map(d=>({ email:d.email, decisions:d.decisions||{}, features:d.features||{}, notes:d.notes||'' }));
  }
  const out=[]; const pre='gl_resp:'+projectId+':';
  for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i);
    if(k && k.indexOf(pre)===0){ try{ out.push(JSON.parse(localStorage.getItem(k))); }catch(e){} } }
  return out;
}

/* ---------------- parsers (builder) ---------------- */
function splitCSVLine(line){
  const out=[]; let cur=''; let q=false;
  for(let i=0;i<line.length;i++){ const ch=line[i];
    if(q){ if(ch==='"'){ if(line[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=ch; }
    else { if(ch==='"') q=true; else if(ch===','){ out.push(cur); cur=''; } else cur+=ch; } }
  out.push(cur); return out.map(s=>s.trim());
}
function parseFeatures(text){
  const lines=text.split(/\r?\n/).map(l=>l.replace(/\s+$/,'')).filter(l=>l.trim().length);
  if(!lines.length) return [];
  const isCSV = lines.filter(l=>l.includes(',')).length >= Math.max(1, Math.floor(lines.length*0.5));
  const cats=[]; const map={}; const seen={};
  function add(cat,name,info,def){ if(!name) return; cat=cat||'Features';
    if(!map[cat]){ map[cat]={name:cat,items:[]}; cats.push(map[cat]); }
    let id=slug(name); while(seen[id]) id=id+'_'+rid(2); seen[id]=1;
    const item={id,name,info:info||''};
    if(def && /^(mvp|soon|later)$/i.test(def)) item.default=def.toLowerCase();
    map[cat].items.push(item); }
  if(isCSV){
    let rows=lines.map(splitCSVLine); let ci=0,ni=1,ii=2,di=-1;
    const head=rows[0].map(c=>c.toLowerCase());
    if(head.some(c=>/categor|group|section|feature|name|item|info|descrip|detail|note|default|priority/.test(c))){
      const f=re=>head.findIndex(c=>re.test(c));
      ci=f(/categor|group|section/); ni=f(/feature|name|item|title/); ii=f(/info|descrip|detail|note/); di=f(/default|priority|phase/);
      if(ni<0) ni=(ci===0?1:0); rows=rows.slice(1);
    } else { const w=rows[0].length; if(w===1){ci=-1;ni=0;ii=-1;} else if(w===2){ci=0;ni=1;ii=-1;} else {ci=0;ni=1;ii=2;} }
    rows.forEach(r=>{ const cat=ci>=0?(r[ci]||''):''; const name=(r[ni]||'').trim(); const info=ii>=0?(r[ii]||''):''; const def=di>=0?(r[di]||''):''; if(name) add(cat,name,info,def); });
  } else {
    let cur='Features';
    lines.forEach(l=>{ const t=l.trim();
      if(t.endsWith(':')){ cur=t.slice(0,-1).trim()||'Features'; return; }
      let name=t,info=''; const b=t.indexOf('|'); if(b>=0){ name=t.slice(0,b).trim(); info=t.slice(b+1).trim(); }
      add(cur,name,info); });
  }
  return cats;
}
function parseDecisions(text){
  if(!text||!text.trim()) return [];
  const out=[];
  text.split(/\r?\n/).forEach(line=>{ const t=line.trim(); if(!t) return;
    let q=t,rest=''; const qm=t.indexOf('?');
    if(qm>=0){ q=t.slice(0,qm+1).trim(); rest=t.slice(qm+1); }
    else { const c=t.indexOf(':'); if(c>=0){ q=t.slice(0,c).trim(); rest=t.slice(c+1); } }
    out.push({ id:'d_'+slug(q)+'_'+rid(2), q, options:rest.split('/').map(s=>s.trim()).filter(Boolean) });
  });
  return out;
}

/* ---------------- router ---------------- */
function route(){
  const h=location.hash.replace(/^#/,''); const p=h.split('/').filter(Boolean);
  if(p[0]==='l' && p[1]) return fillView(p[1]);            // public respondent
  if(p[0]==='login') return loginView();
  if(p[0]==='results' && p[1]) return guard(()=>resultsView(p[1]));
  if(p[0]==='new') return guard(builderView);
  return guard(dashboardView);
}
function guard(fn){ if(!isAuthed()) return loginView(); return fn(); }
window.addEventListener('hashchange', route);

/* ---------------- login ---------------- */
function loginView(){
  root.innerHTML = `<div class="wrap">
    <div class="login-wrap"><div class="center-card">
      <div class="logo">${MARK}<span class="wm">Greenlight</span></div>
      <p class="sub" style="text-align:center;font-size:14.5px;margin-bottom:6px">Sign in to your workspace</p>
      <label>Email</label>
      <input id="em" type="email" placeholder="you@email.com" autocomplete="username" />
      <label>Password</label>
      <input id="pw" type="password" placeholder="Your password" autocomplete="current-password" />
      <button class="btn btn-green btn-block" id="in" style="margin-top:20px">Sign in</button>
      <div class="err" id="er"></div>
      <div class="note" style="text-align:center">Google sign in is coming next. For now this is a quick gate to get moving.</div>
    </div></div>
  </div>`;
  const em=root.querySelector('#em'), pw=root.querySelector('#pw'), er=root.querySelector('#er');
  const attempt=()=>{
    if(em.value.trim().toLowerCase()===String(CFG.ADMIN_EMAIL||'').toLowerCase() && pw.value===CFG.ADMIN_PASSWORD){
      sessionStorage.setItem('gl_admin', em.value.trim().toLowerCase()); go('');
    } else { er.textContent='That email or password did not match.'; }
  };
  root.querySelector('#in').onclick=attempt;
  pw.addEventListener('keydown',e=>{ if(e.key==='Enter') attempt(); });
  em.focus();
}

/* ---------------- dashboard ---------------- */
async function dashboardView(){
  root.innerHTML = `<div class="wrap">${topbar(true)}
    <header><div class="kicker">Workspace</div><h1>Prospect <em>projects</em></h1>
    <p class="sub">Each project has a share link you send to a client or team. They tag what matters, and the results land back here.</p></header>
    <div class="grid" id="grid"><p class="note" style="grid-column:1/-1">Loading\u2026</p></div>
    <div class="mode-note"></div>
  </div>`;
  const grid=root.querySelector('#grid');
  const projects=await getProjects(adminEmail());
  const cards=[];
  for(const pr of projects){
    let n=0; try{ n=(await getResponses(pr.id)).length; }catch(e){}
    const fc = pr.data&&pr.data.cats ? pr.data.cats.reduce((a,c)=>a+c.items.length,0) : 0;
    cards.push(`<div class="proj">
      <h3>${esc(pr.title)}</h3>
      <div class="meta">${fc} features \u00b7 ${n} ${n===1?'response':'responses'}</div>
      <div class="linkbox"><input type="text" readonly value="${esc(shareURL(pr.id))}" /><button class="copybtn" onclick="copy('${shareURL(pr.id)}')">Copy</button></div>
      <div class="acts"><button class="btn btn-green" onclick="go('results/${pr.id}')">View results</button><button class="btn btn-ghost" onclick="go('l/${pr.id}')">Preview</button></div>
    </div>`);
  }
  cards.push(`<div class="new-proj" onclick="go('new')">+ New project</div>`);
  grid.innerHTML = cards.join('');
  if(!useSupabase){ root.querySelector('.mode-note').innerHTML='<p class="note">Local mode. Projects live only in this browser. Add Supabase keys in config.js to share links with other people.</p>'; }
}

/* ---------------- builder ---------------- */
let bstate={title:'',features:'',decisions:'',preview:null};
function builderView(){
  const s=bstate;
  root.innerHTML = `<div class="wrap">${topbar(true)}
    <header><div class="kicker">New project</div><h1>Paste it in, <em>get a link</em></h1>
    <p class="sub">Drop the feature list as a CSV or as plain text. Add the key decisions you want answered. Preview, then create the shareable link.</p></header>
    <label>Project title</label>
    <input id="title" type="text" placeholder="Example: Acme, restaurant ordering app" value="${esc(s.title)}" />
    <label>Features</label>
    <textarea id="features" placeholder="CSV with a header row:
Category,Feature,Info
Core,Vertical fullscreen player,The main viewing surface
Core,Swipe to next feed,TikTok style consumption

Or plain text with a category line ending in a colon:
Core:
Vertical fullscreen player | The main viewing surface">${esc(s.features)}</textarea>
    <div class="row" style="margin-top:10px"><button class="btn btn-ghost" id="sample">Load the Flick sample</button><span class="note" style="margin:0">The Info column powers the circled i next to a feature.</span></div>
    <label>Key decisions (optional)</label>
    <textarea id="decisions" placeholder="One per line. Options after the question mark, split by a slash.
Which platform do we launch on? Native iOS / Native Android / Both" style="min-height:110px">${esc(s.decisions)}</textarea>
    <div class="row" style="margin-top:22px"><button class="btn btn-green" id="prev">Preview</button><button class="btn btn-ghost" id="create" style="${s.preview?'':'display:none'}">Create shareable list</button></div>
    <div id="pa"></div>
  </div>`;
  const T=root.querySelector('#title'),F=root.querySelector('#features'),D=root.querySelector('#decisions');
  const sync=()=>{s.title=T.value;s.features=F.value;s.decisions=D.value;};
  T.oninput=sync;F.oninput=sync;D.oninput=sync;
  root.querySelector('#sample').onclick=()=>{ F.value=SAMPLE_FEATURES; D.value=SAMPLE_DECISIONS; if(!T.value)T.value='Flick, vertical film web app'; sync(); toast('Sample loaded'); };
  root.querySelector('#prev').onclick=()=>{ sync(); const cats=parseFeatures(s.features); const dec=parseDecisions(s.decisions);
    if(!cats.length){ toast('Add some features first'); return; } s.preview={cats,decisions:dec}; renderPreview(); root.querySelector('#create').style.display=''; };
  root.querySelector('#create').onclick=async()=>{ sync(); if(!s.preview){toast('Preview first');return;}
    const id=slug(s.title).slice(0,20)+'_'+rid(4);
    try{ await createProject({ id, owner:adminEmail(), title:s.title.trim()||'Untitled', data:{cats:s.preview.cats, decisions:s.preview.decisions} });
      bstate={title:'',features:'',decisions:'',preview:null}; successView(id, s.title.trim()||'Untitled'); }
    catch(e){ toast('Could not save. Check Supabase setup.'); } };
  if(s.preview) renderPreview();
}
function renderPreview(){
  const {cats,decisions}=bstate.preview; const area=root.querySelector('#pa');
  const count=cats.reduce((a,c)=>a+c.items.length,0);
  area.innerHTML=`<div class="card"><div class="kicker" style="margin-bottom:8px">Preview</div>
    <p class="note" style="margin:0 0 16px">${count} features in ${cats.length} ${cats.length===1?'category':'categories'}${decisions.length?', plus '+decisions.length+' decision questions':''}.</p>
    ${decisions.length?`<div class="deck"><h3>Key decisions</h3>${decisions.map(d=>`<div class="q"><div class="ql">${esc(d.q)}</div><div class="opts">${(d.options.length?d.options:['(no options)']).map(o=>`<span class="opt">${esc(o)}</span>`).join('')}</div></div>`).join('')}</div>`:''}
    ${cats.map(c=>`<div class="cat"><div class="cat-h"><span class="n">${esc(c.name)}</span><span class="c">${c.items.length}</span></div>
      ${c.items.map(it=>`<div class="feat"><div class="feat-main"><div class="fname">${esc(it.name)}</div>${it.info?`<span class="info-btn">i</span>`:''}<div class="seg"><button>MVP</button><button>Soon</button><button>Later</button></div></div>${it.info?`<div class="info-panel hidden">${esc(it.info)}</div>`:''}</div>`).join('')}</div>`).join('')}
  </div>`;
  area.querySelectorAll('.info-btn').forEach(b=>{ const p=b.closest('.feat').querySelector('.info-panel'); if(p) b.onclick=()=>{p.classList.toggle('hidden');b.classList.toggle('open');}; });
}
function successView(id,title){
  root.innerHTML=`<div class="wrap">${topbar(true)}<div class="ok"><div class="markwrap" style="width:64px;margin:0 auto 18px">${MARK}</div>
    <h2>${esc(title)} is live</h2><p>Send the share link to your client or team. Track results from your dashboard.</p>
    <div style="text-align:left;margin-top:22px"><label style="margin-top:0">Share link</label>
      <div class="linkbox"><input type="text" readonly value="${esc(shareURL(id))}" /><button class="copybtn" onclick="copy('${shareURL(id)}')">Copy</button></div></div>
    <div class="row" style="justify-content:center;margin-top:22px"><button class="btn btn-green" onclick="go('results/${id}')">View results</button><button class="btn btn-ghost" onclick="go('')">Back to projects</button></div>
  </div></div>`;
}

/* ---------------- respondent fill ---------------- */
async function fillView(id){
  root.innerHTML=`<div class="wrap">${topbar(false)}<header><h1>Loading\u2026</h1></header></div>`;
  const project=await getProject(id);
  if(!project){ root.innerHTML=`<div class="wrap">${topbar(false)}<div class="empty" style="margin-top:40px">This list could not be found. The link may be wrong, or it was created in a different browser while in local mode.</div></div>`; return; }
  const {cats,decisions,meta}=project.data;
  const total=cats.reduce((a,c)=>a+c.items.length,0);
  const resp={ email:'', decisions:{}, features:{}, notes:'' };
  let defaultsApplied=false;
  let loadedFromPrevious=false;
  const sessionEmailKey='gl_last_email:'+id;

  async function loadPrevious(email){
    const prev=await getResponse(id, email);
    if(!prev) return false;
    resp.decisions={...(prev.decisions||{})};
    resp.features={...(prev.features||{})};
    resp.notes=prev.notes||'';
    loadedFromPrevious=true;
    return true;
  }

  function emailStep(){
    const savedEmail=sessionStorage.getItem(sessionEmailKey)||'';
    root.innerHTML=`<div class="wrap">${topbar(false)}
      <header><div class="kicker">${esc(project.title)}</div><h1>Help shape <em>what we build</em></h1>
      <p class="sub">Enter your email to start or pick up where you left off. Same email loads your previous answers so you can update them.</p></header>
      ${scopeBlock(meta)}
      <div class="center-card" style="margin-top:30px">
        <label style="margin-top:0">Your email</label>
        <input id="em" type="email" placeholder="you@email.com" value="${esc(savedEmail)}" />
        <button class="btn btn-green btn-block" id="next" style="margin-top:18px">Continue</button>
        <div class="err" id="er"></div>
        ${savedEmail?'<p class="note" style="margin-top:12px;text-align:center">We remember this email from your last visit on this device.</p>':''}
      </div></div>`;
    bindScopeToggle();
    const em=root.querySelector('#em'),er=root.querySelector('#er'),btn=root.querySelector('#next');
    const next=async()=>{
      const v=em.value.trim();
      if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)){ er.textContent='Please enter a valid email.'; return; }
      er.textContent='';
      btn.disabled=true; btn.textContent='Loading\u2026';
      resp.email=v;
      loadedFromPrevious=false;
      await loadPrevious(v);
      sessionStorage.setItem(sessionEmailKey, v);
      defaultsApplied=false;
      form();
    };
    btn.onclick=next;
    em.addEventListener('keydown',e=>{ if(e.key==='Enter') next(); });
    em.focus();
  }

  function form(){
    if(!defaultsApplied){
      if(!loadedFromPrevious) initFeatureDefaults(cats, resp.features);
      defaultsApplied=true;
    }
    const rated=Object.keys(resp.features).length; const pct=Math.round(rated/total*100);
    root.innerHTML=`<div class="wrap">${topbar(false)}
      <header><div class="kicker">${esc(project.title)}</div><h1>What matters <em>most</em>?</h1>
      <p class="sub">Features start from our written scope. Change anything that does not match your view. Tap the circled i for detail.</p></header>
      ${scopeBlock(meta)}
      ${loadedFromPrevious?'<div class="return-banner">Welcome back — your previous answers are loaded. Change anything and submit again to update.</div>':''}
      <div class="progress" style="margin-top:16px"><div class="bar"><span style="width:${pct}%"></span></div><div class="pct">${rated} of ${total} rated</div></div>
      ${decisions.length?`<div class="deck"><h3>Key decisions</h3>${decisions.map(d=>`<div class="q"><div class="ql">${esc(d.q)}</div><div class="opts" data-d="${d.id}">${d.options.map(o=>`<button class="opt ${resp.decisions[d.id]===o?'sel':''}" data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div></div>`).join('')}</div>`:''}
      ${cats.map(c=>{ const catRated=c.items.filter(it=>resp.features[it.id]).length;
        return `<div class="cat"><div class="cat-h"><span class="n">${esc(c.name)}</span><span class="c">${catRated}/${c.items.length}</span></div>
        ${c.items.map(it=>{ const cur=resp.features[it.id]; const changed=it.default&&cur&&cur!==it.default;
          return `<div class="feat${changed?' feat-changed':''}"><div class="feat-main"><div class="fname-wrap"><div class="fname">${esc(it.name)}</div>${it.default?`<span class="feat-default">Starts ${PRIORITY_LABEL[it.default]}</span>`:''}${changed?`<span class="feat-pick">Your pick</span>`:''}</div>${it.info?`<span class="info-btn" data-info="${it.id}">i</span>`:''}<div class="seg">${['mvp','soon','later'].map(v=>`<button data-id="${it.id}" data-v="${v}" class="${cur===v?'on':''}">${v==='mvp'?'MVP':v==='soon'?'Soon':'Later'}</button>`).join('')}</div></div>${it.info?`<div class="info-panel hidden" id="ip_${it.id}">${esc(it.info)}</div>`:''}</div>`; }).join('')}
      </div>`; }).join('')}
      <label>Anything we missed?</label>
      <textarea id="notes" placeholder="Features, concerns, must haves, references, anything on your mind.">${esc(resp.notes)}</textarea>
      <div class="submitbar"><button class="btn btn-green btn-block" id="submit">Submit my thoughts</button></div>
      <footer>Submitting as ${esc(resp.email)}. Come back with the same email any time to update.</footer>
    </div>`;
    bindScopeToggle();
    root.querySelectorAll('.opts').forEach(g=>{ const did=g.dataset.d; g.querySelectorAll('.opt').forEach(b=>{ b.onclick=()=>{ const o=b.dataset.o; resp.decisions[did]=resp.decisions[did]===o?undefined:o; saveScroll(); form(); }; }); });
    root.querySelectorAll('.info-btn').forEach(b=>{ b.onclick=()=>{ const p=root.querySelector('#ip_'+b.dataset.info); if(p){p.classList.toggle('hidden');b.classList.toggle('open');} }; });
    root.querySelectorAll('.seg button').forEach(b=>{ b.onclick=()=>{ const fid=b.dataset.id,v=b.dataset.v; if(resp.features[fid]===v) delete resp.features[fid]; else resp.features[fid]=v; saveScroll(); form(); }; });
    const nt=root.querySelector('#notes'); nt.oninput=()=>{ resp.notes=nt.value; };
    root.querySelector('#submit').onclick=submit;
    if(window._gl_scroll){ window.scrollTo(0,window._gl_scroll); window._gl_scroll=0; }
  }
  function saveScroll(){ window._gl_scroll=window.scrollY; }

  async function submit(){
    const clean={ email:resp.email, notes:(root.querySelector('#notes')?root.querySelector('#notes').value:resp.notes)||'',
      decisions:Object.fromEntries(Object.entries(resp.decisions).filter(([k,v])=>v!=null)), features:resp.features };
    resp.notes=clean.notes;
    try{ await saveResponse(id, clean); sessionStorage.setItem(sessionEmailKey, resp.email); thanks(); }catch(e){ toast('Could not submit. Try again.'); }
  }
  function thanks(){
    root.innerHTML=`<div class="wrap">${topbar(false)}<div class="ok"><div class="markwrap" style="width:64px;margin:0 auto 18px">${MARK}</div>
      <h2>Thank you</h2><p>Your thoughts are in for ${esc(project.title)}. The team will use this to lock what we build first. You can close this tab.</p>
      <p class="note" style="margin-top:14px">Come back with the same email (${esc(resp.email)}) any time to update your answers.</p>
      <div class="row" style="justify-content:center;margin-top:22px"><button class="btn btn-ghost" id="edit">Edit my answers</button></div></div></div>`;
    root.querySelector('#edit').onclick=()=>{ loadedFromPrevious=true; defaultsApplied=true; form(); };
  }
  emailStep();
}

/* ---------------- results (admin) ---------------- */
async function resultsView(id){
  root.innerHTML=`<div class="wrap">${topbar(true)}<header><h1>Loading\u2026</h1></header></div>`;
  const project=await getProject(id);
  if(!project){ root.innerHTML=`<div class="wrap">${topbar(true)}<div class="empty" style="margin-top:40px">Project not found.</div></div>`; return; }
  const {cats,decisions,meta}=project.data;
  const all=await getResponses(id);
  const {ALL,score,dtal,n,ranked,threshold}=computeResultsData(cats,decisions,all);
  const legend=`<div class="legend"><span><i class="dot" style="background:var(--green)"></i>MVP</span><span><i class="dot" style="background:var(--blue)"></i>Soon</span><span><i class="dot" style="background:var(--grey)"></i>Later</span></div>`;
  const diverged=ALL.filter(f=>{ const t=score[f.id].mvp+score[f.id].soon+score[f.id].later; if(!t||!f.default) return false; const c=consensusPick(score[f.id],n,threshold); return c&&c!==f.default; });
  function rowHtml({f,s}, extra){
    const t=s.mvp+s.soon+s.later||1;
    const consensus=consensusPick(s,n,threshold);
    const delta=f.default&&consensus&&consensus!==f.default?`<span class="res-delta">Default ${PRIORITY_LABEL[f.default]} \u2192 team ${PRIORITY_LABEL[consensus]}</span>`:'';
    return `<div class="res-row${delta?' res-row-drift':''}"><div class="res-top"><span class="rn">${esc(f.name)}</span><span class="score">${s.mvp} of ${n} say MVP</span></div>
      ${delta?`<div class="res-delta-row">${delta}</div>`:''}${extra||''}
      <div class="stack"><i style="width:${s.mvp/t*100}%;background:var(--green)"></i><i style="width:${s.soon/t*100}%;background:var(--blue)"></i><i style="width:${s.later/t*100}%;background:var(--grey)"></i></div></div>`;
  }
  function rows(list){ return list.map(x=>rowHtml(x)).join(''); }
  const notes=all.filter(v=>v.notes&&v.notes.trim());

  root.innerHTML=`<div class="wrap">${topbar(true)}
    <header><div class="kicker">Results</div><h1>${esc(project.title)}</h1>
    <p class="sub">${n} ${n===1?'person has':'people have'} responded.</p></header>
    ${scopeBlock(meta)}
    <div class="card" style="margin-top:20px"><label style="margin-top:0">Share link</label>
      <div class="linkbox"><input type="text" readonly value="${esc(shareURL(id))}" /><button class="copybtn" onclick="copy('${shareURL(id)}')">Copy</button></div></div>
    ${n>0?`<div class="row" style="margin-top:16px"><button class="btn btn-ghost" id="expJson">Export JSON</button><button class="btn btn-ghost" id="expCsv">Export CSV</button><button class="btn btn-green" id="expMvp">Export locked MVP</button></div>`:''}
    ${n===0?`<div class="empty" style="margin-top:20px">No responses yet. Share the link above and results will appear here.</div>`:`
      ${notes.length?`<div class="res-cat">Notes and things we might have missed</div>${notes.map(v=>`<div class="note-card"><div class="who">${esc(v.email)}</div><div class="body">${esc(v.notes)}</div></div>`).join('')}`:''}
      ${decisions.length?`<div class="deck" style="margin-top:24px"><h3>Key decisions</h3>${decisions.map(d=>`<div class="q"><div class="ql">${esc(d.q)}</div><div class="pill-tally">${d.options.map(o=>`<span>${esc(o)} <b>${dtal[d.id][o]||0}</b></span>`).join('')}</div></div>`).join('')}</div>`:''}
      ${diverged.length?`<div class="res-cat">Changed from starting scope</div><p class="note" style="margin:-4px 0 12px">${diverged.length} feature${diverged.length===1?'':'s'} where team consensus differs from the default tags.</p>${rows(diverged.map(f=>({f,s:score[f.id]})))}`:''}
      ${legend}
      <div class="res-cat">Strongest MVP consensus</div>${rows(ranked.slice(0,12))}
      <div class="res-cat" style="margin-top:26px">Everything else, by category</div>
      ${cats.map(c=>{ const lst=c.items.map(it=>({f:ALL.find(x=>x.id===it.id),s:score[it.id]})).filter(x=>x.s.mvp+x.s.soon+x.s.later>0);
        if(!lst.length) return ''; return `<div style="margin-top:14px"><div style="font-size:13px;color:var(--muted);margin:0 2px 8px;font-weight:600">${esc(c.name)}</div>${rows(lst)}</div>`; }).join('')}
      <div class="res-cat" style="margin-top:26px">Respondents</div>
      <div class="pill-tally">${all.map(v=>`<span>${esc(v.email)}</span>`).join('')}</div>
    `}
    <div class="row" style="margin-top:28px"><button class="btn btn-ghost" onclick="location.reload()">Refresh</button><button class="btn btn-ghost" onclick="go('')">Back to projects</button></div>
  </div>`;
  bindScopeToggle();
  const ej=root.querySelector('#expJson'), ec=root.querySelector('#expCsv'), em=root.querySelector('#expMvp');
  if(ej) ej.onclick=()=>exportResultsJSON(project,all);
  if(ec) ec.onclick=()=>exportResultsCSV(project,all);
  if(em) em.onclick=()=>exportLockedMvp(project,all);
}

/* ---------------- sample text for the builder ---------------- */
const SAMPLE_FEATURES = `Category,Feature,Info,Default
Core Player and Feed,Vertical fullscreen player,The main viewing surface every video plays inside.,mvp
Core Player and Feed,Swipe to next feed,TikTok style consumption. The recommended starting wedge.,mvp
Core Player and Feed,Autoplay on scroll,The next video starts automatically as you move through the feed.,mvp
Core Player and Feed,Resume where you left off,,mvp
Discovery and Browse,Search,Find titles filmmakers and tags.,mvp
Discovery and Browse,Filmmaker pages,A dedicated page for each creator and their work.,mvp
Accounts and Profiles,Email and password sign up,,mvp
Subscriptions and Monetization,Stripe subscription checkout,Web checkout for paid plans.,mvp
Subscriptions and Monetization,Paywall or subscription gate,,mvp
Notifications and Retention,Web push notifications,Browser push for new content.,soon
Offline and Extras,Offline downloads,Save titles to watch without a connection.,later`;
const SAMPLE_DECISIONS = `Which platform do we launch on? Native iOS / Native Android / Both
Admin or content tool for launch? Full tool at launch / Scaled down and scrappy / Later, keep it manual for now`;

/* ---------------- boot ---------------- */
if(!location.hash) { go(isAuthed()?'':'login'); }
route();
