// Isolated visual fixture. Never connects to the API or writes to a database.
import React from 'react';
import {createRoot} from 'react-dom/client';
import Reservations from '../src/admin/management/Reservations.jsx';
const mode=new URLSearchParams(location.search).get('state');
const rows=Array.from({length:6},(_,i)=>({reservationId:i+1,reservationCode:`RSV-0048${i}`,customerName:['Lê Thu Hà','Hoa Sen Co.','Đặng Khoa','Mai Anh','Trương Hiếu','Vũ Linh'][i],phone:'0903 123 812',email:'customer@example.test',facilityName:'Thu Duc – Vo Nguyen Giap',unitTypeCode:'M',areaM2:5,moveInDate:'2026-11-20',rentalMonths:3,status:'Pending',depositAmount:i?1000000:0,depositStatus:'held',refundAmount:0,createdAt:'2026-10-14T03:00:00Z'}));
window.fetch=async(url,options={})=>{
 const out=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json'}});
 if(mode==='loading')return new Promise(()=>{});
 if(mode==='error')return out({title:'Preview: backend unavailable'},503);
 const u=new URL(url,location.origin),suffix=u.pathname.split('/').pop();
 if(suffix==='walk-in-options')return out({facilities:mode==='empty'?[]:[{facilityId:1,name:'Thu Duc – Vo Nguyen Giap'}],unitTypes:[{facilityId:1,unitTypeId:1,code:'M',name:'Medium',areaM2:5}]});
 if(suffix==='walk-in'&&options.method==='POST'){
   const b=JSON.parse(options.body),id=rows.length+1,code=`RSV-${String(id).padStart(5,'0')}`;
   rows.push({...rows[0],reservationId:id,reservationCode:code,customerName:b.customerName,email:b.email,phone:b.phone,moveInDate:b.moveInDate,rentalMonths:b.rentalMonths,depositAmount:b.depositAmount});
   return out({reservationId:id,reservationCode:code},201);
 }
 if(options.method&&options.method!=='GET')return out({success:true});
 if(suffix==='settings')return out({earlyCancelHours:48,lateCancelRefundPercent:50,forfeitAfterDays:7,approachingMinutes:60});
 if(suffix==='audit'||suffix==='refunds')return out([]);
 if(suffix==='available-units')return out([{storageUnitId:1,unitCode:'M-204',floorName:'Floor 2',zone:'A'}]);
 if(/^\d+$/.test(suffix))return out(rows[Number(suffix)-1]);
 const items=mode==='empty'||u.searchParams.get('tab')!=='Pending'?[]:rows;
 return out({items,totalCount:items.length,counts:{pending:items.length,confirmed:0,cancelled:0,expired:0}});
};
createRoot(document.getElementById('root')).render(<Reservations user={{role:'SystemAdministrator'}}/>);
