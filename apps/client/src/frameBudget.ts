/** Bounded degradation after sustained slow frames, never based on loading or hidden tabs. */
export class FrameBudget {
 private elapsed=0;private frames=0;private warmup=8;private cooldown=0;
 level=0;
 reset(){this.elapsed=0;this.frames=0;this.warmup=8;this.cooldown=0;this.level=0;}
 sample(dt:number){
  if(!Number.isFinite(dt)||dt<=0||dt>1)return false;
  if(this.warmup>0){this.warmup-=dt;return false;}
  if(this.cooldown>0){this.cooldown-=dt;return false;}
  this.elapsed+=dt;this.frames++;
  if(this.elapsed<3)return false;
  const fps=this.frames/this.elapsed;this.elapsed=0;this.frames=0;
  if(fps<35&&this.level<4){this.level++;this.cooldown=5;return true;}
  return false;
 }
}
