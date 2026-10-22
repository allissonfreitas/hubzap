const { app, BrowserWindow, WebContentsView, session, ipcMain, shell, clipboard, Notification, net, safeStorage, dialog, Menu } = require('electron');
const fs = require('fs');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const { UpdateController } = require('./updates');
const { UPDATE_RELEASE_URL } = require('./update-config');

// Restrict every privileged message to the local main frame.
const registerHandle = ipcMain.handle.bind(ipcMain);
ipcMain.handle = (channel, listener) => registerHandle(channel, (event, ...args) => {
  if (!trustedSender(event)) throw new Error('Origem não autorizada.');
  return listener(event, ...args);
});
const registerOn = ipcMain.on.bind(ipcMain);
ipcMain.on = (channel, listener) => registerOn(channel, (event, ...args) => {
  if (trustedSender(event)) listener(event, ...args);
});
const WHATSAPP_URL = 'https://web.whatsapp.com/';
const { normalizePreferences } = require('./preferences');
const { OutlookCalendar } = require('./outlook');
const { StickerStore, MAX_FILE } = require('./stickers');
const { allowedStickerSource, imageReadScript } = require('./sticker-capture');
let preferences = normalizePreferences();
let extraPanelOpen = false;
let outlook;
const calendarNotified = new Set();
const HEADER = 52;
const QUICK_PANEL = 350;
const CHROME_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const COMMUNITY_APP_ID = 'net.afatec.hubzap.community';
const COMMUNITY_USER_DATA_DIRECTORY = 'HubZap Community';
let win;
let selected = 'personal';
let layout = 'single';
let quickPanelOpen = false;
let supportPanelOpen = false;
let ticketsPanelOpen = false;
let reminderTimer;
let updates;
let privacySettings = { enabled:false, personal:true, company:true, names:true, photos:true, previews:true, chat:true, media:true, revealOnHover:true };
const views = new Map();
const unreadByAccount = { personal: 0, company: 0 };
function unreadFromTitle(title) {
  const match = String(title || '').match(/^\((\d{1,4})\)\s*(?:WhatsApp|WA Web)\b/i);
  return match ? Math.min(9999, Number(match[1])) : 0;
}
function sendUnreadState() {
  if (win && !win.isDestroyed() && !win.webContents.isLoading()) {
    win.webContents.send('hub:unread', { ...unreadByAccount });
  }
}


// Keep the public/community edition isolated from private HubZap editions.
// Persistent WhatsApp partitions, local settings and cache all live below userData.
app.setPath('userData', path.join(app.getPath('appData'), COMMUNITY_USER_DATA_DIRECTORY));
app.setPath('sessionData', app.getPath('userData'));

// Required on Windows so native notifications are associated with this edition.
if (process.platform === 'win32') app.setAppUserModelId(COMMUNITY_APP_ID);

function sendUpdateStatus(status) {
  if (win && !win.isDestroyed()) win.webContents.send('update:status', status);
}
updates = new UpdateController({updater:autoUpdater,packaged:app.isPackaged,version:app.getVersion(),send:sendUpdateStatus});

const accounts = {
  personal: { label: 'Pessoal', partition: 'persist:wa-personal' },
  company: { label: 'Empresa', partition: 'persist:wa-company' }
};

function safeExternal(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'mailto:';
  } catch { return false; }
}

