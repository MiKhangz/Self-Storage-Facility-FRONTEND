import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reservationsApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import { confirmAction } from '../components/confirm.js';
import { formatDate, todayIso } from '../components/format.js';
import Icon from '../components/Icon.jsx';
import { formatDateTime } from '../support/support.js';
import { useT } from '../../i18n/I18n.jsx';

const refresh = (queryClient) => ['reservations', 'invoices', 'deposit-refunds'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));

/** Staff need another unit for this booking: the customer takes it, or cancels with the whole deposit back. */
export function UnitProposal({ reservation: r }) {
    const t = useT();
    const queryClient = useQueryClient();
    const accept = useMutation({ mutationFn: () => reservationsApi.acceptUnit(r.reservationId), onSuccess: () => refresh(queryClient) });
    const decline = useMutation({ mutationFn: () => reservationsApi.declineUnit(r.reservationId), onSuccess: () => refresh(queryClient) });
    if (!r.proposedUnitCode || !['Pending', 'Confirmed'].includes(r.status)) return null;
    const busy = accept.isPending || decline.isPending;
    const failed = accept.error ?? decline.error;
    return (
        <div className="se-alert info se-proposal" role="status">
            <p><strong>{t('Kho của bạn cần đổi sang {code}', { code: r.proposedUnitCode })}</strong></p>
            <p>{t('Kho {old} không còn trống cho thời gian bạn thuê. Kho {code} cùng cỡ, cùng giá. Bạn đồng ý đổi, hoặc huỷ đơn và được hoàn lại toàn bộ tiền cọc.', { old: r.unitCode, code: r.proposedUnitCode })}</p>
            {failed && <div className="se-alert" role="alert">{errorMessage(failed)}</div>}
            <div className="se-proposal-actions">
                <button type="button" className="se-btn se-btn-primary se-btn-sm" disabled={busy} onClick={() => accept.mutate()}>
                    {t('Đồng ý đổi sang {code}', { code: r.proposedUnitCode })}
                </button>
                <button type="button" className="se-btn se-btn-ghost se-btn-sm" disabled={busy}
                    onClick={() => confirmAction(t('Huỷ đơn {code}? Toàn bộ tiền cọc sẽ được hoàn lại.', { code: r.reservationCode })).then((ok) => ok && decline.mutate())}>
                    {t('Không đồng ý, huỷ đơn')}
                </button>
            </div>
        </div>
    );
}

