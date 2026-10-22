const { PublicClientApplication } = require("@azure/msal-node");
const fs = require("node:fs");
const path = require("node:path");
const SCOPES = ["Calendars.ReadBasic"];
class OutlookCalendar {
  constructor({
    directory,
    safeStorage,
    openExternal,
    onCode,
    fetch = globalThis.fetch,
  }) {
    Object.assign(this, {
      directory,
      safeStorage,
      openExternal,
      onCode,
      fetch,
    });
    this.events = [];
    this.generation = 0;
    let config = {};
    try {
      config = JSON.parse(
        fs.readFileSync(path.join(directory, "outlook-config.json"), "utf8"),
      );
    } catch {}
    const clientId = process.env.HUBZAP_MICROSOFT_CLIENT_ID || config.clientId;
    const tenant =
      process.env.HUBZAP_MICROSOFT_TENANT_ID || config.tenantId || "common";
    this.configured =
      /^[a-f0-9-]{36}$/i.test(clientId || "") &&
      /^(common|organizations|consumers|[a-f0-9-]{36})$/i.test(tenant);
    if (!this.configured) return;
    this.client = new PublicClientApplication({
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenant}`,
      },
    });
    this.cacheFile = path.join(directory, "outlook-cache.bin");
    try {
      if (safeStorage.isEncryptionAvailable())
        this.client
          .getTokenCache()
          .deserialize(
            safeStorage.decryptString(fs.readFileSync(this.cacheFile)),
          );
    } catch {}
  }
  async status() {
    return {
      configured: this.configured,
      connected: Boolean(
        this.client &&
        (await this.client.getTokenCache().getAllAccounts()).length,
      ),
      connecting: Boolean(this.pending),
    };
  }
  persist() {
    if (
      this.safeStorage.isEncryptionAvailable() &&
      this.safeStorage.getSelectedStorageBackend?.() !== "basic_text"
    ) {
      fs.writeFileSync(
        this.cacheFile,
        this.safeStorage.encryptString(this.client.getTokenCache().serialize()),
        { mode: 0o600 },
      );
    }
  }
  async connect() {
    if (!this.client)
      throw new Error(
        "Configure o Client ID Microsoft. Consulte docs/OUTLOOK.md.",
      );
    if (this.pending) throw new Error("Conexão já em andamento.");
    const generation = this.generation;
    this.pending = {
      scopes: SCOPES,
      deviceCodeCallback: (code) => {
        this.onCode({ code: code.userCode, expiresIn: code.expiresIn });
        this.openExternal("https://microsoft.com/devicelogin");
      },
    };
    try {
      await this.client.acquireTokenByDeviceCode(this.pending);
      if (generation !== this.generation) {
        await this.clearAccounts();
        return;
      }
      this.persist();
    } finally {
      this.pending = null;
    }
  }
  async clearAccounts() {
    if (!this.client) return;
    const cache = this.client.getTokenCache();
    for (const account of await cache.getAllAccounts())
      await cache.removeAccount(account);
  }
  async disconnect() {
    this.generation++;
    if (this.pending) this.pending.cancel = true;
    await this.clearAccounts();
    this.events = [];
    if (this.cacheFile) fs.rmSync(this.cacheFile, { force: true });
  }
  async list() {
    if (!(await this.status()).connected) return [];
    const generation = this.generation;
    const account = (await this.client.getTokenCache().getAllAccounts())[0];
    const token = await this.client.acquireTokenSilent({
      account,
      scopes: SCOPES,
    });
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 14);
    const query = new URLSearchParams({
      startDateTime: start.toISOString(),
      endDateTime: end.toISOString(),
      $select:
        "id,subject,start,end,isCancelled,onlineMeeting,webLink,isAllDay",
      $orderby: "start/dateTime",
      $top: "100",
    });
    let url = `https://graph.microsoft.com/v1.0/me/calendarView?${query}`;
    const events = [];
    while (url) {
      const parsed = new URL(url);
      if (parsed.origin !== "https://graph.microsoft.com")
        throw new Error("Endereço Graph inválido.");
      const response = await this.fetch(url, {
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          Prefer: 'outlook.timezone="UTC"',
        },
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok)
        throw new Error(
          `Não foi possível ler a agenda (${response.status}). Reconecte ou consulte o administrador Microsoft.`,
        );
      const data = await response.json();
      for (const event of data.value || [])
        if (!event.isCancelled)
          events.push({
            id: event.id,
            title: event.subject || "Reunião",
            start: event.start.dateTime.replace(/Z$/, "") + "Z",
            end: event.end.dateTime.replace(/Z$/, "") + "Z",
            url: event.onlineMeeting?.joinUrl || event.webLink || "",
            allDay: event.isAllDay,
          });
      url = data["@odata.nextLink"];
    }
    if (generation !== this.generation) return [];
    this.persist();
    this.events = events;
    return events;
  }
}
module.exports = { OutlookCalendar, SCOPES };