function privacyCss(settings) {
  if (!settings?.enabled) return '';
  const hover = settings.revealOnHover ? ':hover' : '__never__';
  const rules = [];
  if (settings.photos) rules.push(`img[src*="blob:"], img[src*="pps.whatsapp.net"], img[src*="mmg.whatsapp.net"]{filter:blur(10px)!important} img[src*="blob:"]${hover},img[src*="pps.whatsapp.net"]${hover},img[src*="mmg.whatsapp.net"]${hover}{filter:none!important}`);
  if (settings.names) rules.push(`[data-testid="cell-frame-title"],[data-testid="conversation-info-header-chat-title"],header span[title]{filter:blur(6px)!important} [data-testid="cell-frame-title"]${hover},[data-testid="conversation-info-header-chat-title"]${hover},header span[title]${hover}{filter:none!important}`);
  if (settings.previews) rules.push(`[data-testid="cell-frame-secondary"]{filter:blur(6px)!important} [data-testid="cell-frame-secondary"]${hover}{filter:none!important}`);
  if (settings.chat) rules.push(`#main [data-pre-plain-text],#main .selectable-text{filter:blur(6px)!important} #main [data-pre-plain-text]${hover},#main .selectable-text${hover}{filter:none!important}`);
  if (settings.media) rules.push(`#main img:not([src*="data:image/svg"]),#main video{filter:blur(14px)!important} #main img${hover},#main video${hover}{filter:none!important}`);
  return rules.join('\n');
}
function applyPrivacyToView(view, id) {
  view._privacyQueue = (view._privacyQueue || Promise.resolve()).then(() => updatePrivacyCss(view, id));
  return view._privacyQueue;
}
async function updatePrivacyCss(view, id) {
  if (!view || view.webContents.isDestroyed()) return;
  try {
    if (view._hubPrivacyKey) { await view.webContents.removeInsertedCSS(view._hubPrivacyKey); view._hubPrivacyKey = null; }
    const accountEnabled = id === 'personal' ? privacySettings.personal !== false : privacySettings.company !== false;
    const css = accountEnabled ? privacyCss(privacySettings) : '';
    if (css) view._hubPrivacyKey = await view.webContents.insertCSS(css);
  } catch (e) { console.error('[HubZap privacy]', e); }
}
function applyPrivacyAll(){ for (const [id, view] of views.entries()) applyPrivacyToView(view, id); }

