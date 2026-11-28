import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { unitTypesApi } from '../../api/generated';
import Icon from '../components/Icon.jsx';
import { discountFor, discountLabel, useTerms } from '../components/terms.js';
import { addDays, formatDate, formatVnd, isSameDayClosed, rentalEndDate, todayIso } from '../components/format.js';
import { useFacilities } from '../sizes/SizesPage.jsx';
import BookingStepper from './BookingStepper.jsx';
import BookingSummary from './BookingSummary.jsx';
import { useT } from '../../i18n/I18n.jsx';

const PERIODS = [1, 3, 6, 12];
const PREFERENCE_TAGS = [
    { key: 'Ground floor', label: 'Tầng trệt' },
    { key: 'Near elevator', label: 'Gần thang máy' },
    { key: 'Near entrance', label: 'Gần lối vào' },
    { key: 'Well-ventilated', label: 'Thoáng khí' },
    { key: 'Other', label: 'Khác' },
];

/** U06: what, where and when. Values travel in the URL so they survive the login redirect. */
export default function ChooseUnitPage() {
    const navigate = useNavigate();
    const tr = useT();
    const [params] = useSearchParams();
    const today = todayIso();
    const tomorrow = addDays(today, 1);
    const [sameDayClosed, setSameDayClosed] = useState(isSameDayClosed);
    const paramSameDay = params.get('sameDay');
    const paramDate = params.get('moveInDate');
    const initialSameDay = !sameDayClosed && (paramSameDay ? paramSameDay !== 'false' : (!paramDate || paramDate <= today));
    const initialMoveInDate = initialSameDay ? today : (paramDate && paramDate > today ? paramDate : tomorrow);
    const initialPrefs = (params.get('preferences') ?? '').split(',').map((s) => s.trim()).filter(Boolean);

    const [form, setForm] = useState({
        facilityId: params.get('facilityId') ?? '',
        unitTypeId: params.get('unitTypeId') ?? '',
        sameDay: initialSameDay,
        moveInDate: initialMoveInDate,
        rentalMonths: Number(params.get('rentalMonths')) || 3,
        unitAssignmentMode: params.get('unitAssignmentMode') === 'STAFF_ASSISTED' ? 'STAFF_ASSISTED' : 'AUTO',
        preferences: initialPrefs,
        preferenceNote: params.get('preferenceNote') ?? '',
        storageUnitId: Number(params.get('storageUnitId')) || null,
    });
    const set = (patch) => setForm((prev) => ({ ...prev, storageUnitId: null, ...patch }));

    useEffect(() => {
        const tick = () => {
            const closedNow = isSameDayClosed();
            setSameDayClosed(closedNow);
            if (closedNow) {
                setForm((prev) => (prev.sameDay
                    ? { ...prev, sameDay: false, moveInDate: prev.moveInDate > today ? prev.moveInDate : tomorrow, storageUnitId: null }
                    : prev));
            }
        };
        tick();
        const id = setInterval(tick, 15_000);
        return () => clearInterval(id);
    }, [today, tomorrow]);

    const facilities = useFacilities();
    const unitTypes = useQuery({ queryKey: ['unit-types'], queryFn: () => unitTypesApi.list() });
    const facilityId = Number(form.facilityId) || facilities.data?.items?.[0]?.facilityId;
    const facility = facilities.data?.items?.find((f) => f.facilityId === facilityId);
    const types = [...(unitTypes.data ?? [])].sort((a, b) => a.areaM2 - b.areaM2);
    const unitTypeId = Number(form.unitTypeId) || types[0]?.unitTypeId;
    const type = types.find((t) => t.unitTypeId === unitTypeId);
    const activeMoveInDate = form.sameDay ? today : (form.moveInDate > today ? form.moveInDate : tomorrow);
    const terms = useTerms({ facilityId, date: activeMoveInDate }).data;
    const ready = !!(facilityId && unitTypeId && activeMoveInDate);

    // Free for every day of the stay, not just move-in day.
    const stockQuery = { facilityId, moveInDate: activeMoveInDate, rentalMonths: form.rentalMonths };
    const stock = useQuery({
        queryKey: ['availability', { unitTypeId, ...stockQuery }],
        queryFn: () => unitTypesApi.availability(unitTypeId, stockQuery),
        enabled: ready,
        refetchInterval: 30000,
    });
    const quoteQuery = {
        ...stockQuery,
        sameDay: form.sameDay,
    };
    const quote = useQuery({
        queryKey: ['quote', { unitTypeId, ...quoteQuery }],
        queryFn: () => unitTypesApi.quote(unitTypeId, quoteQuery),
        enabled: ready,
    });
    const availableCount = stock.data?.availableUnits;
    const soldOut = availableCount === 0;
    const isStaffAssisted = form.unitAssignmentMode === 'STAFF_ASSISTED';
    const availableUnits = (stock.data?.units ?? []).filter((unit) => unit.isAvailable);
    const selectedUnit = form.sameDay && !isStaffAssisted
        ? availableUnits.find((unit) => unit.storageUnitId === form.storageUnitId) : null;

    const discountPercent = discountFor(terms, form.rentalMonths, unitTypeId);
    const rentSubtotal = quote.data?.rentSubtotal;
    const savingsAmount = quote.data && discountPercent > 0 && discountPercent < 100
        ? Math.max(0, Math.round((quote.data.monthlyRent / (1 - discountPercent / 100)) * form.rentalMonths - quote.data.rentSubtotal))
        : 0;

    const togglePreference = (tag) => {
        const exists = form.preferences.includes(tag);
        set({ preferences: exists ? form.preferences.filter((x) => x !== tag) : [...form.preferences, tag] });
    };

    const next = () => {
        const q = new URLSearchParams({
            facilityId,
            unitTypeId,
            moveInDate: activeMoveInDate,
            rentalMonths: form.rentalMonths,
            sameDay: String(form.sameDay),
            unitAssignmentMode: form.unitAssignmentMode,
        });
        if (selectedUnit) {
            q.set('storageUnitId', selectedUnit.storageUnitId);
            q.set('unitCode', selectedUnit.unitCode);
        }
        if (isStaffAssisted && form.preferences.length > 0) {
            q.set('preferences', form.preferences.join(','));
        }
        if (isStaffAssisted && form.preferenceNote.trim()) {
            q.set('preferenceNote', form.preferenceNote.trim());
        }
        navigate(`/booking/details?${q}`);
    };

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
                                <select value={facilityId ?? ''} onChange={(e) => set({ facilityId: e.target.value })} aria-label={tr('Cơ sở')}>
                                    {facilities.data?.items?.map((f) => <option key={f.facilityId} value={f.facilityId}>{f.name}</option>)}
                                </select>
                            </div>
                            <span className="se-label">{tr('Kích thước kho')}</span>
                            <div className="se-chips" role="radiogroup" aria-label={tr('Kích thước kho')}>
                                {types.map((t) => (
                                    <button key={t.unitTypeId} type="button" role="radio" aria-checked={t.unitTypeId === unitTypeId}
                                        className={`se-chip${t.unitTypeId === unitTypeId ? ' active' : ''}`} onClick={() => set({ unitTypeId: t.unitTypeId })}>
                                        {t.unitTypeId === unitTypeId && <Icon name="check" size={14} />}{t.code} · {t.areaM2.toLocaleString('vi-VN')} m²
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section className="se-panel">
                            <h2>2. {tr('Chọn thời hạn thuê')}</h2>
                            <span className="se-label">{tr('Loại đặt kho')}</span>
                            <div className="se-chips" role="radiogroup" aria-label={tr('Loại đặt kho')} style={{ marginBottom: 16 }}>
                                <button
                                    type="button"
                                    role="radio"
                                    disabled={sameDayClosed}
                                    aria-disabled={sameDayClosed}
                                    aria-checked={!sameDayClosed && form.sameDay}
                                    title={sameDayClosed ? tr('Đặt kho nhận trong ngày chỉ áp dụng trước 20:00') : undefined}
                                    className={`se-chip${!sameDayClosed && form.sameDay ? ' active' : ''}${sameDayClosed ? ' disabled' : ''}`}
                                    onClick={() => !sameDayClosed && set({ sameDay: true, moveInDate: today })}
                                >
                                    {!sameDayClosed && form.sameDay && <Icon name="check" size={14} />}
                                    {tr('Nhận kho ngay hôm nay')}
                                </button>
                                <button
                                    type="button"
                                    role="radio"
                                    aria-checked={sameDayClosed || !form.sameDay}
                                    className={`se-chip${sameDayClosed || !form.sameDay ? ' active' : ''}`}
                                    onClick={() => set({ sameDay: false, moveInDate: form.moveInDate > today ? form.moveInDate : tomorrow })}
                                >
                                    {(sameDayClosed || !form.sameDay) && <Icon name="check" size={14} />}
                                    {tr('Đặt kho')}
                                </button>
                            </div>

                            {form.sameDay ? (
                                <div className="se-alert info" style={{ marginBottom: 16 }}>
                                    {tr('Cọc nhận kho trong ngày bằng 1 ngày tiền thuê sau giảm giá, tối thiểu 100.000₫. Thanh toán trước 1 tháng tiền thuê sau giảm giá. Khách huỷ hoặc không nhận kho trước 20:30: hoàn khoản đã trả trừ 100.000₫.')}
                                </div>
                            ) : (
                                <div className="se-panel-grid" style={{ marginBottom: 16 }}>
                                    <label>
                                        <span className="se-label">{tr('Ngày nhận kho')} ({tr('từ ngày mai')})</span>
                                        <div className="se-field se-date-field"><Icon name="calendar" />
                                            <span className="se-date-field-text">{formatDate(activeMoveInDate)}</span>
                                            <input
                                                type="date"
                                                value={activeMoveInDate}
                                                min={tomorrow}
                                                aria-label={tr('Ngày nhận kho')}
                                                onChange={(e) => set({ moveInDate: e.target.value >= tomorrow ? e.target.value : tomorrow })}
                                                onClick={(e) => e.currentTarget.showPicker?.()}
                                                required
                                            />
                                        </div>
                                    </label>
                                    <div>
                                        <span className="se-label">{tr('Ngày kết thúc (tự tính)')}</span>
                                        <div className="se-field" aria-readonly="true"><Icon name="calendar" />
                                            {activeMoveInDate ? formatDate(rentalEndDate(activeMoveInDate, form.rentalMonths)) : '—'}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <span className="se-label">{tr('Thời hạn thuê')}</span>
                            <div className="se-chips" role="radiogroup" aria-label={tr('Thời hạn thuê')}>
                                {PERIODS.map((months) => (
                                    <button key={months} type="button" role="radio" aria-checked={form.rentalMonths === months}
                                        className={`se-chip${form.rentalMonths === months ? ' active' : ''}`} onClick={() => set({ rentalMonths: months })}>
                                        {form.rentalMonths === months && <Icon name="check" size={14} />}{tr('{months} tháng', { months })} {discountLabel(terms, months, unitTypeId) && <small>{discountLabel(terms, months, unitTypeId)}</small>}
                                    </button>
                                ))}
                            </div>
                            {rentSubtotal != null && (
                                <p className="se-period-summary">
                                    <span>{tr('Tổng cộng')}: {formatVnd(rentSubtotal)}</span>
                                    {form.rentalMonths > 1 && savingsAmount > 0 && discountPercent > 0 && (
                                        <span className="se-period-savings">
                                            {tr('Tiết kiệm {amount} ({percent}%)', { amount: formatVnd(savingsAmount), percent: discountPercent })}
                                        </span>
                                    )}
                                </p>
                            )}
                        </section>

                        <section className="se-panel">
                            <h2>3. {tr('Chúng tôi nên xếp kho cho bạn như thế nào?')}</h2>
                            {type && (
                                <p className="se-booking-note">
                                    {tr('Kho')} {type.code} · {type.areaM2.toLocaleString('vi-VN')} m² · {[type.width, type.depth, type.height].map((n) => n.toLocaleString('vi-VN')).join(' × ')} m
                                    {availableCount > 0 && <> &nbsp;<span className="se-badge">{tr('Còn trống trong ngày bạn chọn')}</span></>}
                                </p>
                            )}
                            {soldOut && (
                                <div className="se-alert" role="alert" style={{ marginTop: 12 }}>
                                    {tr('Không còn kho cỡ này trống trong ngày bạn chọn')}
                                </div>
                            )}

                            <div className="se-assign-modes" role="radiogroup" aria-label={tr('Chúng tôi nên xếp kho cho bạn như thế nào?')}>
                                <button
                                    type="button"
                                    role="radio"
                                    aria-checked={!isStaffAssisted && !selectedUnit}
                                    className={`se-assign-card${!isStaffAssisted && !selectedUnit ? ' active' : ''}`}
                                    onClick={() => set({ unitAssignmentMode: 'AUTO', storageUnitId: null })}
                                >
                                    <span className="se-assign-radio" aria-hidden="true" />
                                    <span className="se-assign-body">
                                        <strong>{tr('Tự động xếp kho')}</strong>
                                        <small>{tr('Chúng tôi sẽ xếp kho trống tốt nhất cho bạn.')}</small>
                                    </span>
                                </button>
                                {form.sameDay && availableUnits.map((unit) => (
                                    <button key={unit.storageUnitId} type="button" role="radio"
                                        aria-checked={selectedUnit?.storageUnitId === unit.storageUnitId}
                                        className={`se-assign-card${selectedUnit?.storageUnitId === unit.storageUnitId ? ' active' : ''}`}
                                        onClick={() => set({ unitAssignmentMode: 'AUTO', storageUnitId: unit.storageUnitId })}>
                                        <span className="se-assign-radio" aria-hidden="true" />
                                        <span className="se-assign-body"><strong>{unit.unitCode}</strong>
                                            <small>{[unit.floorName, unit.zone].filter(Boolean).join(' · ')}</small>
                                        </span>
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    role="radio"
                                    aria-checked={isStaffAssisted}
                                    className={`se-assign-card secondary${isStaffAssisted ? ' active' : ''}`}
                                    onClick={() => set({ unitAssignmentMode: 'STAFF_ASSISTED' })}
                                >
                                    <span className="se-assign-radio" aria-hidden="true" />
                                    <span className="se-assign-body">
                                        <strong>{tr('Có yêu cầu đặc biệt? Nhờ nhân viên tư vấn.')}</strong>
                                        <small>{tr('Nhân viên sẽ trao đổi và giúp bạn chọn kho sau khi xác nhận đặt kho.')}</small>
                                    </span>
                                </button>
                            </div>
                            {form.sameDay && <p className="se-hint">{tr('Chưa nhận kho lúc 20:30: đơn hết hạn')}</p>}

                            {isStaffAssisted && (
                                <div className="se-preferences-box">
                                    {form.sameDay && (
                                        <div className="se-alert info">
                                            {tr('Lưu ý nhận kho trong ngày: thời gian nhân viên phản hồi có thể làm chậm giờ nhận kho của bạn (yêu cầu sẽ được ưu tiên Khẩn cấp).')}
                                        </div>
                                    )}
                                    <div>
                                        <span className="se-label">{tr('Ưu tiên vị trí kho (không bắt buộc)')}</span>
                                        <div className="se-chips" role="group" aria-label={tr('Ưu tiên vị trí kho (không bắt buộc)')}>
                                            {PREFERENCE_TAGS.map((tag) => {
                                                const active = form.preferences.includes(tag.key);
                                                return (
                                                    <button
                                                        key={tag.key}
                                                        type="button"
                                                        aria-pressed={active}
                                                        className={`se-chip${active ? ' active' : ''}`}
                                                        onClick={() => togglePreference(tag.key)}
                                                    >
                                                        {active && <Icon name="check" size={14} />}
                                                        {tr(tag.label)}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <label>
                                        <span className="se-label">{tr('Ghi chú thêm (không bắt buộc)')}</span>
                                        <textarea
                                            className="se-textarea"
                                            rows={2}
                                            maxLength={300}
                                            placeholder={tr('Ví dụ: cần lối đi rộng cho xe đẩy hàng…')}
                                            value={form.preferenceNote}
                                            onChange={(e) => set({ preferenceNote: e.target.value })}
                                        />
                                    </label>
                                </div>
                            )}

                            <p className="se-hint" style={{ marginTop: 12 }}>
                                {quote.data ? <>{tr('Tiền thuê {rent} mỗi tháng khi thuê {months} tháng.', { rent: formatVnd(quote.data.monthlyRent), months: form.rentalMonths })} </> : null}
                                {isStaffAssisted
                                    ? tr('Nhân viên sẽ giúp bạn chọn kho sau khi bạn xác nhận.')
                                    : selectedUnit ? selectedUnit.unitCode : tr('Kho sẽ được hệ thống tự động xếp.')}
                            </p>
                            {(quote.isError || stock.isError) && !soldOut && <div className="se-alert" role="alert">{tr('Chưa có giá cho lựa chọn này. Hãy thử cỡ kho, cơ sở hoặc ngày khác.')}</div>}
                        </section>

                    </div>
                    <BookingSummary
                        facility={facility}
                        type={type}
                        moveInDate={activeMoveInDate}
                        rentalMonths={form.rentalMonths}
                        quote={quote}
                        sameDay={form.sameDay}
                        unitAssignmentMode={form.unitAssignmentMode}
                        unitCode={selectedUnit?.unitCode}
                    >
                        <button type="button" className="se-btn se-btn-primary se-btn-block se-booking-cta" disabled={!ready || soldOut || !quote.data} onClick={next}>
                            {soldOut
                                ? tr('Không còn kho cỡ này trống trong ngày bạn chọn')
                                : <>{tr('Tiếp tục')} <Icon name="arrow" size={16} /></>}
                        </button>
                    </BookingSummary>
                </div>
            </div>
        </>
    );
}
