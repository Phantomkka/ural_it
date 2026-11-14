export const CLIENT_CASE_TEMPLATE = {
  id: "moved-desks", title: "Сеть пропала после перестановки",
  caller: "Елена · бухгалтерия", address: "Офис №001 · первый этаж · приёмная",
  client: { x: 10, z: -2.5 }, hardware: { x: 11.3, z: -4.8 }, shop: { x: -6, z: 2 },
  advance: 30, payment: 110, xp: 80, port: 2,
  questions: {
    changed: "Вчера передвинули стол. Кабель натянулся под ножкой.",
    lights: "Индикатор на сетевой розетке не горит. Питание компьютера есть.",
    scope: "Не работает только мой компьютер. У коллег сеть есть.",
  },
} as const;
