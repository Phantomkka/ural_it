import {test} from 'node:test';
import {MemoryProgressStore} from './progress/store.js';
import {diagnosticsContract} from './diagnostics.contract.js';
test('engineering audits require real evidence, safe repairs and current control readings; all 15 fault branches preserve rewards',()=>diagnosticsContract(new MemoryProgressStore()));
