const KEY='canAllianceHQ_v4';
const OLD_KEYS=['canAllianceHQ_v3','canAllianceHQ_v2','canAllianceHQ_v1'];
const clone=x=>JSON.parse(JSON.stringify(x));
let state=loadState();
let currentPage='dashboard';
let currentMessageTab='Template';
let btSortMode='high';

function loadState(){
  let saved=null;
  try{saved=JSON.parse(localStorage.getItem(KEY));}catch(e){}
  if(saved && Array.isArray(saved.members) && saved.members.length){
    migrateEvents(saved);
    return saved;
  }

  let migrated=clone(window.CAN_SEED_DATA);
  migrated.events=[];
  for(const k of OLD_KEYS){
    try{
      const old=JSON.parse(localStorage.getItem(k));
      if(old){
        if(Array.isArray(old.events)) migrated.events=old.events;
        if(Array.isArray(old.messages)&&old.messages.length) migrated.messages=old.messages;
        if(old.settings) migrated.settings={...migrated.settings,...old.settings};
        break;
      }
    }catch(e){}
  }
  migrateEvents(migrated);
  localStorage.setItem(KEY,JSON.stringify(migrated));
  return migrated;
}

function migrateEvents(container){
  (container.events||[]).forEach(e=>{
    e.planning=e.planning||{};
    e.attendance=e.attendance||{};
    e.guestIds=e.guestIds||[];
    e.damage=e.damage||{};

    // Migrate old planning values that were stored in attendance.
    Object.entries(e.attendance).forEach(([mid,status])=>{
      if(e.type==='Crazy Joe' && ['yes','sub','off'].includes(status) && !e.planning[mid]){
        e.planning[mid]=status==='yes'?'deployed':status==='sub'?'substitute':'notdeployed';
        delete e.attendance[mid];
      }
      if((e.type==='Foundry'||e.type==='Canyon') && ['present','noshow','notplaying','excused'].includes(status) && !e.planning[mid]){
        if(status==='present') e.planning[mid]='deployed';
        if(status==='notplaying') e.planning[mid]='notdeployed';
      }
    });
  });
}

function persist(){localStorage.setItem(KEY,JSON.stringify(state));render();}
function esc(v=''){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function page(id){
  currentPage=id;
  document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id===id));
  document.querySelectorAll('.bottom-nav button').forEach(x=>x.classList.toggle('active',x.dataset.page===id));
  render();
  window.scrollTo(0,0);
}
document.querySelectorAll('.bottom-nav button').forEach(b=>b.addEventListener('click',()=>page(b.dataset.page)));

function membersActive(){return state.members.filter(m=>m.status==='Active');}
function fmtDate(x){return x?new Date(x+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'';}
function eventLabel(e){return `${esc(e.type)} • ${fmtDate(e.date)} • ${esc(e.time)} UTC${e.group?' • '+esc(e.group):''}`;}
function sortGaia(a,b){return (a.gaia??9999)-(b.gaia??9999)||a.name.localeCompare(b.name);}
function strengthNumber(v){
  if(v==null)return 0;
  const s=String(v).trim().toLowerCase().replace(/,/g,'');
  const n=parseFloat(s);
  if(!Number.isFinite(n))return 0;
  if(s.endsWith('t'))return n*1e12;
  if(s.endsWith('b'))return n*1e9;
  if(s.endsWith('m'))return n*1e6;
  if(s.endsWith('k'))return n*1e3;
  return n;
}
function sortPower(a,b){return strengthNumber(b.strength)-strengthNumber(a.strength)||sortGaia(a,b);}

function render(){
  renderDashboard(); renderMembers(); renderEventHome('Crazy Joe','crazyjoe'); renderEventHome('Foundry','foundry');
  renderEventHome('Canyon','canyon'); renderBear(); renderMessages(); renderIntel(); renderSettings();
}
function renderDashboard(){
  const active=membersActive().length, bt1=membersActive().filter(m=>m.bt==='BT1').length, bt2=active-bt1;
  dashboard.innerHTML=`<div class="grid tiles">
    ${tile('members','👥','Members',`${active} active players`)}
    ${tile('crazyjoe','⚔️','Crazy Joe','Separate BT teams')}
    ${tile('foundry','🏭','Foundry','Weekly legion planning')}
    ${tile('canyon','🏰','Canyon Clash','Mission teams A–F')}
    ${tile('bear','🐻','Bear Trap','Damage tracker')}
    ${tile('messages','💬','Messages','Templates and guides')}
    ${tile('intel','🧠','Intelligence','Attendance analytics')}
    ${tile('settings','⚙️','Settings','Backups and defaults')}
  </div>
  <div class="section-head"><h2>Alliance Summary</h2></div>
  <div class="stats">${stat('Active',active)}${stat('BT1',bt1)}${stat('BT2',bt2)}${stat('Events',state.events.length)}</div>
  <div class="section-head"><h2>Recent Events</h2></div>
  <div class="list">${recentEvents()}</div>`;
}
function tile(id,emoji,title,sub){return `<button class="tile" onclick="page('${id}')"><span class="emoji">${emoji}</span><b>${title}</b><small>${sub}</small></button>`}
function stat(label,value){return `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`}
function recentEvents(){
  const list=[...state.events].sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time)).slice(0,5);
  return list.length?list.map(e=>`<div class="event-card row"><div><b>${eventLabel(e)}</b></div><button class="btn small" onclick="openEvent('${e.id}')">Open</button></div>`).join(''):`<div class="empty">No events yet.</div>`;
}

