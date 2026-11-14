export interface BusinessProgress {upgrades:string[];claimed:string[];workCounts:Record<string,number>;cableCertified?:boolean}
export const BUSINESS_UPGRADES=[
 {id:'field-kit',name:'Полевой мультиметр',price:150,reputation:1,description:'Диагностика питания ПК и механики принтера.'},
 {id:'workbench',name:'Мастерская и стенд резервирования',price:450,reputation:3,description:'Серверные заказы и восстановление данных; +10% к оплате работ.'},
 {id:'service-van',name:'Складской фургон и выездной комплект',price:1000,reputation:6,description:'Выезды на склад, камеры и телефония; рюкзак 18 кг.'},
] as const;
export const BUSINESS_CONTRACTS=[
 {id:'first-clients',name:'Первые клиенты',distinct:3,total:3,credits:300,xp:120},
 {id:'reliable-office',name:'Надёжный офис',distinct:6,total:6,credits:600,xp:240},
 {id:'city-partner',name:'Партнёр Новолинска',distinct:8,total:32,credits:1200,xp:480},
] as const;
export const freshBusiness=():BusinessProgress=>({upgrades:[],claimed:[],workCounts:{}});
