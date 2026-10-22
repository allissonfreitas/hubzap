// Construct the shell before the existing features bind their controls.
const sidebar = document.querySelector("#sidebar");
const toolbar = document.querySelector("header");
for (const id of ["single", "split", "reload"])
  toolbar.append(document.getElementById(id));
const accountTabs = document.createElement("div");
accountTabs.className = "account-tabs";
for (const [id, label] of [
  ["personal", "👤 Pessoal"],
  ["company", "💼 Empresa"],
]) {
  const b = document.createElement("button");
  b.textContent = label;
  b.onclick = () => window.hubZap.selectAccount(id);
  accountTabs.append(b);
}
toolbar.prepend(accountTabs);
const settingsPanel = document.createElement("section");
settingsPanel.id = "settingsPanel";
settingsPanel.className = "quick-panel hidden";
settingsPanel.innerHTML =
  '<div class="quick-head"><b>⚙ Configurações</b><button id="settingsClose" title="Fechar">×</button></div><h3>Aparência</h3><div id="appearanceFields"></div><h3>Privacidade</h3><div id="privacyContainer"></div><h3>Atualizações</h3>';
document.body.append(settingsPanel);
for (const id of ["privacyControl", "privacyOptions"])
  settingsPanel
    .querySelector("#privacyContainer")
    .append(document.getElementById(id));
settingsPanel.append(document.getElementById("updateButton"));
document.getElementById("themeToggle").hidden = true;
const features = [
  ["quickToggle", "⚡", "Mensagens rápidas"],
  ["supportToggle", "📅", "Agenda"],
  ["ticketsToggle", "🎧", "Atendimento"],
];
for (const [id, icon, label] of features) {
  const b = document.getElementById(id);
  b.title = label;
  b.innerHTML =
    '<span class="nav-icon">' +
    icon +
    '</span><span class="nav-label">' +
    label +
    "</span>";
}
for (const b of document.querySelectorAll(".account")) {
  b.title = b.dataset.account === "personal" ? "Pessoal" : "Empresa";
  const icon = document.createElement("span");
  icon.className = "nav-icon";
  icon.textContent = b.dataset.account === "personal" ? "👤" : "💼";
  b.prepend(icon);
}
for (const [id, icon, label] of [
  ["stickersToggle", "✨", "Stickers"],
  ["settingsToggle", "⚙", "Configurações"],
  ["sidebarToggle", "»", "Expandir menu"],
]) {
  const b = document.createElement("button");
  b.id = id;
  b.title = label;
  b.innerHTML =
    '<span class="nav-icon">' +
    icon +
    '</span><span class="nav-label">' +
    label +
    "</span>";
  sidebar.insertBefore(b, sidebar.querySelector(".spacer"));
}
const privacyShortcut = document.createElement("button");
privacyShortcut.title = "Privacidade";
privacyShortcut.innerHTML =
  '<span class="nav-icon">🔒</span><span class="nav-label">Privacidade</span>';
privacyShortcut.onclick = () =>
  document.getElementById("settingsToggle").click();
sidebar.insertBefore(
  privacyShortcut,
  document.getElementById("settingsToggle"),
);
const zoomControl = document.createElement("select");
zoomControl.id = "toolbarZoom";
zoomControl.title = "Zoom WhatsApp";
zoomControl.setAttribute("aria-label", "Zoom WhatsApp");
for (const v of [80, 90, 100, 110, 125])
  zoomControl.add(new Option(v + "%", v));
toolbar.append(zoomControl);
const gear = document.createElement("button");
gear.textContent = "⚙";
gear.title = "Configurações";
gear.onclick = () => document.getElementById("settingsToggle").click();
toolbar.append(gear);
const stickersPanel = document.createElement("section");
stickersPanel.id = "stickersPanel";
stickersPanel.className = "quick-panel hidden";
stickersPanel.innerHTML =
  '<div class="quick-head"><b>✨ Stickers</b><button id="stickersClose" title="Fechar">×</button></div><p>Organize suas imagens. Use “Mostrar arquivo” e anexe manualmente pelo WhatsApp. A importação não cria pacotes oficiais de figurinhas.</p><input id="stickerSearch" placeholder="Buscar stickers" aria-label="Buscar stickers"><select id="stickerCategory" aria-label="Categoria"><option>Todos</option><option>Recentes</option><option>Favoritos</option><option>Memes</option><option>Reações</option><option>Animados</option></select><button id="stickerImport">＋ Importar PNG, WebP ou GIF</button><div id="stickerList" class="quick-list"></div>';
document.body.append(stickersPanel);
const agenda = document.querySelector("#supportPanel");
agenda.querySelector(".quick-head b").textContent = "📅 Agenda";
agenda.querySelector(".quick-head small").textContent =
  "Outlook e lembretes locais";
const outlookSection = document.createElement("div");
outlookSection.className = "outlook-section";
outlookSection.innerHTML =
  '<p id="outlookStatus">Verificando conexão…</p><button id="outlookConnect">Conectar Outlook</button><button id="outlookDisconnect">Desconectar</button><button id="outlookRefresh">Atualizar</button><p id="outlookCode" role="status"></p><select id="agendaRange" aria-label="Período da agenda"><option value="today">Hoje</option><option value="next">Próximos 14 dias</option><option value="local">Lembretes HubZap</option></select><div id="outlookList"></div>';
agenda.insertBefore(outlookSection, agenda.querySelector("#reminderAlert"));
const agendaBadge = document.createElement("span");
agendaBadge.id = "agendaBadge";
agendaBadge.className = "unread-badge hidden";
document.getElementById("supportToggle").append(agendaBadge);
