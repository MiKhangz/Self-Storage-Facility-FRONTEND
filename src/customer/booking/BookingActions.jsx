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

/** A day from today to move-in and a time still ahead; `at` is what the API takes (Vietnam time). */
export function useAppointmentPicker(moveInDate) {
    const today = todayIso();
    const [day, setDay] = useState(moveInDate > today ? moveInDate : today);
    const [picked, setTime] = useState('09:00');
    // Today, only times still ahead (Vietnam time) can be booked.
    const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' });
    const slots = day === today ? SLOTS.filter((s) => s > now) : SLOTS;
    const time = slots.includes(picked) ? picked : slots[0];
    return { day, setDay, time, setTime, slots, today, moveInDate, at: time ? `${day}T${time}:00` : null };
}

/** The date and time boxes, shared by the booking form and the change-appointment form. */
export function AppointmentFields({ picker: p }) {
    const t = useT();
    return (
        <>
            <input type="date" value={p.day} min={p.today} max={p.moveInDate} onChange={(e) => p.setDay(e.target.value)} required aria-label={t('Ngày hẹn')} />
            <select value={p.time ?? ''} onChange={(e) => p.setTime(e.target.value)} aria-label={t('Giờ hẹn')}>
                {p.slots.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
        </>
    );
}

/** The time picked with the booking; once the deposit is paid it can be changed until it has passed. */
export function HandoverAppointment({ reservation: r }) {
    const t = useT();
    const queryClient = useQueryClient();
    const [editing, setEditing] = useState(false);
    const picker = useAppointmentPicker(r.moveInDate);
    const save = useMutation({
        mutationFn: () => reservationsApi.appointment(r.reservationId, { at: picker.at }),
        onSuccess: () => { setEditing(false); refresh(queryClient); },
    });
    if (!['Pending', 'Confirmed'].includes(r.status)) return null;
    if (r.depositStatus !== 'Paid') {
        return r.handoverSlot ? (
            <div className="se-appointment">
                <span><strong>{t('Lịch hẹn nhận kho')}:</strong> {formatDateTime(r.handoverSlot)}</span>
                <small className="se-hint">{t('Lịch hẹn có hiệu lực khi đã thanh toán tiền cọc.')}</small>
            </div>
        ) : null;
    }

    if (r.handoverSlot && !editing) {
        // A passed appointment cannot be moved (the server refuses it too).
        const passed = new Date(r.handoverSlot) < new Date();
        return (
            <div className="se-appointment">
                <span><strong>{t('Lịch hẹn nhận kho')}:</strong> {formatDateTime(r.handoverSlot)}</span>
                {!passed && <button type="button" className="se-btn se-btn-ghost se-btn-sm" onClick={() => setEditing(true)}>{t('Đổi lịch hẹn')}</button>}
                <small className="se-hint">{passed
                    ? t('Đã qua giờ hẹn nên không thể đổi lịch. Hãy đến nhận kho trong ngày hẹn, nếu không đơn sẽ hết hạn và tiền cọc không được hoàn.')
                    : t('Không đến đúng ngày hẹn, đơn sẽ hết hạn và tiền cọc không được hoàn.')}</small>
            </div>
        );
    }
    return (
        <form className="se-appointment" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <strong>{t('Chọn lịch hẹn nhận kho')}</strong>
            <div className="se-appointment-fields">
                <AppointmentFields picker={picker} />
                <button type="submit" className="se-btn se-btn-primary se-btn-sm" disabled={save.isPending || !picker.time}>{save.isPending ? t('Đang lưu…') : t('Đặt lịch')}</button>
            </div>
            <small className="se-hint">{t('Từ hôm nay đến ngày nhận kho {date}. Không đến đúng ngày hẹn, đơn sẽ hết hạn và tiền cọc không được hoàn.', { date: formatDate(r.moveInDate) })}</small>
            {save.isError && <div className="se-alert" role="alert">{errorMessage(save.error)}</div>}
        </form>
    );
}
