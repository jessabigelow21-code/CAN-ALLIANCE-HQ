
const KEY='canAllianceHQ_v5_fixed';
const OLD_KEYS=['canAllianceHQ_v4','canAllianceHQ_v3','canAllianceHQ_v2','canAllianceHQ_v1'];
const clone=x=>JSON.parse(JSON.stringify(x));
let state=loadState();
let currentPage='dashboard';
let currentMessageTab='Template';
let btSortMode='high';

function loadState(){
  let saved=null;
  for(const k of [KEY,...OLD_KEYS]){
    try{
      const x=JSON.parse(localStorage.getItem(k));
      if(x && Array.isArray(x.members) && x.members.length){ saved=x; break; }
    }catch(e){}
  }
  if(!saved) saved=clone(window.CAN_SEED_DATA);
  saved.events=Array.isArray(saved.events)?saved.events:[];
  saved.messages=Array.isArray(saved.messages)?saved.messages:[];
  saved.settings={allianceName:'CAN',stateNumber:'2578',cjTeamSize:6,rankingMinimum:5,...(saved.settings||{})};
  migrateEvents(saved);
  localStorage.setItem(KEY,JSON.stringify(saved));
  return saved;
}
function migrateEvents(s){
  (s.events||[]).forEach(e=>{
    e.planning=e.planning||{};
    e.attendance=e.attendance||{};
    e.guestIds=e.guestIds||[];
    e.teams=e.teams||[];
    e.damage=e.damage||{};
    Object.entries(e.attendance).forEach(([mid,v])=>{
      if(!e.planning[mid] && ['yes','sub','off'].includes(v)){
        e.planning[mid]=v==='yes'?'deployed':v==='sub'?'substitute':'notdeployed';
      }
    });
  });
}
function persist(){localStorage.setItem(KEY,JSON.stringify(state));render();}
function esc(v=''){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function fmtDate(x){return x?new Date(x+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'';}
function membersActive(){return state.members.filter(m=>m.status==='Active');}
function sortGaia(a,b){return (a.gaia??9999)-(b.gaia??9999)||String(a.name).localeCompare(String(b.name));}
function strengthNumber(v){
  const s=String(v??'').trim().toLowerCase().replace(/,/g,'');
  const n=parseFloat(s); if(!Number.isFinite(n))return 0;
  if(s.endsWith('t'))return n*1e12;
  if(s.endsWith('b'))return n*1e9;
  if(s.endsWith('m'))return n*1e6;
  if(s.endsWith('k'))return n*1e3;
  return n;
}
function sortPower(a,b){return strengthNumber(b.strength||b.power)-strengthNumber(a.strength||a.power)||sortGaia(a,b);}
function formatDamage(n){
  n=Number(n||0);
  if(n>=1e12)return `${(n/1e12).toFixed(2)}T`;
  if(n>=1e9)return `${(n/1e9).toFixed(2)}B`;
  if(n>=1e6)return `${(n/1e6).toFixed(1)}M`;
  if(n>=1e3)return `${(n/1e3).toFixed(1)}K`;
  return String(Math.round(n));
}
function eventLabel(e){return `${esc(e.type)} • ${fmtDate(e.date)} • ${esc(e.time)} UTC${e.group?' • '+esc(e.group):''}`;}
function stat(label,value){return `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`;}
function tile(id,emoji,title,sub){return `<button class="tile" onclick="page('${id}')"><span class="emoji">${emoji}</span><b>${title}</b><small>${sub}</small></button>`;}

function page(id){
  currentPage=id;
  document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id===id));
  document.querySelectorAll('.bottom-nav button').forEach(x=>x.classList.toggle('active',x.dataset.page===id));
  render();
  scrollTo(0,0);
}
document.querySelectorAll('.bottom-nav button').forEach(b=>b.addEventListener('click',()=>page(b.dataset.page)));

