import { useEffect, useRef, useState } from 'react';
import { useData, write, money, Pager, useUnsaved } from './common.jsx';
import './Reservations.css';
import WalkInBooking from './WalkInBooking.jsx';
const ROOT='/api/reservation-management';
const tabs=['Pending','Confirmed','Cancelled','Expired'];
const time=value=>value?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(value)):'Not scheduled';
const local=value=>value?new Date(new Date(value).getTime()+7*3600000).toISOString().slice(0,16):'';
function QueryState({query,empty}){return query.loading?<p role="status">Loading…</p>:query.error?<p role="alert">{query.error} <button onClick={query.reload}>Retry</button></p>:empty?<p>No records found.</p>:null;}
export default function Reservations({user,onDirtyChange,initialReservationId=null}) {
  const [tab,setTab]=useState(initialReservationId?'Confirmed':'Pending'),[search,setSearch]=useState(''),[term,setTerm]=useState(''),[date,setDate]=useState(''),[page,setPage]=useState(1),[id,setId]=useState(initialReservationId),[modal,setModal]=useState(null),[notice,setNotice]=useState('');
  useEffect(()=>{const timer=setTimeout(()=>{setTerm(search);setPage(1);},300);return()=>clearTimeout(timer);},[search]);
  const queue=useData(`${ROOT}?${new URLSearchParams({tab,search:term,page,pageSize:6,...(date?{moveInDate:date}:{})})}`);
  const detail=useData(id?`${ROOT}/${id}`:null),settings=useData(`${ROOT}/settings`);
  const r=detail.data?.reservationId?detail.data:null;
  useUnsaved(!!modal,onDirtyChange);
  useEffect(()=>{const timer=setInterval(()=>{queue.reload();if(id)detail.reload();},30000);return()=>clearInterval(timer);},[queue.reload,detail.reload,id]);
  const [revision,setRevision]=useState(0);
  const done=()=>{setRevision(x=>x+1);setModal(null);setNotice('Saved successfully.');queue.reload();detail.reload();settings.reload();};
  const items=queue.data?.items??[];
  const walkInCreated=result=>{setTab('Pending');setSearch('');setTerm('');setDate('');setPage(1);setId(result.reservationId);setModal(null);setRevision(x=>x+1);setNotice(`Created ${result.reservationCode}. Confirm & assign when ready.`);queue.reload();};
  return <section className="rv-page">
    <header className="rv-header"><div><h1>Reservations</h1><p>Review bookings, assign units and schedule check-in · Vietnam time (UTC+7)</p></div><div className="rv-actions"><button className="primary" onClick={()=>setModal('walk-in')}>+ New walk-in booking</button><button onClick={()=>setModal('refunds')}>Refunds due</button>{user?.role==='SystemAdministrator'&&<button disabled={settings.loading||!!settings.error} onClick={()=>setModal('settings')}>Settings</button>}</div></header>
    {settings.error&&<div className="rv-warning">Reservation settings: <QueryState query={settings}/></div>}{notice&&<p role="status" className="rv-notice">{notice} <button onClick={()=>setNotice('')}>Dismiss</button></p>}
    <div className="rv-tabs" role="tablist">{tabs.map(t=><button key={t} role="tab" aria-selected={t===tab} className={t===tab?'selected':''} onClick={()=>{setTab(t);setPage(1);setId(null);}}>{t} <span>{queue.data?.counts?.[t.toLowerCase()]??'—'}</span></button>)}</div>
    <div className="rv-filters"><input aria-label="Search code, customer name or phone" placeholder="Search code, customer name or phone" value={search} onChange={e=>setSearch(e.target.value)}/><label>Move-in date <input type="date" value={date} onChange={e=>{setDate(e.target.value);setPage(1);}}/></label><button onClick={queue.reload}>Refresh</button></div>
    <div className={'rv-layout '+(id?'with-detail':'')}><div className="rv-table-card"><div className="rv-table-scroll"><table><thead><tr><th>Code</th><th>Customer Name</th><th>Requested</th><th>Move-in / check-in</th><th>Period</th><th>Deposit received</th>{['Cancelled','Expired'].includes(tab)&&<th>Reason</th>}</tr></thead><tbody>{!queue.loading&&!queue.error&&items.map(row=>{
      const end=row.checkInEnd?Date.parse(row.checkInEnd):Infinity,start=row.checkInSlot?Date.parse(row.checkInSlot):Infinity,now=Date.now();
      const urgency=tab==='Confirmed'?(end<now?'overdue':start-now<=(settings.data?.approachingMinutes??60)*60000?'approaching':''):'';
      return <tr key={row.reservationId} className={`${id===row.reservationId?'selected':''} ${urgency}`} onClick={()=>setId(row.reservationId)}><td><button className="rv-link" onClick={()=>setId(row.reservationId)}>{row.reservationCode}</button></td><td><strong>{row.customerName}</strong><small>{row.phone||'No phone'}</small></td><td>{row.unitTypeCode} · {row.areaM2} m²</td><td>{row.moveInDate}<small>{row.checkInSlot?`${local(row.checkInSlot).slice(11)}–${local(row.checkInEnd).slice(11)}`:'Awaiting assignment'}</small>{urgency&&<small>{urgency==='overdue'?'Window ended':'Approaching / in progress'}</small>}</td><td>{row.rentalMonths} mo</td><td><strong>{money(row.depositAmount)}</strong><small>{row.depositStatus.replaceAll('_',' ')}</small></td>{['Cancelled','Expired'].includes(tab)&&<td>{row.status==='NoShow'?'No-show':row.status}<small>{row.statusReason}</small></td>}</tr>;
    })}</tbody></table><div className="rv-state"><QueryState query={queue} empty={!items.length}/></div></div><Pager page={page} setPage={setPage} total={queue.data?.totalCount??0} size={6}/></div>
    {id&&<aside className="rv-detail"><button className="rv-close" aria-label="Close details" onClick={()=>setId(null)}>×</button><QueryState query={detail}/>{r&&<><h2>{r.reservationCode}</h2><span className="rv-pill">{r.status==='CheckedIn'?'Handed over':r.status}</span><p className="rv-customer"><strong>{r.customerName}</strong><small>{r.phone} · {r.email}</small></p><dl>{Object.entries({'Facility':r.facilityName,'Requested':`${r.unitTypeCode} · ${r.areaM2} m²`,'Unit':r.unitCode||'Unassigned','Move-in date':r.moveInDate,'Rental period':`${r.rentalMonths} months`,'Check-in start':time(r.checkInSlot),'Check-in end':time(r.checkInEnd),'Deposit received':money(r.depositAmount),'Deposit status':r.depositStatus.replaceAll('_',' '),'Refund amount':money(r.refundAmount),'Forfeiture deadline':r.forfeitAt?time(r.forfeitAt):'—','Reason':r.statusReason||'—'}).map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      {r.contractBlocked&&<p className="rv-warning">An unresolved contract blocks cancellation, no-show, expiry and schedule changes. A manager must resolve it first.</p>}
      <div className="rv-actions">{r.status==='Pending'&&<><button onClick={()=>setModal('reject')}>Reject</button><button className="primary" disabled={r.contractBlocked} onClick={()=>setModal('confirm')}>Confirm & assign</button></>}{r.status==='Confirmed'&&<><button disabled={r.contractBlocked} onClick={()=>setModal('schedule')}>Edit date/time</button><button disabled={r.contractBlocked} onClick={()=>setModal('cancel')}>Cancel reservation</button><button disabled={r.contractBlocked} onClick={()=>setModal('no-show')}>No-show</button></>}{r.status==='Expired'&&<button onClick={()=>setModal('recover')}>Recover to Pending</button>}
      {['Pending','Confirmed'].includes(r.status)&&r.depositAmount===0&&<button onClick={()=>setModal('deposit-received')}>Record deposit received</button>}{r.depositStatus==='refund_due'&&<button onClick={()=>setModal('refund')}>Mark manually refunded</button>}{!['Pending','Confirmed','CheckedIn'].includes(r.status)&&r.depositStatus!=='refunded'&&<button onClick={()=>setModal('deposit-override')}>Override deposit outcome</button>}{r.contractBlocked&&['SystemAdministrator','FacilityManager'].includes(user?.role)&&<button onClick={()=>setModal('resolve-contract')}>Resolve draft contract</button>}</div>
      <Audit key={`${id}-${revision}`} id={id}/></>}</aside>}</div>
    {modal==='walk-in'&&<WalkInBooking close={()=>setModal(null)} created={walkInCreated}/>}
    {modal&&modal!=='walk-in'&&<ReservationModal key={`${modal}-${id}`} kind={modal} reservation={r} settings={settings.data} close={()=>setModal(null)} done={done} select={next=>{setId(next);setModal(null);}}/>}
  </section>;
}
function Audit({id}){const q=useData(`${ROOT}/${id}/audit`);return <details className="rv-audit"><summary>Action history</summary><QueryState query={q} empty={!q.data.length}/>{Array.isArray(q.data)&&q.data.map(a=><article key={a.reservationAuditId}><strong>{a.action}</strong><small>{a.actorName} · {time(a.createdAt)}</small><p>{a.reason}</p><details><summary>Before / after</summary><pre>{JSON.stringify({before:JSON.parse(a.beforeJson),after:JSON.parse(a.afterJson)},null,2)}</pre></details></article>)}</details>;}
function ReservationModal({kind,reservation:r,settings,close,done,select}) {
  const ref=useRef(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const units=useData(kind==='confirm'?`${ROOT}/${r.reservationId}/available-units`:null),refunds=useData(kind==='refunds'?`${ROOT}/refunds`:null);
  const [form,setForm]=useState({unit:r?.storageUnitId??'',date:r?.checkInSlot?local(r.checkInSlot).slice(0,10):r?.moveInDate??'',start:r?.checkInSlot?local(r.checkInSlot).slice(11):'09:00',end:r?.checkInEnd?local(r.checkInEnd).slice(11):'10:00',reason:'',amount:'',reference:'',depositStatus:'held',refundAmount:0,earlyCancelHours:settings?.earlyCancelHours??48,lateCancelRefundPercent:settings?.lateCancelRefundPercent??50,forfeitAfterDays:settings?.forfeitAfterDays??7,approachingMinutes:settings?.approachingMinutes??60});
  useEffect(()=>{ref.current.showModal();},[]);
  const field=(key,label,type='text',props={})=><label>{label}<input type={type} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})} required {...props}/></label>;
  const submit=async e=>{e.preventDefault();setError('');setBusy(true);try{
    let path=`${ROOT}/${r?.reservationId}/${kind}`,method='POST',body={reason:form.reason.trim()};
    if(['confirm','schedule'].includes(kind)){
      const start=new Date(`${form.date}T${form.start}:00+07:00`),end=new Date(`${form.date}T${form.end}:00+07:00`);
      if(start<=new Date()||end<=start)throw new Error('Choose a future start and a later end on the same date.');
      body={storageUnitId:Number(form.unit),checkInStart:start.toISOString(),checkInEnd:end.toISOString()};if(kind==='schedule')method='PUT';
    }else if(kind==='settings'){path=`${ROOT}/settings`;method='PUT';body=Object.fromEntries(['earlyCancelHours','lateCancelRefundPercent','forfeitAfterDays','approachingMinutes'].map(k=>[k,Number(form[k])]));}
    else if(kind==='deposit-received')body={amount:Number(form.amount),reference:form.reference.trim()};
    else if(kind==='deposit-override')body={depositStatus:form.depositStatus,refundAmount:form.depositStatus==='refund_due'?Number(form.refundAmount):0,reason:form.reason.trim()};
    else if(kind==='recover')body=undefined;
    else if(!body.reason)throw new Error('A reason or payment reference is required.');
    await write(path,method,body);done();
  }catch(e){setError(e.message);if(kind==='confirm')units.reload();}finally{setBusy(false);}};
  return <dialog ref={ref} className="rv-modal" onCancel={e=>{e.preventDefault();if(!busy)close();}}><form onSubmit={submit}><h2>{({'confirm':'Confirm & assign','schedule':'Edit check-in window','deposit-received':'Record deposit received','deposit-override':'Override deposit outcome','refund':'Record manual refund','recover':'Recover reservation','resolve-contract':'Resolve draft contract','refunds':'Refunds due','settings':'Reservation settings','cancel':'Cancel reservation','reject':'Reject reservation','no-show':'Mark no-show'})[kind]}</h2>
    {kind==='refunds'?<><QueryState query={refunds} empty={!refunds.data.length}/>{Array.isArray(refunds.data)&&refunds.data.map(x=><button type="button" key={x.reservationId} onClick={()=>select(x.reservationId)}>{x.reservationCode} · {x.customerName} · {money(x.refundAmount)}</button>)}</>:<>
    {['confirm','schedule'].includes(kind)&&<>{kind==='confirm'?<><QueryState query={units} empty={!units.data.length}/><label>Available matching unit<select required value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}><option value="">Choose a unit</option>{Array.isArray(units.data)&&units.data.map(u=><option key={u.storageUnitId} value={u.storageUnitId}>{u.unitCode} · {u.floorName} · {u.zone}</option>)}</select></label></>:<p>Assigned unit: {r.unitCode}</p>}{field('date','Check-in date (updates move-in date)','date')}{field('start','Start time (UTC+7)','time')}{field('end','End time (UTC+7)','time')}</>}
    {kind==='settings'&&<>{field('earlyCancelHours','Full refund cutoff (hours)','number',{min:0,max:720,step:1})}{field('lateCancelRefundPercent','Late cancellation refund (%)','number',{min:0,max:100,step:'any'})}{field('forfeitAfterDays','Days before final forfeiture','number',{min:3,max:14,step:1})}{field('approachingMinutes','Highlight before check-in (minutes)','number',{min:0,max:1440,step:1})}<p>New settings apply to future actions. Existing forfeiture deadlines are retained.</p></>}
    {kind==='deposit-received'&&<><p>Record money actually received. This does not collect a payment. A receipt can be recorded once.</p>{field('amount','Amount received (₫)','number',{min:0.01,max:9999999999.99,step:0.01})}{field('reference','Receipt / payment reference','text',{maxLength:100})}</>}
    {kind==='deposit-override'&&<><label>Outcome<select value={form.depositStatus} onChange={e=>setForm({...form,depositStatus:e.target.value})}>{['held','refund_due',...(r.status==='Expired'?['forfeit_pending']:[]),'forfeited'].map(s=><option key={s} value={s}>{s.replaceAll('_',' ')}</option>)}</select></label>{form.depositStatus==='refund_due'&&field('refundAmount','Refund amount (₫)','number',{min:0,max:r.depositAmount,step:0.01})}</>}
    {kind==='recover'&&<p>Keep move-in date {r.moveInDate}, clear the assigned unit and check-in window, and return to Pending. A forfeited deposit must first be overridden to held.</p>}
    {kind==='refund'&&<p>Confirm that {money(r.refundAmount)} has already been paid manually. This action records the payment; it does not send money.</p>}
    {kind==='resolve-contract'&&<p>This explicitly terminates this reservation’s draft contracts, including signed drafts. It does not cancel the reservation. Active contracts must be resolved in contract management.</p>}
    {kind==='reject'&&<p>The reservation will be hidden from all four queues. Its full deposit becomes refund due and remains accessible under Refunds due.</p>}
    {kind==='cancel'&&<p>Refund: at least {settings?.earlyCancelHours??48} hours before check-in, 100%; otherwise {settings?.lateCancelRefundPercent??50}%. The remainder is forfeited.</p>}
    {kind==='no-show'&&<p>The recorded deposit will be fully forfeited and the unit released.</p>}
    {!['confirm','schedule','settings','recover','deposit-received'].includes(kind)&&field('reason',kind==='refund'?'Payment reference / note':'Required reason','text',{maxLength:500})}
    </>}{error&&<p role="alert" className="rv-warning">{error}</p>}<footer><button type="button" disabled={busy} onClick={close}>Close</button>{kind!=='refunds'&&<button className="primary" disabled={busy||(kind==='confirm'&&(units.loading||!!units.error||!units.data.length))}>{busy?'Saving…':'Save'}</button>}</footer></form></dialog>;
}




