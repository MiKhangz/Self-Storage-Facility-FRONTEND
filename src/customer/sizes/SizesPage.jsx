import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { facilitiesApi, unitTypesApi } from '../../api/generated';
import Icon from '../components/Icon.jsx';
import PageHead from '../components/PageHead.jsx';
import { availability, formatVnd, todayIso } from '../components/format.js';
import './SizesPage.css';

const TABS = ['Self-storage', 'Shelf storage', 'Climate-controlled'];
// The three price columns in Figma: 1–2 months, 3–5 months, 6+ months.
const TIERS = [1, 3, 6];
const PERIODS = [1, 3, 6, 12];

const FEES = [
    { icon: 'shield', title: 'Deposit', text: 'Equal to 1 month of rent. Refunded within 7 days after the unit is returned in good condition.' },
    { icon: 'lock', title: 'Lock & access card', text: '150,000 ₫ one-time. Bring your own disc lock or buy one at check-in.' },
    { icon: 'clock', title: 'Late payment fee', text: '5% of monthly rent per week overdue. Access is suspended after 15 days.' },
    { icon: 'card', title: 'Discounts', text: '−5% for 3 months, −10% for 6+ months. Students get an extra −5% with ID.' },
];

const tierFor = (months) => (months >= 6 ? 6 : months >= 3 ? 3 : 1);

export function useFacilities() {
    return useQuery({ queryKey: ['facilities', { page: 1, pageSize: 50 }], queryFn: () => facilitiesApi.list({ page: 1, pageSize: 50 }) });
}

/** Monthly rent per tier and free-unit count for every unit type at one facility. */
function useTypeRows(types, facilityId) {
    const moveInDate = todayIso();
    const enabled = !!facilityId;
    const quotes = useQueries({
        queries: types.flatMap((t) => TIERS.map((rentalMonths) => ({
            queryKey: ['quote', { unitTypeId: t.unitTypeId, facilityId, moveInDate, rentalMonths }],
            queryFn: () => unitTypesApi.quote(t.unitTypeId, { facilityId, moveInDate, rentalMonths }),
            enabled,
        }))),
    });
    const stock = useQueries({
        queries: types.map((t) => ({
            queryKey: ['availability', { unitTypeId: t.unitTypeId, facilityId, moveInDate }],
            queryFn: () => unitTypesApi.availability(t.unitTypeId, { facilityId, moveInDate }),
            enabled,
        })),
    });
    return types.map((t, i) => ({
        ...t,
        prices: TIERS.map((_, j) => quotes[i * TIERS.length + j].data?.monthlyRent),
        free: stock[i].data?.availableUnits,
    }));
}

function SizeArt({ area, max }) {
    // Box edge grows with the square root of the area so a 30 m² unit is not 30× wider than 1 m².
    const edge = 24 + 86 * Math.sqrt(area / max);
    return (
        <div className="se-size-art" aria-hidden="true">
            <span className="se-size-box" style={{ width: edge, height: edge * 0.85 }} />
            <span className="se-size-person" />
        </div>
    );
}

