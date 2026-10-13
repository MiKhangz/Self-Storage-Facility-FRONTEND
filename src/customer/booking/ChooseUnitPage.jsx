import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { unitTypesApi } from '../../api/generated';
import Icon from '../components/Icon.jsx';
import { availability, formatDate, formatVnd, rentalEndDate, todayIso } from '../components/format.js';
import { useFacilities } from '../sizes/SizesPage.jsx';
import BookingStepper from './BookingStepper.jsx';

const PERIODS = [{ months: 1 }, { months: 3, note: '−5%' }, { months: 6, note: '−10%' }, { months: 12, note: '−10%' }];

/** U06: what, where and when. Values travel in the URL so they survive the login redirect. */
export default function ChooseUnitPage() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const [form, setForm] = useState({
        facilityId: params.get('facilityId') ?? '',
        unitTypeId: params.get('unitTypeId') ?? '',
        moveInDate: params.get('moveInDate') ?? todayIso(),
        rentalMonths: Number(params.get('rentalMonths')) || 3,
    });
    const set = (patch) => setForm({ ...form, ...patch });

    const facilities = useFacilities();
    const unitTypes = useQuery({ queryKey: ['unit-types'], queryFn: () => unitTypesApi.list() });
    const facilityId = Number(form.facilityId) || facilities.data?.items?.[0]?.facilityId;
    const types = [...(unitTypes.data ?? [])].sort((a, b) => a.areaM2 - b.areaM2);
    const unitTypeId = Number(form.unitTypeId) || types[0]?.unitTypeId;
    const type = types.find((t) => t.unitTypeId === unitTypeId);
    const ready = !!(facilityId && unitTypeId && form.moveInDate);

    const stockQuery = { facilityId, moveInDate: form.moveInDate };
    const stock = useQuery({
        queryKey: ['availability', { unitTypeId, ...stockQuery }],
        queryFn: () => unitTypesApi.availability(unitTypeId, stockQuery),
        enabled: ready,
    });
    const quoteQuery = { ...stockQuery, rentalMonths: form.rentalMonths };
    const quote = useQuery({
        queryKey: ['quote', { unitTypeId, ...quoteQuery }],
        queryFn: () => unitTypesApi.quote(unitTypeId, quoteQuery),
        enabled: ready,
    });
    const badge = availability(stock.data?.availableUnits);
    const soldOut = stock.data?.availableUnits === 0;

    const next = () => {
        const q = new URLSearchParams({ facilityId, unitTypeId, moveInDate: form.moveInDate, rentalMonths: form.rentalMonths });
        navigate(`/booking/details?${q}`);
    };

    return (
        <>
            <BookingStepper current={1} />
            <div className="se-booking">
                <div className="se-container">
                    <section className="se-panel">
                        <h2>1. Where and what size?</h2>
                        <span className="se-label">Facility</span>
                        <div className="se-field"><Icon name="pin" />
                            <select value={facilityId ?? ''} onChange={(e) => set({ facilityId: e.target.value })} aria-label="Facility">
                                {facilities.data?.items?.map((f) => <option key={f.facilityId} value={f.facilityId}>{f.name}</option>)}
                            </select>
                        </div>
                        <span className="se-label">Unit size</span>
                        <div className="se-chips" role="radiogroup" aria-label="Unit size">
                            {types.map((t) => (
                                <button key={t.unitTypeId} type="button" role="radio" aria-checked={t.unitTypeId === unitTypeId}
                                    className={`se-chip${t.unitTypeId === unitTypeId ? ' active' : ''}`} onClick={() => set({ unitTypeId: t.unitTypeId })}>
                                    {t.unitTypeId === unitTypeId && <Icon name="check" size={14} />}{t.code} · {t.areaM2} m²
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="se-panel">
                        <h2>2. When and how long?</h2>
                        <div className="se-panel-grid">
                            <label><span className="se-label">Move-in date</span>
                                <div className="se-field"><Icon name="calendar" />
                                    <input type="date" value={form.moveInDate} min={todayIso()} onChange={(e) => set({ moveInDate: e.target.value })} required />
                                </div>
                            </label>
                            <div><span className="se-label">End date (auto)</span>
                                <div className="se-field" aria-readonly="true"><Icon name="calendar" />
                                    {form.moveInDate ? formatDate(rentalEndDate(form.moveInDate, form.rentalMonths)) : '—'}
                                </div>
                            </div>
                        </div>
                        <span className="se-label">Rental period</span>
                        <div className="se-chips" role="radiogroup" aria-label="Rental period">
                            {PERIODS.map(({ months, note }) => (
                                <button key={months} type="button" role="radio" aria-checked={form.rentalMonths === months}
                                    className={`se-chip${form.rentalMonths === months ? ' active' : ''}`} onClick={() => set({ rentalMonths: months })}>
                                    {form.rentalMonths === months && <Icon name="check" size={14} />}{months} {months === 1 ? 'month' : 'months'} {note && <small>{note}</small>}
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="se-panel">
                        <h2>3. Your unit</h2>
                        {type && (
                            <p className="se-booking-note">
                                Size {type.code} · {type.areaM2} m² · {type.width} × {type.depth} × {type.height} m
                                {badge && <> &nbsp;<span className={`se-badge ${badge.tone}`}>{badge.label}</span></>}
                            </p>
                        )}
                        <p className="se-hint">
                            {quote.data ? <>Monthly rent {formatVnd(quote.data.monthlyRent)} for {form.rentalMonths} {form.rentalMonths === 1 ? 'month' : 'months'}. </> : null}
                            Staff assign your exact unit before check-in.
                        </p>
                        {(quote.isError || stock.isError) && <div className="se-alert" role="alert">Prices could not be loaded for this choice. Please try another size or date.</div>}
                    </section>

                    <button type="button" className="se-btn se-btn-primary se-btn-block se-booking-cta" disabled={!ready || soldOut || !quote.data} onClick={next}>
                        {soldOut ? 'No units left for this size' : <>Continue to details <Icon name="arrow" size={16} /></>}
                    </button>
                </div>
            </div>
        </>
    );
}
