const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { normalizePreferences } = require("../src/preferences");
const { OutlookCalendar, SCOPES } = require("../src/outlook");

test("appearance rejects unsupported geometry, font and zoom values", () => {
  assert.deepEqual(
    normalizePreferences({
      sidebar: "other",
      zoom: 999,
      theme: "remote",
      font: "url(x)",
      size: null,
    }),
    normalizePreferences(),
  );
  assert.equal(
    normalizePreferences({ zoom: 125, sidebar: "expanded" }).zoom,
    125,
  );
});
function calendar(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "hubzap-test-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return new OutlookCalendar({
    directory,
    safeStorage: { isEncryptionAvailable: () => false },
    openExternal: () => {},
    onCode: () => {},
  });
}
test("calendar without configuration stays usable and disconnected", async (t) => {
  const c = calendar(t);
  c.client = undefined;
  c.configured = false;
  assert.equal((await c.status()).connected, false);
  assert.deepEqual(await c.list(), []);
  await assert.rejects(c.connect(), /Client ID/);
  await c.disconnect();
  assert.deepEqual(SCOPES, ["Calendars.ReadBasic"]);
});
test("Graph pagination, UTC normalization, cancellations and minimal scopes", async (t) => {
  const c = calendar(t);
  let calls = 0;
  c.client = {
    getTokenCache: () => ({ getAllAccounts: async () => [{}] }),
    acquireTokenSilent: async (input) => {
      assert.deepEqual(input.scopes, ["Calendars.ReadBasic"]);
      return { accessToken: "test-token" };
    },
  };
  c.fetch = async (url, options) => {
    assert.equal(new URL(url).origin, "https://graph.microsoft.com");
    assert.equal(options.headers.Authorization, "Bearer test-token");
    calls++;
    return {
      ok: true,
      json: async () =>
        calls === 1
          ? {
              value: [
                {
                  id: "one",
                  subject: "Reunião",
                  start: { dateTime: "2026-10-22T14:00:00" },
                  end: { dateTime: "2026-10-22T15:00:00" },
                  onlineMeeting: {
                    joinUrl: "https://teams.microsoft.com/test",
                  },
                },
              ],
              "@odata.nextLink":
                "https://graph.microsoft.com/v1.0/me/calendarView?$skip=1",
            }
          : { value: [{ isCancelled: true }] },
    };
  };
  const result = await c.list();
  assert.equal(calls, 2);
  assert.equal(result.length, 1);
  assert.equal(result[0].start, "2026-10-22T14:00:00Z");
  assert.equal(result[0].url, "https://teams.microsoft.com/test");
});
test("disconnect clears accounts and cached events", async (t) => {
  const c = calendar(t);
  let removed = false;
  c.client = {
    getTokenCache: () => ({
      getAllAccounts: async () => [{}],
      removeAccount: async () => {
        removed = true;
      },
    }),
  };
  c.events = [{ id: "private" }];
  await c.disconnect();
  assert.ok(removed);
  assert.deepEqual(c.events, []);
});
test("Graph rejects untrusted pagination URLs before forwarding tokens", async (t) => {
  const c = calendar(t);
  c.client = {
    getTokenCache: () => ({ getAllAccounts: async () => [{}] }),
    acquireTokenSilent: async () => ({ accessToken: "test" }),
  };
  c.fetch = async () => ({
    ok: true,
    json: async () => ({
      value: [],
      "@odata.nextLink": "https://example.com/steal",
    }),
  });
  await assert.rejects(c.list(), /inválido/);
});
