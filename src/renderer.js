const accounts = [...document.querySelectorAll('.account')];
const panel = document.querySelector('#quickPanel');
const dialog = document.querySelector('#quickDialog');
const supportPanel = document.querySelector('#supportPanel');
const supportForm = document.querySelector('#supportForm');
const ticketsPanel = document.querySelector('#ticketsPanel');
const ticketForm = document.querySelector('#ticketForm');
let supportTickets = [];
let supportEvents = [];
let selected = 'personal';
let unreadCounts = { personal: 0, company: 0 };
let quickMessages = [];
let updateState = 'current';
let updateError = '';
let activeReminderId = null;
let privacy = { enabled:false, names:true, photos:true, previews:true, chat:true, media:true, revealOnHover:true };

function choose(id) {
  selected = id;
  accounts.forEach(b => b.classList.toggle('active', b.dataset.account === id));
  document.querySelector('#title').textContent = id === 'personal' ? 'WhatsApp Pessoal' : 'WhatsApp Empresa';
  window.hubZap.selectAccount(id);
}

function toast(message) {
  const el = document.querySelector('#toast');
  el.textContent = message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1800);
}

function setPanel(open) {
  panel.classList.toggle('hidden', !open);
  document.querySelector('#quickToggle').classList.toggle('active', open);
  window.hubZap.setQuickPanel(open);
}

function setSupportPanel(open) {
  supportPanel.classList.toggle('hidden', !open);
  panel.classList.add('hidden');
  document.querySelector('#quickToggle').classList.remove('active');
  document.querySelector('#supportToggle').classList.toggle('active', open);
  window.hubZap.setQuickPanel(false);
  window.hubZap.setSupportPanel(open);
}

function setTicketsPanel(open){
  ticketsPanel.classList.toggle('hidden',!open);
  window.hubZap.setTicketsPanel(open);
  document.querySelector('#ticketsToggle').classList.toggle('active',open);
  if(open){setPanel(false);setSupportPanel(false);}
}
async function loadSupportTickets(){supportTickets=await window.hubZap.getSupportTickets();renderSupportTickets();}
function renderSupportTickets(){
  const ids={'Em atendimento':'countWorking','Aguardando cliente':'countCustomer','Aguardando terceiro':'countThird','Resolvido':'countResolved'};
  Object.keys(ids).forEach(s=>document.querySelector('#'+ids[s]).textContent=supportTickets.filter(x=>x.status===s).length);
  const list=document.querySelector('#ticketList');list.replaceChildren();
  const filter=document.querySelector('#ticketFilter').value;
  const items=supportTickets.filter(x=>!filter||x.status===filter).sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));
  if(!items.length){const e=document.createElement('div');e.className='empty';e.textContent='Nenhum atendimento encontrado.';list.appendChild(e);return;}
  items.forEach(item=>{
    const card=document.createElement('article');card.className='ticket-card'+(item.status==='Resolvido'?' resolved':'');
    const top=document.createElement('div');top.className='ticket-top';
    const title=document.createElement('b');title.textContent=item.customer;
    const badge=document.createElement('span');badge.className='ticket-status';badge.textContent=item.status;top.append(title,badge);
    const subject=document.createElement('div');subject.className='ticket-subject';subject.textContent=item.subject;
    const meta=document.createElement('small');meta.textContent=(item.account==='company'?'Empresa':'Pessoal')+' - '+new Date(item.updatedAt).toLocaleString('pt-BR');
    const notes=document.createElement('p');notes.textContent=item.notes||'Sem notas.';
    const actions=document.createElement('div');actions.className='actions';
    const status=document.createElement('select');status.className='ticket-status-select';
    ['Em atendimento','Aguardando cliente','Aguardando terceiro','Resolvido'].forEach(s=>{const o=document.createElement('option');o.value=s;o.textContent=s;o.selected=s===item.status;status.appendChild(o);});
    status.onchange=async()=>{await window.hubZap.setSupportTicketStatus(item.id,status.value);await loadSupportTickets();toast('Status atualizado.');};
    const remind=document.createElement('button');remind.textContent='⏰ Lembrete';remind.onclick=()=>openReminderForTicket(item);
    const edit=document.createElement('button');edit.textContent='Editar';edit.onclick=()=>openTicketForm(item);
    const del=document.createElement('button');del.textContent='Excluir';del.onclick=async()=>{if(confirm('Excluir este atendimento?')){await window.hubZap.deleteSupportTicket(item.id);await loadSupportTickets();}};
    actions.append(status,remind,edit,del);card.append(top,subject,meta,notes,actions);list.appendChild(card);
  });
}
function openTicketForm(item=null){
  document.querySelector('#ticketFormTitle').textContent=item?'Editar atendimento':'Novo atendimento';
  document.querySelector('#ticketId').value=item?.id||'';
  document.querySelector('#ticketCustomer').value=item?.customer||'';
  document.querySelector('#ticketSubject').value=item?.subject||'';
  document.querySelector('#ticketStatus').value=item?.status||'Em atendimento';
  document.querySelector('#ticketAccount').value=item?.account||selected;
  document.querySelector('#ticketNotes').value=item?.notes||'';
  ticketForm.classList.remove('hidden');document.querySelector('#ticketList').classList.add('hidden');document.querySelector('#ticketNew').classList.add('hidden');document.querySelector('#ticketFilter').classList.add('hidden');
}
function closeTicketForm(){ticketForm.classList.add('hidden');document.querySelector('#ticketList').classList.remove('hidden');document.querySelector('#ticketNew').classList.remove('hidden');document.querySelector('#ticketFilter').classList.remove('hidden');}