function renderMembers(){
  const q=(document.getElementById('memberSearch')?.value||'').toLowerCase();
  const f=document.getElementById('memberFilter')?.value||'All';
  let list=state.members.filter(m=>m.name.toLowerCase().includes(q));
  if(f==='BT1'||f==='BT2')list=list.filter(m=>m.bt===f);
  else if(f!=='All')list=list.filter(m=>m.status===f);
  list.sort(sortGaia);
  members.innerHTML=`<div class="section-head"><h2>Members</h2><button class="btn primary" onclick="openMember()">+ Add</button></div>
  <div class="toolbar two"><input id="memberSearch" placeholder="Search player" value="${esc(q)}" oninput="renderMembers()">
  <select id="memberFilter" onchange="renderMembers()">${['All','Active','Vacation','Archived','BT1','BT2'].map(x=>`<option ${x===f?'selected':''}>${x}</option>`).join('')}</select></div>
  <div class="notice">${state.members.length} roster members are preloaded from the master roster.</div>
  <div class="list" style="margin-top:12px">${list.map(memberCard).join('')||'<div class="empty">No members found.</div>'}</div>`;
}
function memberCard(m){return `<div class="member-card"><div class="row"><div><b>${esc(m.name)}</b><div class="meta">Gaia #${m.gaia??'—'} • ${esc(m.strength||'No strength')} • ${esc(m.bt)}<br>${esc(m.foundry)} Foundry • ${esc(m.canyon)} Canyon</div><span class="badge">${esc(m.status)}</span></div><button class="btn small" onclick="openMember('${m.id}')">Edit</button></div></div>`}
function openMember(id=''){
  const m=state.members.find(x=>x.id===id)||{bt:'BT1',status:'Active',foundry:'Legion 1',canyon:'Legion 1'};
  memberDialogTitle.textContent=id?'Edit Member':'Add Member'; memberId.value=m.id||''; memberName.value=m.name||''; memberGaia.value=m.gaia||''; memberStrength.value=m.strength||''; memberBT.value=m.bt; memberStatus.value=m.status; memberFoundry.value=m.foundry; memberCanyon.value=m.canyon; memberNotes.value=m.notes||''; memberDialog.showModal();
}
saveMemberBtn.onclick=()=>{
  if(!memberName.value.trim())return alert('Player name is required.');
  const id=memberId.value||`member-${Date.now()}`;
  const m={id,name:memberName.value.trim(),gaia:memberGaia.value?Number(memberGaia.value):null,strength:memberStrength.value.trim(),bt:memberBT.value,status:memberStatus.value,foundry:memberFoundry.value,canyon:memberCanyon.value,region:'Unknown/Mixed',notes:memberNotes.value.trim()};
  const i=state.members.findIndex(x=>x.id===id); if(i>=0)state.members[i]=m;else state.members.push(m);
  memberDialog.close();persist();
};

