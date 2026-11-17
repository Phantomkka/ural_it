import {test} from 'node:test';import assert from 'node:assert/strict';import {FrameBudget} from '../../client/src/frameBudget.js';
test('frame adaptation ignores warmup and long pauses, holds smooth devices and degrades slowly within bounds',()=>{
 const smooth=new FrameBudget();for(let i=0;i<3600;i++)smooth.sample(1/60);assert.equal(smooth.level,0);
 const slow=new FrameBudget();for(let i=0;i<70;i++)slow.sample(.1);assert.equal(slow.level,0);assert.equal(slow.sample(30),false);
 for(let i=0;i<800;i++)slow.sample(.1);assert.equal(slow.level,4);slow.reset();assert.equal(slow.level,0);for(let i=0;i<300;i++)slow.sample(1/60);assert.equal(slow.level,0);
});

test('an intentional 30 FPS cap is stable while sub-budget frames still adapt',()=>{
 const capped=new FrameBudget();for(let i=0;i<3600;i++)capped.sample(1/30,30);assert.equal(capped.level,0);
 const overloaded=new FrameBudget();for(let i=0;i<1800;i++)overloaded.sample(1/18,30);assert.equal(overloaded.level,4);
});