function createWhatsAppView(id) {
  const account = accounts[id];
  const ses = session.fromPartition(account.partition);

  // WhatsApp Web rejects Electron's default UA because it contains the Electron token.
  // Use a normal, current Chrome-on-Windows UA for both navigation and subrequests.
  ses.setUserAgent(CHROME_USER_AGENT, 'pt-BR,pt');
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = CHROME_USER_AGENT;
    details.requestHeaders['Accept-Language'] = 'pt-BR,pt;q=0.9,en;q=0.8';
    callback({ requestHeaders: details.requestHeaders });
  });

  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(['notifications', 'media', 'clipboard-sanitized-write'].includes(permission));
  });

  const view = new WebContentsView({
    webPreferences: {
      session: ses,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  });

  view.webContents.setWindowOpenHandler(({ url }) => {
    if (safeExternal(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  view.webContents.on('will-navigate', (event, url) => {
    try {
      const host = new URL(url).hostname;
      if (host !== 'web.whatsapp.com' && !host.endsWith('.whatsapp.com')) {
        event.preventDefault();
        if (safeExternal(url)) shell.openExternal(url);
      }
    } catch { event.preventDefault(); }
  });

  view.webContents.on('context-menu', (_event, params) => {
    if (params.mediaType !== 'image' || !params.srcURL) return;
    Menu.buildFromTemplate([
      { label: 'Salvar na biblioteca de stickers • ' + account.label, click: () => captureSticker(view, id, params.srcURL) },
      { label: 'Salvar imagem como…', click: () => view.webContents.downloadURL(params.srcURL) },
      { label: 'Copiar imagem', click: () => view.webContents.copyImageAt(params.x, params.y) }
    ]).popup({ window: win });
  });
  view.webContents.setUserAgent(CHROME_USER_AGENT);
  // Synchronize the sidebar with WhatsApp's real unread conversation rows.
  // This deliberately ignores the left navigation badge/title because those can
  // lag behind after the last unread chat is opened.
  let unreadRefreshing = false;
  const refreshUnread = async () => {
    if (view.webContents.isDestroyed() || view.webContents.isLoadingMainFrame() || unreadRefreshing) return;
    unreadRefreshing = true;
    try {
      const next = await view.webContents.executeJavaScript(`
        (() => {
          const rows = [...document.querySelectorAll('[role="listitem"], [role="row"]')];
          const unreadRows = rows.filter(row => {
            const text = String(row.innerText || row.textContent || '');
            const aria = [...row.querySelectorAll('[aria-label]')]
              .map(el => String(el.getAttribute('aria-label') || ''))
              .join(' | ');
            // Current WhatsApp exposes unread state either in an aria label or
            // as a compact green numeric badge inside the conversation row.
            if (/nao lida|não lida|unread/i.test(aria)) return true;
            const badges = [...row.querySelectorAll('span')].filter(el => {
              const t = String(el.textContent || '').trim();
              if (!/^\\d{1,4}$/.test(t)) return false;
              const r = el.getBoundingClientRect();
              if (!r.width || !r.height || r.width > 44 || r.height > 44) return false;
              const style = getComputedStyle(el);
              const bg = style.backgroundColor;
              return bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
            });
            return badges.length > 0 && /\\d{1,2}:\\d{2}|ontem|segunda|terça|quarta|quinta|sexta|sábado|domingo/i.test(text);
          });
          return unreadRows.length;
        })()
      `, true);
      if (Number.isInteger(next) && next >= 0 && unreadByAccount[id] !== next) {
        unreadByAccount[id] = next;
        sendUnreadState();
      }
    } catch {} finally { unreadRefreshing = false; }
  };

  view.webContents.on('did-finish-load', () => {
    applyPrivacyToView(view, id);
    refreshUnread();
  });
  // Also refresh after clicks so opening the final unread chat clears the HubZap
  // badge quickly, while the interval catches incoming messages in the background.
  view.webContents.on('before-input-event', (_event, input) => {
    if (input.type === 'mouseDown' || input.type === 'keyDown') setTimeout(refreshUnread, 350);
  });
  const unreadTimer = setInterval(refreshUnread, 1000);
  view.webContents.once('destroyed', () => clearInterval(unreadTimer));

  view.webContents.loadURL(WHATSAPP_URL, { userAgent: CHROME_USER_AGENT });
  views.set(id, view);
  win.contentView.addChildView(view);
}

function contentBounds() {
  const [width, height] = win.getContentSize();
  const SIDEBAR = preferences.sidebar === 'compact' ? 72 : 220;
  const panel = (extraPanelOpen || quickPanelOpen || supportPanelOpen || ticketsPanelOpen) ? QUICK_PANEL : 0;
  return { x: SIDEBAR, y: HEADER, width: Math.max(0, width - SIDEBAR - panel), height: Math.max(0, height - HEADER) };
}

function quickMessagesPath() {
  return path.join(app.getPath('userData'), 'quick-messages.json');
}

function defaultQuickMessages() {
  return [
    { id: 'welcome', title: 'Saudação inicial', category: 'Comercial', text: 'Olá! Tudo bem? Como posso te ajudar hoje?', favorite: true },
    { id: 'thanks', title: 'Agradecimento', category: 'Geral', text: 'Muito obrigado pelo contato! Se precisar de mais alguma coisa, estou à disposição.', favorite: false }
  ];
}

function readQuickMessages() {
  try {
    const file = quickMessagesPath();
    if (!fs.existsSync(file)) {
      const initial = defaultQuickMessages();
      fs.writeFileSync(file, JSON.stringify(initial, null, 2), 'utf8');
      return initial;
    }
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return defaultQuickMessages();
  }
}

function writeQuickMessages(messages) {
  fs.writeFileSync(quickMessagesPath(), JSON.stringify(messages, null, 2), 'utf8');
}

function supportTicketsPath() { return path.join(app.getPath('userData'), 'support-tickets.json'); }
function readSupportTickets() {
  try {
    const file = supportTicketsPath();
    if (!fs.existsSync(file)) return [];
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}
function writeSupportTickets(items) { fs.writeFileSync(supportTicketsPath(), JSON.stringify(items, null, 2), 'utf8'); }

function supportEventsPath() { return path.join(app.getPath('userData'), 'support-events.json'); }
function readSupportEvents() {
  try {
    const file = supportEventsPath();
    if (!fs.existsSync(file)) return [];
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}
function writeSupportEvents(items) { fs.writeFileSync(supportEventsPath(), JSON.stringify(items, null, 2), 'utf8'); }
function checkDueEvents() {
  if (!win || win.isDestroyed() || win.webContents.isLoading()) return;
  const now = Date.now();
  const items = readSupportEvents();
  let changed = false;
  for (const item of items) {
    if (item.status !== 'Concluído' && !item.notified && item.remindAt && new Date(item.remindAt).getTime() <= now) {
      item.notified = true; changed = true;
      if (Notification.isSupported()) {
        const notice = new Notification({
          title: 'HubZap • Lembrete',
          body: `${item.title}${item.contact ? ' • ' + item.contact : ''}\nAbra o HubZap para concluir ou adiar.`
        });
        notice.on('click', () => {
          if (win && !win.isDestroyed()) {
            if (win.isMinimized()) win.restore();
            win.show();
            win.focus();
            win.webContents.send('support:open-event', item.id);
          }
        });
        notice.show();
      }
      if (win && !win.isDestroyed()) win.webContents.send('support:event-due', item);
    }
  }
  if (changed) writeSupportEvents(items);
}

function layoutViews() {
  if (!win) return;
  const b = contentBounds();
  const personal = views.get('personal');
  const company = views.get('company');
  if (!personal || !company) return;

  if (layout === 'split') {
    const left = Math.floor(b.width / 2);
    personal.setVisible(true);
    company.setVisible(true);
    personal.setBounds({ x: b.x, y: b.y, width: left, height: b.height });
    company.setBounds({ x: b.x + left, y: b.y, width: b.width - left, height: b.height });
  } else {
    for (const [id, view] of views) {
      view.setVisible(id === selected);
      if (id === selected) view.setBounds(b);
    }
  }
  win.webContents.send('hub:state', { selected, layout, quickPanelOpen, supportPanelOpen });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1500,
    height: 900,
    minWidth: 1000,
    minHeight: 650,
    title: 'HubZap',
    backgroundColor: '#111b21',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'index.html'));
  createWhatsAppView('personal');
  createWhatsAppView('company');
  win.on('resize', layoutViews);
  win.webContents.on('did-finish-load', () => {
    layoutViews();
    sendUnreadState();
    setTimeout(checkDueEvents, 1000);
  });
}

ipcMain.on('account:select', (_e, id) => {
  if (!accounts[id]) return;
  selected = id;
  layoutViews();
});
ipcMain.on('layout:set', (_e, next) => {
  if (!['single', 'split'].includes(next)) return;
  layout = next;
  layoutViews();
});
ipcMain.on('account:reload', (_e, id) => {
  if (accounts[id]) views.get(id)?.webContents.reload();
});
ipcMain.on('quick:panel', (_e, open) => {
  quickPanelOpen = Boolean(open);
  if (quickPanelOpen) { supportPanelOpen = false; ticketsPanelOpen = false; }
  layoutViews();
});
ipcMain.on('support:panel', (_e, open) => {
  supportPanelOpen = Boolean(open);
  if (supportPanelOpen) { quickPanelOpen = false; ticketsPanelOpen = false; }
  layoutViews();
});
ipcMain.on('tickets:panel', (_e, open) => {
  ticketsPanelOpen = Boolean(open);
  if (ticketsPanelOpen) { quickPanelOpen = false; supportPanelOpen = false; }
  layoutViews();
});
ipcMain.handle('external:afatec', async () => { await shell.openExternal('https://afatec.net'); return { ok:true }; });
ipcMain.handle('privacy:get', () => privacySettings);
ipcMain.handle('privacy:set', async (_e, next) => {
  for (const key of Object.keys(privacySettings)) if (typeof next?.[key] === 'boolean') privacySettings[key] = next[key];
  fs.writeFileSync(path.join(app.getPath('userData'), 'privacy.json'), JSON.stringify(privacySettings));
  await Promise.all([...views.entries()].map(([id,v]) => applyPrivacyToView(v,id)));
  return { ok:true, settings:privacySettings };
});
ipcMain.handle('quick:list', () => readQuickMessages());
ipcMain.handle('quick:save', (_e, input) => {
  const title = String(input?.title || '').trim().slice(0, 60);
  const text = String(input?.text || '').trim().slice(0, 2000);
  const allowed = ['Comercial', 'Suporte', 'Pessoal', 'Cobrança', 'Geral'];
  const category = allowed.includes(input?.category) ? input.category : 'Geral';
  if (!title || !text) return { ok: false, error: 'Título e mensagem são obrigatórios.' };
  const messages = readQuickMessages();
  const id = String(input?.id || '').trim() || `msg-${Date.now()}`;
  const item = { id, title, category, text, favorite: Boolean(input?.favorite) };
  const index = messages.findIndex(m => m.id === id);
  if (index >= 0) messages[index] = item; else messages.unshift(item);
  writeQuickMessages(messages);
  return { ok: true, item };
});
ipcMain.handle('quick:delete', (_e, id) => {
  const messages = readQuickMessages().filter(m => m.id !== String(id));
  writeQuickMessages(messages);
  return { ok: true };
});
ipcMain.handle('tickets:list', () => readSupportTickets());
ipcMain.handle('tickets:save', (_e, input) => {
  const customer = String(input?.customer || '').trim().slice(0, 100);
  const subject = String(input?.subject || '').trim().slice(0, 140);
  const notes = String(input?.notes || '').trim().slice(0, 3000);
  const allowed = ['Em atendimento', 'Aguardando cliente', 'Aguardando terceiro', 'Resolvido'];
  const status = allowed.includes(input?.status) ? input.status : 'Em atendimento';
  if (!customer || !subject) return { ok:false, error:'Cliente e assunto são obrigatórios.' };
  const items = readSupportTickets();
  const id = String(input?.id || '') || 'ticket-' + Date.now();
  const previous = items.find(x => x.id === id);
  const now = new Date().toISOString();
  const item = { id, customer, subject, notes, status, account: input?.account === 'company' ? 'company' : 'personal', createdAt: previous?.createdAt || now, updatedAt: now };
  const i = items.findIndex(x => x.id === id);
  if (i >= 0) items[i] = item; else items.unshift(item);
  writeSupportTickets(items);
  return { ok:true, item };
});
ipcMain.handle('tickets:status', (_e, id, status) => {
  const allowed = ['Em atendimento', 'Aguardando cliente', 'Aguardando terceiro', 'Resolvido'];
  if (!allowed.includes(status)) return { ok:false, error:'Status inválido.' };
  const items = readSupportTickets();
  const item = items.find(x => x.id === String(id));
  if (!item) return { ok:false, error:'Atendimento não encontrado.' };
  item.status = status;
  item.updatedAt = new Date().toISOString();
  writeSupportTickets(items);
  return { ok:true, item };
});
ipcMain.handle('tickets:delete', (_e, id) => {
  writeSupportTickets(readSupportTickets().filter(x => x.id !== String(id)));
  return { ok:true };
});
ipcMain.handle('support:list', () => readSupportEvents());
ipcMain.handle('support:save', (_e, input) => {
  const title = String(input?.title || '').trim().slice(0, 100);
  const contact = String(input?.contact || '').trim().slice(0, 100);
  const notes = String(input?.notes || '').trim().slice(0, 1000);
  const remindAt = String(input?.remindAt || '');
  if (!title || !remindAt || Number.isNaN(new Date(remindAt).getTime())) return { ok:false, error:'Título, data e hora são obrigatórios.' };
  const items = readSupportEvents();
  const id = String(input?.id || '') || 'evt-' + Date.now();
  const ticketId = String(input?.ticketId || '').trim().slice(0, 80);
  const item = { id, title, contact, notes, remindAt, status: input?.status || 'Pendente', account: input?.account === 'company' ? 'company' : 'personal', ticketId, notified:false };
  const i = items.findIndex(x => x.id === id);
  if (i >= 0) items[i] = item; else items.push(item);
  items.sort((a,b) => new Date(a.remindAt)-new Date(b.remindAt));
  writeSupportEvents(items); return {ok:true,item};
});
ipcMain.handle('support:delete', (_e, id) => { writeSupportEvents(readSupportEvents().filter(x => x.id !== String(id))); return {ok:true}; });
ipcMain.handle('support:done', (_e, id) => {
  const items=readSupportEvents(); const item=items.find(x=>x.id===String(id));
  if(item){item.status='Concluído';item.notified=true;writeSupportEvents(items);} return {ok:true};
});
ipcMain.handle('support:snooze', (_e, id, minutes) => {
  const allowed = [10, 30, 60, 1440];
  const delay = Number(minutes);
  if (!allowed.includes(delay)) return { ok:false, error:'Período de adiamento inválido.' };
  const items = readSupportEvents();
  const item = items.find(x => x.id === String(id));
  if (!item) return { ok:false, error:'Evento não encontrado.' };
  item.remindAt = new Date(Date.now() + delay * 60000).toISOString();
  item.status = 'Pendente';
  item.notified = false;
  items.sort((a,b) => new Date(a.remindAt)-new Date(b.remindAt));
  writeSupportEvents(items);
  return { ok:true, item };
});
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('update:status', () => updates.status);
ipcMain.handle('update:check', () => updates.check());
ipcMain.handle('update:download', () => updates.download());
ipcMain.handle('update:apply', () => updates.apply());
ipcMain.handle('update:open-release', async () => { await shell.openExternal(UPDATE_RELEASE_URL); return {ok:true}; });
ipcMain.on('update:install', () => updates.install());

ipcMain.handle('clipboard:copy', (_e, text) => {
  clipboard.writeText(String(text || '').slice(0, 4000));
  return { ok: true };
});

app.whenReady().then(() => {
  try { preferences = normalizePreferences(JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'appearance.json'), 'utf8'))); } catch {}
  try { const saved = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'privacy.json'), 'utf8')); for (const key of Object.keys(privacySettings)) if (typeof saved[key] === 'boolean') privacySettings[key] = saved[key]; } catch {}
  outlook = new OutlookCalendar({ directory: app.getPath('userData'), safeStorage, openExternal: url => shell.openExternal(url), onCode: code => win?.webContents.send('outlook:code', code) });
  setInterval(() => refreshCalendar().catch(() => {}), 300000).unref();
  setInterval(checkCalendarNotices, 15000).unref();
  refreshCalendar().catch(() => {});
  createWindow();
  reminderTimer = setInterval(checkDueEvents, 15000);
  if (app.isPackaged) {
    setTimeout(() => updates.check(), 5000).unref();
    setInterval(() => updates.check(), 6 * 60 * 60 * 1000).unref();
  }
});
app.on('window-all-closed', () => { if (reminderTimer) clearInterval(reminderTimer); if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// Only the trusted local shell may access privileged IPC, never WhatsApp views.
function trustedSender(event) { return win && event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame; }
function handle(channel, listener) { ipcMain.handle(channel, (event, ...args) => { if (!trustedSender(event)) throw new Error('Origem não autorizada.'); return listener(...args); }); }
handle('appearance:get', () => preferences);
handle('appearance:set', input => {
  preferences = normalizePreferences(input);
  fs.writeFileSync(path.join(app.getPath('userData'), 'appearance.json'), JSON.stringify(preferences));
  for (const view of views.values()) view.webContents.setZoomFactor(preferences.zoom / 100);
  layoutViews(); return preferences;
});
handle('panel:extra', open => { extraPanelOpen = Boolean(open); layoutViews(); });
async function refreshCalendar() { const events = await outlook.list(); if (win && !win.isDestroyed()) win.webContents.send('outlook:events', events); return events; }
handle('outlook:status', () => outlook.status());
handle('outlook:connect', async () => { try { await outlook.connect(); await refreshCalendar(); return { ok:true }; } catch { return { ok:false, error:'Conexão Microsoft não concluída. Confira a configuração, o consentimento e tente novamente.' }; } });
handle('outlook:disconnect', async () => { await outlook.disconnect(); calendarNotified.clear(); win.webContents.send('outlook:events', []); return { ok:true }; });
handle('outlook:list', async () => { try { return { ok:true, events:await refreshCalendar() }; } catch (error) { return { ok:false, error:error.message }; } });
handle('outlook:open', async id => { const item=outlook.events.find(x=>x.id===id); if (item && /^https:\/\//i.test(item.url)) await shell.openExternal(item.url); });
function checkCalendarNotices() {
  for (const item of outlook?.events || []) {
    const remaining = new Date(item.start)-Date.now(); const key=item.id+item.start;
    if (item.allDay || remaining < 0 || remaining > 900000 || calendarNotified.has(key)) continue;
    calendarNotified.add(key);
    win?.webContents.send('outlook:notice', item);
    if (Notification.isSupported()) { const notice = new Notification({ title:'HubZap • Reunião em breve', body:item.title+' • '+new Date(item.start).toLocaleTimeString('pt-BR') }); notice.on('click',()=>{win?.show();win?.focus();}); notice.show(); }
  }
}

const stickerStore = () => new StickerStore(path.join(app.getPath('userData'), 'stickers'));
function stickerOperation(operation) { try { return operation(); } catch(error) { return {ok:false,error:error.message}; } }
handle('stickers:list', () => stickerStore().list());
handle('stickers:import', async (input = {}) => {
  const result = await dialog.showOpenDialog(win,{properties:['openFile','multiSelections'],filters:[{name:'Figurinhas',extensions:['png','webp','gif']}]});
  if(result.canceled)return {ok:true,canceled:true};
  return stickerOperation(() => {let added=0,duplicates=0;const errors=[];for(const file of result.filePaths.slice(0,20)){try{const r=stickerStore().addFile(file,input);if(r.duplicate)duplicates++;else added++;}catch(error){errors.push(error.message);}}notifyStickers();return {ok:!errors.length,added,duplicates,error:errors.join(' ')};});
});
handle('stickers:save', (payload) => stickerOperation(() => {
  const match=typeof payload?.data==='string' && payload.data.length<=MAX_FILE*1.4+100 && payload.data.match(/^data:image\/(?:png|webp|gif);base64,([A-Za-z0-9+/=]+)$/);
  if(!match)throw new Error('Imagem inválida ou maior que 5 MB.');
  const result=stickerStore().add(Buffer.from(match[1],'base64'),payload);notifyStickers();return result;
}));
handle('stickers:update', (id,input) => stickerOperation(() => {const result=stickerStore().update(id,input);notifyStickers();return result;}));
handle('stickers:action', async (id, action) => {
  try {
    const store=stickerStore();const item=store.read().find(x=>x.id===id);if(!item)throw new Error('Figurinha não encontrada.');
    if(action==='export'){
      const result=await dialog.showSaveDialog(win,{defaultPath:item.title.replace(/[<>:"/\\|?*]/g,'_')+item.ext,filters:[{name:'Imagem original',extensions:[item.ext.slice(1)]}]});
      if(result.canceled)return {ok:true,canceled:true};fs.copyFileSync(store.file(item),result.filePath);
    }
    store.action(id,action);
    if(action==='open')shell.showItemInFolder(store.file(item));notifyStickers();return {ok:true};
  }catch(error){return {ok:false,error:error.message};}
});
function notifyStickers(message) { if(win&&!win.isDestroyed())win.webContents.send('stickers:changed', {message}); }
async function captureSticker(view, collection, url) {
  try {
    if(!allowedStickerSource(url))throw new Error('Use uma imagem recebida no WhatsApp ou importe o arquivo salvo.');
    // Read only the image selected by the user; no internal WhatsApp APIs.
    const data=await view.webContents.executeJavaScript(imageReadScript(url),true);
    const result=stickerStore().add(Buffer.from(data,'base64'),{title:'Figurinha do WhatsApp',collection,source:'WhatsApp',category:'Reações'});
    notifyStickers(result.duplicate?'Essa figurinha já está nesta coleção.':'Figurinha salva na coleção '+(collection==='company'?'Empresa':'Pessoal')+'.');
  }catch(error){notifyStickers('Não foi possível salvar diretamente. Use Salvar imagem como… e depois Importar. '+error.message);}
}