function renderEventHome(type,id){
  const el=document.getElementById(id), list=state.events.filter(e=>e.type===type).sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time));
  const note=type==='Crazy Joe'
    ?'Players are separated by BT first. Each BT is then balanced by player strength.'
    :type==='Foundry'
      ?'Choose Deployed, Substitute, or Not Deployed. You can add a player from the other legion for this event only.'
      :'Choose Deployed, Substitute, or Not Deployed. Weekly guest players can also be added for this event only.';
  el.innerHTML=`<div class="section-head"><h2>${type}</h2><button class="btn primary" onclick="newEvent('${type}')">+ New Event</button></div>
  <div class="notice">${note}</div>
  <div class="section-head"><h2>Event History</h2></div><div class="list">${list.map(eventCard).join('')||'<div class="empty">No events yet.</div>'}</div>`;
}
function renderBear(){
  const list=state.events.filter(e=>e.type==='Bear Trap').sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time));
  bear.innerHTML=`<div class="section-head"><h2>Bear Trap</h2><button class="btn primary" onclick="newEvent('Bear Trap')">+ New Event</button></div>
  <div class="notice">Open an event to enter each player's personal rally damage. Rankings can be sorted highest-to-lowest or lowest-to-highest.</div>
  <div class="section-head"><h2>Event History</h2></div><div class="list">${list.map(eventCard).join('')||'<div class="empty">No events yet.</div>'}</div>
  <div class="section-head"><h2>Damage Rankings</h2><select style="width:auto;margin:0" onchange="btSortMode=this.value;renderBear()"><option value="high" ${btSortMode==='high'?'selected':''}>Highest to Lowest</option><option value="low" ${btSortMode==='low'?'selected':''}>Lowest to Highest</option></select></div>${damageRankings()}`;
}
function eventCard(e){return `<div class="event-card row"><div><b>${eventLabel(e)}</b></div><button class="btn small" onclick="openEvent('${e.id}')">Open</button></div>`}
function newEvent(type){
  eventType.value=type; eventDialogTitle.textContent=`New ${type} Event`; eventDate.value=new Date().toISOString().slice(0,10); eventTime.value='';
  let opts=[]; if(type==='Bear Trap')opts=['BT1','BT2']; else if(type==='Foundry'||type==='Canyon')opts=['Legion 1','Legion 2'];
  eventGroupWrap.style.display=opts.length?'block':'none'; eventGroup.innerHTML=opts.map(x=>`<option>${x}</option>`).join('');
  eventDialog.showModal();
}
createEventBtn.onclick=()=>{
  if(!eventDate.value||!eventTime.value)return alert('Choose a date and enter a UTC time.');
  const type=eventType.value, group=eventGroupWrap.style.display==='none'?'':eventGroup.value;
  const eligible=baseEligible({type,group,guestIds:[]});
  const planning={}, attendance={}; eligible.forEach(m=>{planning[m.id]='';attendance[m.id]='';});
  const e={id:`event-${Date.now()}`,type,date:eventDate.value,time:eventTime.value,group,planning,attendance,guestIds:[],teams:[],damage:{}};
  state.events.push(e);eventDialog.close();persist();openEvent(e.id);
};

