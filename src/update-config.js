// Permanent public update channel. Do not expose feed overrides in preferences/env.
const UPDATE_REPOSITORY = Object.freeze({
  owner: "allissonfreitas",
  repo: "hubzap",
});
const UPDATE_FEED = Object.freeze({ provider: "github", ...UPDATE_REPOSITORY });
const UPDATE_RELEASE_URL = `https://github.com/${UPDATE_REPOSITORY.owner}/${UPDATE_REPOSITORY.repo}/releases/latest`;
module.exports = { UPDATE_REPOSITORY, UPDATE_FEED, UPDATE_RELEASE_URL };
