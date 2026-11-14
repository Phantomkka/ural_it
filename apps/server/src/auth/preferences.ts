import {AuthError} from './password.js';
export function preferences(value:unknown):Record<string,unknown>{
 if(value===undefined)return {};if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['settings','quality','tutorialDone'].includes(k)))throw new AuthError(400,'Некорректные настройки переноса.');
 const p=value as Record<string,unknown>,out:Record<string,unknown>={};
 if(p.quality!==undefined){if(!['low','medium','high'].includes(String(p.quality)))throw new AuthError(400,'Некорректное качество.');out.quality=p.quality;}
 if(p.tutorialDone!==undefined){if(typeof p.tutorialDone!=='boolean')throw new AuthError(400,'Некорректный статус обучения.');out.tutorialDone=p.tutorialDone;}
 if(p.settings!==undefined){
  const s=p.settings as Record<string,unknown>,keys=['tablet','drop','forward','back','left','right','sprint','interact','inventory','journal','map','help'];
  if(!s||typeof s!=='object'||Object.keys(s).some(k=>!['sensitivity','invertY','volume','bindings'].includes(k))||typeof s.sensitivity!=='number'||!Number.isFinite(s.sensitivity)||s.sensitivity<0.25||s.sensitivity>3||typeof s.volume!=='number'||!Number.isFinite(s.volume)||s.volume<0||s.volume>1||typeof s.invertY!=='boolean')throw new AuthError(400,'Некорректные параметры управления.');
  const b=s.bindings as Record<string,unknown>;if(!b||typeof b!=='object'||Object.keys(b).length!==keys.length||keys.some(k=>typeof b[k]!=='string'||!/^(Tab|Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Shift(Left|Right))$/.test(String(b[k])))||new Set(Object.values(b)).size!==keys.length)throw new AuthError(400,'Некорректные клавиши.');out.settings=s;
 }return structuredClone(out);
}
