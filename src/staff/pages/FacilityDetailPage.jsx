import { Link, useParams } from 'react-router-dom';
import Icon from '../../customer/components/Icon.jsx';
import { formatVnd, todayIso } from '../../customer/components/format.js';
import { initials } from '../../customer/layout/CustomerLayout.jsx';
import { PageHeader, Stat } from '../components/ui.jsx';
import { useFacilities, useShifts, useTickets, useUnits } from '../queries.js';
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

/** A12: one facility — floors, unit mix, open tickets and who is on shift today. */
export default function FacilityDetailPage() {
    const facilityId = Number(useParams().facilityId);
    const today = todayIso();
    const facility = (useFacilities().data ?? []).find((f) => f.facilityId === facilityId);
    const units = (useUnits({ facilityId }).data ?? []);
    const tickets = (useTickets({ facilityId }).data ?? []).filter((t) => !['Resolved', 'Closed'].includes(t.status));
    const shifts = useShifts({ facilityId, from: today, to: today }).data ?? [];
    const floors = group(units, 'floorName');
    const mix = group(units, 'unitTypeCode');

    if (!facility) return <p className="se-empty">Loading facility…</p>;

    return (
        <>
            <Link to="/admin/facilities" className="se-back"><Icon name="arrowLeft" size={16} /> Back to facilities</Link>
            <PageHeader title={facility.name} subtitle={`${facility.address}${facility.district ? `, ${facility.district}` : ''}`}>
                <Link to="/admin/units" className="se-btn se-btn-primary"><Icon name="grid" size={16} /> View units</Link>
            </PageHeader>
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
                                        <tr key={m.label}><td className="strong">{m.label} · {m.units[0].areaM2} m²</td><td>{m.units.length}</td><td>{m.rented}</td><td>{m.free}</td><td className="price">{formatVnd(m.units[0].currentPrice)}</td></tr>
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
