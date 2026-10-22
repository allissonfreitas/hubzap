// Local sticker library and static creator. No external image service or upload.
const stickerPanel = document.getElementById("stickersPanel");
stickerPanel.innerHTML = `
  <div class="quick-head"><b>✨ Meu repertório</b><button id="stickersClose" title="Fechar">×</button></div>
  <p>Nos grupos: clique com o botão direito na figurinha → Salvar na biblioteca. Se a imagem não estiver acessível, salve o arquivo e importe aqui.</p>
  <label>Coleção<select id="stickerCollection"><option value="all">Todas</option><option value="personal">👤 Pessoal</option><option value="company">💼 Empresa</option><option value="shared">Compartilhados</option></select></label>
  <input id="stickerSearch" placeholder="Buscar nome, grupo ou etiquetas" aria-label="Buscar figurinhas">
  <select id="stickerCategory" aria-label="Categoria"><option>Todos</option><option>Recentes</option><option>Favoritos</option><option>Memes</option><option>Reações</option><option>Animados</option></select>
  <div class="sticker-tools"><button id="stickerImport">＋ Importar arquivos</button><button id="stickerCreate">🎨 Criar figurinha</button></div>
  <p id="stickerDropHint" class="drop-hint" tabindex="0">Arraste PNG, WebP ou GIF para cá, ou cole uma imagem com Ctrl+V. Animações importadas são mantidas.</p>
  <div id="stickerStatus" role="status" aria-live="polite"></div>
  <form id="stickerMetadata" class="support-form hidden">
    <b>Organizar figurinha</b><input id="stickerEditId" type="hidden">
    <label>Nome<input id="stickerEditTitle" required maxlength="100"></label>
    <label>Coleção<select id="stickerEditCollection"><option value="personal">Pessoal</option><option value="company">Empresa</option><option value="shared">Compartilhados</option></select></label>
    <label>Categoria<input id="stickerEditCategory" maxlength="40" list="stickerCategories"></label>
    <label>Grupo / origem (opcional)<input id="stickerEditSource" maxlength="100"></label>
    <label>Etiquetas (opcional)<input id="stickerEditTags" maxlength="200" placeholder="bom dia, engraçadas, trabalho"></label>
    <div class="sticker-tools"><button type="button" id="stickerEditCancel">Cancelar</button><button type="submit" class="primary">Salvar alterações</button></div>
  </form>
  <section id="stickerCreator" class="hidden">
    <div class="quick-head"><b>Criar figurinha estática</b><button id="stickerCreatorClose" title="Fechar criador">×</button></div>
    <p>Escolha uma imagem e acrescente texto. A criação gera WebP de 512 × 512; GIFs e WebPs animados viram uma imagem estática somente neste criador.</p>
    <label>Imagem<input type="file" id="creatorFile" accept="image/png,image/jpeg,image/webp,image/gif"></label>
    <label>Nome<input id="creatorTitle" maxlength="100" placeholder="Minha figurinha"></label>
    <label>Texto acima<input id="creatorTop" maxlength="80"></label>
    <label>Texto abaixo<input id="creatorBottom" maxlength="80"></label>
    <div class="sticker-tools"><label>Enquadramento<select id="creatorFit"><option value="contain">Imagem inteira</option><option value="cover">Preencher quadrado</option></select></label><label>Fundo<select id="creatorBackground"><option value="transparent">Transparente</option><option value="#ffffff">Branco</option><option value="#000000">Preto</option></select></label></div>
    <label>Fonte<select id="creatorFont"><option value="Inter">Inter</option><option value="Poppins">Poppins</option><option value="Arial">Arial</option></select></label>
    <label>Tamanho do texto<input id="creatorFontSize" type="range" min="20" max="72" value="42"></label>
    <canvas id="creatorCanvas" width="512" height="512" aria-label="Prévia da figurinha"></canvas>
    <button id="creatorSave" class="primary" disabled>Salvar no repertório</button>
  </section>
  <datalist id="stickerCategories"><option value="Memes"><option value="Reações"><option value="Bom dia"><option value="Trabalho"></datalist>
  <div id="stickerList" class="quick-list"></div>`;
