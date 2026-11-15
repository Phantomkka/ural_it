/** Floor footprints shared by furniture rendering, movement and cable collision. */
export const SERVICE_FURNITURE = [
  {id:'network',x:11.5,z:-5.25,width:.7,depth:.85,height:.78},
  {id:'printer',x:11.7,z:3,width:.85,depth:.7,height:.82},
  {id:'backup',x:18,z:3.3,width:.75,depth:.65,height:.82},
  {id:'voip',x:6,z:-4,width:.65,depth:.55,height:.85},
  {id:'camera',x:-6.5,z:20,width:.18,depth:.18,height:2.8},
] as const;
export const PARKED_CARS=[-1,1].flatMap(side=>[-35,35].map(z=>({x:side*4.05,z,width:1.8,depth:4})));
