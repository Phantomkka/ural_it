import {ITEMS,ITEM_WEIGHT,bagUsage,caseTemplate,inOfficeRoom,insideBuilding,type ClientCase,type ProgressResult} from '@netcity/shared';
import type {Transaction} from './store.js';
import {initBusiness} from './business.js';
import {initLab,performLab,labPart} from './diagnosticLab.js';
const bad=(message:string):ProgressResult=>({ok:false,message}),ok=(message:string):ProgressResult=>({ok:true,message});
export function performCase(tx:Transaction,c:ClientCase,a:Record<string,unknown>,p:{x:number;z:number;sessionId:string}|null,now:number):ProgressResult{
 if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.z))return bad('Сеанс закрыт.');
 const t=caseTemplate(c),d=tx.data,b=initBusiness(d),q=c.progress??={};
 const near=(point:{x:number;z:number},inside=false)=> (!inside||(t.buildingId?insideBuilding(p,t.buildingId):inOfficeRoom(p,point.x)))&&Math.hypot(p.x-point.x,p.z-point.z)<=2.5;
 const hardware=()=>near(t.hardware,t.indoor),cameraReady=()=>d.cable?.kind==='camera'&&d.cable.caseId===c.id&&d.cable.stage==='TESTED';
 if(t.lab){
  const lab=initLab(c,t);
  if(['measure','configure','diagnose','verify'].includes(String(a.action))){
   if(!hardware())return bad('Подойдите к устройству для измерения или настройки.');
   if(d.inventory.toolkit<1)return bad('Нужен набор инструментов.');
   if(t.upgrade&&!b.upgrades.includes(t.upgrade))return bad('Нужен соответствующий комплект компании.');
   return performLab(tx,c,t,a,now)!;
  }
  if(['buyPart','take','install'].includes(String(a.action))&&lab.requiredPart!==t.part)return bad('Для установленной причины эта запчасть не требуется.');
 }
 if(a.action==='accept'){if(c.stage!=='RINGING')return bad('Звонок уже обработан.');if(d.jobs.some(j=>j.status==='ACTIVE'))return bad('Сначала завершите текущую работу.');const advance=t.lab&&!labPart(c,t)?0:t.advance;c.stage='ACCEPTED';d.credits+=advance;return ok(`${t.caller} ждёт по адресу: ${t.address}. Аванс ${advance} NET на материалы.`);}
 if(a.action==='decline'){if(c.stage!=='RINGING')return bad('Звонок уже обработан.');c.stage='DECLINED';c.availableAt=now+20000;return ok('Клиент позвонит снова через 20 секунд.');}
 if(['RINGING','DECLINED','COMPLETED'].includes(c.stage))return bad('Нет активной заявки для этого действия.');
 if(a.action==='talk'){
  if(!near(t.client,t.indoor))return bad('Подойдите к клиенту на месте.');
  if(!['ACCEPTED','INTERVIEW'].includes(c.stage)||typeof a.choice!=='string'||!Object.hasOwn(t.questions,a.choice))return bad('Выберите вопрос на этапе опроса.');
  if(!c.clues.includes(a.choice))c.clues.push(a.choice);c.stage='INTERVIEW';return ok(t.questions[a.choice]);
 }
 if(a.action==='diagnose'){
  if(!hardware())return bad('Подойдите к нужному устройству.');
  if(c.stage!=='INTERVIEW'||c.clues.length<2)return bad('Задайте клиенту хотя бы два разных вопроса.');
  if(d.inventory.toolkit<1)return bad('Нужен набор инструментов.');
  if(t.upgrade&&!b.upgrades.includes(t.upgrade))return bad('Нужно улучшение компании. Оформите комплект у Марата в приложении «Компания».');
  if(a.choice!==t.diagnosis){c.satisfaction=Math.max(1,c.satisfaction-1);return bad('Гипотеза не подтвердилась. Сопоставьте признаки.');}
  c.stage='DIAGNOSED';return ok('Причина установлена. Выполните специальные шаги ремонта.');
 }
 if(a.action==='buyPart'){
  if(!near(t.shop))return bad('Покупка оплачивается у стойки Марата.');if(c.stage!=='DIAGNOSED'||!t.part)return bad('На этом этапе запчасть не требуется.');
  const item=ITEMS[t.part],usage=bagUsage(d.inventory),weight=ITEM_WEIGHT[t.part];
  if(usage.weight+weight>(b.upgrades.includes('service-van')?18:12)||d.inventory[t.part]>=99)return bad('В рюкзаке нет места.');if(d.credits<item.price)return bad('Недостаточно NET.');
  d.credits-=item.price;d.inventory[t.part]++;return ok(`${item.name} куплен за ${item.price} NET.`);
 }
 if(a.action==='returnPart'||a.action==='returnCleaner'){
  if(!near(t.shop))return bad('Вернуть расходник можно у Марата.');const chosen=typeof a.choice==='string'&&Object.hasOwn(ITEMS,a.choice)?a.choice as keyof typeof ITEMS:null;const part=a.action==='returnCleaner'?'cleaner':chosen??t.part;if(!part||!ITEMS[part].consumable||d.inventory[part]<1)return bad('Нет расходника для возврата.');const price=a.action==='returnCleaner'?10:ITEMS[part].price;d.inventory[part]--;d.credits+=price;return ok(`Возвращено ${price} NET.`);
 }
 if(a.action==='take'){
  if(d.cable?.carrier||c.carrying||c.stage!=='DIAGNOSED'||!t.part)return bad('Для детали нужны свободные руки и этап ремонта.');
  if(c.droppedAt){if(!near(c.droppedAt))return bad('Подойдите к оставленной детали.');c.droppedAt=null;}else{if(d.inventory[t.part]<1)return bad('В рюкзаке нет нужного расходника.');d.inventory[t.part]--;}
  c.carrying=true;c.carrier=p.sessionId;c.carryOrigin={x:p.x,z:p.z};return ok(ITEMS[t.part].name+' в руках.');
 }
 if(a.action==='drop'){if(!c.carrying||c.carrier!==p.sessionId)return bad('В этом сеансе нет детали в руках.');c.carrying=false;c.carrier=undefined;c.carryOrigin=undefined;c.droppedAt={x:p.x,z:p.z};return ok('Деталь оставлена у ног.');}
 if(a.action==='install'){
  if(!hardware()||c.stage!=='DIAGNOSED'||!c.carrying||c.carrier!==p.sessionId||!t.part)return bad('Подойдите к устройству с деталью в руках.');
  if(a.port!==t.port)return bad(`Нужен разъём №${t.port}. Деталь не потрачена.`);
  if(t.kind==='power'&&!q.isolated)return bad('Сначала отключите питание и проверьте отсутствие напряжения.');
  if(t.kind==='printer'&&!q.jamCleared)return bad('Сначала освободите бумажный тракт.');
  if(t.kind==='server'&&!q.shutdown)return bad('Сначала штатно остановите сервер.');
  if(t.kind==='ups'&&!q.isolated)return bad('Сначала отключите ИБП и отсоедините некритическую нагрузку.');
  if(t.kind==='storage'&&(!q.snapshotMade||!q.diskOffline))return bad('Сначала создайте снимок и выведите неисправный диск из массива.');
  if(t.kind==='camera'&&!cameraReady())return bad('Сначала проложите и проверьте монтажную линию для этой заявки.');
  c.carrying=false;c.carrier=undefined;c.carryOrigin=undefined;c.stage='REPAIRED';return ok('Расходник установлен. Выполните специальный тест результата.');
 }
 if(a.action==='repairStep'){
  if(!hardware()||!['DIAGNOSED','REPAIRED'].includes(c.stage))return bad('Подойдите к устройству на этапе ремонта.');const choice=String(a.choice??'');
  if(t.kind==='wifi'){
   if(choice==='survey'){q.survey=true;return ok(`Скан: канал 1 занят на 92%, 6 — на ${t.tuning?.wifiChannel===11?76:8}%, 11 — на ${t.tuning?.wifiChannel===11?7:71}%.`);}
   if(['channel:1','channel:6','channel:11'].includes(choice)&&q.survey){q.channel=Number(choice.split(':')[1]);q.wifiTest=false;c.stage='DIAGNOSED';return ok('Канал установлен. Выполните тест.');}
   if(choice==='wifiPing'&&q.channel===(t.tuning?.wifiChannel??6)){q.wifiTest=true;c.stage='REPAIRED';return ok('Wi-Fi: -51 dBm, потерь 0/4.');}
  }
  if(t.kind==='power'&&choice==='isolate'){q.isolated=true;return ok('Питание отключено; измерено 0 В. Можно заменить БП.');}
  if(t.kind==='power'&&choice==='powerTest'&&c.stage==='REPAIRED'){q.powerTest=true;return ok('POST завершён, линии 12/5/3.3 В стабильны.');}
  if(t.kind==='printer'&&choice==='clearJam'){q.jamCleared=true;return ok('Мятый лист извлечён, ролики свободны.');}
  if(t.kind==='printer'&&choice==='testPage'&&c.stage==='REPAIRED'){q.testPage=true;return ok('Тестовая страница без полос и замятия.');}
  if(t.kind==='server'&&choice==='shutdown'){q.shutdown=true;return ok('Службы остановлены штатно, питание снято.');}
  if(t.kind==='server'&&choice==='restartServer'&&c.stage==='REPAIRED'){q.serverTest=true;return ok('Нагрузка 80%, CPU 48 °C, ошибок нет.');}
  if(t.kind==='backup'){
   if(choice==='checksumScan'){q.scanned=true;return ok(['clients.csv','contracts.db','inventory.json'].map(f=>f+': '+(f===(t.tuning?.backupFile??'contracts.db')?'MISMATCH':'OK')).join('; ')+'. Доступен вчерашний снимок.');}
   if(choice===`restore:${t.tuning?.backupFile??'contracts.db'}:snapshot`&&q.scanned){q.restored=true;return ok('Повреждённый файл восстановлен из снимка; остальные файлы не изменялись.');}
   if(choice==='verifyHashes'&&q.restored){q.hashes=true;c.stage='REPAIRED';return ok('Контрольные суммы совпали, тестовое чтение прошло.');}
  }
  if(t.kind==='voip'){
   if(choice===`voiceVlan:${t.tuning?.voiceVlan??20}`){q.vlan=t.tuning?.voiceVlan??20;return ok('Голосовая VLAN настроена.');}
   if(choice===`sip:${t.tuning?.sipHost??'pbx.netcity.local'}`){q.sip=true;return ok('Адрес игровой АТС установлен.');}
   if(choice==='testCall'&&q.vlan===(t.tuning?.voiceVlan??20)&&q.sip){q.call=true;c.stage='REPAIRED';return ok('REGISTER 200, тестовый звонок в обе стороны прошёл.');}
  }
  if(t.kind==='network'&&choice==='linkTest'&&c.stage==='REPAIRED'){q.linkTest=true;return ok('Линк 1 Гбит/с, потерь 0/4, приложение доступно.');}
  if(t.kind==='dhcp'){
   if(choice==='auditLeases'){q.scanned=true;return ok(`Аренды исчерпаны. Согласованный свободный пул ${t.tuning!.poolStart}–${t.tuning!.poolEnd}; ниже — статические устройства.`);}
   if(q.scanned&&choice===`dhcpPool:${t.tuning!.poolStart}:${t.tuning!.poolEnd}`){q.pool=true;q.leaseTest=false;c.stage='DIAGNOSED';return ok('Пул обновлён без пересечения со статическими адресами.');}
   if(choice==='renewLease'&&q.pool){q.leaseTest=true;c.stage='REPAIRED';return ok('Ноутбук получил аренду, шлюз и DNS; конфликтов нет.');}
  }
  if(t.kind==='dns'){
   if(choice==='zoneAudit'){q.scanned=true;return ok(`У ${t.tuning!.dnsHost} устаревшая A-запись. По заданию нужен ${t.tuning!.targetIP}.`);}
   if(q.scanned&&choice===`dnsRecord:${t.tuning!.targetIP}`){q.record=true;q.dnsTest=false;c.stage='DIAGNOSED';return ok('Игровая A-запись заменена; остальные записи сохранены.');}
   if(choice==='dnsResolve'&&q.record){q.dnsTest=true;c.stage='REPAIRED';return ok('Имя разрешается в верный адрес, портал отвечает.');}
  }
  if(t.kind==='ups'){
   if(choice==='isolateUPS'){q.isolated=true;return ok('ИБП отключён, некритическая нагрузка отсоединена. Можно заменить батарею.');}
   if(choice==='restoreUPS'&&c.stage==='REPAIRED'){q.powerRestored=true;return ok('Критическая группа подключена; нагрузка 46%.');}
   if(choice==='upsTest'&&q.powerRestored){q.upsTest=true;return ok('Самотест успешен: батарея 100%, автономность 24 минуты.');}
  }
  if(t.kind==='storage'){
   if(choice==='makeSnapshot'){q.snapshotMade=true;return ok('Согласованный снимок создан и проверен.');}
   if(choice==='offlineDisk'&&q.snapshotMade){q.diskOffline=true;return ok('Неисправный диск выведен из зеркала. Можно заменить SSD.');}
   if(choice==='startRebuild'&&c.stage==='REPAIRED'){q.rebuildAt??=now+5000;return ok('Восстановление зеркала начато. Проверка будет доступна через 5 секунд.');}
   if(choice==='storageVerify'&&typeof q.rebuildAt==='number'&&now>=q.rebuildAt){q.storageTest=true;return ok('Зеркало восстановлено; контрольные суммы и SMART в норме.');}
  }
  return bad('Этот шаг не подходит или не выполнены предварительные условия.');
 }
 if(a.action==='verify'){
  if(!hardware()||!['REPAIRED','VERIFIED'].includes(c.stage))return bad('Сначала завершите ремонт рядом с устройством.');
  const valid=t.kind==='wifi'?q.wifiTest:t.kind==='power'?q.powerTest:t.kind==='printer'?q.testPage:t.kind==='server'?q.serverTest:t.kind==='backup'?q.hashes:t.kind==='voip'?q.call:t.kind==='network'?q.linkTest:t.kind==='dhcp'?q.leaseTest:t.kind==='dns'?q.dnsTest:t.kind==='ups'?q.upsTest:t.kind==='storage'?q.storageTest:cameraReady();
  if(!valid)return bad('Сначала выполните специальный тест результата.');if(t.kind==='camera')q.verifiedCable=d.cable!.id;c.stage='VERIFIED';return ok('Диагностика успешна. Вернитесь к клиенту.');
 }
 if(a.action==='signoff'){
  if(!near(t.client,t.indoor)||c.stage!=='VERIFIED')return bad('Сдать проверенную работу можно рядом с клиентом.');
  if(t.kind==='camera'&&(!cameraReady()||q.verifiedCable!==d.cable?.id))return bad('Линия изменилась. Повторите проверку.');
  const credits=Math.round(t.payment*(b.upgrades.includes('workbench')?1.1:1));c.stage='COMPLETED';c.completedAt=now;c.availableAt=now+60000;d.service!.completed++;b.workCounts[t.id]=(b.workCounts[t.id]??0)+1;d.credits+=credits;d.xp+=t.xp;tx.reward={jobId:c.id,credits,xp:t.xp};return ok(`Работа принята: +${credits} NET, +${t.xp} XP.`);
 }
 return bad('Недопустимое действие.');
}