async function loadSupportEvents(){ supportEvents=await window.hubZap.getSupportEvents(); renderSupportEvents(); }
function renderSupportEvents(){
  const list=document.querySelector('#supportList'); list.replaceChildren();
  const filter=document.querySelector('#supportFilter').value;
  const items=supportEvents.filter(x=>!filter||x.status===filter);
  if(!items.length){const e=document.createElement('div');e.className='empty';e.textContent='Nenhum evento cadastrado.';list.appendChild(e);return;}
  items.forEach(item=>{
    const card=document.createElement('article');card.className='support-card'+(item.status==='Concluído'?' done':'');
    const title=document.createElement('b');title.textContent=item.title;
    const contact=document.createElement('div');contact.className='contact';contact.textContent=(item.contact||'Sem contato')+' • '+(item.account==='company'?'Empresa':'Pessoal');
    const when=document.createElement('div');when.className='when';when.textContent=new Date(item.remindAt).toLocaleString('pt-BR');
    const notes=document.createElement('p');notes.textContent=item.notes||'';
    const actions=document.createElement('div');actions.className='actions';
    if(item.status!=='Concluído'){
      const done=document.createElement('button');done.className='use';done.textContent='✓ Concluir';done.onclick=async()=>{await window.hubZap.completeSupportEvent(item.id);loadSupportEvents();toast('Evento concluído.');};actions.appendChild(done);
      const snooze=document.createElement('select');snooze.className='snooze-select';
      [['','⏰ Adiar'],['10','10 min'],['30','30 min'],['60','1 hora'],['1440','Amanhã']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;snooze.appendChild(o);});
      snooze.onchange=async()=>{if(!snooze.value)return;const result=await window.hubZap.snoozeSupportEvent(item.id,Number(snooze.value));if(result.ok){await loadSupportEvents();toast('Lembrete adiado.');}else toast(result.error||'Não foi possível adiar.');};
      actions.appendChild(snooze);
    }
    const edit=document.createElement('button');edit.textContent='Editar';edit.onclick=()=>openSupportForm(item);
    const del=document.createElement('button');del.textContent='Excluir';del.onclick=async()=>{if(confirm('Excluir este evento?')){await window.hubZap.deleteSupportEvent(item.id);loadSupportEvents();}};
    actions.append(edit,del);card.append(title,contact,when,notes,actions);list.appendChild(card);
  });
}
function openReminderForTicket(ticket){
  setTicketsPanel(false);
  setSupportPanel(true);
  openSupportForm({
    id:'',
    title:'Retornar: '+ticket.subject,
    contact:ticket.customer,
    remindAt:'',
    account:ticket.account,
    notes:'Atendimento: '+ticket.subject,
    ticketId:ticket.id
  });
}
function openSupportForm(item=null){
  document.querySelector('#supportFormTitle').textContent=item?.id?'Editar evento':(item?.ticketId?'Novo lembrete do atendimento':'Novo evento');
  document.querySelector('#supportId').value=item?.id||'';
  document.querySelector('#supportTicketId').value=item?.ticketId||'';
  document.querySelector('#supportTitle').value=item?.title||'';
  document.querySelector('#supportContact').value=item?.contact||'';
  document.querySelector('#supportWhen').value=item?.remindAt?item.remindAt.slice(0,16):'';
  document.querySelector('#supportAccount').value=item?.account||selected;
  document.querySelector('#supportNotes').value=item?.notes||'';
  supportForm.classList.remove('hidden');
  document.querySelector('#supportList').classList.add('hidden');
  document.querySelector('#supportNew').classList.add('hidden');
  document.querySelector('#supportFilter').classList.add('hidden');
}

