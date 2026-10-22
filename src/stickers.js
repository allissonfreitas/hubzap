const fs = require("node:fs");
const path = require("node:path");
const { randomUUID, createHash } = require("node:crypto");
const MAX_FILE = 5 * 1024 * 1024;
const COLLECTIONS = ["personal", "company", "shared"];
function imageType(data) {
  if (!Buffer.isBuffer(data) || !data.length || data.length > MAX_FILE)
    throw new Error("Use uma imagem PNG, WebP ou GIF de até 5 MB.");
  if (
    data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return { ext: ".png", mime: "image/png", animated: false };
  if (/^GIF8[79]a$/.test(data.subarray(0, 6).toString()))
    return { ext: ".gif", mime: "image/gif", animated: true };
  if (
    data.subarray(0, 4).toString() === "RIFF" &&
    data.subarray(8, 12).toString() === "WEBP"
  )
    return {
      ext: ".webp",
      mime: "image/webp",
      animated: data.includes(Buffer.from("ANIM")),
    };
  throw new Error(
    "Formato inválido. Use PNG, WebP ou GIF; SVG e arquivos executáveis não são aceitos.",
  );
}
function metadata(input = {}) {
  return {
    title:
      String(input.title || "Minha figurinha")
        .trim()
        .slice(0, 100) || "Minha figurinha",
    collection: COLLECTIONS.includes(input.collection)
      ? input.collection
      : "shared",
    category:
      String(input.category || "Reações")
        .trim()
        .slice(0, 40) || "Reações",
    source: String(input.source || "")
      .trim()
      .slice(0, 100),
    tags: String(input.tags || "")
      .trim()
      .slice(0, 200),
  };
}
class StickerStore {
  constructor(directory) {
    this.directory = directory;
    this.index = path.join(directory, "index.json");
  }
  read() {
    if (!fs.existsSync(this.index)) return [];
    const items = JSON.parse(fs.readFileSync(this.index, "utf8"));
    if (!Array.isArray(items))
      throw new Error(
        "Índice da biblioteca inválido. Seus arquivos foram preservados.",
      );
    return items.map((item) => ({
      ...item,
      ...metadata({ ...item, collection: item.collection || "shared" }),
      animated: item.animated ?? item.category === "Animados",
    }));
  }
  file(item) {
    if (
      !/^[a-f0-9-]{36}$/i.test(item.id) ||
      ![".png", ".webp", ".gif"].includes(item.ext)
    )
      throw new Error("Arquivo da biblioteca inválido.");
    return path.join(this.directory, item.id + item.ext);
  }
  write(items) {
    fs.mkdirSync(this.directory, { recursive: true });
    if (fs.existsSync(this.index) && !fs.existsSync(this.index + '.pre-collections.json')) {
      const previous = JSON.parse(fs.readFileSync(this.index, 'utf8'));
      if (previous.some(item => !item.collection)) fs.copyFileSync(this.index, this.index + '.pre-collections.json');
    }
    fs.writeFileSync(this.index + ".tmp", JSON.stringify(items, null, 2));
    fs.renameSync(this.index + ".tmp", this.index);
  }
  list() {
    return this.read().map((item) => ({
      ...item,
      preview: fs.existsSync(this.file(item))
        ? `data:${item.mime};base64,${fs.readFileSync(this.file(item)).toString("base64")}`
        : "",
      missing: !fs.existsSync(this.file(item)),
    }));
  }
  add(data, input = {}) {
    const type = imageType(data);
    const meta = metadata(input);
    const items = this.read();
    const hash = createHash("sha256").update(data).digest("hex");
    const existing = items.find(
      (item) =>
        item.collection === meta.collection &&
        (item.hash ||
          (fs.existsSync(this.file(item))
            ? createHash("sha256")
                .update(fs.readFileSync(this.file(item)))
                .digest("hex")
            : "")) === hash,
    );
    if (existing) return { ok: true, item: existing, duplicate: true };
    const total = items.reduce(
      (sum, item) =>
        sum +
        (fs.existsSync(this.file(item))
          ? fs.statSync(this.file(item)).size
          : 0),
      0,
    );
    if (items.length >= 200 || total + data.length > 50 * 1024 * 1024)
      throw new Error(
        "Limite da biblioteca: 200 itens ou 50 MB. Exclua imagens para liberar espaço.",
      );
    const item = {
      ...meta,
      ...type,
      id: randomUUID(),
      hash,
      favorite: false,
      recent: 0,
      createdAt: new Date().toISOString(),
    };
    fs.mkdirSync(this.directory, { recursive: true });
    fs.writeFileSync(this.file(item), data);
    try {
      items.push(item);
      this.write(items);
    } catch (error) {
      fs.rmSync(this.file(item), { force: true });
      throw error;
    }
    return { ok: true, item, duplicate: false };
  }
  addFile(file, input) {
    if (fs.statSync(file).size > MAX_FILE)
      throw new Error("O limite por imagem é 5 MB.");
    return this.add(fs.readFileSync(file), {
      title: path.basename(file, path.extname(file)),
      ...input,
    });
  }
  update(id, input) {
    const items = this.read();
    const item = items.find((x) => x.id === id);
    if (!item) throw new Error("Figurinha não encontrada.");
    Object.assign(item, metadata({ ...item, ...input }));
    this.write(items);
    return { ok: true };
  }
  action(id, action) {
    const items = this.read();
    const item = items.find((x) => x.id === id);
    if (!item) throw new Error("Figurinha não encontrada.");
    if (action === "favorite") item.favorite = !item.favorite;
    else if (action === "open" || action === "export") item.recent = Date.now();
    else if (action === "category")
      item.category = item.category === "Memes" ? "Reações" : "Memes";
    else if (action === "delete") items.splice(items.indexOf(item), 1);
    else throw new Error("Ação inválida.");
    this.write(items);
    if (action === "delete") fs.rmSync(this.file(item), { force: true });
    return item;
  }
}
module.exports = { StickerStore, imageType, MAX_FILE };
