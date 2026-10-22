const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { UpdateController } = require("../src/updates");
const { UPDATE_FEED } = require("../src/update-config");
function fixture(options = {}) {
  const updater = new EventEmitter();
  const calls = [];
  const states = [];
  const scheduled = [];
  updater.setFeedURL = (value) => {
    assert.deepEqual(value, UPDATE_FEED);
    calls.push("feed");
  };
  updater.checkForUpdates = async () => {
    calls.push("check");
    updater.emit(
      options.current ? "update-not-available" : "update-available",
      { version: "0.1.3" },
    );
    return { updateInfo: { version: "0.1.3" } };
  };
  updater.downloadUpdate = async () => {
    calls.push("download");
    updater.emit("download-progress", { percent: 48 });
    updater.emit("update-downloaded", { version: "0.1.3" });
    return ["validated-installer"];
  };
  updater.quitAndInstall = (silent, restart) => {
    calls.push("install");
    assert.equal(silent, false);
    assert.equal(restart, true);
  };
  const controller = new UpdateController({
    updater,
    packaged: options.packaged !== false,
    version: "0.1.2",
    send: (s) => states.push(s),
    schedule: (fn) => scheduled.push(fn),
  });
  return { updater, calls, states, scheduled, controller };
}
test("fixed feed and explicit installation are the same for every supported package", () => {
  const f = fixture();
  assert.equal(f.updater.autoDownload, false);
  assert.equal(f.updater.autoInstallOnAppQuit, false);
  assert.equal(f.updater.disableDifferentialDownload, true);
  assert.equal(f.updater.allowPrerelease, false);
  assert.equal(f.updater.allowDowngrade, false);
});
test("one action checks then downloads then installs and restarts", async () => {
  const f = fixture();
  assert.equal((await f.controller.apply()).ok, true);
  assert.deepEqual(f.calls, ["feed", "check", "download"]);
  assert.equal(f.controller.status.state, "installing");
  f.scheduled[0]();
  assert.deepEqual(f.calls, ["feed", "check", "download", "install"]);
});
test("available version downloads without a second release lookup", async () => {
  const f = fixture();
  await f.controller.check();
  await f.controller.apply();
  assert.equal(f.calls.filter((x) => x === "check").length, 1);
  assert.equal(
    f.states.find((x) => x.state === "downloading" && x.percent === 48).percent,
    48,
  );
});
test("current version does not download or install", async () => {
  const f = fixture({ current: true });
  await f.controller.apply();
  assert.equal(f.controller.status.state, "current");
  assert.ok(!f.calls.includes("download"));
  assert.equal(f.scheduled.length, 0);
});
test("failed checksum or download never installs and can be retried", async () => {
  const f = fixture();
  const valid = f.updater.downloadUpdate;
  f.updater.downloadUpdate = async () => {
    throw Error("SHA512 checksum mismatch");
  };
  assert.equal((await f.controller.apply()).ok, false);
  assert.equal(f.scheduled.length, 0);
  assert.equal(f.controller.status.state, "error");
  f.updater.downloadUpdate = valid;
  assert.equal((await f.controller.apply()).ok, true);
  assert.equal(f.scheduled.length, 1);
});
test("missing release is shown as unavailable instead of falsely current", async () => {
  const f = fixture();
  f.updater.checkForUpdates = async () => {
    throw Error("404 latest.yml");
  };
  await f.controller.check();
  assert.equal(f.controller.status.state, "error");
  assert.match(f.controller.status.message, /versão completa publicada/);
});
test("development and unpackaged Linux do not attempt installation", async () => {
  const f = fixture({ packaged: false });
  assert.equal((await f.controller.apply()).dev, true);
  assert.deepEqual(f.calls, ["feed"]);
  const linux = fixture();
  linux.updater.checkForUpdates = async () => null;
  assert.equal((await linux.controller.apply()).ok, false);
  assert.equal(linux.controller.status.state, "unsupported");
  assert.equal(linux.scheduled.length, 0);
});
test("concurrent clicks share the same download and install once", async () => {
  const f = fixture();
  await Promise.all([
    f.controller.apply(),
    f.controller.apply(),
    f.controller.apply(),
  ]);
  assert.equal(f.calls.filter((x) => x === "download").length, 1);
  assert.equal(f.scheduled.length, 1);
});
test("install is refused before download validation", () => {
  const f = fixture();
  assert.equal(f.controller.install().ok, false);
  assert.equal(f.scheduled.length, 0);
});
test("late subscribers can recover current progress or a ready download", async () => {
  const f = fixture();
  await f.controller.download();
  assert.equal(f.controller.status.state, "ready");
  assert.equal(f.controller.status.version, "0.1.3");
  await f.controller.check();
  assert.equal(f.controller.status.state, "ready");
});
test("a click during a background check waits then downloads", async () => {
  const f = fixture();
  let finish;
  f.updater.checkForUpdates = () =>
    new Promise((resolve) => {
      finish = () => {
        f.updater.emit("update-available", { version: "0.1.3" });
        resolve({});
      };
    });
  const checking = f.controller.check();
  const applying = f.controller.apply();
  finish();
  await checking;
  await applying;
  assert.equal(f.calls.filter((x) => x === "download").length, 1);
  assert.equal(f.scheduled.length, 1);
});
