const $ = (selector) => document.querySelector(selector);
let appearance;
let meetings = [];
let stickers = [];
const choices = {
  theme: [
    ["system", "Sistema"],
    ["light", "Claro"],
    ["dark", "Escuro"],
  ],
  font: [
    ["default", "Padrão"],
    ["Inter", "Inter"],
    ["Poppins", "Poppins"],
    ["Arial", "Arial"],
  ],
  size: [
    ["small", "Pequena"],
    ["normal", "Normal"],
    ["large", "Grande"],
  ],
  zoom: [80, 90, 100, 110, 125].map((x) => [x, x + "%"]),
  sidebar: [
    ["compact", "Compacta"],
    ["expanded", "Expandida"],
  ],
};
const labels = {
  theme: "Tema",
  font: "Fonte",
  size: "Tamanho da interface",
  zoom: "Zoom WhatsApp",
  sidebar: "Barra lateral",
};
for (const [key, options] of Object.entries(choices)) {
  const label = document.createElement("label");
  label.textContent = labels[key];
  const select = document.createElement("select");
  select.id = "appearance-" + key;
  for (const [v, text] of options) select.add(new Option(text, v));
  select.onchange = () =>
    saveAppearance({
      ...appearance,
      [key]: key === "zoom" ? Number(select.value) : select.value,
    });
  label.append(select);
  $("#appearanceFields").append(label);
}
function showAppearance() {
  if (!appearance) return;
  const a = appearance;
  document.body.classList.toggle("compact", a.sidebar === "compact");
  document.documentElement.dataset.theme =
    a.theme === "system"
      ? matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark"
      : a.theme;
  document.documentElement.dataset.size = a.size;
  document.documentElement.dataset.font = a.font;
  for (const key of Object.keys(choices))
    $("#appearance-" + key).value = a[key];
  $("#toolbarZoom").value = a.zoom;
  $("#sidebarToggle").title =
    a.sidebar === "compact" ? "Expandir menu" : "Recolher menu";
  $("#sidebarToggle .nav-icon").textContent =
    a.sidebar === "compact" ? "»" : "«";
}
async function saveAppearance(value) {
  appearance = await window.hubZap.setAppearance(value);
  showAppearance();
}
window.hubZap.getAppearance().then((value) => {
  appearance = value;
  showAppearance();
});
matchMedia("(prefers-color-scheme: light)").addEventListener(
  "change",
  showAppearance,
);
$("#toolbarZoom").onchange = (e) =>
  saveAppearance({ ...appearance, zoom: Number(e.target.value) });
$("#sidebarToggle").onclick = () =>
  saveAppearance({
    ...appearance,
    sidebar: appearance.sidebar === "compact" ? "expanded" : "compact",
  });
function openModern(id) {
  const target = document.getElementById(id);
  const open = target.classList.contains("hidden");
  setPanel(false);
  setSupportPanel(false);
  setTicketsPanel(false);
  for (const p of ["settingsPanel", "stickersPanel"])
    document.getElementById(p).classList.add("hidden");
  target.classList.toggle("hidden", !open);
  window.hubZap.setExtraPanel(open);
}
$("#settingsToggle").onclick = () => openModern("settingsPanel");
$("#stickersToggle").onclick = () => {
  openModern("stickersPanel");
  loadStickers();
};
for (const id of ["settings", "stickers"])
  $("#" + id + "Close").onclick = () => {
    $("#" + id + "Panel").classList.add("hidden");
    window.hubZap.setExtraPanel(false);
  };
// Ensure exactly one auxiliary panel is visible, including legacy tools.
for (const id of ["quickToggle", "supportToggle", "ticketsToggle"])
  document.getElementById(id).addEventListener("click", () => {
    for (const p of ["settingsPanel", "stickersPanel"])
      document.getElementById(p).classList.add("hidden");
    window.hubZap.setExtraPanel(false);
    const active =
      id === "quickToggle"
        ? "quickPanel"
        : id === "supportToggle"
          ? "supportPanel"
          : "ticketsPanel";
    for (const p of ["quickPanel", "supportPanel", "ticketsPanel"])
      if (p !== active) document.getElementById(p).classList.add("hidden");
  });
