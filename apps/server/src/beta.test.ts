import {test} from 'node:test';import {MemoryProgressStore} from './progress/store.js';import {betaContract} from './beta.contract.js';
test('36 district missions, twelve repair families, variants, unsafe steps and exact-once rewards',()=>betaContract(new MemoryProgressStore()));