function render(){
  renderDashboard(); renderMembers(); renderEventHome('Crazy Joe','crazyjoe');
  renderEventHome('Foundry','foundry'); renderEventHome('Canyon','canyon');
  renderBear(); renderMessages(); renderIntel(); renderSettings();
}
function renderDashboard(){
  if(!window.dashboard)return;
  const active=membersActive().length,bt1=membersActive().filter(m=>m.bt==='BT1').length;
  dashboard.innerHTML=`<div class="grid tiles">
  ${tile('members','👥','Members',`${active} active players`)}
  ${tile('crazyjoe','⚔️','Crazy Joe','BT-separated balanced teams')}
  ${tile('foundry','🏭','Foundry','Legion planning')}
  ${tile('canyon','🏰','Canyon Clash','Mission teams')}
  ${tile('bear','🐻','Bear Trap','Damage tracker')}
  ${tile('messages','💬','Messages','Templates')}
  ${tile('intel','🧠','Intelligence','Attendance')}
  ${tile('settings','⚙️','Settings','Backups')}
  </div><div class="section-head"><h2>Alliance Summary</h2></div>
  <div class="stats">${stat('Active',active)}${stat('BT1',bt1)}${stat('BT2',active-bt1)}${stat('Events',state.events.length)}</div>`;
}
function renderMembers(){
  if(!window.members)return;
  const q=(document.getElementById('memberSearch')?.value||'').toLowerCase();
  const f=document.getElementById('memberFilter')?.value||'All';
  let list=state.members.filter(m=>String(m.name).toLowerCase().includes(q));
  if(f==='BT1'||f==='BT2')list=list.filter(m=>m.bt===f); else if(f!=='All')list=list.filter(m=>m.status===f);
  list.sort(sortGaia);
  members.innerHTML=`<div class="section-head"><h2>Members</h2></div>
  <div class="toolbar two"><input id="memberSearch" placeholder="Search player" value="${esc(q)}" oninput="renderMembers()">
  <select id="memberFilter" onchange="renderMembers()">${['All','Active','Vacation','Archived','BT1','BT2'].map(x=>`<option ${x===f?'selected':''}>${x}</option>`).join('')}</select></div>
  <div class="list">${list.map(m=>`<div class="member-card"><b>${esc(m.name)}</b><div class="meta">Gaia #${m.gaia??'—'} • ${esc(m.strength||m.power||'No power')} • ${esc(m.bt||'')}</div></div>`).join('')}</div>`;
}
function eventCard(e){return `<div class="event-card row"><div><b>${eventLabel(e)}</b></div><button class="btn small" onclick="openEvent('${e.id}')">Open</button></div>`;}
function renderEventHome(type,id){
  const el=document.getElementById(id); if(!el)return;
  const list=state.events.filter(e=>e.type===type).sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time));
  el.innerHTML=`<div class="section-head"><h2>${type}</h2><button class="btn primary" onclick="newEvent('${type}')">+ New Event</button></div>
  <div class="notice">${type==='Crazy Joe'?'Teams stay separated by BT and are balanced by power.':'Choose Deployed, Substitute, or Not Deployed.'}</div>
  <div class="section-head"><h2>Event History</h2></div><div class="list">${list.map(eventCard).join('')||'<div class="empty">No events yet.</div>'}</div>`;
}
function renderBear(){
  if(!window.bear)return;
  const list=state.events.filter(e=>e.type==='Bear Trap').sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time));
  bear.innerHTML=`<div class="section-head"><h2>Bear Trap</h2><button class="btn primary" onclick="newEvent('Bear Trap')">+ New Event</button></div>
  <div class="list">${list.map(eventCard).join('')||'<div class="empty">No events yet.</div>'}</div>`;
}
function newEvent(type){
  eventType.value=type; eventDialogTitle.textContent=`New ${type} Event`; eventDate.value=new Date().toISOString().slice(0,10); eventTime.value='';
  const opts=type==='Bear Trap'?['BT1','BT2']:(type==='Foundry'||type==='Canyon'?['Legion 1','Legion 2']:[]);
  eventGroupWrap.style.display=opts.length?'block':'none'; eventGroup.innerHTML=opts.map(x=>`<option>${x}</option>`).join('');
  eventDialog.showModal();
}
createEventBtn.onclick=()=>{
  if(!eventDate.value||!eventTime.value)return alert('Choose a date and UTC time.');
  const type=eventType.value,group=eventGroupWrap.style.display==='none'?'':eventGroup.value;
  const e={id:`event-${Date.now()}`,type,date:eventDate.value,time:eventTime.value,group,planning:{},attendance:{},guestIds:[],teams:[],damage:{}};
  baseEligible(e).forEach(m=>{e.planning[m.id]='';e.attendance[m.id]='';});
  state.events.push(e);eventDialog.close();persist();openEvent(e.id);
};
function baseEligible(e){
  return membersActive().filter(m=>e.type!=='Bear Trap'||m.bt===e.group)
    .filter(m=>e.type!=='Foundry'||m.foundry===e.group)
    .filter(m=>e.type!=='Canyon'||m.canyon===e.group);
}
function eligibleFor(e){
  const ids=new Set(baseEligible(e).map(m=>m.id)); (e.guestIds||[]).forEach(id=>ids.add(id));
  return state.members.filter(m=>ids.has(m.id)&&m.status==='Active').sort(sortGaia);
}
function openEvent(id){
  const e=state.events.find(x=>x.id===id); if(!e)return;
  const pid=e.type==='Crazy Joe'?'crazyjoe':e.type==='Bear Trap'?'bear':e.type.toLowerCase();
  page(pid); document.getElementById(pid).innerHTML=eventDetail(e);
}
function planningModes(){return [['deployed','Deployed'],['substitute','Substitute'],['notdeployed','Not Deployed']];}
function attendanceModes(){return [['present','Present'],['noshow','No Show'],['excused','Excused']];}
function statusRow(e,m,field,modes){
  return `<div class="attendance-row"><div><b>${esc(m.name)}</b></div>${modes.map(([v,t])=>`<button class="${e[field]?.[m.id]===v?'on '+v:''}" onclick="setStatus('${e.id}','${m.id}','${field}','${v}')">${t}</button>`).join('')}</div>`;
}
function eventDetail(e){
  const eligible=eligibleFor(e);
  return `<div class="section-head"><h2>${eventLabel(e)}</h2><button class="btn" onclick="render();page('${e.type==='Crazy Joe'?'crazyjoe':e.type==='Bear Trap'?'bear':e.type.toLowerCase()}')">Back</button></div>
  <div class="event-card"><div class="actions">${e.type!=='Bear Trap'?`<button class="btn primary" onclick="generateTeams('${e.id}')">Generate Teams</button>`:''}<button class="btn danger" onclick="deleteEvent('${e.id}')">Delete Event</button></div></div>
  ${e.type!=='Bear Trap'?`<div class="section-head"><h2>Team-Building Status</h2></div><div class="attendance">${eligible.map(m=>statusRow(e,m,'planning',planningModes())).join('')}</div>`:''}
  <div class="section-head"><h2>After-Event Attendance</h2></div><div class="attendance">${eligible.map(m=>statusRow(e,m,'attendance',attendanceModes())).join('')}</div>
  ${e.type!=='Bear Trap'?`<div class="section-head"><h2>Teams</h2></div>${renderTeams(e)}`:''}`;
}
function setStatus(eid,mid,field,v){const e=state.events.find(x=>x.id===eid);e[field]=e[field]||{};e[field][mid]=v;persist();openEvent(eid);}
function deleteEvent(id){if(confirm('Delete this event?')){state.events=state.events.filter(e=>e.id!==id);persist();page(currentPage);}}

