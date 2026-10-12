import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { unitTypesApi } from '../../api/generated';
import Icon from '../components/Icon.jsx';
import PageHead from '../components/PageHead.jsx';
import { availability, todayIso } from '../components/format.js';
import { useFacilities } from '../sizes/SizesPage.jsx';
import './LocationsPage.css';

// ponytail: the map is a drawing, not real geography; swap for a map library once facilities carry coordinates.
const PINS = [[71, 21], [80, 34], [40, 39], [62, 43], [24, 54], [74, 54], [49, 60], [57, 71]];

export default function LocationsPage() {
    const [search, setSearch] = useState('');
    const [unitTypeId, setUnitTypeId] = useState('');
    const [active, setActive] = useState(null);
    const facilities = useFacilities();
    const unitTypes = useQuery({ queryKey: ['unit-types'], queryFn: () => unitTypesApi.list() });
    const all = facilities.data?.items ?? [];
    const moveInDate = todayIso();

    // With a size filter, availability is per facility for that size; otherwise the list's own total is used.
    const stock = useQueries({
        queries: all.map((f) => ({
            queryKey: ['availability', { unitTypeId: Number(unitTypeId), facilityId: f.facilityId, moveInDate }],
            queryFn: () => unitTypesApi.availability(Number(unitTypeId), { facilityId: f.facilityId, moveInDate }),
            enabled: !!unitTypeId,
        })),
    });

    const term = search.trim().toLowerCase();
    const shown = all
        .map((f, i) => ({ ...f, free: unitTypeId ? stock[i].data?.availableUnits : f.availableUnits, pin: PINS[i % PINS.length] }))
        .filter((f) => !term || [f.name, f.address, f.district].some((v) => v?.toLowerCase().includes(term)));
    const focus = shown.find((f) => f.facilityId === active) ?? shown[0];

    return (
        <>
            <PageHead crumb="Locations" title={all.length === 1 ? 'Our storage location' : `Our ${all.length || 8} storage locations`}>
                All facilities have CCTV, fire alarms, 24/7 personal-code access and on-site staff from 8:00–20:00.
            </PageHead>

            <section className="se-container se-locations-page">
                <div>
                    <div className="se-loc-filters">
                        <div className="se-field se-loc-search"><Icon name="search" />
                            <input type="search" placeholder="Search by district or address" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search by district or address" />
                        </div>
                        <div className="se-field"><Icon name="box" />
                            <select value={unitTypeId} onChange={(e) => setUnitTypeId(e.target.value)} aria-label="Filter by unit size">
                                <option value="">All sizes</option>
                                {unitTypes.data?.map((u) => <option key={u.unitTypeId} value={u.unitTypeId}>{u.code} units</option>)}
                            </select>
                        </div>
                    </div>

                    {facilities.isError && <div className="se-card se-empty">Locations could not be loaded. Please try again later.</div>}
                    {facilities.isLoading && <div className="se-card se-empty">Loading locations…</div>}

                    <div className="se-loc-list">
                        {shown.map((f) => {
                            const badge = availability(f.free);
                            return (
                                <article key={f.facilityId} className={`se-card se-loc${focus?.facilityId === f.facilityId ? ' active' : ''}`} onMouseEnter={() => setActive(f.facilityId)}>
                                    <span className="se-loc-thumb"><Icon name="building" size={28} /></span>
                                    <div className="se-loc-body">
                                        <div className="se-loc-title"><h3>{f.name}</h3>{badge && <span className={`se-badge ${badge.tone}`}>{badge.label}</span>}</div>
                                        <p className="se-loc-addr"><Icon name="pin" size={14} /> {f.address}{f.district ? `, ${f.district}` : ''}</p>
                                        <p className="se-loc-meta">{f.openingHours ? `Open ${f.openingHours}` : 'Open daily'}{f.phone ? ` · ${f.phone}` : ''}</p>
                                    </div>
                                    <Link to={`/booking?facilityId=${f.facilityId}${unitTypeId ? `&unitTypeId=${unitTypeId}` : ''}`} className="se-btn se-btn-primary se-btn-sm">View units</Link>
                                </article>
                            );
                        })}
                    </div>
                    {!!all.length && <p className="se-loc-count">Showing {shown.length} of {all.length} locations</p>}
                </div>

                <div className="se-loc-map" aria-hidden="true">
                    {shown.map((f) => (
                        <span key={f.facilityId} className={`se-map-pin${focus?.facilityId === f.facilityId ? ' hq' : ''}`} style={{ left: `${f.pin[0]}%`, top: `${f.pin[1]}%` }}>
                            <Icon name="pin" size={14} />
                        </span>
                    ))}
                    {focus && (
                        <div className={`se-map-tip${focus.pin[1] < 30 ? ' below' : ''}`} style={{ left: `${focus.pin[0]}%`, top: `${focus.pin[1]}%` }}>
                            <strong>{focus.name}</strong>
                            <small>{focus.free ?? 0} units available</small>
                        </div>
                    )}
                </div>
            </section>
        </>
    );
}
