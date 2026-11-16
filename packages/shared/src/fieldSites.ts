/** New rear service areas use existing gate gaps; existing office and mission coordinates stay fixed. */
export const FIELD_SITES=[
 {id:'residential-cabinet',name:'Жилой квартал · распределительный шкаф',kind:'network' as const,x:36,z:17,client:{x:34,z:15},caller:'Елена · управляющая домом'},
 {id:'industrial-power',name:'Промзона · резервное питание склада',kind:'ups' as const,x:-36,z:-17,client:{x:-34,z:-15},caller:'Олег · начальник смены'},
];
export const FIELD_COLLIDERS=FIELD_SITES.map(p=>({x:p.x,z:p.z,width:1,depth:1}));
