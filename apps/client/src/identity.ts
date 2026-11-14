const SESSION_KEY="netcity-guest-token";
const DEVICE_KEY="netcity-saved-guest-token";
let memory:string|null=null;
let notice="";
const valid=(token:string|null):token is string=>typeof token==="string"&&/^[a-f0-9]{64}$/.test(token);
const session=()=>{try{return sessionStorage.getItem(SESSION_KEY);}catch{return null;}};
const saved=()=>{try{return localStorage.getItem(DEVICE_KEY);}catch{return null;}};
function current() {
  const tab=session(),device=saved();
  return valid(tab)?tab:valid(device)?device:memory;
}
function remember(token:string) {
  memory=token;
  try{sessionStorage.setItem(SESSION_KEY,token);}catch{/* In-memory reconnect remains available. */}
  // A legacy tab may belong to another profile. Never replace its saved neighbour silently.
  const existing=saved();
  if(valid(existing) && existing!==token) return;
  try{localStorage.setItem(DEVICE_KEY,token);}catch{/* Status exposes the limited lifetime. */}
}
export async function acquireIdentity(create:()=>Promise<string>) {
  notice="";
  const prior=current();if(prior){remember(prior);return prior;}
  const initialize=async()=>{
    const existing=current();if(existing){remember(existing);return existing;}
    const token=await create();
    const winner=current();
    remember(winner??token);return winner??token;
  };
  if(navigator.locks?.request) {
    try{return await navigator.locks.request("netcity-create-guest",initialize);}
    catch(error){if(!(error instanceof DOMException)||!["SecurityError","NotSupportedError"].includes(error.name))throw error;}
  }
  return initialize();
}
export async function replaceExpiredIdentity(token:string,create:()=>Promise<string>) {
  try{if(session()===token)sessionStorage.removeItem(SESSION_KEY);}catch{}
  try{if(saved()===token)localStorage.removeItem(DEVICE_KEY);}catch{}
  if(memory===token)memory=null;
  const next=await acquireIdentity(create);
  notice="Временный профиль истёк после перезапуска тестовой игры. Создан новый профиль.";
  return next;
}
export function identityStatus() {
  const token=memory??current();
  const mode=token && saved()===token ? "device" : token && session()===token ? "tab" : "memory";
  const conflict=valid(saved()) && saved()!==token;
  return {mode,notice,conflict};
}
