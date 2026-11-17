/** Time-based visual response; simulation and collision state remain authoritative. */
export const doorResponse=(dt:number)=>1-Math.exp(-12*Math.max(0,Math.min(dt,.1)));
