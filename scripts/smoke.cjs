const { app, BrowserWindow, dialog, session } = require("electron");
const path = require("path");
const fs = require("fs");
const smokeDirectory = path.join(
  __dirname,
  "..",
  ".smoke-data",
  "run-" + require("node:crypto").randomUUID(),
);
fs.mkdirSync(smokeDirectory, { recursive: true });
app.setPath("appData", smokeDirectory);
const fixture = path.join(app.getPath("appData"), "smoke-sticker.png");
fs.writeFileSync(
  fixture,
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=",
    "base64",
  ),
);
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [fixture] });
const failures = [];
app.on("web-contents-created", (_event, wc) => {
  wc.on("console-message", (_e, ...args) => {
    const detail = args[0];
    if (typeof detail === "object" && detail.level === "error")
      failures.push(detail.message);
  });
  wc.on("render-process-gone", (_e, detail) =>
    failures.push(JSON.stringify(detail)),
  );
});
// Keep smoke tests independent from WhatsApp connectivity and real accounts.
app.whenReady().then(() => {
  for (const partition of ["persist:wa-personal", "persist:wa-company"]) {
    session
      .fromPartition(partition)
      .protocol.handle(
        "https",
        () =>
          new Response(
            "<html><title>WhatsApp fixture</title><body>Offline test view</body></html>",
            { headers: { "content-type": "text/html" } },
          ),
      );
  }
});
setTimeout(() => {
  console.error("Smoke test timed out.");
  app.exit(1);
}, 120000).unref();
require("../src/main");
app.whenReady().then(async () => {
  try {
    const win = BrowserWindow.getAllWindows()[0];
    if (win.webContents.isLoading())
      await new Promise((resolve) =>
        win.webContents.once("did-finish-load", resolve),
      );
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const result = await win.webContents.executeJavaScript(`(async()=>{
      const check=(condition,label)=>{if(!condition)throw new Error(label)};
      check(document.getElementById('toolbarUpdateButton'),'permanent update toolbar button');
      await window.hubZap.checkUpdate();
      await new Promise(resolve=>setTimeout(resolve,50));
      check(document.getElementById('updateButton').dataset.state==='development','development status does not get stuck checking');
      check(!document.getElementById('toolbarUpdateButton').disabled,'update retry enabled');
      check(document.body.classList.contains('compact'),'compact sidebar');
      check(document.getElementById('sidebar').getBoundingClientRect().width===72,'sidebar width');
      document.getElementById('settingsToggle').click();
      check(!document.getElementById('settingsPanel').classList.contains('hidden'),'settings open');
      await window.hubZap.setAppearance({theme:'light',font:'Inter',size:'large',zoom:125,sidebar:'expanded'});
      const a=await window.hubZap.getAppearance();check(a.zoom===125&&a.sidebar==='expanded','persist appearance');
      await window.hubZap.setPrivacy({enabled:true,personal:true,company:false});
      const privacy=await window.hubZap.getPrivacy();check(privacy.personal&&!privacy.company,'privacy per account');
      document.getElementById('stickersToggle').click();check(document.getElementById('settingsPanel').classList.contains('hidden'),'exclusive panels');
      check((await window.hubZap.stickersList()).length===0,'empty stickers');
      check((await window.hubZap.stickersImport()).ok,'import sticker');
      const imported=await window.hubZap.stickersList();check(imported.length===1 && imported[0].preview.startsWith('data:image/png;base64,'),'sticker preview');
      await window.hubZap.stickersAction(imported[0].id,'favorite');check((await window.hubZap.stickersList())[0].favorite,'favorite sticker');
      await window.hubZap.stickersAction(imported[0].id,'delete');check((await window.hubZap.stickersList()).length===0,'delete sticker');
      document.getElementById('stickerCollection').value='company';
      document.getElementById('stickerCreate').click();
      const source=document.createElement('canvas');source.width=64;source.height=64;source.getContext('2d').fillRect(0,0,64,64);const sourceBlob=await new Promise(resolve=>source.toBlob(resolve));
      const transfer=new DataTransfer();transfer.items.add(new File([sourceBlob],'foto.png',{type:'image/png'}));
      document.getElementById('creatorFile').files=transfer.files;
      await document.getElementById('creatorFile').onchange({target:document.getElementById('creatorFile')});
      check(!document.getElementById('creatorSave').disabled,'creator loaded image');
      document.getElementById('creatorBottom').value='Bom dia!';document.getElementById('creatorBottom').dispatchEvent(new Event('input'));
      await document.getElementById('creatorSave').onclick();
      const created=await window.hubZap.stickersList();check(created.length===1&&created[0].collection==='company'&&created[0].mime==='image/webp','created WebP in company library');
      const encoded=created[0].preview.split(',')[1];const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));const bitmap=await createImageBitmap(new Blob([bytes],{type:'image/webp'}));check(bitmap.width===512&&bitmap.height===512,'512px output');bitmap.close();
      await window.hubZap.stickersUpdate(created[0].id,{title:'Minha reação',source:'Grupo de teste',tags:'bom dia'});
      check((await window.hubZap.stickersList())[0].source==='Grupo de teste','group metadata');
      const duplicate=await window.hubZap.stickersSave({data:created[0].preview,collection:'company'});check(duplicate.duplicate,'deduplication');
      await window.hubZap.stickersAction(created[0].id,'delete');
      document.getElementById('stickerCollection').value='all';
      document.getElementById('supportToggle').click();check(!document.getElementById('supportPanel').classList.contains('hidden'),'agenda open');
      document.getElementById('quickToggle').click();check(document.getElementById('supportPanel').classList.contains('hidden'),'close agenda');
      document.getElementById('ticketsToggle').click();check(document.getElementById('quickPanel').classList.contains('hidden'),'close quick messages');
      document.getElementById('ticketsClose').click();
      const select=document.getElementById('appearance-sidebar');select.value='compact';select.dispatchEvent(new Event('change'));
      return 'UI interactions passed';
    })()`);
    await new Promise((resolve) => setTimeout(resolve, 500));
    fs.mkdirSync(path.join(__dirname, "..", "dist"), { recursive: true });
    fs.writeFileSync(
      path.join(__dirname, "..", "dist", "hubzap-preview.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    const shellErrors = failures.filter(
      (x) =>
        !/whatsapp|ERR_|favicon|Failed to fetch|Content Security Policy/i.test(
          x,
        ),
    );
    if (shellErrors.length) throw new Error(shellErrors.join("\n"));
    console.log(result);
    app.exit(0);
  } catch (e) {
    console.error(e);
    app.exit(1);
  }
});
