import { COLLISION_SYSTEMS } from "./glauber.js";
import {
  buildBatchExplanation,
  buildEventExplanation,
  formatExplanationLog,
} from "./explanations.js";

const state = {
  eventEntries: [],
  batchEntries: [],
  eventMode: "plain",
  batchMode: "plain",
};

function installStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .explanation-log-panel{margin-top:18px;padding:0;overflow:hidden}
    .log-header{display:flex;gap:14px;align-items:flex-start;justify-content:space-between;padding:18px 20px;border-bottom:1px solid var(--border)}
    .log-header h2{margin:0 0 4px;font-size:1.05rem}.log-header p{margin:0;color:var(--muted);font-size:.88rem;max-width:760px}
    .log-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
    .log-switch{display:inline-flex;border:1px solid var(--border);border-radius:999px;padding:3px;background:var(--background)}
    .log-switch button{border:0;background:transparent;border-radius:999px;padding:7px 11px;font-size:.78rem;font-weight:750;cursor:pointer;color:var(--muted)}
    .log-switch button.active{background:var(--primary);color:white}
    .log-download{min-height:34px;padding:6px 10px;font-size:.78rem}
    .explanation-log{display:grid;gap:0;max-height:540px;overflow:auto;padding:6px 20px 18px}
    .log-entry{display:grid;grid-template-columns:38px minmax(0,1fr);gap:12px;padding:14px 0;border-bottom:1px solid var(--border)}
    .log-entry:last-child{border-bottom:0}.log-step{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;font-weight:850;font-size:.78rem;background:var(--background);border:1px solid var(--border)}
    .log-entry h3{margin:0 0 5px;font-size:.92rem}.log-entry p{margin:0;color:var(--muted);line-height:1.5;font-size:.86rem;white-space:pre-wrap;word-break:break-word}
    .log-entry[data-level="success"] .log-step{color:var(--implemented);border-color:color-mix(in srgb,var(--implemented) 35%,var(--border))}
    .log-entry[data-level="warning"] .log-step,.log-entry[data-level="limit"] .log-step{color:var(--planned);border-color:color-mix(in srgb,var(--planned) 35%,var(--border))}
    .log-entry[data-level="calculation"] .log-step,.log-entry[data-level="geometry"] .log-step{color:var(--context)}
    .log-empty{padding:22px 0;color:var(--muted);text-align:center}
    .log-hint{display:inline-flex;align-items:center;gap:6px;font-size:.75rem;color:var(--muted)}
    .log-hint::before{content:"●";color:var(--implemented)}
    @media(max-width:760px){.log-header{flex-direction:column}.log-actions{justify-content:flex-start}.explanation-log{padding-inline:14px}.log-entry{grid-template-columns:34px 1fr}}
  `;
  document.head.append(style);
}

function createPanel(kind, title, subtitle) {
  const panel = document.createElement("section");
  panel.className = "panel explanation-log-panel";
  panel.dataset.logKind = kind;
  panel.innerHTML = `
    <div class="log-header">
      <div><h2>${title}</h2><p>${subtitle}</p></div>
      <div class="log-actions">
        <span class="log-hint">оновлюється автоматично</span>
        <div class="log-switch" role="group" aria-label="Рівень пояснення">
          <button type="button" data-log-mode="plain" class="active">Простими словами</button>
          <button type="button" data-log-mode="technical">Технічний лог</button>
        </div>
        <button type="button" class="log-download">Завантажити .txt</button>
      </div>
    </div>
    <div class="explanation-log"><div class="log-empty">Журнал з’явиться після розрахунку.</div></div>
  `;
  return panel;
}

function renderPanel(panel, entries, mode) {
  const container = panel.querySelector(".explanation-log");
  container.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "log-empty";
    empty.textContent = "Журнал з’явиться після розрахунку.";
    container.append(empty);
    return;
  }
  const technical = mode === "technical";
  for (const item of entries) {
    const article = document.createElement("article");
    article.className = "log-entry";
    article.dataset.level = item.level;
    article.innerHTML = `<span class="log-step">${item.step}</span><div><h3>${item.title}</h3><p></p></div>`;
    article.querySelector("p").textContent = technical ? item.technical : item.explanation;
    container.append(article);
  }
}

function downloadLog(kind, entries, mode) {
  if (!entries.length) return;
  const heading = kind === "event" ? "Algorithmic Universe — журнал події" : "Algorithmic Universe — журнал minimum-bias серії";
  const content = `${heading}\nРежим: ${mode === "technical" ? "технічний" : "простими словами"}\n\n${formatExplanationLog(entries, mode)}\n`;
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `algorithmic-universe-${kind}-log.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function wirePanel(panel, kind) {
  panel.addEventListener("click", (event) => {
    const modeButton = event.target.closest("[data-log-mode]");
    if (modeButton) {
      const mode = modeButton.dataset.logMode;
      state[`${kind}Mode`] = mode;
      for (const button of panel.querySelectorAll("[data-log-mode]")) button.classList.toggle("active", button === modeButton);
      renderPanel(panel, state[`${kind}Entries`], mode);
      return;
    }
    if (event.target.closest(".log-download")) {
      downloadLog(kind, state[`${kind}Entries`], state[`${kind}Mode`]);
    }
  });
}

