import {useEffect,useRef,useState} from 'react';
import {useData,write} from './common.jsx';
const ROOT='/api/reservation-management';
const today=()=>new Date(Date.now()+7*3600000).toISOString().slice(0,10);
export default function WalkInBooking({close,created}) {
  const dialog=useRef(null),saving=useRef(false);
  const options=useData(`${ROOT}/walk-in-options`);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const [form,setForm]=useState({customerName:'',email:'',phone:'',facilityId:'',unitTypeId:'',moveInDate:today(),rentalMonths:1,depositAmount:0,depositReference:''});
  useEffect(()=>{dialog.current.showModal();},[]);
  const facilities=options.data?.facilities??[],types=(options.data?.unitTypes??[]).filter(t=>t.facilityId===Number(form.facilityId));
  const update=(key,value)=>setForm(f=>({...f,[key]:value,...(key==='facilityId'?{unitTypeId:''}:{})}));
  const field=(key,label,type='text',props={})=><label>{label}<input value={form[key]} onChange={e=>update(key,e.target.value)} type={type} required {...props}/></label>;
  async function submit(event){
    event.preventDefault();if(saving.current)return;setError('');
    const body={...form,customerName:form.customerName.trim(),email:form.email.trim(),phone:form.phone.trim(),depositReference:form.depositReference.trim(),
      facilityId:Number(form.facilityId),unitTypeId:Number(form.unitTypeId),rentalMonths:Number(form.rentalMonths),depositAmount:Number(form.depositAmount)};
    if(!body.customerName||!body.email||!body.phone||(body.depositAmount>0&&!body.depositReference)){setError('Enter customer details and a receipt reference when a deposit was received.');return;}
    if(body.moveInDate<today()){setError('Move-in date cannot be in the past.');return;}
    saving.current=true;setBusy(true);
    try{const result=await write(`${ROOT}/walk-in`,'POST',body);created(result);}
    catch(e){setError(e.message);options.reload();}
    finally{saving.current=false;setBusy(false);}
  }
  return <dialog ref={dialog} className="rv-modal" aria-labelledby="walk-in-title" onCancel={e=>{e.preventDefault();if(!busy)close();}}><form onSubmit={submit}>
    <h2 id="walk-in-title">New walk-in booking</h2>
    <p>Creates a Pending reservation. Its RSV-XXXXX code is generated on save. Assign the unit and check-in window afterwards.</p>
    {options.loading&&<p role="status">Loading facilities and unit types…</p>}
    {options.error&&<p role="alert" className="rv-warning">{options.error} <button type="button" onClick={options.reload}>Retry</button></p>}
    {!options.loading&&!options.error&&!facilities.length&&<p>No active facilities are assigned to you. Ask a manager to check your facility assignment.</p>}
    <fieldset disabled={busy} style={{border:0,padding:0,margin:0,display:'grid',gap:15}}>
    {field('customerName','Customer name','text',{maxLength:100})}
    {field('email','Customer email','email',{maxLength:100})}
    {field('phone','Customer phone','tel',{maxLength:20,pattern:'\\+?[0-9 \\(\\)\\-]{6,20}',title:'6–20 characters: digits, spaces, +, parentheses or hyphens'})}
    <small>Use registered details for an existing customer. New customers get a contact profile; no login password is created.</small>
    <label>Facility<select required disabled={options.loading||!!options.error} value={form.facilityId} onChange={e=>update('facilityId',e.target.value)}><option value="">Choose a facility</option>{facilities.map(f=><option key={f.facilityId} value={f.facilityId}>{f.name}</option>)}</select></label>
    <label>Requested unit type<select required disabled={!form.facilityId||options.loading||!!options.error} value={form.unitTypeId} onChange={e=>update('unitTypeId',e.target.value)}><option value="">Choose a unit type</option>{types.map(t=><option key={t.unitTypeId} value={t.unitTypeId}>{t.code} · {t.areaM2} m² · {t.name}</option>)}</select></label>
    {form.facilityId&&!options.loading&&!options.error&&!types.length&&<p>No unit types currently have availability at this facility.</p>}
    {field('moveInDate','Requested move-in date (UTC+7)','date',{min:today()})}
    {field('rentalMonths','Period (months)','number',{min:1,max:36,step:1})}
    {field('depositAmount','Deposit received (₫)','number',{min:0,max:9999999999.99,step:0.01})}
    <small>Enter the amount actually received, or 0 if unpaid. This records a manual payment.</small>
    {Number(form.depositAmount)>0&&field('depositReference','Receipt / payment reference','text',{maxLength:100})}
    </fieldset>
    {error&&<p role="alert" className="rv-warning">{error}</p>}
    <footer><button type="button" disabled={busy} onClick={close}>Cancel</button><button className="primary" disabled={busy||options.loading||!!options.error||!facilities.length||!types.length}>{busy?'Creating…':'Create reservation'}</button></footer>
  </form></dialog>;
}