window.hubZap.onState((state) => {
  selected = state.selected;
  accounts.forEach((b) =>
    b.classList.toggle("active", b.dataset.account === selected),
  );
  $("#title").textContent =
    selected === "personal" ? "WhatsApp Pessoal" : "WhatsApp Empresa";
  $("#single").classList.toggle("active", state.layout === "single");
  $("#split").classList.toggle("active", state.layout === "split");
});
async function loadStickers() {
  try {
    stickers = await window.hubZap.stickersList();
    renderStickers();
  } catch {
    toast("Não foi possível carregar a biblioteca.");
  }
}
function renderStickers() {
  const list = $("#stickerList");
  list.replaceChildren();
  const search = $("#stickerSearch").value.toLocaleLowerCase();
  const category = $("#stickerCategory").value;
  const filtered = stickers
    .filter(
      (x) =>
        x.title.toLocaleLowerCase().includes(search) &&
        (category === "Todos" ||
          (category === "Favoritos" && x.favorite) ||
          (category === "Recentes" && x.recent) ||
          category === x.category),
    )
    .sort((a, b) => (category === "Recentes" ? b.recent - a.recent : 0));
  if (!filtered.length)
    list.textContent = "Nenhum sticker nesta categoria. Importe suas imagens.";
  for (const item of filtered) {
    const card = document.createElement("article");
    card.className = "quick-card";
    const image = document.createElement("img");
    image.src = item.preview;
    image.alt = item.title;
    image.className = "sticker-preview";
    const title = document.createElement("p");
    title.textContent = item.title;
    card.append(image, title);
    for (const [action, label] of [
      ["open", "Mostrar arquivo"],
      ["favorite", item.favorite ? "★" : "☆"],
      ["category", "Memes / Reações"],
      ["delete", "Excluir"],
    ]) {
      const b = document.createElement("button");
      b.textContent = label;
      b.onclick = async () => {
        await window.hubZap.stickersAction(item.id, action);
        await loadStickers();
      };
      card.append(b);
    }
    list.append(card);
  }
}
$("#stickerSearch").oninput = renderStickers;
$("#stickerCategory").onchange = renderStickers;
$("#stickerImport").onclick = async () => {
  const r = await window.hubZap.stickersImport();
  if (!r.ok) toast(r.error);
  await loadStickers();
};
async function outlookStatus() {
  const s = await window.hubZap.outlookStatus();
  $("#outlookStatus").textContent = !s.configured
    ? "Outlook ainda não configurado. Consulte docs/OUTLOOK.md."
    : s.connected
      ? "Outlook conectado • somente leitura"
      : s.connecting
        ? "Aguardando autenticação Microsoft…"
        : "Conecte sua conta Microsoft";
  $("#outlookConnect").disabled = !s.configured || s.connected || s.connecting;
  $("#outlookDisconnect").disabled = !s.connected && !s.connecting;
  $("#outlookRefresh").disabled = !s.connected;
}
function renderMeetings() {
  const range = $("#agendaRange").value;
  const list = $("#outlookList");
  list.replaceChildren();
  const today = new Date().toLocaleDateString();
  const future = meetings.filter((x) => new Date(x.end) > new Date());
  const count = future.filter(
    (x) => new Date(x.start) - Date.now() >= 0 && new Date(x.start) - Date.now() <= 900000,
  ).length;
  $("#agendaBadge").textContent = count;
  $("#agendaBadge").classList.toggle("hidden", !count);
  if (range === "local") return;
  const items = future.filter(
    (x) => range === "next" || new Date(x.start).toLocaleDateString() === today,
  );
  if (!items.length) list.textContent = "Nenhuma reunião neste período.";
  for (const item of items) {
    const card = document.createElement("article");
    card.className = "support-card";
    const title = document.createElement("b");
    title.textContent = item.title;
    const time = document.createElement("p");
    time.textContent = item.allDay
      ? "Dia inteiro • " + new Date(item.start).toLocaleDateString("pt-BR")
      : new Date(item.start).toLocaleString("pt-BR");
    card.append(title, time);
    if (item.url) {
      const b = document.createElement("button");
      b.textContent = "Abrir reunião / Outlook";
      b.onclick = () => window.hubZap.outlookOpen(item.id);
      card.append(b);
    }
    list.append(card);
  }
}
async function refreshOutlook() {
  const r = await window.hubZap.outlookList();
  if (r.ok) {
    meetings = r.events;
    renderMeetings();
  }
  await outlookStatus();
  if (!r.ok) $("#outlookStatus").textContent = r.error;
}
$("#outlookConnect").onclick = async () => {
  $("#outlookConnect").disabled = true;
  $("#outlookDisconnect").disabled = false;
  const r = await window.hubZap.outlookConnect();
  $("#outlookCode").textContent = "";
  if (!r.ok) toast(r.error);
  await outlookStatus();
  await refreshOutlook();
};
$("#outlookDisconnect").onclick = async () => {
  await window.hubZap.outlookDisconnect();
  meetings = [];
  $("#outlookCode").textContent = "";
  renderMeetings();
  await outlookStatus();
};
$("#outlookRefresh").onclick = refreshOutlook;
$("#agendaRange").onchange = renderMeetings;
window.hubZap.onOutlookCode((data) => {
  $("#outlookCode").textContent =
    "No navegador Microsoft, digite: " +
    data.code +
    " (expira em " +
    Math.ceil(data.expiresIn / 60) +
    " min).";
});
window.hubZap.onOutlookEvents((events) => {
  meetings = events;
  renderMeetings();
});
window.hubZap.onOutlookNotice((item) =>
  toast("📅 Reunião em breve: " + item.title),
);
outlookStatus();
refreshOutlook();
setInterval(renderMeetings, 30000);
window.hubZap.onUpdateStatus((status) => {
  const visible = ["available", "downloading", "ready", "error"].includes(
    status.state,
  );
  for (const button of [
    document.getElementById("settingsToggle"),
    document.querySelector("header>button:last-child"),
  ]) {
    button.classList.toggle("update-attention", visible);
    button.title = visible
      ? "Configurações • Atualização disponível ou requer atenção"
      : "Configurações";
  }
});
