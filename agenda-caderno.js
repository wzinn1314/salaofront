window.AgendaCaderno=[
 ['03','Cíntia','08:00'],['04','Jucileide','08:00'],['04','Eduarda',null,'Tarde'],
 ['05','Dany','08:00'],['06','Vitória','14:00'],['07','Ana Júlia','17:30'],
 ['08','Micaelly','17:30'],['09','Mãe de Vitória','17:30'],['10','Pamela','08:00'],
 ['13','Raquel',null],['13','Auxiliadora',null],['14','Menina do reforço','08:00'],
 ['17','Neide (tia de Vitória)','17:30'],['19','Janinha','08:00'],['19','Vanessa','14:00'],
 ['20','Cecília','08:00'],['20','Dany',null,'Tarde'],['22','Jaiane','08:00'],
 ['23','Taylane','08:00'],['24','Cleidiane','08:00'],['27','Vitória','08:00']
].map(([day,name,time,period])=>({id:'calendar-'+day+'-'+name,date:'2026-12-'+day,name,time:time||'',period:period||'',duration:120,phone:'',service:'Procedimento a confirmar',hair_length:'',price:null,manual:true,status:'confirmed'}));