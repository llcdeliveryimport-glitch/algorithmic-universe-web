import { geometricCentralityPercent, validateGlauberEvent } from "./collider.js";

function entry(step, level, title, explanation, technical) {
  return { step, level, title, explanation, technical };
}

function finite(value, digits = 2) {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : "—";
}

function plural(value, one, few, many) {
  const n = Math.abs(Number(value)) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return many;
  if (n1 > 1 && n1 < 5) return few;
  if (n1 === 1) return one;
  return many;
}

export function buildEventExplanation(event) {
  if (!event?.system || !event?.metrics) {
    throw new TypeError("A complete Glauber event is required.");
  }
  const m = event.metrics;
  const totalNucleons = event.projectile.length + event.target.length;
  const possiblePairs = event.projectile.length * event.target.length;
  const centrality = geometricCentralityPercent(event);
  const validation = validateGlauberEvent(event);
  const attempts = event.searchAttempts || 1;
  const entries = [
    entry(1, "context", "Обрано систему пучків", `${event.system.label} при √sNN ${(event.system.sqrtSnnGev / 1000).toFixed(2)} TeV. Перше ядро містить ${event.projectile.length} нуклонів, друге — ${event.target.length}.`, `projectile=${event.system.projectile}; target=${event.system.target}; total nucleons=${totalNucleons}`),
    entry(2, "model", "Створено Monte Carlo-конфігурацію", "Протони й нейтрони розміщені випадково за профілями густини. Це одна допустима конфігурація, а не фотографія статичного ядра.", `seed=${event.seed}; trialId=${event.trialId}; deterministic key=${event.seed}:${event.trialId}`),
    entry(3, "geometry", "Задано взаємне зміщення", `Центри ядер пройшли на відстані b = ${finite(event.impactParameterFm)} fm. Менше b зазвичай означає сильніше перекриття.`, `b=${event.impactParameterFm} fm; bMax=${event.system.bMaxFm} fm; geometric percentile=${centrality === null ? "undefined" : finite(centrality, 3) + "%"}`),
    entry(4, "calculation", "Перевірено всі можливі пари", `Алгоритм порівняв ${possiblePairs} пар: кожен нуклон першого ядра з кожним нуклоном другого.`, `pair count=${event.projectile.length}×${event.target.length}=${possiblePairs}; overlap model=hard sphere`),
    entry(5, event.accepted ? "success" : "warning", event.accepted ? "Знайдено близькі пари" : "Близьких пар не знайдено", event.accepted ? `Подію прийнято: знайдено ${m.nColl} ${plural(m.nColl, "парну взаємодію", "парні взаємодії", "парних взаємодій")}.` : "Подію не прийнято як ядерне зіткнення: жодна пара нуклонів не підійшла достатньо близько.", `σNN=${event.sigmaMb} mb; interaction radius=${finite(event.interactionRadiusFm, 6)} fm; Ncoll=${m.nColl}`),
    entry(6, "result", "Пораховано учасників і спостерігачів", `${m.nPart} із ${totalNucleons} нуклонів взаємодіяли хоча б раз. ${m.nSpectators} не взаємодіяли й у цій геометричній моделі є спостерігачами.`, `Npart=${m.nPart}; spectators=${m.nSpectators}; identity=${m.nPart}+${m.nSpectators}=${totalNucleons}`),
    entry(7, "result", "Розкладено взаємодії за каналами", `Із ${m.nColl} взаємодій: протон–протон ${m.nCollPP}, протон–нейтрон ${m.nCollPN}, нейтрон–нейтрон ${m.nCollNN}.`, `pp+pn+nn=${m.nCollPP + m.nCollPN + m.nCollNN}; expected Ncoll=${m.nColl}`),
  ];

  if (m.nPart < 3) {
    entries.push(entry(8, "notice", "Форма області не визначається", "Для ε₂, ε₃ та площі потрібна хмара щонайменше з трьох учасників. Тому лабораторія показує «—», а не оманливе число.", `Npart=${m.nPart}; shape observables=null by model policy`));
  } else {
    entries.push(entry(8, "result", "Оцінено форму області учасників", `Еліптичність ε₂ = ${finite(m.epsilon2, 3)}, трикутність ε₃ = ${finite(m.epsilon3, 3)}, площа учасників = ${finite(m.participantAreaFm2)} fm².`, `epsilon2=${m.epsilon2}; epsilon3=${m.epsilon3}; participantAreaFm2=${m.participantAreaFm2}`));
  }

  entries.push(entry(9, validation.valid ? "success" : "warning", "Виконано самоперевірку", validation.valid ? "Внутрішні тотожності події узгоджені: кількості учасників, спостерігачів, пар і каналів не суперечать одна одній." : `Знайдено ${validation.errors.length} внутрішніх неузгодженостей. Такий результат не слід використовувати до виправлення.`, validation.valid ? "event integrity=PASS" : `event integrity=FAIL; ${validation.errors.join(" | ")}`));

  if (attempts > 1) {
    entries.push(entry(10, "notice", "Навчальний фільтр пропустив порожні події", `Щоб показати зрозуміле зіткнення, лабораторія перевірила ${attempts} конфігурацій. У minimum-bias статистиці такі прольоти повз не відкидаються.`, `accepted-only search attempts=${attempts}; searchStartTrialId=${event.searchStartTrialId ?? event.trialId}`));
  }

  entries.push(entry(entries.length + 1, "limit", "Де закінчується ця модель", "На цьому етапі завершено лише геометрію Glauber. Кварки, глюони, адрони, розпади й сигнали детектора тут ще не створюються.", "next adapters=HepMC event record → PYTHIA 8/Angantyr → Geant4 → reconstruction"));
  return entries;
}

