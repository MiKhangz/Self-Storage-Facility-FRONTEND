import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../auth.js';
import './PricingPage.css';

const ROOT = '/api/pricing-policies';
const money = value => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value);
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const defaults = () => ({ effectiveFrom: today(), effectiveTo: '', depositMonths: 1, graceDays: 3, noticeDays: 30,
  lateFeePercentPerWeek: 5, suspendAfterDays: 7, clearOutAfterDays: 60, cancelFreeHours: 48 });
const settingKeys = Object.keys(defaults());
const settingsOf = policy => Object.fromEntries(settingKeys.map(key => [key, policy[key] ?? '']));
const draftOf = policy => ({ settings: settingsOf(policy), unitPrices: policy.unitPrices.map(p => ({ unitTypeId: p.unitTypeId,
  basePricePerMonth: p.basePricePerMonth, discount3Month: p.discount3Month, discount6Month: p.discount6Month, discount12Month: p.discount12Month })),
  fees: policy.fees.map(f => ({ code: f.code, name: f.name, amount: f.amount, isPercentage: f.isPercentage,
    chargeWhen: f.chargeWhen || 'Booking', ruleDescription: f.ruleDescription || '' })) });
const json = body => ({ method: 'POST', body: JSON.stringify(body) });

function Modal({ title, children, onClose }) {
  const ref = useRef(null);
  useEffect(() => { ref.current.showModal(); }, []);
  return <dialog className="pricing-dialog" ref={ref} onCancel={e => { e.preventDefault(); onClose(); }}>
    <header><h2>{title}</h2><button type="button" aria-label="Close dialog" onClick={onClose}>×</button></header>{children}
  </dialog>;
}

function NumberField({ label, value, onChange, max, suffix, step = 1, min = 0 }) {
  return <label className="rule-row"><span>{label}</span><span className="number-wrap">
    <input aria-label={label} type="number" required min={min} max={max} step={step} value={value}
      onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))} /><small>{suffix}</small>
  </span></label>;
}

function PolicySettings({ values, change }) {
  const number = (key, label, max, suffix, step) => <NumberField key={key} label={label} value={values[key]}
    onChange={v => change(key, v)} max={max} suffix={suffix} step={step} />;
  return <>
    <section className="pricing-card"><h3><i>◷</i> Effective dates</h3>
      <label className="rule-row">Effective from<input aria-label="Effective from" type="date" required value={values.effectiveFrom} onChange={e => change('effectiveFrom', e.target.value)} /></label>
      <label className="rule-row">Effective to<input aria-label="Effective to" type="date" min={values.effectiveFrom} value={values.effectiveTo} onChange={e => change('effectiveTo', e.target.value)} /></label>
      <p className="pricing-hint">Leave the end date empty for an ongoing policy.</p>
    </section>
    <section className="pricing-card"><h3><i>◇</i> Deposit</h3>{number('depositMonths', 'Deposit amount', 12, 'months’ rent')}</section>
    <section className="pricing-card"><h3><i>↻</i> Notice period</h3>{number('noticeDays', 'Notice period', 365, 'days')}</section>
    <section className="pricing-card"><h3><i>×</i> Cancellation</h3>{number('cancelFreeHours', 'Free cancellation before move-in', 720, 'hours')}</section>
    <section className="pricing-card"><h3><i>△</i> Overdue handling</h3>
      {number('graceDays', 'Grace period', 90, 'days')}
      {number('lateFeePercentPerWeek', 'Late fee', 100, '% / week', 0.01)}
      {number('suspendAfterDays', 'Suspend access after', 365, 'days')}
      {number('clearOutAfterDays', 'Clear out unit after', 365, 'days')}
    </section>
  </>;
}

