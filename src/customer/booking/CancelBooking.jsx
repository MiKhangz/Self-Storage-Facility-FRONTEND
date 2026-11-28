import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reservationsApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import { formatVnd } from '../components/format.js';
import { useTerms } from '../components/terms.js';
import { useT } from '../../i18n/I18n.jsx';
import { confirmAction } from '../components/confirm.js';

const time = (d) => d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });

/**
 * The customer cancels a booking that has not been handed over. A paid deposit comes back only inside the free
 * window after booking (the policy's cancelFreeHours), or whenever StorEase has no unit ready for the booking; the
 * page says which before they confirm.
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
    const isSameDay = !!reservation.sameDay;
    const cancelHours = isSameDay ? 3 : (terms?.cancelFreeHours ?? 24);
    const freeUntil = (isSameDay || terms) && new Date(Date.parse(reservation.createdAt) + cancelHours * 3_600_000);
    const refundable = freeUntil && new Date() <= freeUntil;
    const notReady = reservation.unitBlocked || !!reservation.proposedUnitCode;
    const retainedFund = Math.max(Math.round(paid / 30), 100000);
    const partialRefund = Math.max(paid - retainedFund, 0);
    const outcome = !paid
        ? t('Bạn chưa đóng cọc nên không mất khoản nào.')
        : notReady
            ? t('Kho chưa sẵn sàng cho bạn nên huỷ lúc nào cũng được hoàn toàn bộ {amount} tiền cọc.', { amount: formatVnd(paid) })
            : refundable
                ? t('Huỷ trước {time} được hoàn lại {amount} tiền cọc.', { time: time(freeUntil), amount: formatVnd(paid) })
                : isSameDay
                    ? t('Đã quá 3 giờ kể từ lúc đặt (hoặc không nhận kho trước 20:30): hoàn lại {amount} (khoản đã trả − {fee}).', { amount: formatVnd(partialRefund), fee: formatVnd(retainedFund) })
                    : t('Đã quá {hours} giờ kể từ lúc đặt nên {amount} tiền cọc sẽ không được hoàn.', { hours: cancelHours, amount: formatVnd(paid) });

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
                onClick={() => confirmAction(`${t('Huỷ đơn đặt kho {code}?', { code: reservation.reservationCode })} ${outcome}`).then((ok) => ok && cancel.mutate())}>
                {cancel.isPending ? t('Đang huỷ…') : t('Huỷ đặt kho')}
            </button>
        </div>
    );
}