function filteredMessages() {
  const q = document.querySelector('#quickSearch').value.trim().toLowerCase();
  const category = document.querySelector('#quickCategory').value;
  return quickMessages
    .filter(m => !category || m.category === category)
    .filter(m => !q || (m.title + ' ' + m.text + ' ' + m.category).toLowerCase().includes(q))
    .sort((a,b) => Number(b.favorite) - Number(a.favorite));
}

function renderQuickMessages() {
  const list = document.querySelector('#quickList');
  list.replaceChildren();
  const messages = filteredMessages();
  if (!messages.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'Nenhuma mensagem encontrada.';
    list.appendChild(empty);
    return;
  }
  messages.forEach(m => {
    const card = document.createElement('article');
    card.className = 'quick-card';

    const top = document.createElement('div'); top.className = 'top';
    const title = document.createElement('b'); title.textContent = (m.favorite ? '⭐ ' : '') + m.title;
    const cat = document.createElement('span'); cat.className = 'category'; cat.textContent = m.category;
    top.append(title, cat);

    const text = document.createElement('p'); text.textContent = m.text;
    const actions = document.createElement('div'); actions.className = 'actions';

    const use = document.createElement('button'); use.className = 'use'; use.textContent = 'Copiar';
    use.addEventListener('click', async () => { await window.hubZap.copyText(m.text); toast('Mensagem copiada. Cole com Ctrl+V.'); });

    const edit = document.createElement('button'); edit.textContent = 'Editar';
    edit.addEventListener('click', () => openForm(m));

    const del = document.createElement('button'); del.textContent = 'Excluir';
    del.addEventListener('click', async () => {
      if (!confirm('Excluir esta mensagem rápida?')) return;
      await window.hubZap.deleteQuickMessage(m.id);
      await loadQuickMessages();
    });
    actions.append(use, edit, del);
    card.append(top, text, actions);
    list.appendChild(card);
  });
}

function openForm(message = null) {
  document.querySelector('#formTitle').textContent = message ? 'Editar mensagem rápida' : 'Nova mensagem rápida';
  document.querySelector('#quickId').value = message?.id || '';
  document.querySelector('#quickTitle').value = message?.title || '';
  document.querySelector('#quickFormCategory').value = message?.category || 'Comercial';
  document.querySelector('#quickText').value = message?.text || '';
  document.querySelector('#quickFavorite').checked = Boolean(message?.favorite);
  dialog.showModal();
}

async function loadQuickMessages() {
  quickMessages = await window.hubZap.getQuickMessages();
  renderQuickMessages();
}

