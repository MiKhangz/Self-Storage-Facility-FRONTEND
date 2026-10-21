// Isolated UI fixture: never calls the backend or changes the database.
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import Facilities from '../src/admin/management/Facilities.jsx';
import Units from '../src/admin/management/Units.jsx';
const mode=new URLSearchParams(location.search).get('state');
const role=new URLSearchParams(location.search).get('role')||'SystemAdministrator';
let facilities=mode==='empty'?[]:[
{facilityId:1,code:'TD01',name:'Thu Duc – Vo Nguyen Giap',address:'375 Vo Nguyen Giap',district:'Thu Duc',phone:'02873001234',openingHours:'08:00–20:00',status:'Active',photoUrls:[],totalUnits:6,occupiedUnits:2,availableUnits:2,managerName:'Nguyen Hai'},
{facilityId:2,code:'D101',name:'D1 – Tran Khac Chan',address:'79 Tran Khac Chan',district:'District 1',phone:'',openingHours:'Open 24/7',status:'Active',photoUrls:[],totalUnits:0,occupiedUnits:0,availableUnits:0,managerName:null},
{facilityId:3,code:'D701',name:'D7 – Tan Phong',address:'21 Nguyen Thi Thap',district:'District 7',phone:'',openingHours:'',status:'Inactive',photoUrls:[],totalUnits:0,occupiedUnits:0,availableUnits:0,managerName:null}
];
let floors=[{floorId:1,facilityId:1,floorNumber:1,name:'Floor 1'},{floorId:2,facilityId:1,floorNumber:2,name:'Floor 2'}];
const types=[{unitTypeId:1,code:'S',name:'Small',areaM2:2,width:1,depth:2,height:2.4,isClimateControlled:false},{unitTypeId:2,code:'M',name:'Medium',areaM2:5,width:2,depth:2.5,height:2.4,isClimateControlled:true}];
let units=mode==='empty'?[]:['Available','Occupied','Reserved','Maintenance','Occupied','Available'].map((status,i)=>({storageUnitId:i+1,facilityId:1,facilityName:facilities[0].name,floorId:i<3?1:2,floorName:i<3?'Floor 1':'Floor 2',unitTypeId:2,unitTypeCode:'M',areaM2:5,width:2,depth:2.5,height:2.4,isClimateControlled:true,unitCode:'M-'+(201+i),zone:'A',currentPrice:1850000,status,note:'',isLocked:['Occupied','Reserved'].includes(status),customerName:status==='Occupied'?'Sample customer':null,contractEnd:status==='Occupied'?'2026-12-31':null}));
window.fetch=async(url,o={})=>{
  if(mode==='loading')return new Promise(()=>{});
  const answer=(d,status=200)=>new Response(JSON.stringify(d),{status,headers:{'Content-Type':'application/json'}});
  if(mode==='error')return answer({title:'Preview: backend unavailable.'},503);
  const method=o.method||'GET',body=o.body?JSON.parse(o.body):null;
  if(url==='/api/unit-types')return answer(types);
  if(url==='/api/management/units'&&method==='GET')return answer(units);
  if(url==='/api/management/facilities'&&method==='GET')return answer(facilities);
  const match=url.match(/facilities\/(\d+)\/floors(?:\/(\d+))?/);
  if(match){const fid=Number(match[1]),id=Number(match[2]);
    if(method==='GET')return answer(floors.filter(f=>f.facilityId===fid));
    if(method==='POST')floors.push({...body,floorId:floors.length+1,facilityId:fid});
    if(method==='PUT')floors=floors.map(f=>f.floorId===id?{...f,...body}:f);
    if(method==='DELETE')floors=floors.filter(f=>f.floorId!==id);
    return answer({});
  }
  if(url.includes('/facilities')){
    const id=Number(url.split('/').pop());
    if(method==='POST')facilities.push({...body,facilityId:facilities.length+1,totalUnits:0,occupiedUnits:0,availableUnits:0});
    else facilities=facilities.map(f=>f.facilityId===id?{...f,...body}:f);
    return answer({});
  }
  if(url.includes('/units')){
    const id=Number(url.split('/').pop());
    if(method==='PUT')units=units.map(u=>u.storageUnitId===id?{...u,...body}:u);
    else for(const r of body.units||[body])units.push({...r,storageUnitId:units.length+1,facilityName:facilities.find(f=>f.facilityId===r.facilityId)?.name,floorName:floors.find(f=>f.floorId===r.floorId)?.name,unitTypeCode:types.find(t=>t.unitTypeId===r.unitTypeId)?.code,areaM2:types.find(t=>t.unitTypeId===r.unitTypeId)?.areaM2});
    return answer({});
  }
  return answer({title:'Unexpected fixture route'},404);
};
function Preview(){const [page,setPage]=useState('facilities'),[id,setId]=useState(null);return <><div style={{padding:12,background:'#fff3cd',font:'12px system-ui'}}>Isolated UI fixture · sample data · no database writes. <button onClick={()=>setPage('facilities')}>Facilities preview</button> <button onClick={()=>setPage('units')}>Units preview</button> Role: {role}</div>{page==='facilities'?<Facilities user={{role}} openUnits={id=>{setId(id);setPage('units');}}/>:<Units user={{role}} initialFacilityId={id}/>}</>;}
createRoot(document.getElementById('root')).render(<Preview/>);

