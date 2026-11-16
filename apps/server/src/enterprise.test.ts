import {test} from 'node:test';import {MemoryProgressStore} from './progress/store.js';import {enterpriseContract} from './enterprise.contract.js';
test('shared company: five-member authority, office leases, budgets, wages, stock, proof-backed SLA, protected payouts and account binding',()=>enterpriseContract(new MemoryProgressStore()));
