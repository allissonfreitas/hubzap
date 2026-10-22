const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
app.setPath("appData", path.join(__dirname, "..", ".smoke-data"));
fs.mkdirSync(app.getPath("appData"), { recursive: true });
const fixture = path.join(app.getPath('appData'), 'smoke-sticker.png');
fs.writeFileSync(fixture, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=', 'base64'));
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
