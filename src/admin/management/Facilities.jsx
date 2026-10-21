import { useEffect, useState } from 'react';
import { ROOT, useData, State, Field, Badge, Pager, write, exportCsv, useUnsaved } from './common.jsx';

const blank = { code:'', name:'', address:'', district:'', phone:'', openingHours:'', status:'Active', photoUrls:[] };
function Floors({ facility, editable }) {
  const q = useData(ROOT + '/facilities/' + facility.facilityId + '/floors');
  const [form,setForm] = useState({ floorNumber:0, name:'' }), [id,setId] = useState(null);
  const [busy,setBusy] = useState(false), [error,setError] = useState('');
  const save = async e => {
    e.preventDefault(); setError(''); setBusy(true);
    try { if(!form.name.trim()) throw new Error('Floor name is required.');
      await write(ROOT + '/facilities/' + facility.facilityId + '/floors' + (id ? '/' + id : ''), id ? 'PUT':'POST', form);
      setForm({ floorNumber:0,name:'' }); setId(null); await q.reload();
    } catch(e){setError(e.message);} finally{setBusy(false);}
  };
  const remove = async floor => {
    if(!window.confirm('Delete floor ' + floor.name + '? Only an empty floor can be deleted.')) return;
    setBusy(true);setError('');
    try { await write(ROOT+'/facilities/'+facility.facilityId+'/floors/'+floor.floorId,'DELETE');await q.reload(); }
    catch(e){setError(e.message);}finally{setBusy(false);}
  };
  return <section><h2>Floors</h2><State query={q} empty="No floors yet. Add a floor before creating units." />
    {q.data.map(row=><div className="mg-floor-row" key={row.floorId}><span>{row.floorNumber} · {row.name}</span>{editable&&<div><button disabled={busy} onClick={()=>{setId(row.floorId);setForm({floorNumber:row.floorNumber,name:row.name});}}>Edit</button> <button disabled={busy} className="danger" onClick={()=>remove(row)}>Delete</button></div>}</div>)}
    {editable&&<form className="mg-form" onSubmit={save} style={{marginTop:18}}>
      <h2>{id?'Edit floor':'Add floor'}</h2>
      <Field label="Floor number" type="number" min="-10" max="200" step="1" required value={form.floorNumber} onChange={e=>setForm({...form,floorNumber:e.target.value===''?'':Number(e.target.value)})} />
      <Field label="Floor name" maxLength={50} required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} />
      {error&&<div className="mg-error" role="alert">{error}</div>}
      <button className="primary" disabled={busy}>{busy?'Saving…':'Save floor'}</button>
      {id&&<button type="button" onClick={()=>{setId(null);setForm({floorNumber:0,name:''});}}>Cancel edit</button>}
    </form>}
  </section>;
}
function FacilityPanel({ facility, editable, onClose, onSaved, onDirtyChange, openUnits }) {
  const initial = Object.fromEntries(Object.keys(blank).map(k=>[k,facility?.[k]??blank[k]]));
  const [form,setForm] = useState(initial), [tab,setTab] = useState('details');
  const [busy,setBusy] = useState(false), [error,setError] = useState('');
  const dirty = JSON.stringify(form)!==JSON.stringify(initial);
  useUnsaved(dirty,onDirtyChange);
  const close = ()=>{if(!dirty||window.confirm('Discard unsaved facility changes?'))onClose();};
  const set = (k,v)=>setForm(old=>({...old,[k]:v}));
  async function save(e) {
    e.preventDefault();setBusy(true);setError('');
    try {
      if(['code','name','address','district'].some(k=>!form[k].trim())) throw new Error('Code, name, address and district cannot be blank.');
      const photoUrls=form.photoUrls.map(x=>x.trim()).filter(Boolean);
      if(photoUrls.length>10||photoUrls.some(x=>{try{return x.length>2048||new URL(x).protocol!=='https:';}catch{return true;}}))throw new Error('Use up to 10 HTTPS photo URLs, each at most 2048 characters.');
      await write(ROOT+'/facilities'+(facility?'/'+facility.facilityId:''),facility?'PUT':'POST',{...form,photoUrls});
      await onSaved();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  return <aside className="mg-panel"><div className="mg-panel-heading"><div><h2>{facility?(editable?'Edit ':'')+facility.name:'Add facility'}</h2>{facility&&<Badge value={facility.status}/>}</div><button disabled={busy} onClick={close} aria-label="Close facility">×</button></div>
    {facility&&<div className="mg-tabs"><button className={tab==='details'?'selected':''} onClick={()=>setTab('details')}>Details</button><button className={tab==='floors'?'selected':''} onClick={()=>setTab('floors')}>Floors</button><button onClick={()=>{if(!dirty||window.confirm('Discard changes and view units?'))openUnits(facility.facilityId);}}>Units</button></div>}
    {tab==='floors'?<Floors facility={facility} editable={editable}/>:<form onSubmit={save}>
      <fieldset disabled={!editable||busy} style={{border:0,padding:0,margin:0,display:'grid',gap:15,minWidth:0}}>
      <Field label="Facility code" required maxLength={10} value={form.code} onChange={e=>set('code',e.target.value)}/>
      <Field label="Name" required maxLength={100} value={form.name} onChange={e=>set('name',e.target.value)}/>
      <Field label="Address" required maxLength={200} value={form.address} onChange={e=>set('address',e.target.value)}/>
      <Field label="District" required maxLength={50} value={form.district} onChange={e=>set('district',e.target.value)}/>
      <Field label="Phone" type="tel" maxLength={20} value={form.phone} onChange={e=>set('phone',e.target.value)}/>
      <Field label="Opening hours" maxLength={50} placeholder="08:00–20:00" value={form.openingHours} onChange={e=>set('openingHours',e.target.value)}/>
      <label>Status<select value={form.status} onChange={e=>set('status',e.target.value)}><option>Active</option><option>Inactive</option></select></label>
      <label>Photos · HTTPS URLs, one per line<textarea rows={4} value={form.photoUrls.join('\n')} onChange={e=>set('photoUrls',e.target.value.split('\n'))}/></label>
      </fieldset>
      {!!form.photoUrls.filter(Boolean).length&&<div className="mg-photos">{form.photoUrls.filter(x=>/^https:\/\//i.test(x)).map((url,i)=><img key={i} src={url} alt={'Facility photo '+(i+1)} loading="lazy" referrerPolicy="no-referrer"/>)}</div>}
      {form.status==='Inactive'&&<div className="mg-warning">Inactive facilities are hidden from customer search. Active rentals or reservations must be resolved first.</div>}
      {error&&<div className="mg-error" role="alert">{error}</div>}
      {editable&&<div className="mg-actions"><button type="button" disabled={busy} onClick={close}>Cancel</button><button className="primary" disabled={busy}>{busy?'Saving…':'Save facility'}</button></div>}
    </form>}
  </aside>;
}
export default function Facilities({ user, onDirtyChange, openUnits }) {
  const q=useData(ROOT+'/facilities?page=1&pageSize=500');
  const [search,setSearch]=useState(''),[district,setDistrict]=useState(''),[status,setStatus]=useState('');
  const [selected,setSelected]=useState(null),[adding,setAdding]=useState(false),[page,setPage]=useState(1),[notice,setNotice]=useState('');
  const [dirty,setDirty]=useState(false);
  useEffect(()=>{onDirtyChange?.(dirty);return()=>onDirtyChange?.(false);},[dirty,onDirtyChange]);
  const editable=user?.role==='SystemAdministrator';
  const rows=q.data?.items??q.data;
  const shown=rows.filter(f=>(!status||f.status===status)&&(!district||f.district===district)&&[f.name,f.address,f.code].some(x=>x.toLowerCase().includes(search.toLowerCase())));
  useEffect(()=>setPage(1),[search,district,status,rows.length]);
  const totals=rows.reduce((a,f)=>({units:a.units+f.totalUnits,occupied:a.occupied+f.occupiedUnits,available:a.available+f.availableUnits}),{units:0,occupied:0,available:0});
  const pick=(f)=>{if(dirty&&!window.confirm('Discard unsaved facility changes?'))return;setAdding(!f);setSelected(f);};
  const saved=async()=>{setSelected(null);setAdding(false);setDirty(false);setNotice('Facility saved.');await q.reload();};
  return <div className="mg-page">
    <header className="mg-heading"><div><h1>Facilities</h1><p>{rows.length} facilities · {totals.units} storage units</p></div><div className="mg-actions"><button disabled={q.loading||!!q.error} onClick={()=>exportCsv('facilities.csv',['Code','Name','Address','District','Units','Occupied','Status'],shown.map(f=>[f.code,f.name,f.address,f.district,f.totalUnits,f.occupiedUnits,f.status]))}>↓ Export</button>{editable&&<button className="primary" onClick={()=>pick(null)}>＋ Add facility</button>}</div></header>
    {notice&&<div className="mg-notice" role="status">{notice}</div>}
    <div className="mg-stats">{[['Facilities',rows.length],['Total units',totals.units],['Available units',totals.available],['Occupancy',totals.units?Math.round(totals.occupied/totals.units*100)+'%':'0%']].map(([label,value])=><div className="mg-stat" key={label}><span>{label}</span><strong>{q.loading?'…':q.error?'—':value}</strong><small>Across your facilities</small></div>)}</div>
    <div className="mg-filters"><input aria-label="Search facilities" placeholder="Search facility name or address" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="District" value={district} onChange={e=>setDistrict(e.target.value)}><option value="">All districts</option>{[...new Set(rows.map(f=>f.district))].map(d=><option key={d}>{d}</option>)}</select><select aria-label="Facility status" value={status} onChange={e=>setStatus(e.target.value)}><option value="">Status: All</option><option>Active</option><option>Inactive</option></select></div>
    <div className={selected||adding?'mg-split':''}><section className="mg-card"><div className="mg-table-wrap"><table><thead><tr>{['Facility','Address','Manager','Units','Occupancy','Status','Actions'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>
      {!q.loading&&!q.error&&shown.slice((page-1)*10,page*10).map(f=><tr key={f.facilityId} className={selected?.facilityId===f.facilityId?'chosen':''}><td><strong>{f.name}</strong><small>{f.code} · {f.district}</small></td><td>{f.address}<small>{f.openingHours||'Hours not set'}</small></td><td>{f.managerName||'Unassigned'}</td><td>{f.totalUnits}</td><td><div className="mg-progress"><meter value={f.occupiedUnits} max={f.totalUnits||1}/>{f.totalUnits?Math.round(f.occupiedUnits/f.totalUnits*100):0}%</div></td><td><Badge value={f.status}/></td><td><button onClick={()=>pick(f)}>{editable?'Edit':'View'}</button></td></tr>)}
    </tbody></table></div><State query={q} empty="No facilities yet. Add your first facility." />{!q.loading&&!q.error&&!!rows.length&&!shown.length&&<p className="mg-state">No facilities match these filters.</p>}<Pager page={page} setPage={setPage} total={shown.length}/></section>
      {(selected||adding)&&<FacilityPanel key={selected?.facilityId??'new'} facility={selected} editable={editable} onClose={()=>{setSelected(null);setAdding(false);}} onSaved={saved} onDirtyChange={setDirty} openUnits={openUnits}/>}
    </div>
  </div>;
}