export function buildBatchExplanation(summary) {
  if (!summary?.system || !summary?.means) {
    throw new TypeError("A complete minimum-bias summary is required.");
  }
  const geometricAreaBarn = Math.PI * summary.system.bMaxFm ** 2 / 100;
  return [
    entry(1, "context", "Запущено ансамбль подій", `Для системи ${summary.system.label} згенеровано ${summary.trials} незалежних trial-подій з одним відтворюваним seed-потоком.`, `seed=${summary.seed}; trials=${summary.trials}; bMax=${summary.system.bMaxFm} fm`),
    entry(2, "geometry", "Параметр b вибирався за площею", "Великі кільця мають більшу площу, тому великі b трапляються частіше. Саме так формується minimum-bias геометрична вибірка.", "sampling law: b=bMax·sqrt(U), therefore dP/db∝b"),
    entry(3, "result", "Відокремлено зіткнення від прольотів", `${summary.accepted} із ${summary.trials} trial-подій мали хоча б одну NN-взаємодію. Частка прийняття — ${(summary.acceptance * 100).toFixed(1)}%.`, `accepted=${summary.accepted}; acceptance=${summary.acceptance}`),
    entry(4, "calculation", "Оцінено геометричний переріз", `Повна досліджена площа πbmax² дорівнює приблизно ${geometricAreaBarn.toFixed(3)} barn. Після множення на частку зіткнень отримано ${summary.crossSectionBarn.toFixed(3)} ± ${summary.crossSectionErrorBarn.toFixed(3)} barn.`, "σgeom=π·bMax²·acceptance; uncertainty=binomial statistics propagated to barn"),
    entry(5, "result", "Обчислено середню активність", `Серед прийнятих подій середнє Npart = ${finite(summary.means.nPart)}, середнє Ncoll = ${finite(summary.means.nColl)}.`, `means over accepted events only: Npart=${summary.means.nPart}; Ncoll=${summary.means.nColl}`),
    entry(6, "result", "Події розкладено за геометричною центральністю", "Ліві інтервали відповідають меншим b і сильнішому перекриттю. Праві — крайовим зіткненням. Графік показує, як у середньому змінюються Npart і Ncoll.", `bins=${summary.centralityBins.map((bin) => `${bin.key}:${bin.accepted}/${bin.trials}`).join(", ")}`),
    entry(7, "notice", "Статистична похибка не є всією невизначеністю", "Похибка біля перерізу враховує лише обмежену кількість trial-подій. Вона не включає систематику профілів ядер, recentering або моделі NN-перекриття.", "uncertainty scope=binomial statistics only"),
    entry(8, "limit", "Центральність поки геометрична", "У реальному експерименті центральність калібрують за виміряною активністю детектора. Тут percentiles отримані безпосередньо з b.", "centrality status=geometry-level preview, not detector-calibrated"),
  ];
}

export function formatExplanationLog(entries, mode = "plain") {
  const technical = mode === "technical";
  return entries.map((item) => {
    const body = technical ? item.technical : item.explanation;
    return `${String(item.step).padStart(2, "0")}. ${item.title}\n${body}`;
  }).join("\n\n");
}
