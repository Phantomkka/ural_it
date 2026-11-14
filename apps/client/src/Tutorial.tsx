import { keyLabel, type Settings } from "./settings";
export interface Journey { moved: boolean; looked: boolean; inspected: boolean; }
export function Tutorial({journey, completed, settings, dismiss}: {
  journey: Journey; completed: boolean; settings: Settings; dismiss:()=>void;
}) {
  const mobile = matchMedia("(pointer: coarse)").matches;
  const steps = [
    {done:journey.moved, title:"Освойтесь на улице", text:mobile ? "Сдвиньте левый стик и пройдите несколько метров." : `Нажмите на улицу. ${["forward","left","back","right"].map(k=>keyLabel(settings.bindings[k as keyof Settings["bindings"]])).join(" / ")} — движение, ${keyLabel(settings.bindings.sprint)} — бег.`},
    {done:journey.looked, title:"Осмотритесь", text:mobile ? "Проведите пальцем по правой стороне экрана." : "Поверните мышь. Esc вернёт курсор для меню."},
    {done:journey.inspected, title:"Найдите первое оборудование", text:`Пройдите к офису справа, затем через две двери в серверную. Наведитесь на коммутатор с расстояния до 2,5 м. ${mobile ? "Нажмите «Осмотреть»." : `Нажмите ${keyLabel(settings.bindings.interact)}.`}`},
    {done:completed, title:"Верните офису интернет", text:"В панели коммутатора найдите отключённый кабель. Подключите его в порт №3 и получите 100 NET и 60 XP. Награду подтверждает сервер."},
  ];
  const index = steps.findIndex(s=>!s.done), current = steps[index < 0 ? 3 : index];
  return <section className="tutorial-card" aria-label="Обучение новичка" data-step={index < 0 ? 4 : index}>
    <div className="eyebrow">ПЕРВАЯ СМЕНА · {index < 0 ? 4 : index+1}/4</div>
    <b>{completed ? "Первая работа выполнена!" : current.title}</b><p>{completed ? "Откройте «Работа и снабжение»: купите расходники и возьмите следующую заявку." : current.text}</p>
    <button onClick={dismiss}>{completed ? "Начать смену" : "Пропустить обучение"}</button>
  </section>;
}