function setUpdateStatus(status) {
  const button = document.querySelector('#updateButton');
  const detail = document.querySelector('#updateDetail');
  updateState = status.state || 'current';
  if (updateState === 'error') updateError = status.message || 'Falha ao baixar ou instalar a atualização.';
  else updateError = '';
  button.dataset.state = updateState;
  button.disabled = updateState === 'checking' || updateState === 'downloading';
  button.title = updateError;

  if (updateState === 'checking') { button.querySelector('b').textContent = '↻ Verificando atualização'; detail.textContent = 'Aguarde...'; }
  else if (updateState === 'available') { button.querySelector('b').textContent = '⬆ Nova versão ' + status.version; detail.textContent = 'Clique para baixar e atualizar'; }
  else if (updateState === 'downloading') { button.querySelector('b').textContent = '↓ Baixando atualização'; detail.textContent = (status.percent || 0) + '% concluído'; }
  else if (updateState === 'ready') { button.querySelector('b').textContent = '✓ Atualização pronta'; detail.textContent = 'Clique para instalar e reiniciar'; }
  else if (updateState === 'error') { button.querySelector('b').textContent = '⚠ Não foi possível atualizar'; detail.textContent = updateError.slice(0, 130) + ' — clique para ver opções'; }
  else { button.querySelector('b').textContent = '✓ HubZap atualizado'; detail.textContent = 'Clique para verificar agora'; }
}

document.querySelector('#updateButton').addEventListener('click', async () => {
  if (updateState === 'available') {
    setUpdateStatus({ state: 'downloading', percent: 0 });
    const result = await window.hubZap.downloadUpdate();
    if (!result.ok && !result.dev) setUpdateStatus({ state: 'error', message: result.error });
  } else if (updateState === 'error') {
    const manual = confirm('Falha na atualização: ' + updateError + '\n\nOK: abrir a página oficial para instalar manualmente.\nCancelar: tentar verificar novamente.');
    if (manual) return window.hubZap.openRelease();
    setUpdateStatus({ state: 'checking' });
    const result = await window.hubZap.checkUpdate();
    if (!result.ok && !result.dev) setUpdateStatus({ state: 'error', message: result.error });
  } else if (updateState === 'ready') {
    window.hubZap.installUpdate();
  } else {
    setUpdateStatus({ state: 'checking' });
    const result = await window.hubZap.checkUpdate();
    if (result.dev) toast('A verificação automática funciona no HubZap instalado.');
    else if (!result.ok) setUpdateStatus({ state: 'error', message: result.error });
  }
});
window.hubZap.onUpdateStatus(setUpdateStatus);
window.hubZap.getVersion().then(version => {
  document.querySelector('#appVersion').textContent = 'v' + version;
});
setUpdateStatus({ state: 'current' });

function renderPrivacy(){
  const btn=document.querySelector('#privacyToggle');
  document.querySelector('#privacyState').textContent=privacy.enabled?'Ativado':'Desativado';
  btn.classList.toggle('privacy-on',privacy.enabled);
  document.querySelector('#privacyOptions').classList.toggle('hidden',!privacy.enabled);
  document.querySelector('#privacyPersonal').checked=privacy.personal!==false;
  document.querySelector('#privacyCompany').checked=privacy.company!==false;
  document.querySelector('#privacyNames').checked=privacy.names;
  document.querySelector('#privacyPhotos').checked=privacy.photos;
  document.querySelector('#privacyPreviews').checked=privacy.previews;
  document.querySelector('#privacyChat').checked=privacy.chat;
  document.querySelector('#privacyMedia').checked=privacy.media;
  document.querySelector('#privacyHover').checked=privacy.revealOnHover;
}
async function savePrivacy(){
  const result=await window.hubZap.setPrivacy(privacy);
  if(result.ok){privacy=result.settings;renderPrivacy();}
}
document.querySelector('#privacyToggle').addEventListener('click',async()=>{privacy.enabled=!privacy.enabled;await savePrivacy();toast(privacy.enabled?'🔒 Privacidade ativada.':'🔓 Privacidade desativada.');});
[
  ['privacyPersonal','personal'],
  ['privacyCompany','company'],
  ['privacyNames','names'],
  ['privacyPhotos','photos'],
  ['privacyPreviews','previews'],
  ['privacyChat','chat'],
  ['privacyMedia','media'],
  ['privacyHover','revealOnHover']
].forEach(([id,key])=>document.querySelector('#'+id).addEventListener('change',async e=>{privacy[key]=e.target.checked;await savePrivacy();}));
window.hubZap.getPrivacy().then(settings=>{privacy=settings;renderPrivacy();});