function baseEligible(e){
  return membersActive()
    .filter(m=>e.type!=='Bear Trap'||m.bt===e.group)
    .filter(m=>e.type!=='Foundry'||m.foundry===e.group)
    .filter(m=>e.type!=='Canyon'||m.canyon===e.group);
}
function eligibleFor(e){
  const ids=new Set(baseEligible(e).map(m=>m.id));
  (e.guestIds||[]).forEach(id=>ids.add(id));
  return state.members.filter(m=>ids.has(m.id)&&m.status==='Active').sort(sortGaia);
}
function guestCandidates(e){
  const current=new Set(eligibleFor(e).map(m=>m.id));
  return membersActive().filter(m=>!current.has(m.id)).sort(sortGaia);
}
function addGuest(eid){
  const e=state.events.find(x=>x.id===eid);
  const sel=document.getElementById(`guest-${eid}`);
  if(!sel?.value)return;
  e.guestIds=e.guestIds||[];
  if(!e.guestIds.includes(sel.value))e.guestIds.push(sel.value);
  e.planning[sel.value]='';
  e.attendance[sel.value]='';
  persist();openEvent(eid);
}
function removeGuest(eid,mid){
  const e=state.events.find(x=>x.id===eid);
  e.guestIds=(e.guestIds||[]).filter(x=>x!==mid);
  delete e.planning[mid];delete e.attendance[mid];
  persist();openEvent(eid);
}

function openEvent(id){
  const e=state.events.find(x=>x.id===id);if(!e)return;
  const pid=e.type==='Crazy Joe'?'crazyjoe':e.type==='Bear Trap'?'bear':e.type.toLowerCase();page(pid);
  document.getElementById(pid).innerHTML=eventDetail(e);
}
function planningModes(){return [['deployed','Deployed'],['substitute','Substitute'],['notdeployed','Not Deployed']];}
function attendanceModes(){return [['present','Present'],['noshow','No Show'],['excused','Excused']];}