let stickerImage = null;
let stickerLoadVersion = 0;
const collectionNames = {
  personal: "Pessoal",
  company: "Empresa",
  shared: "Compartilhados",
};
function targetCollection() {
  const value = $("#stickerCollection").value;
  return value === "all" ? selected : value;
}
function stickerMessage(message) {
  $("#stickerStatus").textContent = message;
}
async function loadStickers() {
  const version = ++stickerLoadVersion;
  try {
    const data = await window.hubZap.stickersList();
    if (version !== stickerLoadVersion) return;
    stickers = data;
    renderStickers();
  } catch {
    stickerMessage(
      "Não foi possível carregar a biblioteca. Seus arquivos foram preservados.",
    );
  }
}
function renderStickers() {
  const list = $("#stickerList");
  list.replaceChildren();
  const categorySelect = $('#stickerCategory');
  const previousCategory = categorySelect.value;
  categorySelect.replaceChildren();
  for (const value of new Set(['Todos','Recentes','Favoritos','Memes','Reações','Animados', ...stickers.map(item => item.category)])) categorySelect.add(new Option(value,value));
  categorySelect.value = previousCategory;
  if (!categorySelect.value) categorySelect.value = 'Todos';
  const search = $("#stickerSearch").value.toLocaleLowerCase("pt-BR");
  const category = $("#stickerCategory").value;
  const collection = $("#stickerCollection").value;
  const items = stickers
    .filter(
      (item) =>
        (collection === "all" || item.collection === collection) &&
        [item.title, item.source, item.tags, item.category]
          .join(" ")
          .toLocaleLowerCase("pt-BR")
          .includes(search) &&
        (category === "Todos" ||
          (category === "Recentes" && item.recent) ||
          (category === "Favoritos" && item.favorite) ||
          (category === "Animados" && item.animated) ||
          category === item.category),
    )
    .sort((a, b) => (category === "Recentes" ? b.recent - a.recent : 0));
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent =
      "Seu repertório começa aqui. Salve uma figurinha dos grupos ou crie a sua.";
    list.append(empty);
  }
  for (const item of items) {
    const card = document.createElement("article");
    card.className = "quick-card sticker-card";
    const image = document.createElement("img");
    image.className = "sticker-preview";
    image.alt = item.title;
    if (item.preview) image.src = item.preview;
    image.loading = "lazy";
    const title = document.createElement("b");
    title.textContent = item.title;
    const info = document.createElement("p");
    info.textContent = [
      collectionNames[item.collection],
      item.category,
      item.animated ? "Animada" : "Estática",
      item.source,
      item.tags,
      item.missing ? "Arquivo ausente" : "",
    ]
      .filter(Boolean)
      .join(" • ");
    card.append(image, title, info);
    for (const [action, label] of [
      ["open", "Mostrar arquivo"],
      ["export", "Exportar"],
      ["favorite", item.favorite ? "★ Favorita" : "☆ Favoritar"],
      ["edit", "Organizar"],
      ["delete", "Excluir"],
    ]) {
      const button = document.createElement("button");
      button.textContent = label;
      button.disabled = item.missing && ["open", "export"].includes(action);
      button.onclick = async () => {
        if (action === "edit") {
          editSticker(item);
          return;
        }
        if (
          action === "delete" &&
          !confirm(
            "Excluir “" + item.title + "” somente da biblioteca do HubZap?",
          )
        )
          return;
        const result = await window.hubZap.stickersAction(item.id, action);
        if (!result?.ok)
          stickerMessage(result?.error || "Não foi possível concluir.");
        else if (action === "export" && !result.canceled)
          stickerMessage(
            "Arquivo exportado. Anexe manualmente na conversa do WhatsApp.",
          );
        await loadStickers();
      };
      card.append(button);
    }
    list.append(card);
  }
}
function editSticker(item) {
  $("#stickerCreator").classList.add("hidden");
  $("#stickerMetadata").classList.remove("hidden");
  $("#stickerList").classList.add("hidden");
  for (const [id, key] of [
    ["stickerEditId", "id"],
    ["stickerEditTitle", "title"],
    ["stickerEditCollection", "collection"],
    ["stickerEditCategory", "category"],
    ["stickerEditSource", "source"],
    ["stickerEditTags", "tags"],
  ])
    $("#" + id).value = item[key] || "";
}
function closeStickerEditor() {
  $("#stickerMetadata").classList.add("hidden");
  $("#stickerCreator").classList.add("hidden");
  $("#stickerList").classList.remove("hidden");
}
$("#stickerMetadata").onsubmit = async (event) => {
  event.preventDefault();
  const result = await window.hubZap.stickersUpdate($("#stickerEditId").value, {
    title: $("#stickerEditTitle").value,
    collection: $("#stickerEditCollection").value,
    category: $("#stickerEditCategory").value,
    source: $("#stickerEditSource").value,
    tags: $("#stickerEditTags").value,
  });
  if (!result.ok) return stickerMessage(result.error);
  closeStickerEditor();
  await loadStickers();
  stickerMessage("Figurinha organizada.");
};
$("#stickerEditCancel").onclick = closeStickerEditor;
$("#stickerCreatorClose").onclick = closeStickerEditor;
$("#stickersClose").onclick = () => {
  stickerPanel.classList.add("hidden");
  window.hubZap.setExtraPanel(false);
};
for (const id of ["stickerSearch", "stickerCategory", "stickerCollection"])
  $("#" + id).addEventListener(
    id === "stickerSearch" ? "input" : "change",
    renderStickers,
  );
