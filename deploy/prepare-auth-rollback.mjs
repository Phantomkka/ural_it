// Run against a clean archive of the verified PR #22 baseline, never a live checkout.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
const root=resolve(process.argv[2]??'');
if(!process.argv[2]||root===process.cwd()||relative(process.cwd(),root).startsWith('..'))throw Error('Choose a separate baseline archive below the current workspace.');
const patch=async(path,from,to)=>{const file=resolve(root,path),s=await readFile(file,'utf8');if(!s.includes(from))throw Error('Unexpected baseline: '+path);await writeFile(file,s.replace(from,to));};
const cases=resolve(root,'apps/server/src/progress/clientCases.ts'),source=await readFile(cases,'utf8');
const frozen=source.replace(/export function refreshCases\(data:ProfileData,now:number\) \{[\s\S]*?\n\}/,'export function refreshCases(data:ProfileData,now:number) {}');
if(frozen===source)throw Error('Unexpected case baseline');await writeFile(cases,frozen);
await patch('apps/server/src/progress/workController.ts','    const now = Date.now(),','    if(channel!=="progressResult"){this.send(client,channel,{ok:false,message:"Техническое обслуживание. Прогресс сохранён; игровые операции временно приостановлены."});return;}\n    const now = Date.now(),');
await patch('apps/server/src/progress/workController.ts','    this.subscribers.add(client.sessionId);','    if((value as any)?.type!=="refresh"){this.send(client,"progressResult",{ok:false,message:"Техническое обслуживание — прогресс сохранён."});return;}\n    this.subscribers.add(client.sessionId);\n    this.enqueue(client,"progressResult",async id=>{this.profile(client,await this.service.store.read(id));this.send(client,"progressResult",{ok:true,message:"Техническое обслуживание — прогресс сохранён."});});return;');
await patch('apps/server/src/auth/service.ts','process.env.NETCITY_ORIGIN ??','process.env.NETCITY_ORIGIN ||');
const css=resolve(root,'apps/client/src/style.css');await writeFile(css,(await readFile(css,'utf8'))+'\nbody::before{content:"NETCITY · ТЕХНИЧЕСКОЕ ОБСЛУЖИВАНИЕ · ПРОГРЕСС СОХРАНЁН";position:fixed;z-index:99999;top:0;left:0;right:0;text-align:center;background:#6d4226;color:white;padding:12px;font:14px sans-serif;pointer-events:none}\n');
console.log('Auth-compatible maintenance rollback prepared; no migrations were reversed.');
