import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invoicesApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import { formatVnd } from '../components/format.js';

/** Pays an invoice's outstanding amount through the backend's online-gateway endpoint. */
export default function PayInvoiceButton({ invoice, className = 'se-btn se-btn-primary se-btn-sm', children = 'Pay' }) {
    const queryClient = useQueryClient();
    const pay = useMutation({
        // ponytail: no real gateway yet; the reference stands in for one until VNPay/MoMo is wired in.
        mutationFn: () => invoicesApi.paymentsOnline(invoice.invoiceId, { amount: invoice.outstandingAmount, referenceNo: `WEB-${Date.now()}` }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
        onError: (err) => window.alert(errorMessage(err)),
    });

    const confirmAndPay = () => {
        if (window.confirm(`Pay ${formatVnd(invoice.outstandingAmount)} for invoice ${invoice.invoiceNumber}?`)) pay.mutate();
    };

    return (
        <button type="button" className={className} onClick={confirmAndPay} disabled={pay.isPending}>
            {pay.isPending ? 'Paying…' : children}
        </button>
    );
}
