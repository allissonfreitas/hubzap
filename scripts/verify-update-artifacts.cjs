const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const yaml = require("js-yaml");
const { UPDATE_FEED } = require("../src/update-config");
const pkg = require("../package.json");
async function verify(platform = process.argv[2] || process.platform) {
  const directory = path.resolve(__dirname, "../dist");
  assert.deepEqual(
    pkg.build.publish,
    [UPDATE_FEED],
    "O canal público de atualização não pode mudar.",
  );
  const manifestName = platform === "win32" ? "latest.yml" : "latest-linux.yml";
  const manifest = yaml.load(
    fs.readFileSync(path.join(directory, manifestName), "utf8"),
  );
  assert.equal(
    manifest.version,
    pkg.version,
    "Manifesto e aplicativo precisam ter a mesma versão.",
  );
  const extensions =
    platform === "win32" ? [".exe"] : [".AppImage", ".deb", ".rpm"];
  for (const extension of extensions) {
    const file = manifest.files?.find((x) => x.url.endsWith(extension));
    assert.ok(file, `Falta ${extension} no manifesto ${manifestName}.`);
    const name = decodeURIComponent(file.url);
    assert.equal(
      path.basename(name),
      name,
      "Manifesto deve usar somente nomes locais de arquivos.",
    );
    const fullPath = path.join(directory, name);
    assert.ok(fs.existsSync(fullPath), `Pacote não encontrado: ${name}`);
    assert.equal(
      fs.statSync(fullPath).size,
      file.size,
      `Tamanho inválido: ${name}`,
    );
    const hash = crypto.createHash("sha512");
    for await (const chunk of fs.createReadStream(fullPath)) hash.update(chunk);
    assert.equal(
      hash.digest("base64"),
      file.sha512,
      `Checksum inválido: ${name}`,
    );
    if (platform === "win32")
      assert.equal(name, `HubZap-Setup-${pkg.version}.exe`);
  }
  const resources = path.join(
    directory,
    platform === "win32" ? "win-unpacked" : "linux-unpacked",
    "resources",
  );
  const config = yaml.load(
    fs.readFileSync(path.join(resources, "app-update.yml"), "utf8"),
  );
  for (const key of ["provider", "owner", "repo"])
    assert.equal(config[key], UPDATE_FEED[key]);
  console.log(
    `${platform}: canal fixo, versão, manifestos e SHA-512 de todos os pacotes aprovados.`,
  );
}
if (require.main === module)
  verify().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
module.exports = { verify };
