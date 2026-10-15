import { useEffect, useState } from 'react';
import { ROOT,useData,State,Field,Badge,Pager,write,money,exportCsv,useUnsaved } from './common.jsx';
import { importUnits } from './csv.js';
const STATUSES=['Available','Occupied','Reserved','Maintenance','Retired'];
function UnitPanel({unit,facilityId,facilities,types,onClose,onSaved,onDirtyChange}){
  const initial={facilityId:unit?.facilityId??Number(facilityId),floorId:unit?.floorId??'',unitTypeId:unit?.unitTypeId??'',unitCode:unit?.unitCode??'',zone:unit?.zone??'',currentPrice:unit?.currentPrice??0,status:unit?.status??'Available',note:unit?.note??''};
  const [form,setForm]=useState(initial),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const floors=useData(form.facilityId?ROOT+'/facilities/'+form.facilityId+'/floors':null);
  const locked=unit?.isLocked,dirty=JSON.stringify(form)!==JSON.stringify(initial);
  useUnsaved(dirty,onDirtyChange);
  const type=types.find(t=>t.unitTypeId===Number(form.unitTypeId));
  const set=(k,v)=>setForm(s=>({...s,[k]:v}));
  const close=()=>{if(!dirty||window.confirm('Discard unsaved unit changes?'))onClose();};
  async function submit(e){e.preventDefault();setBusy(true);setError('');
    try{if(!form.unitCode.trim())throw new Error('Unit code cannot be blank.');
      await write(ROOT+'/units'+(unit?'/'+unit.storageUnitId:''),unit?'PUT':'POST',{...form,floorId:Number(form.floorId),unitTypeId:Number(form.unitTypeId),facilityId:Number(form.facilityId)});
      await onSaved();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  return <aside className="mg-panel"><div className="mg-panel-heading"><div><h2>{unit?'Edit unit '+unit.unitCode:'Add storage unit'}</h2>{unit&&<Badge value={unit.status}/>}</div><button disabled={busy} aria-label="Close unit" onClick={close}>×</button></div>
    <form onSubmit={submit}><fieldset disabled={busy} style={{border:0,padding:0,margin:0,minWidth:0,display:'grid',gap:15}}>
      <label>Facility<select required disabled={!!unit} value={form.facilityId||''} onChange={e=>setForm({...form,facilityId:Number(e.target.value),floorId:''})}><option value="">Select facility</option>{facilities.filter(f=>f.status==='Active'||f.facilityId===unit?.facilityId).map(f=><option key={f.facilityId} value={f.facilityId}>{f.name}</option>)}</select></label>
      <div className="mg-form-grid"><Field label="Unit code" required maxLength={20} value={form.unitCode} onChange={e=>set('unitCode',e.target.value)}/>
      <label>Floor<select required disabled={locked||floors.loading||!!floors.error} value={form.floorId} onChange={e=>set('floorId',Number(e.target.value))}><option value="">Select floor</option>{floors.data.map(f=><option key={f.floorId} value={f.floorId}>{f.name} · {f.floorNumber}</option>)}</select></label>
      <Field label="Zone" maxLength={10} value={form.zone} onChange={e=>set('zone',e.target.value)}/>
      <label>Unit type<select required disabled={locked} value={form.unitTypeId} onChange={e=>set('unitTypeId',Number(e.target.value))}><option value="">Select size</option>{types.map(t=><option key={t.unitTypeId} value={t.unitTypeId}>{t.code} · {t.areaM2} m²</option>)}</select></label></div>
      {form.facilityId>0&&<State query={floors} empty="No floors. Ask an administrator to add one under Facilities."/>}
      {type&&<div><label>Dimensions (W × D × H)<input readOnly value={type.width+' × '+type.depth+' × '+type.height+' m'}/></label><p className="mg-muted">{type.isClimateControlled?'Climate-controlled':'Standard climate'} · Dimensions come from the unit type.</p></div>}
      <Field label="Monthly price (₫)" type="number" min="0" max="9999999999.99" step="0.01" required disabled={locked} value={form.currentPrice} onChange={e=>set('currentPrice',e.target.value===''?'':Number(e.target.value))}/>
      <p className="mg-muted">This is the unit reference price. Booking quotes use the effective version in Unit Types &amp; Pricing.</p>
      <label>Status<select disabled={locked} value={form.status} onChange={e=>set('status',e.target.value)}>{(locked?STATUSES:['Available','Maintenance','Retired']).map(s=><option key={s}>{s}</option>)}</select></label>
      <label>Notes<textarea maxLength={200} value={form.note} onChange={e=>set('note',e.target.value)}/></label>
      {locked&&<div className="mg-warning">Status, floor, type and price are locked while this unit has an active reservation or contract.</div>}
    </fieldset>
    {error&&<div className="mg-error" role="alert">{error}</div>}
    <div className="mg-actions"><button type="button" disabled={busy} onClick={close}>Cancel</button><button className="primary" disabled={busy||floors.loading||!!floors.error||!floors.data.length||!types.length}>{busy?'Saving…':'Save changes'}</button></div></form>
  </aside>;
}
function ImportPanel({facilityId,types,onClose,onSaved}){
  const floors=useData(ROOT+'/facilities/'+facilityId+'/floors');
  const [rows,setRows]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function read(e){setRows([]);setError('');const file=e.target.files?.[0];if(!file)return;
    try{if(file.size>1024*1024)throw new Error('CSV must be smaller than 1 MB.');setRows(importUnits(await file.text(),facilityId,floors.data,types));}
    catch(e){setError(e.message);}e.target.value='';
  }
  async function save(){setBusy(true);setError('');try{await write(ROOT+'/units/bulk','POST',{units:rows});await onSaved();}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <aside className="mg-panel"><div className="mg-panel-heading"><h2>Import storage units</h2><button disabled={busy} aria-label="Close import" onClick={onClose}>×</button></div>
    <p>Import up to 200 new units at this facility. All rows save together; an invalid row rejects the entire import.</p>
    <State query={floors} empty="Add a floor before importing units."/>
    <button onClick={()=>exportCsv('storage-units-template.csv',['unitCode','floorNumber','unitTypeCode','zone','currentPrice','status','note'],[['A-001',floors.data[0]?.floorNumber??0,types[0]?.code??'S','A',500000,'Available','']])}>Download template</button>
    <label className="mg-file" style={{marginTop:15}}>Choose CSV<input type="file" accept=".csv,text/csv" disabled={busy||floors.loading||!!floors.error||!floors.data.length} onChange={read}/></label>
    {error&&<div className="mg-error" role="alert">{error}</div>}
    {!!rows.length&&<><p>{rows.length} units ready to import.</p><div className="mg-table-wrap"><table><thead><tr><th>Code</th><th>Price</th><th>Status</th></tr></thead><tbody>{rows.slice(0,10).map(r=><tr key={r.unitCode}><td>{r.unitCode}</td><td>{money(r.currentPrice)}</td><td>{r.status}</td></tr>)}</tbody></table></div>{rows.length>10&&<p>Showing the first 10 rows.</p>}<button className="primary" disabled={busy} onClick={save}>{busy?'Importing…':'Import '+rows.length+' units'}</button></>}
  </aside>;
}
export default function Units({user,initialFacilityId,onDirtyChange}){
  const units=useData(ROOT+'/units'),facilities=useData(ROOT+'/facilities'),types=useData('/api/unit-types');
  const [facilityId,setFacilityId]=useState(initialFacilityId?String(initialFacilityId):''),[status,setStatus]=useState(''),[search,setSearch]=useState(''),[size,setSize]=useState(''),[floor,setFloor]=useState(''),[price,setPrice]=useState(''),[grid,setGrid]=useState(false),[page,setPage]=useState(1);
  const [selected,setSelected]=useState(null),[adding,setAdding]=useState(false),[importing,setImporting]=useState(false),[notice,setNotice]=useState(''),[dirty,setDirty]=useState(false);
  useEffect(()=>{onDirtyChange?.(dirty);return()=>onDirtyChange?.(false);},[dirty,onDirtyChange]);
  const editable=['SystemAdministrator','FacilityManager'].includes(user?.role);
  const scoped=units.data.filter(u=>!facilityId||u.facilityId===Number(facilityId));
  const shown=scoped.filter(u=>(!status||u.status===status)&&(!size||u.unitTypeId===Number(size))&&(!floor||u.floorId===Number(floor))&&
    (!price||(price==='low'?u.currentPrice<1000000:price==='mid'?u.currentPrice>=1000000&&u.currentPrice<3000000:u.currentPrice>=3000000))&&
    [u.unitCode,u.customerName??''].some(x=>x.toLowerCase().includes(search.toLowerCase())));
  useEffect(()=>setPage(1),[facilityId,status,search,size,floor,price,units.data.length]);
  const floors=[...new Map(scoped.map(u=>[u.floorId,{id:u.floorId,name:u.floorName}])).values()];
  const pick=u=>{if(dirty&&!window.confirm('Discard unsaved unit changes?'))return;setSelected(u);setAdding(!u);setImporting(false);};
  const saved=async()=>{setSelected(null);setAdding(false);setImporting(false);setDirty(false);setNotice('Storage units saved.');await Promise.all([units.reload(),facilities.reload()]);};
  const blocked=units.loading||facilities.loading||types.loading||units.error||facilities.error||types.error;
  return <div className="mg-page"><header className="mg-heading"><div><h1>Storage units</h1><p>{facilityId?facilities.data.find(f=>f.facilityId===Number(facilityId))?.name:'All facilities'} · {scoped.length} units on {floors.length} floors</p></div>{editable&&<div className="mg-actions"><button disabled={!facilityId||!!blocked} title={!facilityId?'Select a facility first':''} onClick={()=>{if(dirty&&!window.confirm('Discard unit changes?'))return;setSelected(null);setAdding(false);setImporting(true);}}>↑ Import CSV</button><button className="primary" disabled={!!blocked||!facilities.data.some(f=>f.status==='Active')} onClick={()=>pick(null)}>＋ Add unit</button></div>}</header>
    {notice&&<div className="mg-notice" role="status">{notice}</div>}
    <div className="mg-chips">{['',...STATUSES].map(s=><button key={s} className={status===s?'selected':''} onClick={()=>setStatus(s)}>{s||'All'}　{scoped.filter(u=>!s||u.status===s).length}</button>)}</div>
    <div className="mg-filters"><input placeholder="Search unit code or customer" aria-label="Search units" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Facility" value={facilityId} disabled={adding||!!selected||importing} onChange={e=>{setFacilityId(e.target.value);setFloor('');}}><option value="">All facilities</option>{facilities.data.map(f=><option key={f.facilityId} value={f.facilityId}>{f.name}</option>)}</select><select aria-label="Unit size" value={size} onChange={e=>setSize(e.target.value)}><option value="">All sizes</option>{types.data.map(t=><option key={t.unitTypeId} value={t.unitTypeId}>{t.code}</option>)}</select><select aria-label="Floor" value={floor} onChange={e=>setFloor(e.target.value)}><option value="">All floors</option>{floors.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select><select aria-label="Price range" value={price} onChange={e=>setPrice(e.target.value)}><option value="">Price range</option><option value="low">Under 1M ₫</option><option value="mid">1M–3M ₫</option><option value="high">3M+ ₫</option></select><button aria-pressed={!grid} onClick={()=>setGrid(false)}>☰ List</button><button aria-pressed={grid} onClick={()=>setGrid(true)}>▦ Grid</button></div>
    {(facilities.loading||facilities.error)&&<State query={facilities}/>} {(types.loading||types.error)&&<State query={types}/>}
    <div className={selected||adding||importing?'mg-split':''}><section className="mg-card">
      {!units.loading&&!units.error&&(grid?<div className="mg-unit-grid">{shown.slice((page-1)*10,page*10).map(u=><button className={'mg-unit-tile '+u.status} key={u.storageUnitId} onClick={()=>editable&&pick(u)}><strong>{u.unitCode}</strong><Badge value={u.status}/><small>{u.unitTypeCode} · {u.areaM2} m² · {u.floorName}</small><span>{money(u.currentPrice)}</span></button>)}</div>:<div className="mg-table-wrap"><table><thead><tr>{['Unit','Size','Floor','Price / mo','Status','Customer','Contract end',...(editable?['']:[])].map((h,i)=><th key={i}>{h}</th>)}</tr></thead><tbody>{shown.slice((page-1)*10,page*10).map(u=><tr key={u.storageUnitId} className={selected?.storageUnitId===u.storageUnitId?'chosen':''}><td><strong>{u.unitCode}</strong>{!facilityId&&<small>{u.facilityName}</small>}</td><td>{u.unitTypeCode} · {u.areaM2} m²</td><td>{u.floorName}{u.zone?' · '+u.zone:''}</td><td>{money(u.currentPrice)}</td><td><Badge value={u.status}/></td><td>{u.customerName||'—'}</td><td>{u.contractEnd||'—'}</td>{editable&&<td><button aria-label={'Edit '+u.unitCode} onClick={()=>pick(u)}>✎</button></td>}</tr>)}</tbody></table></div>)}
      <State query={units} empty="No storage units yet. Create a facility and floor, then add units."/>
      {!units.loading&&!units.error&&!!units.data.length&&!shown.length&&<p className="mg-state">No units match these filters.</p>}
      <Pager page={page} setPage={setPage} total={shown.length}/></section>
      {(selected||adding)&&<UnitPanel key={selected?.storageUnitId??'new'} unit={selected} facilityId={facilityId} facilities={facilities.data} types={types.data} onClose={()=>{setSelected(null);setAdding(false);}} onSaved={saved} onDirtyChange={setDirty}/>}
      {importing&&<ImportPanel facilityId={Number(facilityId)} types={types.data} onClose={()=>setImporting(false)} onSaved={saved}/>}
    </div>
  </div>;
}

