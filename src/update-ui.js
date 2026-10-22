// Permanent update controls share one action and one main-process state.
const toolbarUpdate = document.createElement("button");
toolbarUpdate.id = "toolbarUpdateButton";
toolbarUpdate.title = "Verificar atualizações";
toolbarUpdate.setAttribute("aria-label", "Verificar atualizações do HubZap");
toolbar.insertBefore(toolbarUpdate, toolbar.lastElementChild);
let currentUpdateStatus = { state: "idle" };
function renderUpdate(status) {
  currentUpdateStatus = status;
  const button = document.getElementById("updateButton");
  const detail = document.getElementById("updateDetail");
  const busy = ["checking", "downloading", "installing"].includes(status.state);
  button.dataset.state = status.state;
  button.disabled = toolbarUpdate.disabled = busy;
  const texts = {
    idle: [
      "↻ Verificar atualização",
      "Clique para consultar a versão publicada.",
      "↻ Atualizar",
    ],
    checking: ["↻ Verificando atualização", "Aguarde…", "↻"],
    current: [
      "✓ HubZap atualizado",
      "Clique para verificar novamente.",
      "✓ Atualizar",
    ],
    available: [
      "⬆ Atualizar para " + status.version,
      "Clique para baixar, instalar e reiniciar.",
      "⬆ Atualizar",
    ],
    downloading: [
      "↓ Baixando atualização",
      (status.percent || 0) + "% • aguarde a validação do arquivo.",
      "↓ " + (status.percent || 0) + "%",
    ],
    ready: [
      "⬆ Instalar e reiniciar",
      "Download validado. Clique para concluir a atualização.",
      "⬆ Instalar",
    ],
    installing: [
      "↻ Instalando atualização",
      "O HubZap vai reiniciar. O sistema pode solicitar autorização.",
      "↻ Instalando",
    ],
    error: [
      "⚠ Tentar atualização novamente",
      status.message || "Verifique sua conexão e tente novamente.",
      "⚠ Atualizar",
    ],
    unsupported: ["↻ Atualização indisponível", status.message, "↻"],
    development: [
      "↻ Atualizações no aplicativo instalado",
      "A verificação funciona no HubZap instalado.",
      "↻ Atualizar",
    ],
  };
  const text = texts[status.state] || texts.idle;
  button.querySelector("b").textContent = text[0];
  detail.textContent = text[1];
  button.title = text[1];
  toolbarUpdate.textContent = text[2];
  toolbarUpdate.title = text[0] + " • " + text[1];
  toolbarUpdate.setAttribute("aria-label", text[0]);
  toolbarUpdate.classList.toggle(
    "update-attention",
    ["available", "ready", "error"].includes(status.state),
  );
}
async function updateFromButton() {
  if (
    ["checking", "downloading", "installing"].includes(
      currentUpdateStatus.state,
    )
  )
    return;
  try {
    if (["available", "ready"].includes(currentUpdateStatus.state)) {
      renderUpdate({
        ...currentUpdateStatus,
        state:
          currentUpdateStatus.state === "ready" ? "installing" : "downloading",
        percent: 0,
      });
      const result = await window.hubZap.applyUpdate();
      if (!result.ok && !result.dev)
        renderUpdate({ state: "error", message: result.error });
      return;
    }
    renderUpdate({ state: "checking" });
    const result = await window.hubZap.checkUpdate();
    if (result.available) {
      const applied = await window.hubZap.applyUpdate();
      if (!applied.ok && !applied.dev)
        renderUpdate({ state: "error", message: applied.error });
    } else if (!result.ok && !result.dev)
      renderUpdate({ state: "error", message: result.error });
  } catch (error) {
    renderUpdate({
      state: "error",
      message: "Não foi possível atualizar. Tente novamente. " + error.message,
    });
  }
}
document.getElementById("updateButton").onclick = updateFromButton;
toolbarUpdate.onclick = updateFromButton;
window.hubZap.onUpdateStatus(renderUpdate);
window.hubZap.getUpdateStatus().then(renderUpdate);
window.hubZap.getVersion().then((version) => {
  document.getElementById("appVersion").textContent = "v" + version;
});
renderUpdate(currentUpdateStatus);
