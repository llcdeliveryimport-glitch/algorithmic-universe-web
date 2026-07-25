# Algorithmic Universe — Collider Lab v0.6

## Мета оновлення

Версія 0.6 перетворює вебсторінку з одиничним кадром Glauber на прозору лабораторію з трьома режимами:

1. окрема подія;
2. minimum-bias серія та статистика;
3. карта моделі, джерел і ще не реалізованих рівнів.

Проєкт не називає геометричну модель повним симулятором LHC. Реальний цифровий ланцюг має окремі рівні: підготовка й оптика пучка, ядерна геометрія, нуклонні/партонні субзіткнення, утворення кінцевого стану, проходження через детектор і реконструкція.

## Реальний колайдер: що враховано в архітектурі

### Підготовка пучків

У CERN частинки проходять послідовність прискорювачів. Для протонів актуальний ланцюг містить Linac4, PSB, PS, SPS і LHC. Для важких іонів — Linac3, LEIR, PS, SPS і LHC. Електричні/RF-поля прискорюють частинки, магніти спрямовують і фокусують пучки.

У вебверсії цей рівень поки представлений як перевірений контекст і метадані, а не як повний tracking магнітної оптики.

### Ядерна геометрія

Цей рівень реалізовано:

- O-16: modified harmonic oscillator baseline;
- Ne-20 і Pb-208: spherical Woods–Saxon baseline;
- minimum nucleon separation;
- shift-all recentering;
- impact parameter `dP/db ∝ b`;
- straight-line eikonal trajectories.

### Нуклонні субзіткнення

Цей рівень реалізовано як hard-sphere transverse overlap:

`dT < sqrt(sigmaNN / pi)`.

Подія обчислює `Npart`, `Ncoll`, `pp/pn/nn`, spectators, `epsilon2`, `epsilon3` і participant area. Для менш ніж трьох учасників shape observables позначаються як невизначені, а не виводяться оманливі числа.

### Кінцевий стан

Не симулюється декоративно. Наступний валідований адаптер має використовувати PYTHIA 8 / Angantyr або еквівалентний генератор, що об'єднує нуклон-нуклонні субзіткнення у важкоіонну подію.

### Детектор

Не симулюється декоративно. Наступний рівень має передавати кінцеві частинки в Geant4, а потім у reconstruction layer для треків, calorimeter clusters, jets і vertices.

## Нові функції v0.6

- карта повного collider pipeline зі статусами;
- схема двох зустрічних пучків;
- hover-inspector для кожного нуклона;
- геометрична centrality percentile `100 * (b/bmax)^2` з попередженням, що це не detector-calibrated centrality;
- автоматична перевірка цілісності кожної події;
- minimum-bias batch runner;
- acceptance, геометричний cross section і binomial statistical uncertainty;
- centrality bins із середніми `Npart` і `Ncoll`;
- вбудований chart і таблиця;
- окремий режим джерел та обмежень;
- 18 browser-engine tests;
- deterministic validation manifest.

## Контрольний deterministic run

Файл: `validation/v0.6-reference.json`.

Це контроль стабільності конкретної реалізації, а не претензія на нове фізичне передбачення. Для валідації проти TGlauberMC потрібні більша статистика, точне узгодження профілів, NN overlap model і recentering.

## Відомі межі та наступні задачі

1. Реалізувати TGlauber-compatible recentering option 4.
2. Додати correlated O-16/Ne-20 configurations і деформацію Ne-20.
3. Валідувати кілька NN overlap profiles, а не лише hard sphere.
4. Додати імпорт офіційних nuclear tables із provenance/uncertainty.
5. Створити HepMC-compatible event record.
6. Додати PYTHIA 8 / Angantyr adapter.
7. Додати Geant4 export/import і detector geometry abstraction.
8. Окремо моделювати bunch crossing, luminosity, pile-up і trigger/reconstruction.

## Первинні джерела

- CERN accelerator complex: https://home.cern/science/accelerators/the-accelerator-complex/
- CERN: how an accelerator works: https://home.cern/how-accelerator-works/
- CERN oxygen/neon campaign: https://home.cern/first-ever-collisions-oxygen-lhc/
- PYTHIA 8 heavy-ion / Angantyr manual: https://pythia.org/latest-manual/HeavyIons.html
- Geant4 hadronic physics manual: https://geant4.web.cern.ch/documentation/dev/prm_html/PhysicsReferenceManual/hadronic/index.html
- ATLAS event-display explanation: https://atlas.cern/updates/news/picturing-particles
