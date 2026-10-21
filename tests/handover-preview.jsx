// Isolated fixture only. Never sends data to a backend or email service.
import React from 'react';import {createRoot} from 'react-dom/client';
import HandoverDesk from '../src/admin/handover/HandoverDesk.jsx';
const mode=new URLSearchParams(location.search).get('state');
const today=new Date(Date.now()+7*3600000).toISOString().slice(0,10);
const at=t=>new Date(`${today}T${t}:00+07:00`).toISOString();
let checklist={identity:false,contract:false,payment:false,inspection:false,condition:'Good',note:'',equipment:false,lockSerial:'',cardNumber:'',access:false,signatures:false,completedSteps:0};
let revision=0,status='Confirmed',evidence=[],images=new Map();
const rows=['Lê Thu Hà','Đặng Khoa','Hoa Sen Co.','Trương Hiếu','Phan Đức'].map((name,i)=>({reservationId:i+1,reservationCode:`RSV-2026-0048${i}`,customerName:name,phone:'0901234567',unitCode:'M-'+(204+i),unitType:'M',areaM2:5,checkInSlot:at(['09:00','11:00','13:00','14:30','15:30'][i]),checkInEnd:at(['10:00','12:00','14:00','15:30','16:30'][i]),status:['Confirmed','Waiting','Confirmed','Late','Completed'][i]}));
window.fetch=async(url,o={})=>{
 const answer=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
 if(mode==='loading')return new Promise(()=>{});if(mode==='error')return answer({title:'Preview: handover service unavailable.'},503);
 const u=new URL(url,location.origin),path=u.pathname,body=typeof o.body==='string'?JSON.parse(o.body):o.body;
 if(path.includes('/evidence/')&&!o.method)return new Response(images.get(path.split('/').pop())||new Blob([]),{headers:{'Content-Type':'image/png'}});
 if(path.endsWith('/evidence')&&o.method==='POST'){const id=crypto.randomUUID();images.set(id,body.get('file'));evidence.push({handoverEvidenceId:id,kind:body.get('kind')});return answer(id);}
 if(path.endsWith('/lookup'))return answer(1);
 if(path.endsWith('/available-units'))return answer([{storageUnitId:9,unitCode:'M-219',floorName:'Floor 2'}]);
 if(path.endsWith('/lock'))return answer({token:'fixture-lock',revision,until:new Date(Date.now()+120000).toISOString()});
 if(path.endsWith('/unlock'))return answer(true);
 if(path.endsWith('/arrive')){status='Waiting';revision++;return answer(true);}
 if(path.endsWith('/step')){const flag=['identity','contract','payment','inspection','equipment','access','signatures'][body.step-1];if(body.checked)checklist[flag]=true;checklist={...checklist,condition:body.condition??checklist.condition,note:body.note??checklist.note,lockSerial:body.lockSerial??checklist.lockSerial,cardNumber:body.cardNumber??checklist.cardNumber,...(body.customerSignature?{customerSignature:body.customerSignature}:{}),...(body.staffSignature?{staffSignature:body.staffSignature}:{})};checklist.completedSteps=['identity','contract','payment','inspection','equipment','access','signatures'].filter(f=>checklist[f]).length;status='In progress';return answer(++revision);}
 if(path.endsWith('/complete')){status='Completed';revision++;return answer(1);}
 if(path.endsWith('/problem')){status='Blocked';revision++;return answer(true);}
 if(path.endsWith('/resolve')){status='Confirmed';revision++;return answer(true);}
 if(path.endsWith('/settings'))return answer(true);
 if(/\/\d+$/.test(path)){const id=Number(path.split('/').pop());return answer({...rows[id-1],status:id===1?status:rows[id-1].status,revision,checklist,maskedId:'********8901',contract:{contractId:1,contractNumber:'CT-2026-0388',status:'Draft',signedAt:at('08:00')},depositAmount:3757500,depositStatus:'held',receipt:'Cash receipt #001',paymentMethod:'Manual receipt',evidence,readOnly:status==='Completed',rentalMonths:3,editorId:1,editorName:'Nguyễn Hải'});}
 return answer({items:mode==='empty'||u.searchParams.get('tab')==='upcoming'?[]:rows.map(r=>r.reservationId===1?{...r,status}:r),todayCount:5,upcomingCount:0,graceMinutes:15});
};
createRoot(document.getElementById('root')).render(<HandoverDesk user={{userId:1,role:'SystemAdministrator'}} openReservation={()=>{}}/>);