export default function SizesPage() {
    const [tab, setTab] = useState(TABS[0]);
    const [facilityId, setFacilityId] = useState('');
    const [months, setMonths] = useState(3);
    const [selected, setSelected] = useState(null);

    const facilities = useFacilities();
    const unitTypes = useQuery({ queryKey: ['unit-types'], queryFn: () => unitTypesApi.list() });
    const activeFacility = Number(facilityId) || facilities.data?.items?.[0]?.facilityId;

    const types = (unitTypes.data ?? [])
        .filter((t) => tab !== 'Climate-controlled' || t.isClimateControlled)
        .sort((a, b) => a.areaM2 - b.areaM2);
    const rows = useTypeRows(types, activeFacility);
    const maxArea = Math.max(...types.map((t) => t.areaM2), 1);
    const highlight = tierFor(months);
    const bookLink = (t) => `/booking?facilityId=${activeFacility}&unitTypeId=${t.unitTypeId}&rentalMonths=${months}`;

    return (
        <>
            <PageHead crumb="Unit sizes & prices" title="Unit sizes & prices">
                Transparent monthly pricing. Longer rental periods get a discount. Prices include VAT and 24/7 access.
            </PageHead>

            <section className="se-section se-sizes-page">
                <div className="se-container">
                    <div className="se-sizes-toolbar">
                        <div className="se-tabs" role="tablist">
                            {TABS.map((t) => (
                                <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>
                            ))}
                        </div>
                        <div className="se-sizes-filters">
                            <label><span>Facility</span>
                                <div className="se-field"><Icon name="pin" />
                                    <select value={activeFacility ?? ''} onChange={(e) => setFacilityId(e.target.value)}>
                                        {facilities.data?.items?.map((f) => <option key={f.facilityId} value={f.facilityId}>{f.name}</option>)}
                                    </select>
                                </div>
                            </label>
                            <label><span>Rental period</span>
                                <div className="se-field"><Icon name="clock" />
                                    <select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
                                        {PERIODS.map((m) => <option key={m} value={m}>{m} {m === 1 ? 'month' : 'months'}</option>)}
                                    </select>
                                </div>
                            </label>
                        </div>
                    </div>

                    {tab === 'Shelf storage' ? (
                        <div className="se-card se-empty">
                            Shelf storage is priced per box — from 99,000 ₫ / box / month, free pick-up for 10+ boxes.{' '}
                            <Link to="/support/new" className="se-link">Request shelf storage <Icon name="arrow" size={14} /></Link>
                        </div>
                    ) : unitTypes.isError || facilities.isError ? (
                        <div className="se-card se-empty">Prices could not be loaded. Please try again later.</div>
                    ) : (
                        <>
                            <div className="se-size-picker">
                                {types.map((t) => (
                                    <button key={t.unitTypeId} className={`se-card se-size-pick${selected === t.unitTypeId ? ' active' : ''}`} onClick={() => setSelected(t.unitTypeId)}>
                                        <SizeArt area={t.areaM2} max={maxArea} />
                                        <strong>{t.code}</strong>
                                        <span>{t.areaM2} m²</span>
                                    </button>
                                ))}
                            </div>
                            <p className="se-hint">The person icon is 1.7 m tall — for scale.</p>

                            <div className="se-card se-table-wrap">
                                <table className="se-table">
                                    <thead>
                                        <tr>
                                            <th>Size</th><th>Area</th><th>Dimensions (W×D×H)</th><th>Suitable for</th>
                                            <th className={highlight === 1 ? 'hl' : ''}>1–2 months</th>
                                            <th className={highlight === 3 ? 'hl' : ''}>3–5 mo</th>
                                            <th className={highlight === 6 ? 'hl' : ''}>6+ mo</th>
                                            <th>Availability</th><th />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((t) => {
                                            const badge = availability(t.free);
                                            return (
                                                <tr key={t.unitTypeId} className={selected === t.unitTypeId ? 'active' : ''} onClick={() => setSelected(t.unitTypeId)}>
                                                    <td className="strong">{t.code}</td>
                                                    <td>{t.areaM2} m²</td>
                                                    <td className="muted">{t.width} × {t.depth} × {t.height} m</td>
                                                    <td>{t.name}</td>
                                                    {t.prices.map((p, i) => <td key={i} className={`price${TIERS[i] === highlight ? ' hl' : ''}`}>{formatVnd(p)}</td>)}
                                                    <td>{badge && <span className={`se-badge ${badge.tone}`}>{badge.label}</span>}</td>
                                                    <td>
                                                        {t.free === 0
                                                            ? <Link to="/support/new" className="se-btn se-btn-ghost se-btn-sm">Join waitlist</Link>
                                                            : <Link to={bookLink(t)} className="se-btn se-btn-primary se-btn-sm">Book</Link>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {!rows.length && <tr><td colSpan={9} className="se-empty">{unitTypes.isLoading ? 'Loading sizes…' : 'No unit sizes in this category.'}</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                    <h2 className="se-sizes-sub">Fees &amp; policies</h2>
                    <div className="se-fees">
                        {FEES.map((f) => (
                            <article key={f.title} className="se-card se-fee">
                                <span className="se-icon-tile sm"><Icon name={f.icon} size={16} /></span>
                                <h3>{f.title}</h3>
                                <p>{f.text}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>
        </>
    );
}
