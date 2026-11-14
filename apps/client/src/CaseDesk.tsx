import {CLIENT_CASE_TEMPLATE as T,ITEMS,BAG_LIMIT,bagUsage,type CaseIntent,type PrivateProfile} from "@netcity/shared";
import type {TabletApp} from "./Tablet";
const LABELS:Record<string,string>={RINGING:"Входящий звонок",DECLINED:"Звонок отложен",ACCEPTED:"Поговорите с клиентом",INTERVIEW:"Проведите диагностику",DIAGNOSED:"Замените повреждённый кабель",REPAIRED:"Проверьте результат",VERIFIED:"Вернитесь к клиенту",COMPLETED:"Работа подписана"};
export function CaseDesk({profile,page,send,pending,message,openLegacy,retry,sessionId}: {profile:PrivateProfile|null;page:TabletApp;send:(a:CaseIntent)=>void;pending:boolean;message:string;openLegacy:()=>void;retry:()=>void;sessionId?:string}) {
  const c=profile?.service?.cases.at(-1);
  const act=(action:CaseIntent["action"],extra:Partial<CaseIntent>={})=>c&&send({action,caseId:c.id,...extra});
  if(!profile||!c)return <p>Загрузка личных заявок…</p>;
  const action=(label:string,type:CaseIntent["action"],extra:Partial<CaseIntent>={})=><button disabled={pending} onClick={()=>act(type,extra)}>{label}</button>;
  if(page==="company")return <section><h2>Моя компания</h2><h3>{profile.company?.name}</h3><p>Репутация: {profile.company?.reputation??0} · Завершено клиентских работ: {profile.service?.completed??0}</p><p>{profile.credits} NET · {profile.xp} XP · Уровень {profile.level}</p><button onClick={openLegacy}>Работы и контракт NETCITY 2.0</button></section>;
  if(page==="contacts")return <section><h2>Контакты</h2><h3>Елена · бухгалтерия</h3><p>{T.address}. Встреча в приёмной, CLIENT-PC04 у окна.</p><h3>Марат · снабжение</h3><p>Стойка напротив IT-офиса. Покупки по клиентской заявке оплачиваются на месте.</p><h3>Алина · диспетчер</h3><p>Помогает с первыми шагами. Дополнительные старые задания сохранены.</p></section>;
  if(page==="bag") {const usage=bagUsage(profile.inventory);return <section><h2>Рюкзак и запчасти</h2><p>{usage.weight.toFixed(1)} / {BAG_LIMIT.weight} кг · {usage.slots} / {BAG_LIMIT.slots} типов</p><ul>{Object.entries(ITEMS).map(([id,item])=><li key={id}>{item.name}: {profile.inventory[id as keyof typeof ITEMS]}</li>)}</ul><p>В руках: {c.carrying?(c.carrier===sessionId?"патч-корд":"деталь у другого сеанса профиля"):"ничего"}. Автомобиль и серверная стойка слишком тяжёлые для переноски.</p>{c.stage==="DIAGNOSED"&&<div className="case-actions">{action(c.droppedAt?"Подобрать свою деталь":"Достать патч-корд","take")}{action("Положить у ног","drop")}{action("Купить у Марата · 30 NET","buyPart")}</div>}{profile.inventory.cleaner>0&&action("Вернуть баллон Марату · 10 NET","returnCleaner")}<button onClick={openLegacy}>Каталог и старые работы</button>{pending&&<p>Ожидание подтверждения… <button onClick={retry}>Повторить ту же операцию</button></p>}<p role="status">{message}</p></section>;}
  return <section className="case-desk"><div className="eyebrow">КЛИЕНТСКАЯ ЗАЯВКА · {c.id.slice(0,8)}</div><h2>{T.title}</h2><p>{T.caller} · {T.address}</p><strong>{LABELS[c.stage]}</strong>
    <p>«После перестановки рабочего места пропал интернет. Можете помочь?»</p>
    <p>Аванс: {T.advance} NET на материал · Сдача: {T.payment} NET / {T.xp} XP · Удовлетворённость {c.satisfaction}/3</p>
    {c.stage==="RINGING"&&<div className="case-actions">{action("Ответить и принять","accept")}{action("Отклонить звонок","decline")}</div>}
    {["ACCEPTED","INTERVIEW"].includes(c.stage)&&<><p>Елена ждёт в приёмной офиса справа от улицы. Через вход пройдите чуть дальше открытой створки, затем поверните налево. GPS показывает цель; вопросы задаются рядом с клиентом.</p><h3>Разговор с клиентом на месте</h3><div className="case-actions">{action("Что изменилось вчера?","talk",{choice:"changed"})}{action("Горит ли индикатор?","talk",{choice:"lights"})}{action("Кто ещё без сети?","talk",{choice:"scope"})}</div></>}
    {c.clues.length>0&&<ul className="case-notes">{c.clues.map(id=><li key={id}>{T.questions[id as keyof typeof T.questions]}</li>)}</ul>}
    {c.stage==="INTERVIEW"&&<><h3>Диагностика CLIENT-PC04 у окна</h3><div className="case-actions">{action("Проверить питание и перезагрузить","diagnose",{choice:"restart"})}{action("Проверить кабель и индикатор линка","diagnose",{choice:"cable"})}</div></>}
    {c.stage==="DIAGNOSED"&&<><p>Кабель пережат. Нужна розетка №2. Купите запчасть у Марата или используйте запас из рюкзака.</p><div className="case-actions">{action("Купить у Марата · 30 NET","buyPart")}{action(c.droppedAt?"Подобрать деталь":"Достать патч-корд","take")}{action("Установить в розетку №1","install",{port:1})}{action("Установить в розетку №2","install",{port:2})}</div></>}
    {c.stage==="REPAIRED"&&action("Проверить линк на месте","verify")}
    {c.stage==="VERIFIED"&&action("Сдать работу Елене","signoff")}
    {c.stage==="COMPLETED"&&<p>✓ Клиент подписал работу. Награда сохранена. Новый звонок поступит после перерыва.</p>}
    {c.stage==="DECLINED"&&<p>Клиент позвонит снова через короткое время.</p>}
    {pending&&<p>Ожидание подтверждения… <button onClick={retry}>Повторить ту же операцию</button></p>}<p className="case-feedback" role="status">{message}</p>
  </section>;
}
