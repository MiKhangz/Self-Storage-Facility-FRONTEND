import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { facilitiesApi, storageUnitsApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import { useAuth } from '../../features/auth/AuthContext';
import { Roles } from '../../features/auth/roles';
import Icon from '../../customer/components/Icon.jsx';
import { formatVnd, todayIso } from '../../customer/components/format.js';
import { initials } from '../../customer/layout/CustomerLayout.jsx';
import { PageHeader, Stat, Status, Modal } from '../components/ui.jsx';
import { useShifts, useSizePrices, useStaff, useTickets, useUnitTypes, useUnits } from '../queries.js';
import { FACILITY_FIELDS } from './PendingBackendPages.jsx';
import { occupancy } from './DashboardPage.jsx';

/** Rented / total per group, with the occupancy of the rentable units in it. */
function group(units, key) {
    const out = {};
    for (const u of units) {
        const g = (out[u[key]] ??= { units: [], label: u[key] });
        g.units.push(u);
    }
    return Object.values(out).map((g) => ({ ...g, rented: g.units.filter((u) => u.status === 'Occupied').length, free: g.units.filter((u) => u.status === 'Available').length }));
}

const Field = ({ label, children }) => <label><span className="se-label">{label}</span><div className="se-input">{children}</div></label>;

/** Floors of the facility and the forms that add a floor or a unit (facility managers and admins). */
function FloorsAndUnits({ facilityId, onClose }) {
    const queryClient = useQueryClient();
    const floors = useQuery({ queryKey: ['facilities', facilityId, 'floors'], queryFn: () => facilitiesApi.getFloors(facilityId) });
    const types = useUnitTypes().data ?? [];
    const list = [...(floors.data ?? [])].sort((a, b) => a.floorNumber - b.floorNumber);

    const [floor, setFloor] = useState({ floorNumber: '', name: '' });
    const addFloor = useMutation({
        mutationFn: () => facilitiesApi.postFloors(facilityId, { floorNumber: Number(floor.floorNumber), name: floor.name.trim() || null }),
        onSuccess: (created) => {
            queryClient.invalidateQueries({ queryKey: ['facilities', facilityId, 'floors'] });
            setFloor({ floorNumber: '', name: '' });
            setUnit((u) => ({ ...u, floorId: String(created.floorId) }));
        },
    });

    const [unit, setUnit] = useState({ floorId: '', unitTypeId: '', unitCode: '', zone: '' });
    const setU = (key) => (e) => setUnit({ ...unit, [key]: e.target.value });
    const addUnit = useMutation({
        mutationFn: () => storageUnitsApi.create({
            facilityId, floorId: Number(unit.floorId), unitTypeId: Number(unit.unitTypeId),
            unitCode: unit.unitCode.trim(), zone: unit.zone.trim() || null, note: null,
        }),
        onSuccess: () => {
            // The floor's unit count, the facility's available count and the unit lists all change.
            ['storage-units', 'facilities'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
            setUnit((u) => ({ ...u, unitCode: '' })); // keep floor, size, zone and price for the next unit in a row
        },
    });

    return (
        <section className="se-panel">
            <div className="sa-card-title"><h2>Floors &amp; units</h2><button type="button" className="sa-close" onClick={onClose} aria-label="Close">×</button></div>
            <div className="sa-floors-grid">
            <div>
            <h3>Floors</h3>
            <ul className="sa-people">
                {list.map((f) => <li key={f.floorId}><span>Floor {f.floorNumber}{f.name ? ` · ${f.name}` : ''}</span><small>{f.unitCount} units</small></li>)}
                {!list.length && <li className="sa-muted">{floors.isLoading ? 'Loading…' : 'No floors yet. Add one, then add its units.'}</li>}
            </ul>
            </div>

            <form className="se-form sa-setup-card blue" onSubmit={(e) => { e.preventDefault(); addFloor.mutate(); }}>
                <h3>Add floor</h3>
                <div className="se-panel-grid">
                    <Field label="Floor number *"><input type="number" min={-5} max={200} required value={floor.floorNumber} onChange={(e) => setFloor({ ...floor, floorNumber: e.target.value })} /></Field>
                    <Field label="Name"><input maxLength={50} placeholder="e.g. Tầng 1" value={floor.name} onChange={(e) => setFloor({ ...floor, name: e.target.value })} /></Field>
                </div>
                {addFloor.isError && <div className="se-alert" role="alert">{errorMessage(addFloor.error)}</div>}
                <div className="sa-form-actions"><button type="submit" className="se-btn sa-btn-blue" disabled={addFloor.isPending}>{addFloor.isPending ? 'Adding…' : 'Add floor'}</button></div>
            </form>

            <form className="se-form sa-setup-card orange" onSubmit={(e) => { e.preventDefault(); addUnit.mutate(); }}>
                <h3>Add unit</h3>
                <div className="se-panel-grid">
                    <Field label="Floor *">
                        <select required value={unit.floorId} onChange={setU('floorId')} disabled={!list.length}>
                            <option value="">Choose a floor</option>
                            {list.map((f) => <option key={f.floorId} value={f.floorId}>Floor {f.floorNumber}{f.name ? ` · ${f.name}` : ''}</option>)}
                        </select>
                    </Field>
                    <Field label="Size *">
                        <select required value={unit.unitTypeId} onChange={setU('unitTypeId')}>
                            <option value="">Choose a size</option>
                            {types.map((t) => <option key={t.unitTypeId} value={t.unitTypeId}>{t.code} · {t.areaM2} m² · {formatVnd(t.monthlyPrice)}/mo</option>)}
                        </select>
                    </Field>
                    <Field label="Unit code *"><input required maxLength={20} pattern="[A-Za-z0-9\-]+" title="Letters, digits and dashes" placeholder="e.g. B-201" value={unit.unitCode} onChange={setU('unitCode')} /></Field>
                    <Field label="Zone"><input maxLength={10} value={unit.zone} onChange={setU('zone')} /></Field>
                </div>
                {addUnit.isError && <div className="se-alert" role="alert">{errorMessage(addUnit.error)}</div>}
                {addUnit.isSuccess && <div className="se-alert info" role="status">Unit {addUnit.data.unitCode} added and available to book.</div>}
                <p className="se-hint">The rent comes from the size's price in Pricing &amp; Policies.</p>
                <div className="sa-form-actions"><button type="submit" className="se-btn se-btn-primary" disabled={addUnit.isPending || !list.length}>{addUnit.isPending ? 'Adding…' : 'Add unit'}</button></div>
            </form>
            </div>
        </section>
    );
}

/** Admin-only: change the facility's details and manager, or take it offline. */
function EditFacility({ facility, onClose }) {
    const queryClient = useQueryClient();
    const managers = useStaff({ role: Roles.FacilityManager }).data ?? [];
    const [form, setForm] = useState(() => ({
        ...Object.fromEntries(FACILITY_FIELDS.map(([k]) => [k, facility[k] ?? ''])),
        managerId: facility.managerId ? String(facility.managerId) : '',
    }));
    const done = { onSuccess: () => queryClient.invalidateQueries({ queryKey: ['facilities'] }) };
    const save = useMutation({
        mutationFn: () => facilitiesApi.update(facility.facilityId, {
            ...Object.fromEntries(FACILITY_FIELDS.map(([k]) => [k, form[k].trim() || null])),
            managerId: form.managerId ? Number(form.managerId) : null,
        }),
        ...done,
    });
    const active = facility.status === 'Active';
    const toggle = useMutation({ mutationFn: () => (active ? facilitiesApi.deactivate : facilitiesApi.activate)(facility.facilityId), ...done });

    return (
        <section className="se-panel">
            <div className="sa-card-title"><h2>Edit facility</h2><button type="button" className="sa-close" onClick={onClose} aria-label="Close">×</button></div>
            <form className="se-form" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
                <div className="se-panel-grid sa-grid-3">
                    {FACILITY_FIELDS.map(([key, label, required]) => (
                        <Field key={key} label={`${label}${required ? ' *' : ''}`}>
                            <input value={form[key]} required={required} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                        </Field>
                    ))}
                    <Field label="Manager">
                        <select value={form.managerId} onChange={(e) => setForm({ ...form, managerId: e.target.value })}>
                            <option value="">No manager</option>
                            {managers.map((m) => <option key={m.userId} value={m.userId}>{m.fullName} · {m.email}</option>)}
                        </select>
                    </Field>
                </div>
                {[save, toggle].map((m, i) => m.isError && <div key={i} className="se-alert" role="alert">{errorMessage(m.error)}</div>)}
                {save.isSuccess && <div className="se-alert info" role="status">Facility saved.</div>}
                <div className="sa-form-actions">
                    <button type="button" className="se-btn se-btn-ghost" disabled={toggle.isPending}
                        onClick={() => (!active || window.confirm(`Deactivate ${facility.name}? Customers can no longer find or book it.`)) && toggle.mutate()}>
                        {active ? 'Deactivate facility' : 'Activate facility'}
                    </button>
                    <button type="submit" className="se-btn se-btn-primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save facility'}</button>
                </div>
            </form>
        </section>
    );
}

/** A12: one facility — floors, unit mix, open tickets and who is on shift today. */
export default function FacilityDetailPage() {
    const facilityId = Number(useParams().facilityId);
    const today = todayIso();
    // By id, not from the list: the list leaves out inactive facilities.
    const detail = useQuery({ queryKey: ['facilities', facilityId], queryFn: () => facilitiesApi.getById(facilityId) });
    const facility = detail.data;
    const units = (useUnits({ facilityId }).data ?? []);
    const tickets = (useTickets({ facilityId }).data ?? []).filter((t) => !['Resolved', 'Closed'].includes(t.status));
    const shifts = useShifts({ facilityId, from: today, to: today }).data ?? [];
    const floors = group(units, 'floorName');
    const mix = group(units, 'unitTypeCode');
    const sizePrice = useSizePrices();
    const role = useAuth().session?.role;
    const canSetUp = [Roles.FacilityManager, Roles.SystemAdministrator].includes(role);
    // One panel at a time under the header: 'edit' or 'floors'. A facility just created opens on floors, its next step.
    const location = useLocation();
    const [panel, setPanel] = useState(location.state?.setUp ? 'floors' : null);

    if (detail.isError) return <div className="se-alert" role="alert">{errorMessage(detail.error)}</div>;
    if (!facility) return <p className="se-empty">Loading facility…</p>;

    return (
        <>
            <Link to="/admin/facilities" className="se-back"><Icon name="arrowLeft" size={16} /> Back to facilities</Link>
            <PageHeader title={<>{facility.name} <Status value={facility.status} /></>} subtitle={`${facility.address}${facility.district ? `, ${facility.district}` : ''}`}>
                {canSetUp && <button type="button" className="se-btn se-btn-ghost" aria-pressed={panel === 'floors'} onClick={() => setPanel(panel === 'floors' ? null : 'floors')}><Icon name="grid" size={16} /> Floors &amp; units</button>}
                {role === Roles.SystemAdministrator && <button type="button" className="se-btn se-btn-ghost" aria-pressed={panel === 'edit'} onClick={() => setPanel(panel === 'edit' ? null : 'edit')}><Icon name="file" size={16} /> Edit facility</button>}
                <Link to="/admin/units" className="se-btn se-btn-primary"><Icon name="grid" size={16} /> View units</Link>
            </PageHeader>
            {panel === 'edit' && <Modal onClose={() => setPanel(null)} wide><EditFacility key={facility.facilityId} facility={facility} onClose={() => setPanel(null)} /></Modal>}
            {panel === 'floors' && <Modal onClose={() => setPanel(null)} wide><FloorsAndUnits facilityId={facilityId} onClose={() => setPanel(null)} /></Modal>}
            <div className="sa-stats">
                <Stat icon="grid" label="Units rented" value={`${units.filter((u) => u.status === 'Occupied').length} / ${units.length}`} />
                <Stat icon="grid" label="Occupancy" value={`${occupancy(units)}%`} />
                <Stat icon="box" label="Available now" value={facility.availableUnits} />
                <Stat icon="chat" label="Open tickets" value={tickets.length} />
            </div>
            <div className="sa-grid-2">
                <div className="sa-terms">
                    <section className="se-panel">
                        <div className="sa-card-title"><h2>Occupancy by floor</h2></div>
                        <div className="sa-occupancy">
                            {floors.map((f) => (
                                <div key={f.label}>
                                    <div className="sa-occ-label"><span>{f.label}</span><span className="sa-muted">{f.rented} / {f.units.length} rented</span></div>
                                    <div className="se-progress flat"><span style={{ width: `${occupancy(f.units)}%` }} /></div>
                                </div>
                            ))}
                            {!floors.length && <p className="sa-muted">No units yet.</p>}
                        </div>
                    </section>
                    <section className="se-panel">
                        <div className="sa-card-title"><h2>Unit mix &amp; availability</h2></div>
                        <div className="se-table-wrap">
                            <table className="se-table">
                                <thead><tr><th>Size</th><th>Total</th><th>Rented</th><th>Available</th><th>Price / mo</th></tr></thead>
                                <tbody>
                                    {mix.map((m) => (
                                        <tr key={m.label}><td className="strong">{m.label} · {m.units[0].areaM2} m²</td><td>{m.units.length}</td><td>{m.rented}</td><td>{m.free}</td><td className="price">{formatVnd(sizePrice[m.units[0].unitTypeId])}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
                <div className="sa-terms">
                    <section className="se-panel">
                        <div className="sa-card-title"><h2>Facility information</h2></div>
                        <dl className="se-kv">
                            <div><dt>Code</dt><dd>{facility.code}</dd></div>
                            <div><dt>Address</dt><dd>{facility.address}</dd></div>
                            <div><dt>District</dt><dd>{facility.district}</dd></div>
                            <div><dt>Opening hours</dt><dd>{facility.openingHours}</dd></div>
                            <div><dt>Phone</dt><dd>{facility.phone}</dd></div>
                            <div><dt>Manager</dt><dd>{facility.managerName ?? '—'}</dd></div>
                            <div><dt>Floors</dt><dd>{floors.length}</dd></div>
                            <div><dt>Total units</dt><dd>{units.length}</dd></div>
                        </dl>
                    </section>
                    <section className="se-panel">
                        <div className="sa-card-title"><h2>Staff on duty today</h2><Link to="/admin/staff" className="se-link">Shifts <Icon name="arrow" size={14} /></Link></div>
                        <ul className="sa-people">
                            {shifts.map((s) => (
                                <li key={s.shiftId}><span className="se-avatar sm">{initials(s.userName)}</span><span>{s.userName}</span><small>{s.startTime.slice(0, 5)}–{s.endTime.slice(0, 5)}</small></li>
                            ))}
                            {!shifts.length && <li className="sa-muted">No shifts today.</li>}
                        </ul>
                    </section>
                </div>
            </div>
        </>
    );
}
