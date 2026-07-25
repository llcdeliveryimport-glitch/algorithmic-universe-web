# Nuclear Web v0.7 — пояснювальний журнал

- додано автоматичний журнал для кожної Glauber-події;
- додано окремий журнал minimum-bias серії;
- два рівні пояснення: «Простими словами» і «Технічний лог»;
- журнал пояснює вибір системи, seed/trial, impact parameter, кількість перевірених пар, σNN, interaction radius, Npart, Ncoll, pp/pn/nn, shape observables і самоперевірку;
- для accepted-only режиму пояснюється, скільки порожніх конфігурацій було пропущено;
- для batch-прогону пояснюються acceptance, πbmax², geometric cross section, statistical uncertainty та centrality bins;
- додано експорт журналу в UTF-8 `.txt`;
- журнал чітко відокремлений від фізичного JSON event record і не змінює результат симуляції;
- додано 5 автоматичних тестів пояснювального рушія;
- CI перевіряє наявність і синтаксис нових модулів.
