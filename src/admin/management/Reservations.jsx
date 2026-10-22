import { useEffect, useRef, useState } from 'react';
import { useData, write, money, Pager, useUnsaved } from './common.jsx';
import './Reservations.css';
import WalkInBooking from './WalkInBooking.jsx';
import { Roles } from '../../features/auth/roles';
const ROOT='/api/reservations';
const tabs=['Pending','Confirmed','Cancelled','Expired'];
const time=value=>value?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(value)):'Not scheduled';
const local=value=>value?new Date(new Date(value).getTime()+7*3600000).toISOString().slice(0,16):'';
const created=value=>new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(value)).replace(',','');
const dmy=date=>date.toISOString().slice(0,10).split('-').reverse().join('/');
const period=r=>{if(!r.moveInDate||!r.rentalMonths)return r.rentalMonths?`${r.rentalMonths} months`:'Not provided';const [y,m,d]=r.moveInDate.slice(0,10).split('-').map(Number);const last=new Date(Date.UTC(y,m+r.rentalMonths,0)).getUTCDate();const end=new Date(Date.UTC(y,m-1+r.rentalMonths,Math.min(d,last))-86400000);return `${dmy(new Date(Date.UTC(y,m-1,d)))} → ${dmy(end)}`;};
const initials=name=>{const p=(name||'').trim().split(/\s+/).filter(Boolean);return ((p[0]?.[0]||'')+(p.length>1?p[p.length-1][0]:'')).toUpperCase()||'?';};
const maskId=id=>String(id).length>7?`${String(id).slice(0,4)}${'•'.repeat(String(id).length-7)}${String(id).slice(-3)}`:String(id);
function QueryState({query,empty}){return query.loading?<p role="status">Loading…</p>:query.error?<p role="alert">{query.error} <button onClick={query.reload}>Retry</button></p>:empty?<p>No records found.</p>:null;}
export default function Reservations({user,onDirtyChange,initialReservationId=null}) {
  const canWalkIn=[Roles.FacilityStaff,Roles.FacilityManager].includes(user?.role);
  const canAssignUnit=canWalkIn;
  const [tab,setTab]=useState(initialReservationId?'Confirmed':'Pending'),[search,setSearch]=useState(''),[term,setTerm]=useState(''),[date,setDate]=useState(''),[page,setPage]=useState(1),[id,setId]=useState(initialReservationId),[modal,setModal]=useState(null),[walkInOpen,setWalkInOpen]=useState(false),[notice,setNotice]=useState('');
  const [selectedUnitId,setSelectedUnitId]=useState(''),[assignBusy,setAssignBusy]=useState(false),[assignError,setAssignError]=useState('');
  useEffect(()=>{const timer=setTimeout(()=>{setTerm(search);setPage(1);},300);return()=>clearTimeout(timer);},[search]);
  const queue=useData(`${ROOT}?${new URLSearchParams({status:tab,search:term,page,pageSize:6,...(date?{moveInFrom:date,moveInTo:date}:{})})}`);
  const detail=useData(id?`${ROOT}/${id}`:null),settings={data:{},loading:false,error:'',reload:()=>Promise.resolve()};
  const r=detail.data?.reservationId?detail.data:null;
  const customerQuery=useData(r?.customerName?`/api/customers?${new URLSearchParams({search:r.customerName,page:1,pageSize:100})}`:null);
  const customer=(customerQuery.data?.items??[]).find(item=>item.userId===r?.customerId);
  const pendingUnits=useData(r?.status==='Pending'?`/api/storage-units?${new URLSearchParams({facilityId:r.facilityId,unitTypeId:r.unitTypeId,status:'Available',page:1,pageSize:100})}`:null);
  const availablePendingUnits=pendingUnits.data?.items??[];
  useUnsaved(!!modal,onDirtyChange);
  useEffect(()=>{setSelectedUnitId('');setAssignError('');},[id]);
  useEffect(()=>{const list=pendingUnits.data?.items??[];if(r?.status==='Pending'&&!pendingUnits.loading&&list.length&&!list.some(u=>String(u.storageUnitId)===selectedUnitId))setSelectedUnitId(String(list[0].storageUnitId));},[pendingUnits.data,pendingUnits.loading,r?.status,selectedUnitId]);
  useEffect(()=>{const timer=setInterval(()=>{queue.reload();if(id)detail.reload();},30000);return()=>clearInterval(timer);},[queue.reload,detail.reload,id]);
  const done=()=>{setModal(null);setNotice('Saved successfully.');queue.reload();detail.reload();settings.reload();};
  const items=queue.data?.items??[];
  const walkInCreated=result=>{setTab('Confirmed');setSearch('');setTerm('');setDate('');setPage(1);setId(result.reservationId);setModal(null);setWalkInOpen(false);setNotice(`Created ${result.reservationCode} as confirmed. It is available in Return for staff handover.`);};
  const assignSelectedUnit=async()=>{
    if(!r?.reservationId||!selectedUnitId||!canAssignUnit)return;
    setAssignBusy(true);setAssignError('');
    try{
      await write(`${ROOT}/${r.reservationId}/assign-unit`,'POST',{storageUnitId:Number(selectedUnitId)});
      setTab('Confirmed');setNotice(`${r.reservationCode} confirmed and assigned to ${availablePendingUnits.find(unit=>String(unit.storageUnitId)===selectedUnitId)?.unitCode||'the selected room'}.`);
      setSelectedUnitId('');queue.reload();detail.reload();
    }catch(error){setAssignError(error.message);pendingUnits.reload();}
    finally{setAssignBusy(false);}
  };
  if(walkInOpen)return <WalkInBooking close={()=>setWalkInOpen(false)} created={walkInCreated}/>;
  return <section className="rv-page">
    <header className="rv-header"><div><h1>Reservations</h1><p>Review bookings and assign storage units.</p></div><div className="rv-actions"><span className={!canWalkIn?'rv-tooltip':''} data-tooltip={!canWalkIn?'You do not have the permission to do this action.':undefined}><button className="primary" disabled={!canWalkIn} aria-describedby={!canWalkIn?'walkin-permission':undefined} onClick={()=>setWalkInOpen(true)}>+ New walk-in booking</button>{!canWalkIn&&<span className="rv-sr-only" id="walkin-permission">You do not have the permission to do this action.</span>}</span></div></header>
    {notice&&<p role="status" className="rv-notice">{notice} <button onClick={()=>setNotice('')}>Dismiss</button></p>}
    <div className="rv-tabs" role="tablist">{tabs.map(t=><button key={t} role="tab" aria-selected={t===tab} className={t===tab?'selected':''} onClick={()=>{setTab(t);setPage(1);setId(null);}}>{t} <span>{queue.data?.counts?.[t.toLowerCase()]??'—'}</span></button>)}</div>
    <div className="rv-filters"><input aria-label="Search code, customer name or phone" placeholder="Search code, customer name or phone" value={search} onChange={e=>setSearch(e.target.value)}/><label>Move-in date <input type="date" value={date} onChange={e=>{setDate(e.target.value);setPage(1);}}/></label><button onClick={queue.reload}>Refresh</button></div>
    <div className={'rv-layout '+(id?'with-detail':'')}><div className="rv-table-card"><div className="rv-table-scroll"><table><thead><tr><th>Code</th><th>Customer</th><th>Requested size</th><th>Move-in</th><th>Rental period</th><th>Deposit</th><th>Facility</th>{['Cancelled','Expired'].includes(tab)&&<th>Reason</th>}</tr></thead><tbody>{!queue.loading&&!queue.error&&items.map(row=><tr key={row.reservationId} className={`${id===row.reservationId?'selected':''}`} onClick={()=>setId(row.reservationId)}><td><button className="rv-link" onClick={()=>setId(row.reservationId)}>{row.reservationCode}</button></td><td><strong>{row.customerName}</strong></td><td>{row.unitTypeName}</td><td>{row.moveInDate}</td><td>{row.rentalMonths} month{row.rentalMonths===1?'':'s'}</td><td><strong>{money(row.depositAmount)}</strong><small>{row.depositStatus?.replaceAll('_',' ')||'No deposit due'}</small></td><td>{row.facilityName}</td>{['Cancelled','Expired'].includes(tab)&&<td>{row.status}</td>}</tr>)}</tbody></table><div className="rv-state"><QueryState query={queue} empty={!items.length}/></div></div><Pager page={page} setPage={setPage} total={queue.data?.totalCount??0} size={6}/></div>
    {id&&<aside className="rv-detail"><button className="rv-close" aria-label="Close details" onClick={()=>setId(null)}>×</button><QueryState query={detail}/>{r&&<>
      <header className="rv-detail-head"><div className="rv-title"><h2>{r.reservationCode}</h2><span className={`rv-pill ${String(r.status).toLowerCase()}`}>{r.status}</span></div>{r.createdAt&&<small>Created {created(r.createdAt)}</small>}</header>
      <div className="rv-detail-body">
        <div className="rv-customer"><span className="rv-avatar" aria-hidden="true">{initials(r.customerName)}</span><div className="rv-customer-info"><strong>{r.customerName}</strong><small title={[customer?.phoneNumber,customer?.email].filter(Boolean).join(' · ')||undefined}>{customerQuery.loading?'Loading customer details…':customer?[customer.citizenId&&`CCCD ${maskId(customer.citizenId)}`,customer.phoneNumber].filter(Boolean).join(' · '):customerQuery.error?'Customer contact details unavailable':'Customer contact details not returned by backend'}</small></div></div>
        <dl>{[['Facility',r.facilityName],['Requested',r.unitTypeName],r.unitCode&&['Assigned room',r.unitCode],['Rental period',period(r)],['Deposit',`${money(r.depositAmount)} · ${r.depositStatus?.replaceAll('_',' ')||'No deposit due'}`]].filter(Boolean).map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        {r.status==='Pending'&&<section className="rv-assign"><h3>Assign a room (suggested)</h3>{pendingUnits.loading?<p role="status">Loading available rooms…</p>:pendingUnits.error?<p role="alert">{pendingUnits.error} <button type="button" onClick={pendingUnits.reload}>Retry</button></p>:availablePendingUnits.length?<fieldset className="rv-unit-options"><legend className="rv-sr-only">Select a room</legend>{availablePendingUnits.map((unit,i)=><label className={String(unit.storageUnitId)===selectedUnitId?'selected':''} key={unit.storageUnitId}><input type="radio" name="pendingStorageUnitId" value={unit.storageUnitId} checked={String(unit.storageUnitId)===selectedUnitId} onChange={event=>setSelectedUnitId(event.target.value)}/><span className="rv-unit-info"><strong>{unit.unitCode}</strong><small>{unit.floorName||'Floor not provided'}{unit.zone?` · ${unit.zone}`:''}</small></span>{i===0&&<em className="rv-best">Best match</em>}</label>)}</fieldset>:<p className="rv-warning">No available rooms match this facility and requested size.</p>}{assignError&&<p className="rv-warning" role="alert">{assignError}</p>}</section>}
        {user?.role===Roles.FacilityManager&&r.status==='Pending'&&<label className="rv-field">Handover staff<span className="rv-select"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg><select disabled><option>Not available yet</option></select></span></label>}
        <div className="rv-actions rv-detail-actions">{r.status==='Pending'&&<><button className="danger" onClick={()=>setModal('reject')}>Reject</button><button className="primary" disabled={!canAssignUnit||pendingUnits.loading||!!pendingUnits.error||!availablePendingUnits.length||!selectedUnitId||assignBusy} onClick={assignSelectedUnit}>{assignBusy?'Assigning…':<><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg> Confirm &amp; assign</>}</button></>}{r.status==='Confirmed'&&<><button className="danger" onClick={()=>setModal('cancel')}>Cancel reservation</button><button onClick={()=>setModal('no-show')}>No-show</button></>}</div>
      </div>
      </>}</aside>}</div>
    {modal&&modal!=='walk-in'&&<ReservationModal key={`${modal}-${id}`} kind={modal} reservation={r} settings={settings.data} close={()=>setModal(null)} done={done} select={next=>{setId(next);setModal(null);}}/>}
  </section>;
}
function ReservationModal({kind,reservation:r,settings,close,done,select}) {
  const ref=useRef(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const units=useData(kind==='confirm'?`/api/storage-units?facilityId=${r.facilityId}&unitTypeId=${r.unitTypeId}&status=Available&page=1&pageSize=100`:null),refunds=useData(null);
  const availableUnits=units.data?.items??[];
  const [form,setForm]=useState({unit:r?.storageUnitId??'',date:r?.handoverSlot?local(r.handoverSlot).slice(0,10):r?.moveInDate??'',start:r?.handoverSlot?local(r.handoverSlot).slice(11):'09:00',end:r?.handoverEnd?local(r.handoverEnd).slice(11):'10:00',reason:'',amount:'',reference:'',depositStatus:'held',refundAmount:0,earlyCancelHours:settings?.earlyCancelHours??48,lateCancelRefundPercent:settings?.lateCancelRefundPercent??50,forfeitAfterDays:settings?.forfeitAfterDays??7,approachingMinutes:settings?.approachingMinutes??60});
  useEffect(()=>{ref.current.showModal();},[]);
  const field=(key,label,type='text',props={})=><label>{label}<input type={type} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})} required {...props}/></label>;
  const submit=async e=>{e.preventDefault();setError('');setBusy(true);try{
    let path=`${ROOT}/${r?.reservationId}/${kind==='confirm'?'assign-unit':kind==='reject'?'cancel':kind}`,method='POST',body={reason:form.reason.trim()};
    if(['confirm','schedule'].includes(kind)){
      if(kind==='schedule')throw new Error('Handover scheduling is not available in the backend.');
      body={storageUnitId:Number(form.unit)};
    }else if(kind==='settings'){path=`${ROOT}/settings`;method='PUT';body=Object.fromEntries(['earlyCancelHours','lateCancelRefundPercent','forfeitAfterDays','approachingMinutes'].map(k=>[k,Number(form[k])]));}
    else if(kind==='deposit-received')body={amount:Number(form.amount),reference:form.reference.trim()};
    else if(kind==='deposit-override')body={depositStatus:form.depositStatus,refundAmount:form.depositStatus==='refund_due'?Number(form.refundAmount):0,reason:form.reason.trim()};
    else if(kind==='recover')body=undefined;
    else if(!body.reason)throw new Error('A reason or payment reference is required.');
    if(kind==='no-show')body=undefined;
    await write(path,method,body);done();
  }catch(e){setError(e.message);if(kind==='confirm')units.reload();}finally{setBusy(false);}};
  return <dialog ref={ref} className="rv-modal" onCancel={e=>{e.preventDefault();if(!busy)close();}}><form onSubmit={submit}><h2>{({'confirm':'Confirm & assign','schedule':'Edit handover window','deposit-received':'Record deposit received','deposit-override':'Override deposit outcome','refund':'Record manual refund','recover':'Recover reservation','resolve-contract':'Resolve draft contract','refunds':'Refunds due','settings':'Reservation settings','cancel':'Cancel reservation','reject':'Reject reservation','no-show':'Mark no-show'})[kind]}</h2>
    {kind==='refunds'?<><QueryState query={refunds} empty={!refunds.data.length}/>{Array.isArray(refunds.data)&&refunds.data.map(x=><button type="button" key={x.reservationId} onClick={()=>select(x.reservationId)}>{x.reservationCode} · {x.customerName} · {money(x.refundAmount)}</button>)}</>:<>
    {['confirm','schedule'].includes(kind)&&<>{kind==='confirm'?<><QueryState query={units} empty={!availableUnits.length}/><fieldset className="rv-unit-options"><legend>Choose an available storage room</legend>{availableUnits.map(u=><label className={String(u.storageUnitId)===String(form.unit)?'selected':''} key={u.storageUnitId}><input type="radio" name="storageUnitId" required value={u.storageUnitId} checked={String(u.storageUnitId)===String(form.unit)} onChange={e=>setForm({...form,unit:e.target.value})}/><span><strong>{u.unitCode}</strong><small>{u.floorName||'Floor not provided'}{u.zone?` · ${u.zone}`:''}</small></span></label>)}</fieldset></>:<p>Assigned unit: {r.unitCode}</p>}{kind==='schedule'&&<p className="rv-unimplemented">Handover scheduling is not available in the backend yet.</p>}</>}
    {kind==='settings'&&<>{field('earlyCancelHours','Full refund cutoff (hours)','number',{min:0,max:720,step:1})}{field('lateCancelRefundPercent','Late cancellation refund (%)','number',{min:0,max:100,step:'any'})}{field('forfeitAfterDays','Days before final forfeiture','number',{min:3,max:14,step:1})}{field('approachingMinutes','Highlight before handover (minutes)','number',{min:0,max:1440,step:1})}<p>New settings apply to future actions. Existing forfeiture deadlines are retained.</p></>}
    {kind==='deposit-received'&&<><p>Record money actually received. This does not collect a payment. A receipt can be recorded once.</p>{field('amount','Amount received (₫)','number',{min:0.01,max:9999999999.99,step:0.01})}{field('reference','Receipt / payment reference','text',{maxLength:100})}</>}
    {kind==='deposit-override'&&<><label>Outcome<select value={form.depositStatus} onChange={e=>setForm({...form,depositStatus:e.target.value})}>{['held','refund_due',...(r.status==='Expired'?['forfeit_pending']:[]),'forfeited'].map(s=><option key={s} value={s}>{s.replaceAll('_',' ')}</option>)}</select></label>{form.depositStatus==='refund_due'&&field('refundAmount','Refund amount (₫)','number',{min:0,max:r.depositAmount,step:0.01})}</>}
    {kind==='recover'&&<p>Keep move-in date {r.moveInDate}, clear the assigned unit and handover window, and return to Pending. A forfeited deposit must first be overridden to held.</p>}
    {kind==='refund'&&<p>Confirm that {money(r.refundAmount)} has already been paid manually. This action records the payment; it does not send money.</p>}
    {kind==='resolve-contract'&&<p>This explicitly terminates this reservation’s draft contracts, including signed drafts. It does not cancel the reservation. Active contracts must be resolved in contract management.</p>}
    {kind==='reject'&&<p>The reservation will be hidden from all four queues. Its full deposit becomes refund due and remains accessible under Refunds due.</p>}
    {kind==='cancel'&&<p>Refund: at least {settings?.earlyCancelHours??48} hours before handover, 100%; otherwise {settings?.lateCancelRefundPercent??50}%. The remainder is forfeited.</p>}
    {kind==='no-show'&&<p>The recorded deposit will be fully forfeited and the unit released.</p>}
    {!['confirm','schedule','settings','recover','deposit-received'].includes(kind)&&field('reason',kind==='refund'?'Payment reference / note':'Required reason','text',{maxLength:500})}
    </>}{error&&<p role="alert" className="rv-warning">{error}</p>}<footer><button type="button" disabled={busy} onClick={close}>Close</button>{kind!=='refunds'&&<button className="primary" disabled={busy||(kind==='confirm'&&(units.loading||!!units.error||!availableUnits.length))}>{busy?'Saving…':'Save'}</button>}</footer></form></dialog>;
}