function parseNumber(text) {
  const match = String(text).replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function summaryFromBatchView() {
  const systemKey = document.querySelector("#batchSystem")?.value;
  const system = COLLISION_SYSTEMS[systemKey];
  const acceptedText = document.querySelector("#batchAccepted")?.textContent || "0/0";
  const [accepted, trialsShown] = acceptedText.split("/").map(Number);
  const crossText = document.querySelector("#batchCrossSection")?.textContent || "";
  const crossNumbers = crossText.replaceAll(",", ".").match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
  const bins = [...document.querySelectorAll("#centralityTable tr")].map((row) => {
    const cells = [...row.children].map((cell) => cell.textContent.trim());
    return {
      key: cells[0]?.replace("%", "") || "—",
      trials: Number(cells[1]) || 0,
      accepted: Number(cells[2]) || 0,
      meanNPart: parseNumber(cells[3]),
      meanNColl: parseNumber(cells[4]),
    };
  });
  const trials = Number.isFinite(trialsShown) ? trialsShown : Number(document.querySelector("#batchCount")?.value || 0);
  return {
    system,
    seed: Number(document.querySelector("#batchSeed")?.value || 0),
    trials,
    accepted: Number.isFinite(accepted) ? accepted : 0,
    acceptance: (parseNumber(document.querySelector("#batchAcceptance")?.textContent) || 0) / 100,
    crossSectionBarn: crossNumbers[0] || 0,
    crossSectionErrorBarn: crossNumbers[1] || 0,
    means: {
      nPart: parseNumber(document.querySelector("#batchMeanNpart")?.textContent),
      nColl: parseNumber(document.querySelector("#batchMeanNcoll")?.textContent),
    },
    centralityBins: bins,
  };
}

function initialize() {
  installStyles();
  const eventPanel = createPanel("event", "Пояснювальний журнал події", "Кожен крок розрахунку пояснюється окремо. Перемикач показує людську або технічну версію того самого результату.");
  const batchPanel = createPanel("batch", "Пояснювальний журнал серії", "Пояснює, як з trial-подій отримуються acceptance, геометричний переріз, середні значення та центральнісні інтервали.");
  document.querySelector("#eventMode")?.append(eventPanel);
  document.querySelector("#batchMode")?.append(batchPanel);
  wirePanel(eventPanel, "event");
  wirePanel(batchPanel, "batch");

  window.addEventListener("glauber:event", (event) => {
    state.eventEntries = buildEventExplanation(event.detail.event);
    renderPanel(eventPanel, state.eventEntries, state.eventMode);
  });

  const progressText = document.querySelector("#batchProgressText");
  if (progressText) {
    new MutationObserver(() => {
      if (!progressText.textContent.startsWith("Готово:")) return;
      state.batchEntries = buildBatchExplanation(summaryFromBatchView());
      renderPanel(batchPanel, state.batchEntries, state.batchMode);
    }).observe(progressText, { childList: true, characterData: true, subtree: true });
  }

  const badge = document.querySelector(".version-badge");
  if (badge) badge.textContent = "Nuclear Web v0.7";
  document.title = "Algorithmic Universe — ядерна лабораторія v0.7";

  setTimeout(() => {
    if (!state.eventEntries.length) document.querySelector("#generateEvent")?.click();
  }, 80);
}

initialize();
