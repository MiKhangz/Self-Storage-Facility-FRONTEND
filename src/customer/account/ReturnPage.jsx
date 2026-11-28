import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { returnsApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import { useAuth } from '../../features/auth/AuthContext';
import Icon from '../components/Icon.jsx';
import { addDays, formatDate, formatVnd, todayIso, vietnamTimeHhMm } from '../components/format.js';
import { earlyReturnText, useTerms } from '../components/terms.js';
import PayInvoiceButton from './PayInvoiceButton.jsx';
import { OPEN_INVOICE, useMyContracts, useMyInvoices, useMyReservations } from './queries.js';
import './UnitDetailPage.css';
import { useLang, useT } from '../../i18n/I18n.jsx';

const MOVE_OUT_BADGE = {
    Requested: ['low', 'Đã gửi yêu cầu'],
    Approved: ['low', 'Đã hẹn kiểm tra'],
    Inspected: ['low', 'Đã kiểm tra kho'],
    AwaitingPayout: ['low', 'Đang chờ hoàn tiền'],
    Completed: ['', 'Đã hoàn tất'],
    Cancelled: ['none', 'Đã hủy'],
};

/** Days the customer has to empty the unit after asking to return it (ReturnService.MoveOutDays). */
const MOVE_OUT_DAYS = 15;
const HANDOVER_SLOTS = ['08:30', '09:30', '10:30', '11:30', '13:30', '14:30', '15:30', '16:30', '17:30', '18:30', '19:30', '20:30'];
const BANKS = ['Vietcombank', 'Techcombank', 'ACB', 'MB Bank', 'VPBank', 'BIDV', 'VietinBank', 'Sacombank', 'TPBank', 'VIB'];
const REFUND_WORK_DAYS = 3;

const stripDiacritics = (s = '') => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toUpperCase();

function formatDdMm(iso) {
    if (!iso) return '';
    const [, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}`;
}

function formatWeekdayChip(iso, lang = 'vi') {
    const d = new Date(`${iso}T00:00:00Z`);
    const dow = d.getUTCDay();
    if (lang === 'en') {
        const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return `${names[dow]} · ${formatDdMm(iso)}`;
    }
    const names = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    return `${names[dow]} · ${formatDdMm(iso)}`;
}

/*
// Old ReturnPage kept commented for reference:
export function OldReturnPage() { ... }
*/

export default function ReturnPage() {
    const [params] = useSearchParams();
    const t = useT();
    const { lang } = useLang();
    const { session } = useAuth();
    const queryClient = useQueryClient();
    const otherDateRef = useRef(null);
    const contracts = useMyContracts();
    const reservations = useMyReservations();
    const invoices = useMyInvoices();
    const requests = useQuery({ queryKey: ['returns'], queryFn: () => returnsApi.list({ page: 1, pageSize: 50 }) });

    const active = (contracts.data?.items ?? []).filter((c) => c.status === 'Active' || c.status === 'Overstay');
    const [picked, setPicked] = useState('');
    const contract = active.find((c) => c.contractId === (Number(picked) || Number(params.get('contractId')))) ?? active[0];
    const reservation = reservations.data?.items?.find((r) => r.reservationId === contract?.reservationId);
    const open = requests.data?.items?.find((m) => m.contractId === contract?.contractId && m.status !== 'Cancelled');
    const unpaidInvoices = (invoices.data?.items ?? []).filter(
        (i) => i.contractId === contract?.contractId && OPEN_INVOICE.includes(i.status) && !String(i.invoiceNumber ?? '').startsWith('OVS-'),
    );

    const terms = useTerms();
    const today = todayIso();
    const nowHhMm = vietnamTimeHhMm();
    const todaySlots = HANDOVER_SLOTS.filter((s) => s > nowHhMm);
    const todayClosed = todaySlots.length === 0;

    const day1 = addDays(today, 1);
    const day2 = addDays(today, 2);
    const day3 = addDays(today, 3);
    const deadline = addDays(today, MOVE_OUT_DAYS);
    const latest = contract?.endDate && contract.endDate < deadline ? contract.endDate : deadline;

    const defaultDate = todayClosed ? day1 : today;
    const defaultTime = todayClosed ? '10:30' : (todaySlots.includes('10:30') ? '10:30' : todaySlots[0]);

    const [form, setForm] = useState(() => ({
        plannedReturnDate: defaultDate,
        handoverTime: defaultTime,
        showReason: false,
        reason: '',
        bankName: '',
        accountNumber: '',
        accountHolder: stripDiacritics(session?.fullName ?? ''),
        confirmed: false,
    }));
    const set = (patch) => setForm((f) => ({ ...f, ...patch }));

    const activeDate = form.plannedReturnDate || defaultDate;
    const slotsForDate = activeDate === today ? todaySlots : HANDOVER_SLOTS;
    const activeTime = slotsForDate.includes(form.handoverTime) ? form.handoverTime : (slotsForDate[0] ?? '10:30');
    const isCustomDate = ![today, day1, day2, day3].includes(activeDate);

    const hasBank = Boolean(form.bankName.trim() && form.accountNumber.trim() && form.accountHolder.trim());
    const ready = Boolean(activeDate && activeTime && form.confirmed && hasBank);

    const missingParts = [
        !form.confirmed && t('tích ô xác nhận'),
        !hasBank && t('điền tài khoản nhận cọc'),
    ].filter(Boolean);

    const buildRefundAccount = () => {
        const raw = `${form.bankName.trim()} ${form.accountNumber.trim()} ${form.accountHolder.trim()}`.trim();
        return raw.slice(0, 50);
    };

    const buildReason = () => {
        const timeNote = `${t('Giờ hẹn')}: ${activeTime}`;
        const userReason = form.reason.trim();
        return (userReason ? `${timeNote} · ${userReason}` : timeNote).slice(0, 200);
    };

    const submit = useMutation({
        mutationFn: () => returnsApi.create({
            contractId: contract.contractId,
            plannedReturnDate: activeDate,
            reason: buildReason(),
            refundMethod: 'BankTransfer',
            refundAccount: buildRefundAccount(),
        }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['returns'] }),
    });

    if (contracts.isLoading) return <p className="se-empty">{t('Đang tải…')}</p>;
    if (!contract) {
        return (
            <>
                <div className="se-account-title"><div><h1>{t('Yêu cầu trả kho')}</h1></div></div>
                <div className="se-card se-empty">{t('Bạn không có kho nào đang thuê để trả.')} <Link to="/my-storage" className="se-link">{t('Quay lại Kho của tôi')}</Link></div>
            </>
        );
    }

    const earlyPolicy = terms.data
        ? earlyReturnText(terms.data, t)
        : t('Trả trước ngày hết hạn hợp đồng sẽ áp dụng chính sách hoàn cọc theo quy định đang hiệu lực.');

    return (
        <div className="se-return-v2">
            <div className="se-return-head">
                <h1>{t('Yêu cầu trả kho')}</h1>
                <div className="se-return-contract-pill">
                    <Icon name="box" size={16} />
                    <strong>{t('Kho')} {contract.unitCode}{reservation?.unitTypeName ? ` · ${reservation.unitTypeName}` : ''}</strong>
                    <span>{t('HĐ')} {contract.contractNumber} · {t('hết hạn {date}', { date: formatDate(contract.endDate) })}</span>
                    {active.length > 1 && (
                        <select
                            className="se-return-pill-switch"
                            value={contract.contractId}
                            onChange={(e) => setPicked(e.target.value)}
                            aria-label={t('Chọn kho khác')}
                        >
                            {active.map((c) => <option key={c.contractId} value={c.contractId}>{c.unitCode}</option>)}
                        </select>
                    )}
                </div>
            </div>

            {open ? (
                <div className="se-panel">
                    <div className="se-alert info">
                        {t('Bạn đã yêu cầu trả kho ngày {date}. Trạng thái:', { date: formatDate(open.plannedReturnDate) })}{' '}
                        <span className={`se-badge ${MOVE_OUT_BADGE[open.status]?.[0] ?? ''}`}>{t(MOVE_OUT_BADGE[open.status]?.[1] ?? open.status)}</span>
                        {open.inspectionSlot ? ` · ${t('lịch kiểm tra {date}', { date: formatDate(open.inspectionSlot) })}` : ''}
                        {open.moveOutDeadline ? ` · ${t('hạn dọn kho {date}', { date: formatDate(open.moveOutDeadline) })}` : ''}
                        {open.accessLockedAt && <strong> · {t('Đã quá hạn dọn kho, quyền ra vào đã bị khoá.')}</strong>}
                    </div>
                    <div style={{ marginTop: 16 }}>
                        <Link to={`/my-storage/units/${contract.contractId}`} className="se-btn se-btn-outline">{t('Quay lại kho {code}', { code: contract.unitCode })}</Link>
                    </div>
                </div>
            ) : unpaidInvoices.length > 0 ? (
                <div className="se-panel">
                    <div className="se-alert" role="alert">
                        <strong>{t('Vui lòng thanh toán các hóa đơn chưa hoàn tất trước khi gửi yêu cầu trả kho.')}</strong>
                        <p style={{ margin: '6px 0 0' }}>
                            {t('Kho {code} hiện có {n} hóa đơn chưa thanh toán ({amount}).', {
                                code: contract.unitCode,
                                n: unpaidInvoices.length,
                                amount: formatVnd(unpaidInvoices.reduce((s, i) => s + (i.outstandingAmount ?? 0), 0)),
                            })}
                        </p>
                    </div>
                    <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <PayInvoiceButton invoice={unpaidInvoices[0]} className="se-btn se-btn-primary">{t('Thanh toán ngay')}</PayInvoiceButton>
                        <Link to="/payments" className="se-btn se-btn-outline">{t('Xem tất cả hóa đơn')}</Link>
                        <Link to={`/my-storage/units/${contract.contractId}`} className="se-btn se-btn-ghost">{t('Quay lại kho {code}', { code: contract.unitCode })}</Link>
                    </div>
                </div>
            ) : (
                <form className="se-return-grid" onSubmit={(e) => { e.preventDefault(); if (ready) submit.mutate(); }}>
                    <div className="se-panel se-return-main-card">
                        <section className="se-return-sec">
                            <h2>{t('1. Chọn ngày và giờ bàn giao')}</h2>

                            <div className="se-return-days" role="radiogroup" aria-label={t('Ngày dự kiến trả kho')}>
                                <button
                                    type="button"
                                    role="radio"
                                    disabled={todayClosed}
                                    aria-checked={activeDate === today}
                                    className={`se-return-day-btn${activeDate === today ? ' active' : ''}${todayClosed ? ' disabled' : ''}`}
                                    onClick={() => !todayClosed && set({ plannedReturnDate: today })}
                                >
                                    <strong>{t('Hôm nay')}</strong>
                                    <small>{todayClosed ? t('Đã hết giờ nhận') : formatDdMm(today)}</small>
                                </button>

                                {[day1, day2, day3].map((iso, idx) => (
                                    <button
                                        key={iso}
                                        type="button"
                                        role="radio"
                                        aria-checked={activeDate === iso}
                                        className={`se-return-day-btn${activeDate === iso ? ' active' : ''}`}
                                        onClick={() => set({ plannedReturnDate: iso })}
                                    >
                                        <strong>{formatWeekdayChip(iso, lang)}</strong>
                                        {idx === 0 && todayClosed && <small>{t('Sớm nhất')}</small>}
                                    </button>
                                ))}

                                <label className={`se-return-day-btn other${isCustomDate ? ' active' : ''}`}>
                                    <strong>{isCustomDate ? formatWeekdayChip(activeDate, lang) : t('Ngày khác')}</strong>
                                    <small>{t('Hạn chót {date}', { date: formatDdMm(latest) })}</small>
                                    <input
                                        ref={otherDateRef}
                                        type="date"
                                        min={todayClosed ? day1 : today}
                                        max={latest}
                                        value={activeDate}
                                        aria-label={t('Ngày khác')}
                                        onChange={(e) => e.target.value && set({ plannedReturnDate: e.target.value })}
                                        onClick={(e) => e.currentTarget.showPicker?.()}
                                    />
                                </label>
                            </div>

                            <p className="se-return-slot-caption">
                                {todayClosed
                                    ? t('Hôm nay đã quá giờ nhận bàn giao (cuối cùng 20:30). Giờ bàn giao cho ngày {date}:', { date: formatDdMm(activeDate) })
                                    : t('Giờ bàn giao cho ngày {date}:', { date: formatDdMm(activeDate) })}
                            </p>

                            <div className="se-return-slots" role="radiogroup" aria-label={t('Giờ hẹn')}>
                                {HANDOVER_SLOTS.map((slot) => {
                                    const slotDisabled = activeDate === today && !todaySlots.includes(slot);
                                    const isSelected = activeTime === slot && !slotDisabled;
                                    return (
                                        <button
                                            key={slot}
                                            type="button"
                                            role="radio"
                                            disabled={slotDisabled}
                                            aria-checked={isSelected}
                                            className={`se-return-slot-btn${isSelected ? ' active' : ''}`}
                                            onClick={() => !slotDisabled && set({ handoverTime: slot })}
                                        >
                                            {slot}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="se-return-deadline-banner">
                                <span className="se-return-warn-icon" aria-hidden="true">!</span>
                                <p>
                                    <strong>{t('Hạn chót dọn kho: {date}.', { date: formatDate(deadline) })}</strong>{' '}
                                    {t('Sau ngày này quyền ra vào kho sẽ bị khóa.')}
                                </p>
                            </div>

                            {!form.showReason ? (
                                <button type="button" className="se-return-add-reason" onClick={() => set({ showReason: true })}>
                                    {t('+ Thêm lý do trả kho (không bắt buộc)')}
                                </button>
                            ) : (
                                <label className="se-return-reason-box">
                                    <span className="se-label">{t('Lý do (không bắt buộc)')}</span>
                                    <div className="se-input">
                                        <input
                                            maxLength={160}
                                            value={form.reason}
                                            onChange={(e) => set({ reason: e.target.value })}
                                            placeholder={t('Ví dụ: chuyển sang kho lớn hơn')}
                                        />
                                    </div>
                                </label>
                            )}
                        </section>

                        <hr className="se-return-divider" />

                        <section className="se-return-sec">
                            <h2>{t('2. Nhận lại tiền cọc')}</h2>
                            <div className="se-return-bank-grid">
                                <label>
                                    <span className="se-label">{t('Ngân hàng')}</span>
                                    <div className="se-field se-return-input">
                                        <select value={form.bankName} onChange={(e) => set({ bankName: e.target.value })}>
                                            <option value="">{t('Chọn ngân hàng')}</option>
                                            {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                    </div>
                                </label>
                                <label>
                                    <span className="se-label">{t('Số tài khoản')}</span>
                                    <div className="se-input se-return-input">
                                        <input
                                            maxLength={25}
                                            value={form.accountNumber}
                                            onChange={(e) => set({ accountNumber: e.target.value })}
                                            placeholder={t('Nhập số tài khoản')}
                                        />
                                    </div>
                                </label>
                                <label>
                                    <span className="se-label">{t('Tên chủ tài khoản')}</span>
                                    <div className="se-input se-return-input">
                                        <input
                                            maxLength={30}
                                            value={form.accountHolder}
                                            onChange={(e) => set({ accountHolder: e.target.value.toUpperCase() })}
                                            placeholder="NGUYEN VAN A"
                                        />
                                    </div>
                                </label>
                            </div>
                        </section>

                        <hr className="se-return-divider" />

                        <label className="se-check se-return-confirm-check">
                            <input
                                type="checkbox"
                                checked={form.confirmed}
                                onChange={(e) => set({ confirmed: e.target.checked })}
                            />
                            <span>
                                <strong>{t('Tôi xác nhận')}</strong>{' '}
                                {t('sẽ dọn trống kho, tháo ổ khóa riêng, có mặt khi kiểm tra (hoặc cử người có giấy ủy quyền) và đồng ý trừ phí vệ sinh/sửa chữa (nếu có) vào tiền cọc.')}
                            </span>
                        </label>
                    </div>

                    <aside className="se-return-side">
                        <div className="se-panel se-return-summary-card">
                            <h3>{t('Tóm tắt yêu cầu')}</h3>

                            <div className="se-return-sum-block">
                                <small>{t('Hẹn bàn giao')}</small>
                                <strong className="se-return-sum-slot">{formatDate(activeDate)} · {activeTime}</strong>
                            </div>

                            <hr className="se-return-divider" />

                            <div className="se-return-sum-block">
                                <small>{t('Tiền cọc hoàn lại, tối đa')}</small>
                                <strong className="se-return-sum-amount">{formatVnd(contract.depositAmount)}</strong>
                                <p className="se-return-sum-note">
                                    {t('Trừ phí vệ sinh/hư hỏng (nếu có), xác định khi kiểm tra. Hoàn trong {days} ngày làm việc.', { days: REFUND_WORK_DAYS })}
                                </p>
                            </div>

                            {submit.isError && <div className="se-alert" role="alert">{errorMessage(submit.error)}</div>}

                            <button
                                type="submit"
                                className="se-btn se-btn-primary se-btn-block se-return-submit-btn"
                                disabled={!ready || submit.isPending}
                            >
                                {submit.isPending ? t('Đang gửi…') : t('Gửi yêu cầu trả kho')}
                            </button>

                            {missingParts.length > 0 && (
                                <p className="se-return-missing">
                                    {t('Còn thiếu')}: {missingParts.join(' · ')}
                                </p>
                            )}

                            <Link to={`/my-storage/units/${contract.contractId}`} className="se-return-cancel-link">
                                {t('Hủy')}
                            </Link>
                        </div>

                        <div className="se-return-foot-notes">
                            <p>
                                <strong>{t('Sau khi gửi:')}</strong>{' '}
                                {t('nhân viên xác nhận giờ hẹn → bạn dọn kho và tháo khóa → cùng kiểm tra, trả thẻ ra vào → hoàn cọc.')}
                            </p>
                            <p>
                                {t('Trả trước ngày hết hạn HĐ ({date}):', { date: formatDate(contract.endDate) })} {earlyPolicy}
                            </p>
                        </div>
                    </aside>
                </form>
            )}
        </div>
    );
}
