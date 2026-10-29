import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reservationsApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import { formatVnd } from '../components/format.js';
import { useTerms } from '../components/terms.js';
import { useT } from '../../i18n/I18n.jsx';

const time = (d) => d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });

/**
 * The customer cancels a booking that has not been handed over. A paid deposit comes back only inside the free
 * window after booking (the policy's cancelFreeHours); the page says which before they confirm.
 */
export default function CancelBooking({ reservation }) {
    const queryClient = useQueryClient();
    const t = useT();
    const terms = useTerms().data;
    const cancel = useMutation({
        mutationFn: () => reservationsApi.cancel(reservation.reservationId, { reason: null }),
        // The booking itself refreshes on "Đóng": it becomes Cancelled, which would remove this message before it is read.
        onSuccess: () => ['invoices', 'deposit-refunds'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] })),
    });
    const paid = reservation.depositStatus === 'Paid' ? reservation.depositAmount : 0;
    const freeUntil = terms && new Date(Date.parse(reservation.createdAt) + terms.cancelFreeHours * 3_600_000);
    const refundable = freeUntil && new Date() <= freeUntil;
    const outcome = !paid
        ? t('Bạn chưa đóng cọc nên không mất khoản nào.')
        : refundable
            ? t('Huỷ trước {time} được hoàn lại {amount} tiền cọc.', { time: time(freeUntil), amount: formatVnd(paid) })
            : t('Đã quá {hours} giờ kể từ lúc đặt nên {amount} tiền cọc sẽ không được hoàn.', { hours: terms?.cancelFreeHours ?? 24, amount: formatVnd(paid) });

    if (cancel.data) {
        const r = cancel.data;
        return (
            <div className="se-alert info" role="status">
                {t('Đã huỷ đơn {code}.', { code: r.reservation.reservationCode })}{' '}
                {r.depositPaid > 0 && (r.depositRefundable
                    ? t('Tiền cọc {amount} sẽ được hoàn lại; theo dõi ở mục Thanh toán và hóa đơn.', { amount: formatVnd(r.depositPaid) })
                    : t('Tiền cọc {amount} không được hoàn.', { amount: formatVnd(r.depositPaid) }))}
                {' '}<button type="button" className="se-btn se-btn-ghost se-btn-sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['reservations'] })}>{t('Đóng')}</button>
            </div>
        );
    }
    return (
        <div className="se-cancel-booking">
            <p className="se-hint">{outcome}</p>
            {cancel.isError && <div className="se-alert" role="alert">{errorMessage(cancel.error)}</div>}
            <button type="button" className="se-btn se-btn-ghost" disabled={cancel.isPending || !terms}
                onClick={() => window.confirm(`${t('Huỷ đơn đặt kho {code}?', { code: reservation.reservationCode })} ${outcome}`) && cancel.mutate()}>
                {cancel.isPending ? t('Đang huỷ…') : t('Huỷ đặt kho')}
            </button>
        </div>
    );
}
