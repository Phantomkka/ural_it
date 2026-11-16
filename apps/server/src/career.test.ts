import {test} from 'node:test';import assert from 'node:assert/strict';import {careerProgress} from '../../../packages/shared/src/career.js';
test('career derives goals from saved work without migration, forged unknown IDs do not award a specialization',()=>{
 const fresh=careerProgress(undefined,null);assert.equal(fresh.completed,0);assert.ok(fresh.chapters.flatMap(c=>c.goals).every(g=>g.value===0));
 const b={upgrades:['field-kit','workbench'],claimed:[],workCounts:{'engineering-network':12,'engineering-voip':4,'not-a-work':99},logistics:{completed:1},companyCode:'ABCDEF123456'};
 const before=structuredClone(b),c=careerProgress(b,{officeId:'coworking',employees:[{}],completed:3});assert.equal(c.specialties.find(s=>s.name==='Сетевой инженер')!.rank,'Эксперт');assert.equal(c.specialties.find(s=>s.name==='Телефонист')!.rank,'Специалист');assert.equal(c.specialties.find(s=>s.name==='Серверный инженер')!.count,0);assert.ok(c.chapters[2].goals.every(g=>g.complete));assert.deepEqual(b,before);
});
