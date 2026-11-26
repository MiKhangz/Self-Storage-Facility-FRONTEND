import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { storageUnitsApi, unitTypesApi } from '../../api/generated';
import Icon from '../components/Icon.jsx';
import { discountLabel, useTerms } from '../components/terms.js';
import { availability, formatDate, formatVnd, rentalEndDate, todayIso } from '../components/format.js';
import { useFacilities } from '../sizes/SizesPage.jsx';
import BookingStepper from './BookingStepper.jsx';
import BookingSummary from './BookingSummary.jsx';
import { useT } from '../../i18n/I18n.jsx';

const PERIODS = [1, 3, 6, 12];
const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const UNIT_STATUS_LABEL = {
    Available: 'Trống',
    Reserved: 'Đã đặt',
    Occupied: 'Đang thuê',
    Maintenance: 'Bảo trì',
    Retired: 'Ngừng sử dụng',
};

/** Custom date picker restricted to the current month, graying out past days. */
function CurrentMonthDatePicker({ value, onChange, tr }) {
    const today = todayIso();
    const [y, m] = today.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    // 0=Sun..6=Sat -> Monday=0..Sunday=6
    const firstWeekday = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
    const pad = (n) => String(n).padStart(2, '0');
    const monthPrefix = `${y}-${pad(m)}`;

    return (
        <div className="se-month-picker" role="group" aria-label={tr('Ngày nhận kho')}>
            <div className="se-month-head">
                <strong><Icon name="calendar" size={16} /> {tr('Tháng {month}/{year}', { month: pad(m), year: y })}</strong>
                <span>{formatDate(value)}</span>
            </div>
            <div className="se-month-weekdays">
                {WEEKDAYS.map((w) => <span key={w}>{tr(w)}</span>)}
            </div>
            <div className="se-month-days">
                {Array.from({ length: firstWeekday }, (_, i) => <span key={`e${i}`} className="se-day-empty" />)}
                {Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1;
                    const iso = `${monthPrefix}-${pad(day)}`;
                    const past = iso < today;
                    const active = value === iso;
                    return (
                        <button
                            key={iso}
                            type="button"
                            disabled={past}
                            aria-pressed={active}
                            className={`se-day-btn${active ? ' active' : ''}${past ? ' past' : ''}`}
                            onClick={() => onChange(iso)}
                        >
                            {day}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

/** U06: what, where and when. Values travel in the URL so they survive the login redirect. */
export default function ChooseUnitPage() {
    const navigate = useNavigate();
    const tr = useT();
    const [params] = useSearchParams();
    const today = todayIso();
    const [ty, tm] = today.split('-').map(Number);
    const maxDayInMonth = `${ty}-${String(tm).padStart(2, '0')}-${String(new Date(Date.UTC(ty, tm, 0)).getUTCDate()).padStart(2, '0')}`;
    const initDate = params.get('moveInDate');
    const safeMoveInDate = initDate && initDate >= today && initDate <= maxDayInMonth ? initDate : today;

    const [form, setForm] = useState({
        facilityId: params.get('facilityId') ?? '',
        unitTypeId: params.get('unitTypeId') ?? '',
        storageUnitId: params.get('storageUnitId') ?? '',
        moveInDate: safeMoveInDate,
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
    const terms = useTerms({ facilityId, date: form.moveInDate }).data;
    const ready = !!(facilityId && unitTypeId && form.moveInDate);

    // Free for every day of the stay, not just move-in day.
    const stockQuery = { facilityId, moveInDate: form.moveInDate, rentalMonths: form.rentalMonths };
    const stock = useQuery({
        queryKey: ['availability', { unitTypeId, ...stockQuery }],
        queryFn: () => unitTypesApi.availability(unitTypeId, stockQuery),
        enabled: ready,
    });
    const unitsList = useQuery({
        queryKey: ['storage-units', { facilityId, unitTypeId }],
        queryFn: () => storageUnitsApi.list({ facilityId, unitTypeId, page: 1, pageSize: 100 }),
        enabled: !!(facilityId && unitTypeId),
    });
    const quoteQuery = {
        ...stockQuery,
        ...(form.storageUnitId ? { storageUnitId: Number(form.storageUnitId) } : {}),
    };
    const quote = useQuery({
        queryKey: ['quote', { unitTypeId, ...quoteQuery }],
        queryFn: () => unitTypesApi.quote(unitTypeId, quoteQuery),
        enabled: ready,
    });
    const badge = availability(stock.data?.availableUnits, tr);
    const soldOut = stock.data?.availableUnits === 0;
    const allUnits = stock.data?.units?.length
        ? stock.data.units
        : (unitsList.data?.items ?? [])
            .filter((u) => u.status !== 'Retired')
            .map((u) => ({
                storageUnitId: u.storageUnitId,
                unitCode: u.unitCode,
                floorName: u.floorName,
                zone: u.zone,
                status: u.status,
                isAvailable: u.status === 'Available' && !soldOut,
            }));
    const selectedUnit = allUnits.find((u) => String(u.storageUnitId) === String(form.storageUnitId)) ?? null;
    const selectedUnavailable = !!(selectedUnit && !selectedUnit.isAvailable);

    const next = () => {
        const q = new URLSearchParams({ facilityId, unitTypeId, moveInDate: form.moveInDate, rentalMonths: form.rentalMonths });
        if (selectedUnit && selectedUnit.isAvailable) {
            q.set('storageUnitId', String(selectedUnit.storageUnitId));
            q.set('unitCode', selectedUnit.unitCode);
        }
        navigate(`/booking/details?${q}`);
    };

    const ticketQuery = new URLSearchParams({
        ...(facilityId ? { facilityId: String(facilityId) } : {}),
        subject: tr('Đặt trước kho cho các tháng sau'),
    });

    return (
        <>
            <BookingStepper current={1} />
            <div className="se-booking">
                <div className="se-container se-booking-grid">
                    <div>
                    <section className="se-panel">
                        <h2>1. {tr('Ở đâu và cỡ nào?')}</h2>
                        <span className="se-label">{tr('Cơ sở')}</span>
                        <div className="se-field"><Icon name="pin" />
                            <select value={facilityId ?? ''} onChange={(e) => set({ facilityId: e.target.value, storageUnitId: '' })} aria-label={tr('Cơ sở')}>
                                {facilities.data?.items?.map((f) => <option key={f.facilityId} value={f.facilityId}>{f.name}</option>)}
                            </select>
                        </div>
                        <span className="se-label">{tr('Kích thước kho')}</span>
                        <div className="se-chips" role="radiogroup" aria-label={tr('Kích thước kho')}>
                            {types.map((t) => (
                                <button key={t.unitTypeId} type="button" role="radio" aria-checked={t.unitTypeId === unitTypeId}
                                    className={`se-chip${t.unitTypeId === unitTypeId ? ' active' : ''}`} onClick={() => set({ unitTypeId: t.unitTypeId, storageUnitId: '' })}>
                                    {t.unitTypeId === unitTypeId && <Icon name="check" size={14} />}{t.code} · {t.areaM2.toLocaleString('vi-VN')} m²
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="se-panel">
                        <h2>2. {tr('Khi nào và thuê bao lâu?')}</h2>
                        <div className="se-panel-grid">
                            <div>
                                <span className="se-label">{tr('Ngày nhận kho')} ({tr('trong tháng này')})</span>
                                <CurrentMonthDatePicker value={form.moveInDate} onChange={(iso) => set({ moveInDate: iso })} tr={tr} />
                            </div>
                            <div>
                                <span className="se-label">{tr('Ngày kết thúc (tự tính)')}</span>
                                <div className="se-field" aria-readonly="true"><Icon name="calendar" />
                                    {form.moveInDate ? formatDate(rentalEndDate(form.moveInDate, form.rentalMonths)) : '—'}
                                </div>
                                <div className="se-future-month-box">
                                    <p className="se-hint">{tr('Bạn muốn đặt kho cho các tháng sau?')}</p>
                                    <Link to={`/support/new?${ticketQuery}`} className="se-btn se-btn-outline se-btn-sm">
                                        <Icon name="chat" size={15} /> {tr('Gửi yêu cầu hỗ trợ để đặt trước')}
                                    </Link>
                                </div>
                            </div>
                        </div>
                        <span className="se-label">{tr('Thời hạn thuê')}</span>
                        <div className="se-chips" role="radiogroup" aria-label={tr('Thời hạn thuê')}>
                            {PERIODS.map((months) => (
                                <button key={months} type="button" role="radio" aria-checked={form.rentalMonths === months}
                                    className={`se-chip${form.rentalMonths === months ? ' active' : ''}`} onClick={() => set({ rentalMonths: months })}>
                                    {form.rentalMonths === months && <Icon name="check" size={14} />}{tr('{months} tháng', { months })} {discountLabel(terms, months, unitTypeId) && <small>{discountLabel(terms, months, unitTypeId)}</small>}
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="se-panel">
                        <h2>3. {tr('Kho của bạn')}</h2>
                        {type && (
                            <p className="se-booking-note">
                                {tr('Kho')} {type.code} · {type.areaM2.toLocaleString('vi-VN')} m² · {[type.width, type.depth, type.height].map((n) => n.toLocaleString('vi-VN')).join(' × ')} m
                                {badge && <> &nbsp;<span className={`se-badge ${badge.tone}`}>{badge.label}</span></>}
                            </p>
                        )}
                        <span className="se-label" style={{ marginTop: 14 }}>{tr('Chọn kho cụ thể (không bắt buộc)')}</span>
                        <div className="se-unit-picker" role="radiogroup" aria-label={tr('Chọn kho cụ thể (không bắt buộc)')}>
                            <button
                                type="button"
                                role="radio"
                                aria-checked={!selectedUnit}
                                className={`se-unit-slot auto${!selectedUnit ? ' active' : ''}`}
                                onClick={() => set({ storageUnitId: '' })}
                            >
                                <strong>{tr('Tự động xếp kho')}</strong>
                                <small>{quote.data?.expectedUnitCode ? tr('Dự kiến: {code}', { code: quote.data.expectedUnitCode }) : tr('Hệ thống tự chọn kho trống')}</small>
                            </button>
                            {allUnits.map((u) => {
                                const isSelected = selectedUnit?.storageUnitId === u.storageUnitId;
                                const statusLabel = u.isAvailable
                                    ? UNIT_STATUS_LABEL.Available
                                    : (UNIT_STATUS_LABEL[u.status] && u.status !== 'Available' ? UNIT_STATUS_LABEL[u.status] : 'Đã đặt');
                                return (
                                    <button
                                        key={u.storageUnitId}
                                        type="button"
                                        role="radio"
                                        aria-checked={isSelected}
                                        className={`se-unit-slot${isSelected ? ' active' : ''}${u.isAvailable ? ' available' : ' unavailable'}`}
                                        onClick={() => set({ storageUnitId: isSelected ? '' : u.storageUnitId })}
                                    >
                                        <div className="se-unit-slot-head">
                                            <strong>{u.unitCode}</strong>
                                            <span className={`se-badge ${u.isAvailable ? '' : 'none'}`}>
                                                {tr(statusLabel)}
                                            </span>
                                        </div>
                                        <small>{[u.floorName, u.zone].filter(Boolean).join(' · ')}</small>
                                    </button>
                                );
                            })}
                        </div>
                        {selectedUnavailable && (
                            <div className="se-alert" role="alert" style={{ marginTop: 12 }}>
                                {tr('Kho {code} không còn trống trong thời gian bạn chọn. Hãy chọn kho khác hoặc để hệ thống tự động xếp kho.', { code: selectedUnit.unitCode })}
                            </div>
                        )}
                        <p className="se-hint" style={{ marginTop: 12 }}>
                            {quote.data ? <>{tr('Tiền thuê {rent} mỗi tháng khi thuê {months} tháng.', { rent: formatVnd(quote.data.monthlyRent), months: form.rentalMonths })} </> : null}
                            {selectedUnit
                                ? (selectedUnit.isAvailable
                                    ? tr('Bạn đã chọn kho {code}.', { code: selectedUnit.unitCode })
                                    : null)
                                : quote.data?.expectedUnitCode
                                    ? tr('Kho dự kiến của bạn: {code}. Nếu cần đổi kho, chúng tôi sẽ hỏi ý kiến bạn trước.', { code: quote.data.expectedUnitCode })
                                    : tr('Nhân viên sẽ xếp số kho cụ thể cho bạn trước ngày nhận kho.')}
                        </p>
                        {(quote.isError || stock.isError) && !soldOut && <div className="se-alert" role="alert">{tr('Chưa có giá cho lựa chọn này. Hãy thử cỡ kho, cơ sở hoặc ngày khác.')}</div>}
                    </section>

                    </div>
                    <BookingSummary facility={facility} type={type} moveInDate={form.moveInDate} rentalMonths={form.rentalMonths} quote={quote} unitCode={selectedUnit?.unitCode}>
                        <button type="button" className="se-btn se-btn-primary se-btn-block se-booking-cta" disabled={!ready || soldOut || selectedUnavailable || !quote.data} onClick={next}>
                        {selectedUnavailable
                            ? tr('Kho {code} không trống vào ngày này', { code: selectedUnit.unitCode })
                            : soldOut
                                ? tr('Cỡ kho này đã hết, hãy chọn cỡ khác')
                                : <>{tr('Tiếp tục')} <Icon name="arrow" size={16} /></>}
                    </button>
                    </BookingSummary>
                </div>
            </div>
        </>
    );
}
