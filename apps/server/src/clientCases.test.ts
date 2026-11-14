import {test} from "node:test";
import {MemoryProgressStore} from "./progress/store.js";
import {clientCaseContract} from "./clientCases.contract.js";
test("client case economy and authority contract",()=>clientCaseContract(new MemoryProgressStore()));
