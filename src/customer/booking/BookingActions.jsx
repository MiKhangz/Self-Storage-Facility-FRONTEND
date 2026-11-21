import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reservationsApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import { confirmAction } from '../components/confirm.js';
import { formatDate, todayIso } from '../components/format.js';
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

/** After the deposit, the customer books a time to receive the unit. Missing it forfeits the deposit. */
export function HandoverAppointment({ reservation: r }) {
    const t = useT();
    const queryClient = useQueryClient();
    const today = todayIso();
    const [editing, setEditing] = useState(false);
    const [day, setDay] = useState(r.moveInDate > today ? r.moveInDate : today);
    const [picked, setTime] = useState('09:00');
    // Today, only times still ahead (Vietnam time) can be booked.
    const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' });
    const slots = day === today ? SLOTS.filter((s) => s > now) : SLOTS;
    const time = slots.includes(picked) ? picked : slots[0];
    const save = useMutation({
        mutationFn: () => reservationsApi.appointment(r.reservationId, { at: `${day}T${time}:00` }),
        onSuccess: () => { setEditing(false); refresh(queryClient); },
    });
    if (!['Pending', 'Confirmed'].includes(r.status) || r.depositStatus !== 'Paid') return null;

    if (r.handoverSlot && !editing) {
        return (
            <div className="se-appointment">
                <span><strong>{t('Lịch hẹn nhận kho')}:</strong> {formatDateTime(r.handoverSlot)}</span>
                <button type="button" className="se-btn se-btn-ghost se-btn-sm" onClick={() => setEditing(true)}>{t('Đổi lịch hẹn')}</button>
                <small className="se-hint">{t('Không đến đúng ngày hẹn, đơn sẽ hết hạn và tiền cọc không được hoàn.')}</small>
            </div>
        );
    }
    return (
        <form className="se-appointment" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <strong>{t('Chọn lịch hẹn nhận kho')}</strong>
            <div className="se-appointment-fields">
                <input type="date" value={day} min={today} max={r.moveInDate} onChange={(e) => setDay(e.target.value)} required aria-label={t('Ngày hẹn')} />
                <select value={time} onChange={(e) => setTime(e.target.value)} aria-label={t('Giờ hẹn')}>
                    {slots.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <button type="submit" className="se-btn se-btn-primary se-btn-sm" disabled={save.isPending || !time}>{save.isPending ? t('Đang lưu…') : t('Đặt lịch')}</button>
            </div>
            <small className="se-hint">{t('Từ hôm nay đến ngày nhận kho {date}. Không đến đúng ngày hẹn, đơn sẽ hết hạn và tiền cọc không được hoàn.', { date: formatDate(r.moveInDate) })}</small>
            {save.isError && <div className="se-alert" role="alert">{errorMessage(save.error)}</div>}
        </form>
    );
}
