import {Schema,MapSchema,defineTypes} from '@colyseus/schema';
import {initialCars,stepCars,trafficPhase,type CityCar} from '@netcity/shared';
export class Vehicle extends Schema implements CityCar {
  declare id:string;declare x:number;declare z:number;declare direction:number;declare speed:number;
  constructor(){super();Object.assign(this,{id:'',x:0,z:0,direction:1,speed:0});}
}
defineTypes(Vehicle,{id:'string',x:'number',z:'number',direction:'number',speed:'number'});
export function createCars(){const m=new MapSchema<Vehicle>();for(const c of initialCars())m.set(c.id,Object.assign(new Vehicle(),c));return m;}
export function advanceCity(cars:MapSchema<Vehicle>,players:Iterable<{x:number;z:number}>,now:number){for(const c of stepCars([...cars.values()],players,now,0.1))Object.assign(cars.get(c.id)!,c);return trafficPhase(now);}