function UnitEditor({ unit, onClose, onSaved }) {
  const [value, setValue] = useState(unit || { code: '', name: '', areaM2: '', width: '', depth: '', height: '', isClimateControlled: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const change = (key, val) => setValue(old => ({ ...old, [key]: val }));
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const body = { ...value, code: value.code.trim(), name: value.name.trim() };
      if (!body.code || !body.name) throw new Error('Code and name cannot be blank.');
      await apiRequest(`/api/unit-types${unit ? `/${unit.unitTypeId}` : ''}`, { ...json(body), method: unit ? 'PUT' : 'POST' });
      await onSaved();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <Modal title={unit ? 'Edit unit type' : 'New unit type'} onClose={() => !busy && onClose()}>
    <form onSubmit={submit}><fieldset disabled={busy}>
      {error && <p role="alert" className="pricing-error">{error}</p>}
      <div className="unit-form-grid">
        <label>Code<input autoFocus required maxLength={10} value={value.code} onChange={e => change('code', e.target.value)} /></label>
        <label>Name<input required maxLength={50} value={value.name} onChange={e => change('name', e.target.value)} /></label>
        {['areaM2', 'width', 'depth', 'height'].map(key => <label key={key}>{({ areaM2: 'Area (m²)', width: 'Width (m)', depth: 'Depth (m)', height: 'Height (m)' })[key]}
          <input type="number" required min="0.01" max={key === 'areaM2' ? 999.99 : 99.99} step="0.01" value={value[key]} onChange={e => change(key, e.target.value === '' ? '' : Number(e.target.value))} /></label>)}
      </div>
      <label className="pricing-check"><input type="checkbox" checked={value.isClimateControlled} onChange={e => change('isClimateControlled', e.target.checked)} /> Climate controlled</label>
      <footer><button type="button" onClick={onClose}>Cancel</button><button className="primary" type="submit">{busy ? 'Saving…' : 'Save unit type'}</button></footer>
    </fieldset></form>
  </Modal>;
}

export default function PricingPage({ user, onDirtyChange }) {
  const [policies, setPolicies] = useState([]), [units, setUnits] = useState([]);
  const [policy, setPolicy] = useState(null), [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [history, setHistory] = useState(false), [newVersion, setNewVersion] = useState(false);
  const [unitEditor, setUnitEditor] = useState(null), [publish, setPublish] = useState(false);
  const [newSettings, setNewSettings] = useState(defaults), [modalError, setModalError] = useState('');
  const form = useRef(null);
  const allowed = ['SystemAdministrator', 'BusinessOperationsManager'].includes(user?.role);
  const editable = policy?.status === 'Draft';
  const dirty = Boolean(policy && draft && JSON.stringify(draft) !== JSON.stringify(draftOf(policy)));
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const select = useCallback(p => { setPolicy(p); setDraft(p ? draftOf(p) : null); }, []);
  const load = useCallback(async () => {
    setLoading(true); setLoadFailed(false); setError('');
    try {
      const [types, first] = await Promise.all([apiRequest('/api/unit-types'), apiRequest(`${ROOT}?pageSize=100`)]);
      const all = [...first.items];
      for (let page = 2; page <= first.totalPages; page++) all.push(...(await apiRequest(`${ROOT}?pageSize=100&page=${page}`)).items);
      setUnits(types); setPolicies(all); select(all.find(p => p.status === 'Draft') || all.find(p => p.status === 'Active') || all[0] || null);
    } catch (err) { setError(err.message); setLoadFailed(true); } finally { setLoading(false); }
  }, [select]);
  useEffect(() => { if (allowed) load(); else setLoading(false); }, [allowed, load]);
  const accept = p => { select(p); setPolicies(old => [p, ...old.filter(item => item.pricingPolicyId !== p.pricingPolicyId)].sort((a, b) => b.version - a.version)); };
  const changeSetting = (key, val) => setDraft(old => ({ ...old, settings: { ...old.settings, [key]: val } }));
  const changePrice = (id, key, val) => setDraft(old => {
    const found = old.unitPrices.find(p => p.unitTypeId === id);
    const row = { unitTypeId: id, basePricePerMonth: '', discount3Month: 0, discount6Month: 0, discount12Month: 0, ...found, [key]: val };
    return { ...old, unitPrices: found ? old.unitPrices.map(p => p.unitTypeId === id ? row : p) : [...old.unitPrices, row] };
  });
  const changeFee = (index, key, val) => setDraft(old => ({ ...old, fees: old.fees.map((fee, i) => i === index ? { ...fee, [key]: val } : fee) }));
  const valid = () => {
    if (!form.current.reportValidity()) return false;
    if (new Set(draft.fees.map(f => f.code)).size !== draft.fees.length) { setError('Fee codes must be unique within a policy.'); return false; }
    if (draft.fees.some(f => !f.name.trim())) { setError('Fee names cannot be blank.'); return false; }
    return true;
  };
  async function save(activate = false) {
    if (!valid()) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const saved = await apiRequest(`${ROOT}/${policy.pricingPolicyId}`, { method: 'PUT', body: JSON.stringify({ ...draft,
        settings: { ...draft.settings, effectiveTo: draft.settings.effectiveTo || null },
        unitPrices: draft.unitPrices.filter(p => p.basePricePerMonth !== '') }) });
      accept(saved);
      if (activate) {
        const active = await apiRequest(`${ROOT}/${saved.pricingPolicyId}/activate`, { method: 'POST' });
        // Refresh history too: publishing changes the previous active version.
        await load(); select(active); setPublish(false);
        setNotice(`Version ${active.version} published. The previous active version was superseded.`);
      } else setNotice('Draft saved. It is not active until you publish it.');
    } catch (err) { setError(err.message); setPublish(false); } finally { setBusy(false); }
  }
  async function create(e) {
    e.preventDefault(); setBusy(true); setModalError('');
    try {
      const created = await apiRequest(ROOT, json({ ...newSettings, effectiveTo: newSettings.effectiveTo || null }));
      accept(created); setNewVersion(false); setNotice('Draft created. Add unit prices and fees, then publish when ready.');
    } catch (err) { setModalError(err.message); } finally { setBusy(false); }
  }
  function openNew() {
    if (dirty && !window.confirm('Discard unsaved changes and create a new version?')) return;
    setNewSettings(defaults()); setModalError(''); setNewVersion(true);
  }
  async function removeUnit(unit) {
    if (!window.confirm(`Delete unit type ${unit.code}? Types used by storage units or pricing history cannot be deleted.`)) return;
    setBusy(true); setError('');
    try { await apiRequest(`/api/unit-types/${unit.unitTypeId}`, { method: 'DELETE' }); setUnits(await apiRequest('/api/unit-types')); setDraft(old => old ? { ...old, unitPrices: old.unitPrices.filter(p => p.unitTypeId !== unit.unitTypeId) } : old); setNotice('Unit type deleted.'); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  if (!allowed) return <div className="pricing-page"><h1>Unit Types & Pricing</h1><p role="alert">Only administrators and business operations managers can manage pricing.</p></div>;
  if (loading) return <div className="pricing-page" role="status"><h1>Unit Types & Pricing</h1><div className="pricing-skeleton">Loading policies and unit types…</div></div>;
  if (loadFailed) return <div className="pricing-page"><h1>Unit Types & Pricing</h1><div className="pricing-error" role="alert">{error || 'Could not load pricing data.'}<button onClick={load}>Retry loading</button></div></div>;

  return <div className="pricing-page">
    <header className="pricing-heading"><div><h1>Unit Types & Pricing</h1><p>Applies to all facilities{policy ? ` · Policy version ${policy.version} · ${policy.status}` : ' · No policy version yet'}</p></div>
      <div className="pricing-actions"><button disabled={busy} onClick={() => setHistory(true)}>◷ Version history</button><button disabled={busy} onClick={openNew}>＋ New pricing version</button>
        {editable && <><button disabled={busy || !dirty} form="pricing-form" type="submit">Save draft</button><button className="primary" disabled={busy || !draft.unitPrices.some(p => p.basePricePerMonth !== '')} onClick={() => { if (valid()) setPublish(true); }}>✓ Publish changes</button></>}
      </div>
    </header>
    {error && <div className="pricing-error" role="alert">{error} {!policy && <button onClick={load}>Retry loading</button>}</div>}
    {notice && <div className="pricing-success" role="status">{notice}</div>}
    <div className="pricing-banner">ⓘ {dirty ? 'You have unsaved changes. ' : editable ? 'This version is an unpublished draft. ' : 'Published versions are read-only. '}
      Create a new version to change published prices. Existing contracts keep their agreed price.</div>

    <section className="pricing-card unit-catalog"><div className="card-heading"><div><h3>Unit type catalog</h3><p>Create and manage codes, areas, dimensions and climate control. Set monthly prices below.</p></div><button disabled={busy} onClick={() => setUnitEditor({})}>＋ Add unit type</button></div>
      {!units.length ? <div className="pricing-empty">No unit types yet. Add your first size to start setting rental prices.</div> : <div className="pricing-table-scroll"><table><thead><tr><th>Code</th><th>Name</th><th>Area</th><th>W × D × H</th><th>Climate control</th><th>Actions</th></tr></thead><tbody>
        {units.map(u => <tr key={u.unitTypeId}><td><strong>{u.code}</strong></td><td>{u.name}</td><td>{u.areaM2} m²</td><td>{u.width} × {u.depth} × {u.height} m</td><td>{u.isClimateControlled ? 'Yes' : 'No'}</td><td><button disabled={busy} onClick={() => setUnitEditor({ unit: u })}>Edit</button> <button className="text-danger" disabled={busy} onClick={() => removeUnit(u)}>Delete</button></td></tr>)}
      </tbody></table></div>}
    </section>

    {!policy ? <section className="pricing-card pricing-empty"><h2>No pricing policies yet</h2><p>Create a version with an effective date, then add prices and fee rules.</p><button className="primary" onClick={openNew}>Create first version</button></section> :
      <form id="pricing-form" ref={form} onSubmit={e => { e.preventDefault(); save(); }}><fieldset disabled={busy || !editable} className="pricing-columns">
        <div className="pricing-main"><section className="pricing-card"><div className="card-heading"><div><h3>Rental price table</h3><p>Base monthly rent in VND. Discounts apply by rental duration.</p></div><span className={`status-pill ${policy.status.toLowerCase()}`}>{policy.status}</span></div>
          {!units.length ? <p className="pricing-empty">Add a unit type above to configure its price.</p> : <div className="pricing-table-scroll"><table className="rental-table"><thead><tr><th>Size / area</th><th>1 month (₫)</th><th>3–5 months</th><th>6–11 months</th><th>12+ months</th><th>Change</th></tr></thead><tbody>
            {units.map(u => { const p = draft.unitPrices.find(p => p.unitTypeId === u.unitTypeId); const initial = policy.unitPrices.find(p => p.unitTypeId === u.unitTypeId); const changed = p && ['basePricePerMonth', 'discount3Month', 'discount6Month', 'discount12Month'].some(k => p[k] !== initial?.[k]);
              return <tr key={u.unitTypeId}><td><strong>{u.code}</strong><small>{u.areaM2} m²</small></td><td><input aria-label={`${u.code} monthly price`} className={changed ? 'changed-input' : ''} type="number" min="0" max="9999999999.99" step="0.01" placeholder="Not set" value={p?.basePricePerMonth ?? ''} onChange={e => changePrice(u.unitTypeId, 'basePricePerMonth', e.target.value === '' ? '' : Number(e.target.value))} /></td>
                {['discount3Month', 'discount6Month', 'discount12Month'].map((key, i) => <td key={key}><span className="discount-input"><input aria-label={`${u.code} ${[3, 6, 12][i]} month discount`} type="number" min="0" max="100" step="0.01" required={p?.basePricePerMonth !== undefined && p?.basePricePerMonth !== ''} value={p?.[key] ?? 0} onChange={e => changePrice(u.unitTypeId, key, e.target.value === '' ? '' : Number(e.target.value))} /><small>%</small></span><small>{p?.basePricePerMonth !== '' && p?.basePricePerMonth !== undefined ? `${money(p.basePricePerMonth * (1 - Number(p[key]) / 100))} ₫/mo` : 'Not priced'}</small></td>)}
                <td>{changed ? <span className="changed-pill">● Changed</span> : <span className="pricing-hint">—</span>}</td></tr>;
            })}</tbody></table></div>}
          <p className="pricing-hint">Leave a base price blank to exclude that unit type from this version. Enter 0 only for a free rental. At least one price is required to publish.</p>
        </section>
        <section className="pricing-card"><div className="card-heading"><div><h3>Extra fees</h3><p>Fixed charges or percentages of the rental subtotal.</p></div><button type="button" onClick={() => setDraft(old => ({ ...old, fees: [...old.fees, { code: '', name: '', amount: 0, isPercentage: false, chargeWhen: 'Manual', ruleDescription: '' }] }))}>＋ Add fee</button></div>
          {!draft.fees.length && <p className="pricing-empty">No extra fees in this version. Add a lock replacement, cleaning or other charge.</p>}
          {draft.fees.map((fee, i) => <div className="fee-editor" key={i}>
            <div className="fee-grid"><label>Code<input aria-label={`Fee ${i + 1} code`} required maxLength={20} pattern="[A-Z0-9_\-]+" title="Uppercase letters, numbers, underscores or hyphens" value={fee.code} onChange={e => changeFee(i, 'code', e.target.value.toUpperCase())} /></label>
              <label>Name<input required maxLength={50} value={fee.name} onChange={e => changeFee(i, 'name', e.target.value)} placeholder="Lost key / card" /></label>
              <label>Amount<input type="number" required min="0" max={fee.isPercentage ? 100 : 9999999999.99} step="0.01" value={fee.amount} onChange={e => changeFee(i, 'amount', e.target.value === '' ? '' : Number(e.target.value))} /></label>
              <label>Calculation<select value={String(fee.isPercentage)} onChange={e => changeFee(i, 'isPercentage', e.target.value === 'true')}><option value="false">Fixed amount (₫)</option><option value="true">Rental subtotal (%)</option></select></label>
              <label>Charge condition<select value={fee.chargeWhen} onChange={e => changeFee(i, 'chargeWhen', e.target.value)}><option value="Booking">At booking</option><option value="LostKey">Lost key / lock replacement</option><option value="MoveOut">On return / move-out</option><option value="Manual">Manual charge</option></select></label>
              <label className="fee-rule">Rule / instructions<input maxLength={300} value={fee.ruleDescription} onChange={e => changeFee(i, 'ruleDescription', e.target.value)} placeholder="When a key is lost, charge once per replacement." /></label>
            </div><button className="text-danger" type="button" onClick={() => setDraft(old => ({ ...old, fees: old.fees.filter((_, n) => n !== i) }))}>Remove fee</button>
          </div>)}
          <p className="pricing-hint">Only “At booking” fees are included in booking quotes. Other conditions define charges for staff to apply when the event occurs. Late fees are configured under Overdue handling.</p>
        </section></div>
        <aside className="pricing-rules"><details className="pricing-card"><summary>Version dates &amp; rental rules</summary><PolicySettings values={draft.settings} change={changeSetting} /></details></aside>
      </fieldset></form>}
    {history && <Modal title="Version history" onClose={() => setHistory(false)}><p className="pricing-hint">Select a draft to edit, or a published version to inspect.</p>
      {!policies.length ? <p className="pricing-empty">No versions created yet.</p> : <div className="history-list">{policies.map(p => <button key={p.pricingPolicyId} onClick={() => {
        if (dirty && !window.confirm('Discard unsaved changes and switch versions?')) return;
        select(p); setHistory(false); setError(''); setNotice('');
      }}><strong>Version {p.version}</strong><span>{p.effectiveFrom} → {p.effectiveTo || 'Ongoing'}</span><span className={`status-pill ${p.status.toLowerCase()}`}>{p.status}</span></button>)}</div>}
    </Modal>}
    {newVersion && <Modal title="Create pricing policy version" onClose={() => !busy && setNewVersion(false)}><form onSubmit={create}><fieldset disabled={busy}>
      <p className="pricing-hint">Create a blank draft. Prices and fees are configured after creation. Publishing replaces the currently active version.</p>
      {modalError && <p className="pricing-error" role="alert">{modalError}</p>}
      <PolicySettings values={newSettings} change={(key, val) => setNewSettings(old => ({ ...old, [key]: val }))} />
      <footer><button type="button" onClick={() => setNewVersion(false)}>Cancel</button><button className="primary" type="submit">{busy ? 'Creating…' : 'Create draft'}</button></footer>
    </fieldset></form></Modal>}
    {unitEditor && <UnitEditor unit={unitEditor.unit} onClose={() => setUnitEditor(null)} onSaved={async () => { setUnits(await apiRequest('/api/unit-types')); setUnitEditor(null); setNotice('Unit type saved.'); }} />}
    {publish && <Modal title={`Publish version ${policy.version}?`} onClose={() => !busy && setPublish(false)}><p>This saves your changes and makes version {policy.version} the only active pricing policy, with an effective date of {draft.settings.effectiveFrom}.</p><p>The previous active version will be superseded. Existing contract prices stay unchanged.</p><footer><button disabled={busy} onClick={() => setPublish(false)}>Cancel</button><button className="primary" disabled={busy} onClick={() => save(true)}>{busy ? 'Publishing…' : 'Publish version'}</button></footer></Modal>}
  </div>;
}