function eventDetail(e){
  const eligible=eligibleFor(e);
  const planning=eligible.map(m=>statusRow(e,m,'planning',planningModes())).join('');
  const attendance=eligible.map(m=>statusRow(e,m,'attendance',attendanceModes())).join('');
  const guests=(e.type==='Foundry'||e.type==='Canyon')?guestBlock(e):'';
  const damage=e.type==='Bear Trap'?damageEntryBlock(e,eligible):'';
  const teamButton=e.type!=='Bear Trap'?`<button class="btn primary" onclick="generateTeams('${e.id}')">Generate Teams</button>`:'';

  return `<div class="section-head"><h2>${eventLabel(e)}</h2><button class="btn" onclick="render();page('${e.type==='Crazy Joe'?'crazyjoe':e.type==='Bear Trap'?'bear':e.type.toLowerCase()}')">Back</button></div>
  <div class="event-card"><div class="actions">${teamButton}<button class="btn danger" onclick="deleteEvent('${e.id}')">Delete Event</button></div></div>
  ${guests}
  ${e.type!=='Bear Trap'?`<div class="section-head"><h2>Team-Building Status</h2></div><div class="notice">Use Deployed, Substitute, or Not Deployed before generating teams.</div><div class="attendance" style="margin-top:10px">${planning}</div>`:''}
  ${damage}
  <div class="section-head"><h2>After-Event Attendance</h2></div><div class="notice">Complete this after the event: Present, No Show, or Excused.</div><div class="attendance" style="margin-top:10px">${attendance}</div>
  ${e.type!=='Bear Trap'?`<div class="section-head"><h2>Teams</h2></div>${renderTeams(e)}`:''}`;
}
function statusRow(e,m,field,modes){
  const guest=(e.guestIds||[]).includes(m.id);
  return `<div class="attendance-row"><div><b>${esc(m.name)}</b>${guest?`<span class="badge">Weekly guest</span>`:''}</div>${modes.map(([v,t])=>`<button class="${e[field]?.[m.id]===v?'on '+v:''}" onclick="setStatus('${e.id}','${m.id}','${field}','${v}')">${t}</button>`).join('')}${guest&&field==='planning'?`<button onclick="removeGuest('${e.id}','${m.id}')">Remove</button>`:''}</div>`;
}
function guestBlock(e){
  const candidates=guestCandidates(e);
  return `<div class="section-head"><h2>Add Weekly Guest Player</h2></div><div class="member-card">
    <p class="muted">This adds a player from the other legion to this event only. Their permanent roster preference does not change.</p>
    <div class="guest-add"><select id="guest-${e.id}"><option value="">Choose player…</option>${candidates.map(m=>`<option value="${m.id}">${esc(m.name)} • ${esc(m.foundry)} Foundry • ${esc(m.canyon)} Canyon</option>`).join('')}</select><button class="btn primary" onclick="addGuest('${e.id}')">Add Player</button></div>
  </div>`;
}
function damageEntryBlock(e,eligible){
  const ranked=[...eligible].sort((a,b)=>{
    const av=Number(e.damage?.[a.id]||0),bv=Number(e.damage?.[b.id]||0);
    return btSortMode==='high'?bv-av:av-bv;
  });
  return `<div class="section-head"><h2>Personal Rally Damage</h2><select style="width:auto;margin:0" onchange="btSortMode=this.value;openEvent('${e.id}')"><option value="high" ${btSortMode==='high'?'selected':''}>Highest to Lowest</option><option value="low" ${btSortMode==='low'?'selected':''}>Lowest to Highest</option></select></div>
  <div class="notice">Enter damage for any player, even before after-event attendance is completed.</div>
  <div class="list" style="margin-top:10px">${ranked.map((m,i)=>`<div class="member-card damage-row"><div><b>${i+1}. ${esc(m.name)}</b><div class="meta">${esc(m.bt)}${e.damage?.[m.id]?` • ${formatDamage(e.damage[m.id])}`:''}</div></div><input value="${e.damage?.[m.id]?formatDamage(e.damage[m.id]):''}" placeholder="4.82B" onchange="setDamage('${e.id}','${m.id}',this.value)"></div>`).join('')}</div>`;
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
      const btDeployed=deployed.filter(m=>m.bt===bt).sort(sortPower);
      const btSubs=substitutes.filter(m=>m.bt===bt).sort(sortPower);
      if(!btDeployed.length&&!btSubs.length)return;
      const size=state.settings.cjTeamSize||6;
      const count=Math.max(1,Math.ceil(btDeployed.length/size));
      const teams=Array.from({length:count},(_,i)=>({name:`${bt} Team ${i+1}`,objective:`${bt} only`,members:[],subs:[]}));

      // Snake distribution by descending power inside each BT group.
      btDeployed.forEach((m,i)=>{
        const round=Math.floor(i/count),pos=i%count;
        const idx=round%2===0?pos:count-1-pos;
        teams[idx].members.push(m.id);
      });
      btSubs.forEach((m,i)=>teams[i%count].subs.push(m.id));
      e.teams.push(...teams);
    });
  }else if(e.type==='Foundry'){
    const defs=[['Group 1','Assassins • Imperial Foundry'],['Group 2','Boiler • RF4 • Mercenary Camp'],['Group 3','Prototype 1 • RF1'],['Group 4','Transit • RF2 • Munitions Warehouse'],['Group 5','Prototype 2 • RF3'],['Group 6','Support • Looting • Weapons Workshop']];
    e.teams=defs.map(([name,objective])=>({name,objective,members:[],subs:[]}));
    const chosen=[...deployed].sort(sortGaia);
    chosen.slice(0,2).forEach(m=>e.teams[0].members.push(m.id));
    const targets=[2,4,1,3,2,4,1,3];
    chosen.slice(2,10).forEach((m,i)=>e.teams[targets[i]].members.push(m.id));
    chosen.slice(10).forEach((m,i)=>e.teams[1+(i%5)].members.push(m.id));
    substitutes.sort(sortGaia).forEach((m,i)=>e.teams[i%6].subs.push(m.id));
  }else{
    const defs=[['Team A','Building 18'],['Team B','Building 19'],['Team C','Building 31'],['Team D','Building 30'],['Team E','Left territory, then 24 and 28'],['Team F','Building 27']];
    e.teams=defs.map(([name,objective])=>({name,objective,members:[],subs:[]}));
    [...deployed].sort(sortPower).forEach((m,i)=>e.teams[i%6].members.push(m.id));
    [...substitutes].sort(sortPower).forEach((m,i)=>e.teams[i%6].subs.push(m.id));
  }
  persist();openEvent(id);
}
function renderTeams(e){
  if(!e.teams?.length)return '<div class="empty">No teams generated yet.</div>';
  return `<div class="team-grid">${e.teams.map(t=>{
    const members=t.members.map(id=>state.members.find(m=>m.id===id)).filter(Boolean);
    const total=members.reduce((n,m)=>n+strengthNumber(m.strength),0);
    return `<div class="team-card"><div class="row"><b>${esc(t.name)}</b><span class="badge">${formatDamage(total)} power</span></div>${t.objective?`<div class="meta">${esc(t.objective)}</div>`:''}<div class="chips">${members.map(m=>`<span class="chip">${esc(m.name)} • ${esc(m.strength)}</span>`).join('')}</div>${t.subs?.length?`<div class="meta" style="margin-top:10px">Substitutes</div><div class="chips">${t.subs.map(id=>`<span class="chip">${esc(state.members.find(m=>m.id===id)?.name||'Unknown')}</span>`).join('')}</div>`:''}</div>`;
  }).join('')}</div>`;
}

