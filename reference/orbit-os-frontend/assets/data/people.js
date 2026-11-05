/* Demo people. dept is a name; seeds convert it to a department id. */
window.People = {
  maria:{id:'p_maria',name:'Maria Santos',email:'maria@brightpath.co',title:'Office manager',dept:'Operations',access:'admin',authorities:[]},
  david:{id:'p_david',name:'David Park',email:'david@brightpath.co',title:'CEO',dept:'Sales',access:'user',authorities:['leader','approver']},
  jordan:{id:'p_jordan',name:'Jordan Lee',email:'jordan@brightpath.co',title:'Business development',dept:'Sales',access:'user',authorities:['approver']},
  priya:{id:'p_priya',name:'Priya Nair',email:'priya@brightpath.co',title:'Customer success',dept:'Support',access:'user',authorities:[]},
  marcus:{id:'p_marcus',name:'Marcus Reed',email:'marcus@brightpath.co',title:'Finance lead',dept:'Finance',access:'user',authorities:['budget']}
};