// Opening hours for handovers, as the backend checks them (07:00–21:00, Vietnam time).
const SLOTS = Array.from({ length: 28 }, (_, i) => `${String(7 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);

const formatAmPm = (hhmm) => {
    const [hStr, mStr] = hhmm.split(':');
    const h = Number(hStr);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const h12 = String(h % 12 || 12).padStart(2, '0');
    return `${h12}:${mStr} ${suffix}`;
};

function TimeDropdown({ value, slots, onChange, t }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const onDocClick = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        const onKey = (e) => e.key === 'Escape' && setOpen(false);
        document.addEventListener('mousedown', onDocClick);
        window.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDocClick);
            window.removeEventListener('keydown', onKey);
        };
    }, [open]);

    return (
        <div ref={ref} className={`se-time-dropdown${open ? ' open' : ''}`}>
            <button
                type="button"
                className={`se-time-pill${open ? ' open' : ''}`}
                disabled={!slots.length}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={t('Giờ hẹn')}
                onClick={() => slots.length && setOpen((o) => !o)}
            >
                <span className="se-time-pill-icon"><Icon name="clock" size={20} /></span>
                <span className="se-time-pill-value">{value ? formatAmPm(value) : t('Đã hết giờ hẹn hôm nay')}</span>
                <span className="se-time-pill-chevron"><Icon name="down" size={18} /></span>
            </button>
            {open && slots.length > 0 && (
                <ul className="se-time-menu" role="listbox" aria-label={t('Giờ hẹn')}>
                    {slots.map((s) => (
                        <li key={s} role="option" aria-selected={s === value}>
                            <button
                                type="button"
                                className={s === value ? 'active' : ''}
                                onClick={() => {
                                    onChange(s);
                                    setOpen(false);
                                }}
                            >
                                {formatAmPm(s)}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

/** After the deposit, the customer books a time to receive the unit. Missing it forfeits the deposit. */
export function HandoverAppointment({ reservation: r }) {
    const t = useT();
    const queryClient = useQueryClient();
    const today = todayIso();
    const isSameDay = !!(r.sameDay || r.moveInDate <= today);
    const [editing, setEditing] = useState(false);
    const [day, setDay] = useState(isSameDay ? today : (r.moveInDate > today ? r.moveInDate : today));
    const [picked, setTime] = useState('09:00');
    const activeDay = isSameDay ? today : day;
    // Today, only times still ahead (Vietnam time) can be booked.
    const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' });
    const slots = SLOTS.filter((s) => (activeDay !== today || s > now) && (!r.sameDay || s < '20:30'));
    const time = slots.includes(picked) ? picked : slots[0];
    const save = useMutation({
        mutationFn: () => reservationsApi.appointment(r.reservationId, { at: `${activeDay}T${time}:00` }),
        onSuccess: () => { setEditing(false); refresh(queryClient); },
    });
    if (r.status !== 'Confirmed' || r.depositStatus !== 'Paid') return null;

    if (r.handoverSlot && !editing) {
        // A passed appointment cannot be moved (the server refuses it too).
        const passed = new Date(r.handoverSlot) < new Date();
        return (
            <div className="se-card se-appointment-box">
                <div className="se-appointment-head">
                    <span><strong>{t('Lịch hẹn nhận kho')}:</strong> {formatDateTime(r.handoverSlot)}</span>
                    {!passed && <button type="button" className="se-btn se-btn-ghost se-btn-sm" onClick={() => setEditing(true)}>{t('Đổi lịch hẹn')}</button>}
                </div>
                <small className="se-hint">{passed
                    ? t('Đã qua giờ hẹn nên không thể đổi lịch. Hãy đến nhận kho trong ngày hẹn, nếu không đơn sẽ hết hạn và tiền cọc không được hoàn.')
                    : t('Không đến đúng ngày hẹn, đơn sẽ hết hạn và tiền cọc không được hoàn.')}</small>
            </div>
        );
    }
    return (
        <form className="se-card se-appointment-box has-dot" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <span className="se-red-dot" title={t('Hãy chọn lịch hẹn nhận kho')} aria-label={t('Hãy chọn lịch hẹn nhận kho')} />
            <div className="se-appointment-head">
                <strong>{t('Chọn lịch hẹn nhận kho')}</strong>
                {isSameDay && <span className="se-badge low">{t('Hôm nay')} · {formatDate(today)}</span>}
            </div>
            <div className="se-appointment-fields">
                {!isSameDay && (
                    <label className="se-time-pill">
                        <span className="se-time-pill-icon"><Icon name="calendar" size={20} /></span>
                        <input type="date" value={day} min={today} max={r.moveInDate} onChange={(e) => setDay(e.target.value)} required aria-label={t('Ngày hẹn')} />
                    </label>
                )}
                <TimeDropdown value={time} slots={slots} onChange={setTime} t={t} />
                <button type="submit" className="se-btn se-btn-primary se-appointment-submit" disabled={save.isPending || !time}>{save.isPending ? t('Đang lưu…') : t('Đặt lịch')}</button>
            </div>
            <small className="se-hint">
                {isSameDay
                    ? t('Nhận kho ngay hôm nay ({date}). Hãy chọn giờ bạn đến nhận kho.', { date: formatDate(today) })
                    : t('Từ hôm nay đến ngày nhận kho {date}. Không đến đúng ngày hẹn, đơn sẽ hết hạn và tiền cọc không được hoàn.', { date: formatDate(r.moveInDate) })}
            </small>
            {save.isError && <div className="se-alert" role="alert">{errorMessage(save.error)}</div>}
        </form>
    );
}