accounts.forEach(b => b.addEventListener('click', () => choose(b.dataset.account)));
document.querySelector('#single').addEventListener('click', () => window.hubZap.setLayout('single'));
document.querySelector('#split').addEventListener('click', () => window.hubZap.setLayout('split'));
document.querySelector('#reload').addEventListener('click', () => window.hubZap.reloadAccount(selected));
document.querySelector('#quickToggle').addEventListener('click', () => { setSupportPanel(false); setPanel(panel.classList.contains('hidden')); });
document.querySelector('#supportToggle').addEventListener('click', () => {setTicketsPanel(false);setSupportPanel(supportPanel.classList.contains('hidden'));});
document.querySelector('#ticketsToggle').addEventListener('click',()=>setTicketsPanel(ticketsPanel.classList.contains('hidden')));
document.querySelector('#ticketsClose').addEventListener('click',()=>setTicketsPanel(false));
document.querySelector('#ticketNew').addEventListener('click',()=>openTicketForm());
document.querySelector('#ticketCancelTop').addEventListener('click',closeTicketForm);
document.querySelector('#ticketCancel').addEventListener('click',closeTicketForm);
document.querySelector('#ticketFilter').addEventListener('change',renderSupportTickets);
document.querySelector('#ticketForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const payload={id:document.querySelector('#ticketId').value,customer:document.querySelector('#ticketCustomer').value,subject:document.querySelector('#ticketSubject').value,status:document.querySelector('#ticketStatus').value,account:document.querySelector('#ticketAccount').value,notes:document.querySelector('#ticketNotes').value};
  const result=await window.hubZap.saveSupportTicket(payload);
  if(!result.ok)return toast(result.error||'Nao foi possivel salvar.');
  closeTicketForm();await loadSupportTickets();toast('Atendimento salvo.');
});
document.querySelector('#supportClose').addEventListener('click', () => setSupportPanel(false));
document.querySelector('#supportNew').addEventListener('click', () => openSupportForm());
function closeSupportForm(){ supportForm.classList.add('hidden'); document.querySelector('#supportList').classList.remove('hidden'); document.querySelector('#supportNew').classList.remove('hidden'); document.querySelector('#supportFilter').classList.remove('hidden'); }
document.querySelector('#supportCancel').addEventListener('click', closeSupportForm);
document.querySelector('#supportCancelBottom').addEventListener('click', closeSupportForm);
document.querySelector('#supportFilter').addEventListener('change', renderSupportEvents);
document.querySelector('#supportForm').addEventListener('submit', async e => {
 e.preventDefault();
 const result=await window.hubZap.saveSupportEvent({id:document.querySelector('#supportId').value,title:document.querySelector('#supportTitle').value,contact:document.querySelector('#supportContact').value,remindAt:document.querySelector('#supportWhen').value,account:document.querySelector('#supportAccount').value,notes:document.querySelector('#supportNotes').value,ticketId:document.querySelector('#supportTicketId').value});
 if(!result.ok)return toast(result.error||'Não foi possível salvar o evento.');
 closeSupportForm();await loadSupportEvents();toast('Evento salvo.');
});
function showReminderAlert(item){
  activeReminderId=item.id;
  document.querySelector('#reminderAlertTitle').textContent='⏰ '+item.title;
  document.querySelector('#reminderAlertText').textContent=(item.contact?item.contact+' • ':'')+(item.notes||'Lembrete de atendimento');
  document.querySelector('#reminderAlert').classList.remove('hidden');
}
function hideReminderAlert(){document.querySelector('#reminderAlert').classList.add('hidden');activeReminderId=null;document.querySelector('#reminderAlertSnooze').value='';}
window.hubZap.onSupportEventDue(item=>{showReminderAlert(item);toast('⏰ '+item.title);loadSupportEvents();});
document.querySelector('#reminderAlertDone').addEventListener('click',async()=>{if(!activeReminderId)return;await window.hubZap.completeSupportEvent(activeReminderId);hideReminderAlert();await loadSupportEvents();toast('Evento concluído.');});
document.querySelector('#reminderAlertSnooze').addEventListener('change',async e=>{if(!activeReminderId||!e.target.value)return;const result=await window.hubZap.snoozeSupportEvent(activeReminderId,Number(e.target.value));if(result.ok){hideReminderAlert();await loadSupportEvents();toast('Lembrete adiado.');}});
document.querySelector('#reminderAlertClose').addEventListener('click',hideReminderAlert);
window.hubZap.onSupportOpenEvent(async id=>{
  await loadSupportEvents();
  const item=supportEvents.find(x=>x.id===id);
  if(item?.ticketId){
    setSupportPanel(false);setTicketsPanel(true);await loadSupportTickets();
    const ticket=supportTickets.find(x=>x.id===item.ticketId);
    if(ticket) toast('⏰ '+item.title+' — atendimento: '+ticket.customer);
  } else {
    setSupportPanel(true);
    if(item) toast('⏰ '+item.title+' — conclua ou adie o lembrete.');
  }
});
document.querySelector('#quickClose').addEventListener('click', () => setPanel(false));
document.querySelector('#quickNew').addEventListener('click', () => openForm());
document.querySelector('#quickCancel').addEventListener('click', () => dialog.close());
document.querySelector('#quickSearch').addEventListener('input', renderQuickMessages);
document.querySelector('#quickCategory').addEventListener('change', renderQuickMessages);
document.querySelector('#quickForm').addEventListener('submit', async e => {
  e.preventDefault();
  const result = await window.hubZap.saveQuickMessage({
    id: document.querySelector('#quickId').value,
    title: document.querySelector('#quickTitle').value,
    category: document.querySelector('#quickFormCategory').value,
    text: document.querySelector('#quickText').value,
    favorite: document.querySelector('#quickFavorite').checked
  });
  if (!result.ok) return toast(result.error || 'Não foi possível salvar.');
  dialog.close();
  await loadQuickMessages();
  toast('Mensagem salva.');
});
function renderUnreadAccounts() {
  for (const id of ['personal', 'company']) {
    const count = Math.max(0, Number(unreadCounts[id]) || 0);
    const badge = document.querySelector('[data-unread="' + id + '"]');
    const status = document.querySelector('[data-account-status="' + id + '"]');
    const button = document.querySelector('[data-account="' + id + '"]');
    badge.classList.toggle('hidden', count === 0);
    badge.textContent = count > 99 ? '99+' : String(count);
    status.textContent = count ? count + (count === 1 ? ' conversa não lida' : ' conversas não lidas') : 'Sem mensagens não lidas';
    button.classList.toggle('has-unread', count > 0);
    button.setAttribute('aria-label', (id === 'personal' ? 'Pessoal' : 'Empresa') + ': ' + status.textContent);
  }
}
window.hubZap.onUnread(counts => {
  unreadCounts = { personal: counts.personal || 0, company: counts.company || 0 };
  renderUnreadAccounts();
});
window.hubZap.onState(state => {
  document.querySelector('#mode').textContent = state.layout === 'split' ? 'Lado a lado' : 'Conta selecionada';
});

loadQuickMessages();
loadSupportEvents();
loadSupportTickets();

const savedTheme = localStorage.getItem('hubzap-theme') || 'dark';
function applyTheme(theme){
  document.documentElement.dataset.theme=theme;
  document.querySelector('#themeState').textContent=theme==='light'?'Claro':'Escuro';
  document.querySelector('#themeToggle').firstChild.textContent=theme==='light'?'☀ Tema ':'🌙 Tema ';
  localStorage.setItem('hubzap-theme',theme);
}
document.querySelector('#themeToggle').addEventListener('click',()=>applyTheme(document.documentElement.dataset.theme==='light'?'dark':'light'));
document.querySelector('#afatecLink').addEventListener('click',()=>window.hubZap.openAfatec());
applyTheme(savedTheme);
