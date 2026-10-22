const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { StickerStore, imageType, MAX_FILE } = require("../src/stickers");
const { allowedStickerSource, imageReadScript } = require('../src/sticker-capture');
const vm = require('node:vm');
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=",
  "base64",
);
function store(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "hubzap-stickers-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return new StickerStore(directory);
}
test("rejects unsafe formats and oversized payloads", () => {
  assert.throws(
    () => imageType(Buffer.from('<svg onload="alert(1)"/>')),
    /Formato inválido/,
  );
  assert.throws(() => imageType(Buffer.alloc(MAX_FILE + 1)), /até 5 MB/);
});
test("duplicates are avoided within a collection but independent across accounts", (t) => {
  const s = store(t);
  const first = s.add(PNG, { collection: "personal", title: "Bom dia" });
  assert.equal(s.add(PNG, { collection: "personal" }).duplicate, true);
  assert.equal(s.add(PNG, { collection: "company" }).duplicate, false);
  assert.equal(s.list().length, 2);
  assert.equal(s.list()[0].title, "Bom dia");
  assert.equal(s.list()[0].id, first.item.id);
});
test("editing metadata, favorite and deletion preserve the other account", (t) => {
  const s = store(t);
  const personal = s.add(PNG, { collection: "personal" }).item;
  const company = s.add(PNG, { collection: "company" }).item;
  s.update(personal.id, {
    title: "Obrigado",
    source: "Grupo da família",
    tags: "feliz, reações",
  });
  s.action(personal.id, "favorite");
  const saved = new StickerStore(s.directory).list()[0];
  assert.equal(saved.favorite, true);
  assert.equal(saved.source, "Grupo da família");
  assert.equal(saved.tags, "feliz, reações");
  s.action(personal.id, "delete");
  assert.equal(s.list()[0].id, company.id);
  assert.ok(fs.existsSync(s.file(company)));
});
test("legacy library migrates to shared without altering original image bytes", (t) => {
  const s = store(t);
  const item = s.add(PNG, { title: "Antiga" }).item;
  const old = { ...item };
  delete old.collection;
  delete old.animated;
  delete old.hash;
  fs.writeFileSync(s.index, JSON.stringify([old]));
  assert.equal(s.list()[0].collection, "shared");
  assert.ok(fs.readFileSync(s.file(item)).equals(PNG));
  assert.equal(s.add(PNG, { collection: "shared" }).duplicate, true);
});
test("animated source bytes survive import and metadata changes", (t) => {
  const s = store(t);
  const gif = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64",
  );
  const item = s.add(gif, { collection: "company" }).item;
  s.update(item.id, { title: "Reação animada" });
  assert.equal(s.list()[0].animated, true);
  assert.ok(fs.readFileSync(s.file(item)).equals(gif));
});
test("corrupt index and path traversal never silently discard the library", (t) => {
  const s = store(t);
  fs.writeFileSync(s.index, "invalid");
  assert.throws(() => s.add(PNG));
  assert.equal(fs.readFileSync(s.index, "utf8"), "invalid");
  assert.throws(() => s.file({ id: "../../private", ext: ".png" }), /inválido/);
});

test('capture accepts only selected WhatsApp media origins', () => {
  assert.ok(allowedStickerSource('blob:https://web.whatsapp.com/example'));
  assert.ok(allowedStickerSource('https://mmg.whatsapp.net/image.webp'));
  for (const source of ['https://whatsapp.net.evil.test/a','https://evilwhatsapp.net/a','file:///private','javascript:alert(1)','blob:https://example.com/a','not a url']) assert.equal(allowedStickerSource(source),false);
});

test('capture reads original image bytes and cancels oversized streams', async () => {
  class FileReader {
    readAsDataURL(blob) { blob.arrayBuffer().then(data => { this.result='data:application/octet-stream;base64,'+Buffer.from(data).toString('base64');this.onload(); }); }
  }
  const context={Blob,FileReader,AbortSignal,fetch:async()=>new Response(PNG)};
  const encoded=await vm.runInNewContext(imageReadScript('https://mmg.whatsapp.net/example'),context);
  assert.ok(Buffer.from(encoded,'base64').equals(PNG));
  let cancelled=false;
  context.fetch=async()=>({ok:true,headers:new Headers(),body:{getReader:()=>({read:async()=>({done:false,value:Buffer.alloc(MAX_FILE+1)}),cancel:async()=>{cancelled=true;}})}});
  await assert.rejects(vm.runInNewContext(imageReadScript('https://mmg.whatsapp.net/example'),context),/5 MB/);
  assert.ok(cancelled);
});