function generateTeams(id){
  const e=state.events.find(x=>x.id===id);
  const deployed=eligibleFor(e).filter(m=>e.planning?.[m.id]==='deployed');
  const substitutes=eligibleFor(e).filter(m=>e.planning?.[m.id]==='substitute');
  if(!deployed.length)return alert('Mark participating players as Deployed first.');

  if(e.type==='Crazy Joe'){
    e.teams=[];
    ['BT1','BT2'].forEach(bt=>{
      const main=deployed.filter(m=>m.bt===bt).sort(sortPower);
      const subs=substitutes.filter(m=>m.bt===bt).sort(sortPower);
      if(!main.length&&!subs.length)return;
      const size=Number(state.settings.cjTeamSize)||6;
      const count=Math.max(1,Math.ceil(main.length/size));
      const teams=Array.from({length:count},(_,i)=>({name:`${bt} Team ${i+1}`,objective:`${bt} only`,members:[],subs:[]}));
      main.forEach((m,i)=>{
        const round=Math.floor(i/count),pos=i%count,idx=round%2===0?pos:count-1-pos;
        teams[idx].members.push(m.id);
      });
      subs.forEach((m,i)=>teams[i%count].subs.push(m.id));
      e.teams.push(...teams);
    });
  }else{
    const count=e.type==='Foundry'?6:6;
    const names=e.type==='Foundry'?['Group 1','Group 2','Group 3','Group 4','Group 5','Group 6']:['Team A','Team B','Team C','Team D','Team E','Team F'];
    e.teams=names.map(name=>({name,members:[],subs:[]}));
    [...deployed].sort(sortPower).forEach((m,i)=>e.teams[i%count].members.push(m.id));
    [...substitutes].sort(sortPower).forEach((m,i)=>e.teams[i%count].subs.push(m.id));
  }
  persist();openEvent(id);
}
function renderTeams(e){
  if(!e.teams?.length)return '<div class="empty">No teams generated yet.</div>';
  return `<div class="team-grid">${e.teams.map(t=>{
    const ms=t.members.map(id=>state.members.find(m=>m.id===id)).filter(Boolean);
    const total=ms.reduce((n,m)=>n+strengthNumber(m.strength||m.power),0);
    return `<div class="team-card"><div class="row"><b>${esc(t.name)}</b><span class="badge">${formatDamage(total)} power</span></div>
    <div class="chips">${ms.map(m=>`<span class="chip">${esc(m.name)} • ${esc(m.strength||m.power||'')}</span>`).join('')}</div>
    ${t.subs?.length?`<div class="meta" style="margin-top:10px">Substitutes</div><div class="chips">${t.subs.map(id=>`<span class="chip">${esc(state.members.find(m=>m.id===id)?.name||'Unknown')}</span>`).join('')}</div>`:''}</div>`;
  }).join('')}</div>`;
}

function renderMessages(){if(window.messages)messages.innerHTML='<div class="section-head"><h2>Alliance Messages</h2></div><div class="empty">Messages preserved in saved data.</div>';}
function renderIntel(){if(window.intel)intel.innerHTML='<div class="section-head"><h2>Intelligence</h2></div><div class="stats">'+stat('Active',membersActive().length)+stat('Events',state.events.length)+'</div>';}
function renderSettings(){
  if(!window.settings)return;
  settings.innerHTML=`<div class="section-head"><h2>Settings</h2></div><div class="member-card"><label>CJ Team Size<input id="settingCJ" type="number" min="2" max="12" value="${state.settings.cjTeamSize}"></label><div class="actions" style="margin-top:12px"><button class="btn primary" onclick="state.settings.cjTeamSize=Number(settingCJ.value)||6;persist();alert('Saved')">Save</button></div></div>`;
}
function restoreRoster(){state.members=clone(window.CAN_SEED_DATA.members);persist();}
render();page('dashboard');
