import {test} from 'node:test';import {MemoryProgressStore} from './progress/store.js';import {releaseGameplayContract} from './releaseGameplay.contract.js';
test('seven distinct new repairs and company transactions preserve exact rewards under concurrency',()=>releaseGameplayContract(new MemoryProgressStore()));
