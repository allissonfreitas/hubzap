const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const renderer = fs.readFileSync(path.join(root, 'src', 'renderer.js'), 'utf8');

test('public edition uses its own identity and data directory', () => {
  assert.equal(packageJson.build.appId, 'net.afatec.hubzap.community');
  assert.match(main, /COMMUNITY_APP_ID = 'net\.afatec\.hubzap\.community'/);
  assert.match(main, /app\.setPath\('userData', path\.join\(app\.getPath\('appData'\), COMMUNITY_USER_DATA_DIRECTORY\)\)/);
  assert.match(main, /app\.setAppUserModelId\(COMMUNITY_APP_ID\)/);
});

test('all update paths target the permanent public repository', () => {
  const config = require('../src/update-config');
  assert.deepEqual(config.UPDATE_REPOSITORY, {owner:'allissonfreitas',repo:'hubzap'});
  assert.ok(Object.isFrozen(config.UPDATE_REPOSITORY));
  assert.deepEqual(packageJson.build.publish[0],config.UPDATE_FEED);
  assert.equal(config.UPDATE_RELEASE_URL,'https://github.com/allissonfreitas/hubzap/releases/latest');
  assert.match(main,/new UpdateController/);
});

test('privacy account selectors persist and reapply their own setting', () => {
  assert.match(renderer, /\['privacyPersonal','personal'\]/);
  assert.match(renderer, /\['privacyCompany','company'\]/);
  assert.match(renderer, /privacy\[key\]=e\.target\.checked;await savePrivacy\(\)/);
  assert.match(main, /removeInsertedCSS\(view\._hubPrivacyKey\)/);
  assert.match(main, /id === 'personal' \? privacySettings\.personal !== false : privacySettings\.company !== false/);
});

test('privacy panel collapse is independent from the enabled switch', () => {
  const index = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
  const styles = fs.readFileSync(path.join(root, 'src', 'styles.css'), 'utf8');
  assert.match(index, /id="privacyEnabled" role="switch"/);
  assert.match(renderer, /privacyPanelOpen=!privacyPanelOpen;renderPrivacy\(\)/);
  assert.match(renderer, /privacy\.enabled=e\.target\.checked;await savePrivacy\(\)/);
  assert.doesNotMatch(renderer, /privacy\.enabled=!privacy\.enabled/);
  assert.match(styles, /aside\{[^}]*overflow-y:auto;overflow-x:hidden/);
  assert.match(styles, /\.privacy-control\{[^}]*flex:0 0 auto;min-height:45px/);
});

test('release metadata retains identity and advances to v0.1.2', () => {
  assert.equal(packageJson.version, '0.1.2');
  assert.equal(packageJson.build.productName, 'HubZap');
  assert.equal(packageJson.build.artifactName, 'HubZap-Setup-${version}.${ext}');
  assert.deepEqual(packageJson.build.publish[0], {
    provider: 'github',
    owner: 'allissonfreitas',
    repo: 'hubzap'
  });
});
