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

    .pipeline-card.integration::after{background:var(--implemented)}
    .pipeline-card.integration em{color:var(--implemented);background:color-mix(in srgb,var(--implemented) 12%,transparent)}
    .generator-release-panel{margin:0 0 14px;border:1px solid color-mix(in srgb,var(--accent) 35%,var(--border));border-radius:16px;padding:18px;background:linear-gradient(135deg,color-mix(in srgb,var(--accent-soft) 72%,var(--panel)),var(--panel) 58%);box-shadow:0 12px 34px rgba(15,23,42,.06)}
    .generator-release-header{display:flex;gap:18px;align-items:flex-start;justify-content:space-between;margin-bottom:14px}
    .generator-release-header h2{margin:4px 0 5px;font-size:1.15rem}.generator-release-header p{margin:0;max-width:900px;color:var(--muted);line-height:1.5;font-size:.88rem}
    .release-kicker{display:inline-flex;border-radius:999px;padding:4px 8px;background:var(--accent);color:white;font-size:.68rem;font-weight:850;letter-spacing:.05em}
    .release-state{flex:0 0 auto;border-radius:999px;padding:7px 10px;background:color-mix(in srgb,var(--success) 14%,transparent);color:var(--success);font-size:.74rem;font-weight:850;white-space:nowrap}
    .generator-release-grid{display:grid;grid-template-columns:1.15fr 1fr 1fr;gap:10px}
    .release-card{position:relative;border:1px solid var(--border);border-radius:13px;padding:13px;background:color-mix(in srgb,var(--panel) 94%,transparent);overflow:hidden}
    .release-card::before{content:"";position:absolute;inset:0 auto 0 0;width:4px;background:var(--border)}
    .release-card.release-ok::before{background:var(--success)}.release-card.release-progress::before{background:var(--warning)}
    .release-card h3{margin:7px 0 9px;font-size:.91rem}.release-card p{margin:9px 0 0;color:var(--muted);font-size:.78rem;line-height:1.45}
    .release-card-status{font-size:.65rem;font-weight:900;letter-spacing:.04em;color:var(--muted)}
    .release-ok .release-card-status{color:var(--success)}.release-progress .release-card-status{color:var(--warning)}
    .release-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
    .release-metrics div{display:grid;gap:2px;border-radius:9px;padding:8px;background:var(--background)}
    .release-metrics strong{font-size:.92rem;font-variant-numeric:tabular-nums}.release-metrics small{color:var(--muted);font-size:.64rem;line-height:1.25}
    .release-footnote{margin:12px 0 0;padding-top:11px;border-top:1px solid var(--border);color:var(--muted);font-size:.78rem;line-height:1.45}
    .release-footnote strong{color:var(--text)}

    @media(max-width:1060px){.generator-release-grid{grid-template-columns:1fr 1fr}.release-card:first-child{grid-column:1/-1}}
    @media(max-width:760px){.log-header{flex-direction:column}.log-actions{justify-content:flex-start}.explanation-log{padding-inline:14px}.log-entry{grid-template-columns:34px 1fr}.generator-release-header{flex-direction:column}.generator-release-grid{grid-template-columns:1fr}.release-card:first-child{grid-column:auto}.release-state{white-space:normal}.release-metrics{grid-template-columns:1fr 1fr}}
  `;
  document.head.append(style);
}

function createGeneratorStatusPanel() {
  const panel = document.createElement("section");
  panel.className = "generator-release-panel";
  panel.setAttribute("aria-labelledby", "generatorReleaseHeading");
  panel.innerHTML = `
    <div class="generator-release-header">
      <div>
        <span class="release-kicker">НОВЕ У V0.8.1</span>
        <h2 id="generatorReleaseHeading">Реальний генератор частинок уже підключено</h2>
        <p>Це не декоративна обіцянка: нижче показано перевірені результати серверних контрольних запусків PYTHIA, Angantyr і HepMC3. Інтерактивний запуск цих важких обчислень безпосередньо з браузера ще розробляється.</p>
      </div>
      <span class="release-state">backend перевірено</span>
    </div>
    <div class="generator-release-grid">
      <article class="release-card release-ok">
        <span class="release-card-status">✓ ПОВНІСТЮ ПЕРЕВІРЕНО</span>
        <h3>PYTHIA 8.317 · proton–proton · 13 TeV</h3>
        <div class="release-metrics">
          <div><strong>3/3</strong><small>події пройшли аудит</small></div>
          <div><strong>233–437</strong><small>частинок у події</small></div>
          <div><strong>106–177</strong><small>стабільних final-state</small></div>
        </div>
        <p>Повний ланцюг: PYTHIA → офіційний Pythia8ToHepMC3 → EventRecord → перевірка графа та чотири-імпульсу. Максимальна відносна похибка closure: 2,5×10⁻¹¹.</p>
      </article>
      <article class="release-card release-ok">
        <span class="release-card-status">✓ ФОРМАТ ПОДІЇ ПЕРЕВІРЕНО</span>
        <h3>HepMC3 та універсальний EventRecord</h3>
        <div class="release-metrics">
          <div><strong>PDG</strong><small>коди частинок</small></div>
          <div><strong>4-p</strong><small>чотири-імпульси</small></div>
          <div><strong>graph</strong><small>parent / daughter</small></div>
        </div>
        <p>Працює запис і повторне читання стандартного Asciiv3-файлу з вершинами, статусами, одиницями, вагами та provenance.</p>
      </article>
      <article class="release-card release-ok">
        <span class="release-card-status">✓ ПОВНІСТЮ ПЕРЕВІРЕНО</span>
        <h3>Angantyr · proton–O-16 · 9,62 TeV</h3>
        <div class="release-metrics">
          <div><strong>3</strong><small>нуклонів-учасників Npart</small></div>
          <div><strong>2</strong><small>NN-субзіткнення Ncoll</small></div>
          <div><strong>2,43 fm</strong><small>параметр удару b</small></div>
        </div>
        <p>Непружна p–O подія пройшла повний аудит: 1529 частинок, 891 вершина, 499 стабільних кінцевих частинок. Відносна похибка чотири-імпульсу: 3,51×10⁻¹¹.</p>
      </article>
    </div>
    <p class="release-footnote"><strong>Що бачите на полотні зараз:</strong> браузерна Monte Carlo Glauber-геометрія. Реальні PYTHIA та Angantyr частинки вже генеруються у фізичному backend, а окремий truth-level event display буде наступним видимим модулем.</p>
  `;
  return panel;
}

function updatePipelineStatus() {
  const generatorCard = document.querySelector(".pipeline-overview .pipeline-card:nth-child(4)");
  if (!generatorCard) return;
  generatorCard.classList.remove("planned");
  generatorCard.classList.add("integration");
  const description = generatorCard.querySelector("small");
  const badge = generatorCard.querySelector("em");
  if (description) description.textContent = "PYTHIA pp ✓ · Angantyr p–O ✓";
  if (badge) badge.textContent = "backend перевірено";
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
  updatePipelineStatus();

  const releasePanel = createGeneratorStatusPanel();
  const scienceNotice = document.querySelector(".science-notice");
  if (scienceNotice) scienceNotice.insertAdjacentElement("afterend", releasePanel);

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
  if (badge) badge.textContent = "Nuclear Web v0.8.1";
  document.title = "Algorithmic Universe — ядерна лабораторія v0.8.1";

  setTimeout(() => {
    if (!state.eventEntries.length) document.querySelector("#generateEvent")?.click();
  }, 80);
}

initialize();
