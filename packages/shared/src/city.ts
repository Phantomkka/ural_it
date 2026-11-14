export type TrafficPhase='DRIVE'|'AMBER'|'CROSS';
export interface CityCar {id:string;x:number;z:number;direction:number;speed:number}
export function trafficPhase(now:number):TrafficPhase {const t=((now/1000)%32+32)%32;return t<20?'DRIVE':t<23?'AMBER':'CROSS';}
export function initialCars():CityCar[]{return [-1,1].flatMap(direction=>[-30,-8,18].map((z,i)=>({id:`car-${direction}-${i}`,x:direction*2.4,z,direction,speed:0})));}
export function carBlocksPoint(p:{x:number;z:number},car:CityCar){return Math.abs(p.x-car.x)<1.25&&Math.abs(p.z-car.z)<2.15;}
export function stepCars(cars:CityCar[],players:Iterable<{x:number;z:number}>,now:number,dt:number){
  const people=[...players],phase=trafficPhase(now),step=Math.min(Math.max(dt,0),0.1);
  return cars.map(c=>{
    let speed=6;
    if(phase!=='DRIVE'&&c.z*c.direction<-3.9&&c.z*c.direction>-10)speed=0;
    if(people.some(p=>Math.abs(p.x-c.x)<1.24&&(p.z-c.z)*c.direction>-2.1&&(p.z-c.z)*c.direction<7))speed=0;
    if(cars.some(other=>other!==c&&other.direction===c.direction&&(other.z-c.z)*c.direction>0&&(other.z-c.z)*c.direction<7))speed=0;
    let z=c.z+speed*c.direction*step;
    if(people.some(p=>Math.abs(p.x-c.x)<1.24&&Math.abs(p.z-z)<2.1)){z=c.z;speed=0;}
    if(Math.abs(z)>44){const candidate=-44*c.direction;if(!people.some(p=>Math.abs(p.x-c.x)<1.25&&Math.abs(p.z-candidate)<4))z=candidate;else{z=c.z;speed=0;}}
    return {...c,z,speed};
  });
}
export const CITY_PEDESTRIANS=[
  {id:'courier',name:'Никита · курьер',x:-6,z:-18,length:12},
  {id:'resident',name:'Лидия · жительница',x:6,z:20,length:12},
  {id:'guard',name:'Сергей · охрана',x:-6,z:22,length:10},
  {id:'intern',name:'Даша · стажёр',x:6,z:-28,length:10},
] as const;
export function pedestrianPosition(index:number,now:number){const n=CITY_PEDESTRIANS[index],t=(now/1000+index*7)%36,walk=t<14? t/14:t<18?1:t<32?1-(t-18)/14:0;return {x:n.x,z:n.z+walk*n.length,yaw:t<18?0:Math.PI,walking:t<14||t>=18&&t<32};}
