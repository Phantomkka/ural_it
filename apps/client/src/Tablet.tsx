import {useEffect,type ReactNode,type RefObject} from "react";
export type TabletApp="home"|"calls"|"tickets"|"map"|"bag"|"company"|"settings"|"contacts"|"account";
const APPS:Record<TabletApp,string>={home:"Обзор",calls:"Звонки",tickets:"Заявки",map:"GPS",bag:"Рюкзак и магазин",company:"Компания",settings:"Настройки",contacts:"Контакты",account:"Аккаунт"};
export function Tablet({page,change,close,children,dialogRef,overlay,wallet}: {page:TabletApp;change:(p:TabletApp)=>void;close:()=>void;children:ReactNode;dialogRef:RefObject<HTMLElement|null>;overlay:boolean;wallet:string}) {
  useEffect(()=>{if(!overlay)dialogRef.current?.querySelector<HTMLButtonElement>('.tablet-nav [aria-current="page"]')?.focus();},[page,overlay]);
  return <div className="tablet-backdrop"><section className="tablet-frame" role={overlay?undefined:"dialog"} aria-modal={overlay?undefined:true} aria-label="Планшет инженера" ref={overlay?undefined:dialogRef}>
    <div className="tablet-top"><b>NETCITY OS <small>3.0 / ПОЛЕВОЙ ПЛАНШЕТ</small></b><span className="profile-summary">{wallet}</span><button onClick={close} aria-label="Закрыть планшет">✕</button></div>
    <nav className="tablet-nav" aria-label="Приложения планшета">{Object.entries(APPS).map(([id,title])=><button key={id} aria-current={page===id?"page":undefined} onClick={()=>change(id as TabletApp)} onKeyDown={e=>{if(!["ArrowRight","ArrowLeft"].includes(e.code))return;e.preventDefault();const list=Object.keys(APPS) as TabletApp[],i=list.indexOf(id as TabletApp);change(list[(i+(e.code==="ArrowRight"?1:list.length-1))%list.length]);}}>{title}</button>)}</nav>
    <div className="tablet-content">{children}</div><div className="tablet-bottom">Личная работа · мир остаётся в сети · Esc — закрыть</div>
  </section></div>;
}
