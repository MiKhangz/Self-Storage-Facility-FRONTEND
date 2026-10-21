import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { unitTypesApi } from '../../api/generated';
import Icon from '../components/Icon.jsx';
import { discountLabel, useTerms } from '../components/terms.js';
import { availability, formatDate, formatVnd, rentalEndDate, todayIso } from '../components/format.js';
import { useFacilities } from '../sizes/SizesPage.jsx';
import BookingStepper from './BookingStepper.jsx';
import BookingSummary from './BookingSummary.jsx';

const PERIODS = [1, 3, 6, 12];

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
    const facility = facilities.data?.items?.find((f) => f.facilityId === facilityId);
    const types = [...(unitTypes.data ?? [])].sort((a, b) => a.areaM2 - b.areaM2);
    const unitTypeId = Number(form.unitTypeId) || types[0]?.unitTypeId;
    const type = types.find((t) => t.unitTypeId === unitTypeId);
    const terms = useTerms().data;
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
                <div className="se-container se-booking-grid">
                    <div>
                    <section className="se-panel">
                        <h2>1. Ở đâu và cỡ nào?</h2>
                        <span className="se-label">Cơ sở</span>
                        <div className="se-field"><Icon name="pin" />
                            <select value={facilityId ?? ''} onChange={(e) => set({ facilityId: e.target.value })} aria-label="Cơ sở">
                                {facilities.data?.items?.map((f) => <option key={f.facilityId} value={f.facilityId}>{f.name}</option>)}
                            </select>
                        </div>
                        <span className="se-label">Kích thước kho</span>
                        <div className="se-chips" role="radiogroup" aria-label="Kích thước kho">
                            {types.map((t) => (
                                <button key={t.unitTypeId} type="button" role="radio" aria-checked={t.unitTypeId === unitTypeId}
                                    className={`se-chip${t.unitTypeId === unitTypeId ? ' active' : ''}`} onClick={() => set({ unitTypeId: t.unitTypeId })}>
                                    {t.unitTypeId === unitTypeId && <Icon name="check" size={14} />}{t.code} · {t.areaM2.toLocaleString('vi-VN')} m²
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="se-panel">
                        <h2>2. Khi nào và thuê bao lâu?</h2>
                        <div className="se-panel-grid">
                            <label><span className="se-label">Ngày nhận kho</span>
                                <div className="se-field"><Icon name="calendar" />
                                    <input type="date" value={form.moveInDate} min={todayIso()} onChange={(e) => set({ moveInDate: e.target.value })} required />
                                </div>
                            </label>
                            <div><span className="se-label">Ngày kết thúc (tự tính)</span>
                                <div className="se-field" aria-readonly="true"><Icon name="calendar" />
                                    {form.moveInDate ? formatDate(rentalEndDate(form.moveInDate, form.rentalMonths)) : '—'}
                                </div>
                            </div>
                        </div>
                        <span className="se-label">Thời hạn thuê</span>
                        <div className="se-chips" role="radiogroup" aria-label="Thời hạn thuê">
                            {PERIODS.map((months) => (
                                <button key={months} type="button" role="radio" aria-checked={form.rentalMonths === months}
                                    className={`se-chip${form.rentalMonths === months ? ' active' : ''}`} onClick={() => set({ rentalMonths: months })}>
                                    {form.rentalMonths === months && <Icon name="check" size={14} />}{months} tháng {discountLabel(terms, months, unitTypeId) && <small>{discountLabel(terms, months, unitTypeId)}</small>}
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="se-panel">
                        <h2>3. Kho của bạn</h2>
                        {type && (
                            <p className="se-booking-note">
                                Kho {type.code} · {type.areaM2.toLocaleString('vi-VN')} m² · {[type.width, type.depth, type.height].map((n) => n.toLocaleString('vi-VN')).join(' × ')} m
                                {badge && <> &nbsp;<span className={`se-badge ${badge.tone}`}>{badge.label}</span></>}
                            </p>
                        )}
                        <p className="se-hint">
                            {quote.data ? <>Tiền thuê {formatVnd(quote.data.monthlyRent)} mỗi tháng khi thuê {form.rentalMonths} tháng. </> : null}
                            Nhân viên sẽ xếp số kho cụ thể cho bạn trước ngày nhận kho.
                        </p>
                        {(quote.isError || stock.isError) && <div className="se-alert" role="alert">Chưa có giá cho lựa chọn này. Hãy thử cỡ kho, cơ sở hoặc ngày khác.</div>}
                    </section>

                    </div>
                    <BookingSummary facility={facility} type={type} moveInDate={form.moveInDate} rentalMonths={form.rentalMonths} quote={quote}>
                        <button type="button" className="se-btn se-btn-primary se-btn-block se-booking-cta" disabled={!ready || soldOut || !quote.data} onClick={next}>
                        {soldOut ? 'Cỡ kho này đã hết, hãy chọn cỡ khác' : <>Tiếp tục <Icon name="arrow" size={16} /></>}
                    </button>
                    </BookingSummary>
                </div>
            </div>
        </>
    );
}