function parseDamage(v){const s=String(v).trim().toLowerCase().replace(/,/g,'');const n=parseFloat(s);if(!Number.isFinite(n))return null;if(s.endsWith('t'))return n*1e12;if(s.endsWith('b'))return n*1e9;if(s.endsWith('m'))return n*1e6;if(s.endsWith('k'))return n*1e3;return n;}
function formatDamage(n){n=Number(n||0);if(n>=1e12)return `${(n/1e12).toFixed(2)}T`;if(n>=1e9)return `${(n/1e9).toFixed(2)}B`;if(n>=1e6)return `${(n/1e6).toFixed(1)}M`;if(n>=1e3)return `${(n/1e3).toFixed(1)}K`;return String(Math.round(n));}
function setDamage(eid,mid,v){const e=state.events.find(x=>x.id===eid),n=parseDamage(v);if(n===null)delete e.damage[mid];else e.damage[mid]=n;persist();openEvent(eid);}
function damageRankings(){
  const rows=membersActive().map(m=>{
    const vals=state.events.filter(e=>e.type==='Bear Trap'&&e.group===m.bt&&e.damage?.[m.id]!=null).sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time)).map(e=>Number(e.damage[m.id]));
    if(!vals.length)return null;
    const last=vals.slice(0,3);
    return{name:m.name,bt:m.bt,latest:vals[0],avg:last.reduce((a,b)=>a+b,0)/last.length,best:Math.max(...vals)};
  }).filter(Boolean).sort((a,b)=>btSortMode==='high'?b.latest-a.latest:a.latest-b.latest);
  return rows.length?`<div class="list">${rows.map((r,i)=>`<div class="member-card"><b>${i+1}. ${esc(r.name)}</b><div class="meta">${r.bt} • Latest ${formatDamage(r.latest)} • Last 3 avg ${formatDamage(r.avg)} • Best ${formatDamage(r.best)}</div></div>`).join('')}</div>`:'<div class="empty">No damage recorded yet.</div>';
}

function renderMessages(){
  const list=state.messages.filter(m=>m.type===currentMessageTab);
  messages.innerHTML=`<div class="section-head"><h2>Alliance Messages</h2><button class="btn primary" onclick="addMessage()">+ Add</button></div>
  <div class="tabs"><button class="btn ${currentMessageTab==='Template'?'active':''}" onclick="currentMessageTab='Template';renderMessages()">Templates</button><button class="btn ${currentMessageTab==='Guide'?'active':''}" onclick="currentMessageTab='Guide';renderMessages()">Reference Guides</button></div>
  <div class="list">${list.map(m=>`<div class="member-card"><div class="row"><div><b>${esc(m.title)}</b><div class="meta">${esc(m.content)}</div></div><button class="btn small" onclick="copyText(${JSON.stringify(m.content)})">Copy</button></div></div>`).join('')||'<div class="empty">No messages yet.</div>'}</div>`;
}
function addMessage(){const title=prompt('Message title');if(!title)return;const content=prompt('Message content');if(content===null)return;state.messages.push({id:`msg-${Date.now()}`,type:currentMessageTab,title,content});persist();}
function copyText(t){navigator.clipboard.writeText(t).then(()=>alert('Copied'));}

