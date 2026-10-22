const DEFAULTS = Object.freeze({
  theme: "system",
  font: "default",
  size: "normal",
  zoom: 100,
  sidebar: "compact",
});
function normalizePreferences(input = {}) {
  const result = { ...DEFAULTS };
  const choices = {
    theme: ["light", "dark", "system"],
    font: ["default", "Inter", "Poppins", "Arial"],
    size: ["small", "normal", "large"],
    zoom: [80, 90, 100, 110, 125],
    sidebar: ["compact", "expanded"],
  };
  for (const key of Object.keys(choices))
    if (choices[key].includes(input[key])) result[key] = input[key];
  return result;
}
module.exports = { DEFAULTS, normalizePreferences };
