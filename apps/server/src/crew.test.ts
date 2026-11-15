import {test} from 'node:test';import {crewContract} from './crew.contract.js';import {MemoryProgressStore} from './progress/store.js';
test('27 cooperative contracts: five shares, delivery custody, unsafe steps, replay and crash recovery',()=>crewContract(new MemoryProgressStore()));