function metrics(m){
  let attended=0,missed=0,eligible=0,committed=0,showed=0,last=null;
  state.events.forEach(e=>{
    const s=e.attendance?.[m.id], plan=e.planning?.[m.id];
    if(s==='present'){attended++;eligible++;if(plan==='deployed'){committed++;showed++;}if(!last||e.date>last)last=e.date}
    else if(s==='noshow'){missed++;eligible++;if(plan==='deployed')committed++}
    else if(s==='excused'){}
  });
  return {attended,missed,eligible,attendance:eligible?attended/eligible:0,reliability:committed?showed/committed:0,last};
}
function renderIntel(){
  const rows=membersActive().map(m=>({m,...metrics(m)})), qual=rows.filter(x=>x.eligible>=(state.settings.rankingMinimum||5));
  const avg=rows.length?rows.reduce((a,x)=>a+x.attendance,0)/rows.length:0;
  const high=[...qual].sort((a,b)=>b.attendance-a.attendance).slice(0,5),low=[...qual].sort((a,b)=>a.attendance-b.attendance).slice(0,5);
  intel.innerHTML=`<div class="section-head"><h2>Intelligence</h2></div><div class="stats">${stat('Active',rows.length)}${stat('Avg Attendance',Math.round(avg*100)+'%')}${stat('Events',state.events.length)}</div>
  <div class="section-head"><h2>Highest Attendance</h2></div>${rankList(high)}
  <div class="section-head"><h2>Lowest Attendance</h2></div>${rankList(low)}`;
}
function rankList(rows){return rows.length?`<div class="list">${rows.map(x=>`<div class="member-card"><b>${esc(x.m.name)}</b><div class="meta">Attendance ${Math.round(x.attendance*100)}% (${x.attended}/${x.eligible}) • Reliability ${Math.round(x.reliability*100)}%</div></div>`).join('')}</div>`:'<div class="empty">At least 5 eligible events are required.</div>';}

function renderSettings(){
  settings.innerHTML=`<div class="section-head"><h2>Settings</h2></div><div class="member-card"><div class="two-col">
  <label>Alliance Name<input id="settingAlliance" value="${esc(state.settings.allianceName)}"></label>
  <label>State<input id="settingState" value="${esc(state.settings.stateNumber)}"></label>
  <label>CJ Team Size<input id="settingCJ" type="number" min="2" max="12" value="${state.settings.cjTeamSize}"></label>
  <label>Ranking Minimum<input id="settingMin" type="number" min="1" value="${state.settings.rankingMinimum}"></label></div>
  <div class="actions" style="margin-top:12px"><button class="btn primary" onclick="saveSettings()">Save</button></div></div>
  <div class="section-head"><h2>Data & Backups</h2></div><div class="member-card"><p class="muted">The official 92-player roster is built into data.js. Event data is stored on this device.</p><div class="actions"><button class="btn" onclick="downloadBackup()">Download Backup</button><label class="btn">Import Backup<input type="file" accept=".json" hidden onchange="importBackup(event)"></label><button class="btn danger" onclick="restoreRoster()">Restore Official Roster</button></div></div>`;
}
function saveSettings(){state.settings.allianceName=settingAlliance.value.trim()||'CAN';state.settings.stateNumber=settingState.value.trim();state.settings.cjTeamSize=Number(settingCJ.value)||6;state.settings.rankingMinimum=Number(settingMin.value)||5;persist();alert('Settings saved.');}
function downloadBackup(){const b=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`CAN_Alliance_HQ_${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);}
function importBackup(ev){const f=ev.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const x=JSON.parse(r.result);if(!Array.isArray(x.members))throw Error();state=x;migrateEvents(state);persist();alert('Backup imported.')}catch(e){alert('Invalid backup file.')}};r.readAsText(f);}
function restoreRoster(){if(confirm('Restore all 92 official roster members? Existing events will remain.')){state.members=clone(window.CAN_SEED_DATA.members);persist();}}

render();page('dashboard');
