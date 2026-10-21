import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invoicesApi, paymentsApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import { formatVnd } from '../components/format.js';

/** Pays an invoice's outstanding amount through the backend's online-gateway endpoint. */
export default function PayInvoiceButton({ invoice, className = 'se-btn se-btn-outline se-btn-sm', children = 'Thanh toán' }) {
    const queryClient = useQueryClient();
    const pay = useMutation({
        // With VNPay configured the backend returns VNPay's checkout page: leave the site and pay there; VNPay sends
        // the customer back to VnPayReturnPage. Otherwise (demo) the development-only simulate-success pays at once.
        mutationFn: async () => {
            const intent = await invoicesApi.paymentsOnline(invoice.invoiceId, { amount: invoice.outstandingAmount, referenceNo: null });
            if (intent.checkoutUrl?.includes('vnpayment.vn')) {
                window.location.assign(intent.checkoutUrl);
                return 'redirected';
            }
            return paymentsApi.simulateSuccess(intent.paymentCode);
        },
        onSuccess: (result) => result !== 'redirected' && ['invoices', 'reservations'].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] })),
        onError: (err) => window.alert(errorMessage(err)),
    });

    const confirmAndPay = () => {
        if (window.confirm(`Thanh toán ${formatVnd(invoice.outstandingAmount)} cho hóa đơn ${invoice.invoiceNumber}?`)) pay.mutate();
    };

    return (
        <button type="button" className={className} onClick={confirmAndPay} disabled={pay.isPending}>
            {pay.isPending ? 'Đang thanh toán…' : children}
        </button>
    );
}