$("#stickerImport").onclick = async () => {
  const collection = targetCollection();
  const result = await window.hubZap.stickersImport({ collection });
  if (!result.canceled)
    stickerMessage(
      result.ok
        ? `${result.added} salva(s), ${result.duplicates} já existente(s) • ${collectionNames[collection]}.`
        : result.error,
    );
  await loadStickers();
};
async function readStickerFile(file) {
  if (file.size > 5 * 1024 * 1024) throw Error("Limite de 5 MB por figurinha.");
  if (
    !/\.(png|webp|gif)$/i.test(file.name) &&
    !["image/png", "image/webp", "image/gif"].includes(file.type)
  )
    throw Error(
      "Para importar, use PNG, WebP ou GIF. Para JPEG, use Criar figurinha.",
    );
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(file);
  });
  // Native clipboard items sometimes omit MIME type; byte signatures are checked again in main.
  const normalized = String(data).replace(
    /^data:[^;]*;base64,/,
    "data:image/" +
      (file.type === "image/gif" || /\.gif$/i.test(file.name)
        ? "gif"
        : file.type === "image/webp" || /\.webp$/i.test(file.name)
          ? "webp"
          : "png") +
      ";base64,",
  );
  return window.hubZap.stickersSave({
    data: normalized,
    title: file.name.replace(/\.[^.]+$/, "") || "Figurinha colada",
    collection: targetCollection(),
    source: "Importação local",
  });
}
async function importStickerFiles(files) {
  let added = 0,
    duplicates = 0;
  const errors = [];
  for (const file of Array.from(files).slice(0, 20)) {
    try {
      const result = await readStickerFile(file);
      if (!result.ok) errors.push(result.error);
      else if (result.duplicate) duplicates++;
      else added++;
    } catch (error) {
      errors.push(error.message);
    }
  }
  stickerMessage(
    errors.length
      ? errors.join(" ")
      : `${added} salva(s); ${duplicates} já existente(s).`,
  );
  await loadStickers();
}
stickerPanel.addEventListener("dragover", (event) => {
  event.preventDefault();
  stickerPanel.classList.add("dragging");
});
stickerPanel.addEventListener("dragleave", () =>
  stickerPanel.classList.remove("dragging"),
);
stickerPanel.addEventListener("drop", (event) => {
  event.preventDefault();
  stickerPanel.classList.remove("dragging");
  importStickerFiles(event.dataTransfer.files);
});
document.addEventListener("paste", (event) => {
  if (
    stickerPanel.classList.contains("hidden") ||
    !$("#stickerCreator").classList.contains("hidden")
  )
    return;
  const files = Array.from(event.clipboardData?.items || [])
    .filter((x) => x.kind === "file")
    .map((x) => x.getAsFile())
    .filter(Boolean);
  if (files.length) {
    event.preventDefault();
    importStickerFiles(files);
  }
});
window.hubZap.onStickersChanged((data) => {
  if (data.message) stickerMessage(data.message);
  loadStickers();
});
$("#stickerCreate").onclick = () => {
  closeStickerEditor();
  $("#stickerCreator").classList.remove("hidden");
  $("#stickerList").classList.add("hidden");
  drawSticker();
};
$("#creatorFile").onchange = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 10 * 1024 * 1024)
      throw Error("Escolha uma imagem até 10 MB.");
    if (
      !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
        file.type,
      )
    )
      throw Error("Escolha PNG, JPEG, WebP ou GIF.");
    const image = await createImageBitmap(file);
    if (image.width > 8192 || image.height > 8192) {
      image.close();
      throw Error("Imagem grande demais. Use até 8192 pixels por lado.");
    }
    stickerImage?.close();
    stickerImage = image;
    $("#creatorTitle").value = file.name.replace(/\.[^.]+$/, "").slice(0, 100);
    $("#creatorSave").disabled = false;
    await document.fonts.load('600 42px "' + $("#creatorFont").value + '"');
    drawSticker();
  } catch (error) {
    stickerMessage(error.message);
  }
};
function drawSticker() {
  const canvas = $("#creatorCanvas");
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, 512, 512);
  if ($("#creatorBackground").value !== "transparent") {
    context.fillStyle = $("#creatorBackground").value;
    context.fillRect(0, 0, 512, 512);
  }
  if (stickerImage) {
    const scale = ($("#creatorFit").value === "cover" ? Math.max : Math.min)(
      512 / stickerImage.width,
      512 / stickerImage.height,
    );
    const width = stickerImage.width * scale,
      height = stickerImage.height * scale;
    context.drawImage(
      stickerImage,
      (512 - width) / 2,
      (512 - height) / 2,
      width,
      height,
    );
  }
  context.textAlign = "center";
  context.textBaseline = "top";
  context.lineJoin = "round";
  context.strokeStyle = "#000";
  context.fillStyle = "#fff";
  context.lineWidth = 7;
  const size = Number($("#creatorFontSize").value);
  context.font = `600 ${size}px "${$("#creatorFont").value}"`;
  for (const [id, top] of [
    ["creatorTop", true],
    ["creatorBottom", false],
  ]) {
    const text = $("#" + id).value.trim();
    const words = text.split(/\s+/);
    const lines = [];
    let line = "";
    for (const word of words) {
      const next = line ? line + " " + word : word;
      if (context.measureText(next).width > 460 && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    const visible = lines.slice(0, 3);
    let y = top ? 20 : 492 - visible.length * (size + 5);
    for (const value of visible) {
      context.strokeText(value, 256, y, 470);
      context.fillText(value, 256, y, 470);
      y += size + 5;
    }
  }
}
for (const id of [
  "creatorTop",
  "creatorBottom",
  "creatorFit",
  "creatorBackground",
  "creatorFont",
  "creatorFontSize",
])
  $("#" + id).addEventListener("input", drawSticker);
$("#creatorSave").onclick = async () => {
  if (!stickerImage) return;
  const result = await window.hubZap.stickersSave({
    data: $("#creatorCanvas").toDataURL("image/webp", 0.92),
    title: $("#creatorTitle").value || "Minha figurinha",
    collection: targetCollection(),
    source: "Criada no HubZap",
    category: "Criações",
  });
  if (!result.ok) return stickerMessage(result.error);
  closeStickerEditor();
  await loadStickers();
  stickerMessage(
    result.duplicate
      ? "Essa figurinha já está na coleção."
      : "Figurinha criada! Use Exportar ou Mostrar arquivo para anexar no WhatsApp.",
  );
};
