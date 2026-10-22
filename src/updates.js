const { UPDATE_FEED } = require("./update-config");
class UpdateController {
  constructor({ updater, packaged, version, send, schedule = setTimeout }) {
    Object.assign(this, { updater, packaged, version, send, schedule });
    this.status = { state: "idle", version };
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.autoRunAppAfterInstall = true;
    updater.disableDifferentialDownload = true;
    updater.allowPrerelease = false;
    updater.allowDowngrade = false;
    updater.setFeedURL({ ...UPDATE_FEED });
    updater.on("checking-for-update", () => this.report({ state: "checking" }));
    updater.on("update-available", (info) =>
      this.report({ state: "available", version: info.version }),
    );
    updater.on("update-not-available", () =>
      this.report({ state: "current", version }),
    );
    updater.on("download-progress", (progress) =>
      this.report({
        state: "downloading",
        version: this.status.version,
        percent: Math.min(100, Math.max(0, Math.round(progress.percent || 0))),
      }),
    );
    updater.on("update-downloaded", (info) =>
      this.report({ state: "ready", version: info.version }),
    );
    updater.on("error", (error) => this.fail(error));
  }
  report(status) {
    this.status = status;
    this.send({ ...status });
  }
  fail(error) {
    const message = String(error?.message || error);
    const missing =
      /404|ERR_UPDATER_CHANNEL_FILE_NOT_FOUND|ERR_UPDATER_LATEST_VERSION_NOT_FOUND|No published versions|Cannot find latest/i.test(
        message,
      );
    this.report({
      state: "error",
      message: missing
        ? "Ainda não há uma versão completa publicada para este sistema. Tente novamente depois."
        : `Não foi possível atualizar. Verifique sua conexão e tente novamente. ${message.slice(0, 200)}`,
    });
    return { ok: false, error: this.status.message };
  }
  check() {
    if (!this.packaged) {
      this.report({ state: "development", version: this.version });
      return Promise.resolve({ ok: false, dev: true });
    }
    if (this.inFlight) return this.inFlight;
    if (["ready", "installing"].includes(this.status.state))
      return Promise.resolve({ ok: true, state: this.status.state });
    this.inFlight = this.performCheck().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }
  async performCheck() {
    this.report({ state: "checking" });
    try {
      const result = await this.updater.checkForUpdates();
      if (!result) {
        this.report({
          state: "unsupported",
          message:
            "Use o HubZap instalado por NSIS, AppImage, DEB ou RPM para atualizar por este botão.",
        });
        return { ok: false, error: this.status.message };
      }
      return {
        ok: true,
        available: this.status.state === "available",
        version: this.status.version,
      };
    } catch (error) {
      return this.fail(error);
    }
  }
  download() {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.performDownload().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }
  async performDownload() {
    if (!this.packaged) {
      this.report({ state: "development", version: this.version });
      return { ok: false, dev: true };
    }
    if (this.status.state === "ready") return { ok: true };
    if (this.status.state !== "available") {
      const checked = await this.performCheck();
      if (!checked.ok || !checked.available) return checked;
    }
    this.report({
      state: "downloading",
      version: this.status.version,
      percent: 0,
    });
    try {
      // electron-updater verifies the release manifest's SHA-512 before marking ready.
      const files = await this.updater.downloadUpdate();
      if (!files?.length || this.status.state !== "ready")
        throw new Error("O download não foi validado. Tente novamente.");
      return { ok: true };
    } catch (error) {
      return this.fail(error);
    }
  }
  install() {
    if (this.status.state !== "ready")
      return {
        ok: false,
        error: "Baixe e valide a atualização antes de instalar.",
      };
    const version = this.status.version;
    this.report({ state: "installing", version });
    this.schedule(() => {
      try {
        this.updater.quitAndInstall(false, true);
      } catch (error) {
        this.fail(error);
      }
    }, 700);
    return { ok: true };
  }
  apply() {
    if (this.applying) return this.applying;
    this.applying = (async () => {
      if (this.inFlight) await this.inFlight;
      if (this.status.state === "installing") return { ok: true };
      if (this.status.state !== "ready") {
        const result = await this.download();
        if (!result.ok || this.status.state !== "ready") return result;
      }
      return this.install();
    })().finally(() => {
      this.applying = null;
    });
    return this.applying;
  }
}
module.exports = { UpdateController };
