import {useEffect,type ReactNode,type RefObject} from "react";
export type TabletApp="career"|"transport"|"diagnostics"|"office"|"crew"|"missions"|"home"|"calls"|"tickets"|"map"|"bag"|"company"|"settings"|"contacts"|"account"|"tools";
const APPS:Record<TabletApp,string>={career:"Карьера",transport:"Транспорт и доставка",diagnostics:"Диагностика",office:"Офис / этажи",crew:"Бригада",missions:"Работы района",home:"Обзор",calls:"Звонки",tickets:"Заявки",map:"GPS",bag:"Рюкзак и магазин",company:"Компания",settings:"Настройки",contacts:"Контакты",account:"Аккаунт",tools:"Инструменты"};
export function Tablet({page,change,close,children,dialogRef,overlay,wallet,connection,reconnect}: {page:TabletApp;change:(p:TabletApp)=>void;close:()=>void;children:ReactNode;dialogRef:RefObject<HTMLElement|null>;overlay:boolean;wallet:string;connection:string;reconnect:()=>void}) {
  useEffect(()=>{if(!overlay)dialogRef.current?.querySelector<HTMLButtonElement>('.tablet-nav [aria-current="page"]')?.focus();},[page,overlay]);
  return <div className="tablet-backdrop"><section className="tablet-frame" role={overlay?undefined:"dialog"} aria-modal={overlay?undefined:true} aria-label="Планшет инженера" ref={overlay?undefined:dialogRef}>
    <div className="tablet-top"><b>NETCITY OS <small>5.0 / ПОЛЕВОЙ ПЛАНШЕТ</small></b><span className="profile-summary">{connection==='В сети'?wallet:'Нет соединения'}</span><button onClick={close} aria-label="Закрыть планшет">✕</button></div>
    {connection!=='В сети'&&<div className="tablet-connection" role="alert"><span>{connection}. Действия требуют связи с сервером.</span><button disabled={connection==='Подключение…'} onClick={reconnect}>Восстановить соединение</button></div>}
    <nav className="tablet-nav" aria-label="Приложения планшета">{Object.entries(APPS).map(([id,title])=><button key={id} aria-current={page===id?"page":undefined} onClick={()=>change(id as TabletApp)} onKeyDown={e=>{if(!["ArrowRight","ArrowLeft"].includes(e.code))return;e.preventDefault();const list=Object.keys(APPS) as TabletApp[],i=list.indexOf(id as TabletApp);change(list[(i+(e.code==="ArrowRight"?1:list.length-1))%list.length]);}}>{title}</button>)}</nav>
    <div className="tablet-content">{children}</div><div className="tablet-bottom">Бригада до 5 инженеров · мир остаётся в сети · Esc — закрыть</div>
  </section></div>;
}
