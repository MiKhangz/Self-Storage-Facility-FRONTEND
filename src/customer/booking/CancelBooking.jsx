import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reservationsApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import { formatVnd } from '../components/format.js';
import { useTerms } from '../components/terms.js';

const time = (d) => d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });

/**
 * The customer cancels a booking that has not been handed over. A paid deposit comes back only inside the free
 * window after booking (the policy's cancelFreeHours); the page says which before they confirm.
 */
export default function CancelBooking({ reservation }) {
    const queryClient = useQueryClient();
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
        ? 'Bạn chưa đóng cọc nên không mất khoản nào.'
        : refundable
            ? `Huỷ trước ${time(freeUntil)} được hoàn lại ${formatVnd(paid)} tiền cọc.`
            : `Đã quá ${terms?.cancelFreeHours ?? 24} giờ kể từ lúc đặt nên ${formatVnd(paid)} tiền cọc sẽ không được hoàn.`;

    if (cancel.data) {
        const r = cancel.data;
        return (
            <div className="se-alert info" role="status">
                Đã huỷ đơn {r.reservation.reservationCode}.{' '}
                {r.depositPaid > 0 && (r.depositRefundable
                    ? `Tiền cọc ${formatVnd(r.depositPaid)} sẽ được hoàn lại; theo dõi ở mục Thanh toán và hóa đơn.`
                    : `Tiền cọc ${formatVnd(r.depositPaid)} không được hoàn.`)}
                {' '}<button type="button" className="se-btn se-btn-ghost se-btn-sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['reservations'] })}>Đóng</button>
            </div>
        );
    }
    return (
        <div className="se-cancel-booking">
            <p className="se-hint">{outcome}</p>
            {cancel.isError && <div className="se-alert" role="alert">{errorMessage(cancel.error)}</div>}
            <button type="button" className="se-btn se-btn-ghost" disabled={cancel.isPending || !terms}
                onClick={() => window.confirm(`Huỷ đơn đặt kho ${reservation.reservationCode}? ${outcome}`) && cancel.mutate()}>
                {cancel.isPending ? 'Đang huỷ…' : 'Huỷ đặt kho'}
            </button>
        </div>
    );
}
