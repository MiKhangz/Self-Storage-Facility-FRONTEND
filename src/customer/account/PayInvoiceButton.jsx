import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invoicesApi, paymentsApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import { formatVnd } from '../components/format.js';

/** Pays an invoice's outstanding amount through the backend's online-gateway endpoint. */
export default function PayInvoiceButton({ invoice, className = 'se-btn se-btn-primary se-btn-sm', children = 'Thanh toán' }) {
    const queryClient = useQueryClient();
    const pay = useMutation({
        // ponytail: the backend's development-only simulate-success stands in for the gateway. Once VNPay/MoMo
        // is live, send the customer to intent.checkoutUrl instead and let the gateway callback credit the invoice.
        mutationFn: async () => {
            const intent = await invoicesApi.paymentsOnline(invoice.invoiceId, { amount: invoice.outstandingAmount, referenceNo: null });
            return paymentsApi.simulateSuccess(intent.paymentCode);
        },
        onSuccess: () => ['invoices', 'reservations'].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] })),
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
