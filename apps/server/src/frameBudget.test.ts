import {test} from 'node:test';import assert from 'node:assert/strict';import {FrameBudget} from '../../client/src/frameBudget.js';
test('frame adaptation ignores warmup and long pauses, holds smooth devices and degrades slowly within bounds',()=>{
 const smooth=new FrameBudget();for(let i=0;i<3600;i++)smooth.sample(1/60);assert.equal(smooth.level,0);
 const slow=new FrameBudget();for(let i=0;i<70;i++)slow.sample(.1);assert.equal(slow.level,0);assert.equal(slow.sample(30),false);
 for(let i=0;i<800;i++)slow.sample(.1);assert.equal(slow.level,4);slow.reset();assert.equal(slow.level,0);for(let i=0;i<300;i++)slow.sample(1/60);assert.equal(slow.level,0);
});
