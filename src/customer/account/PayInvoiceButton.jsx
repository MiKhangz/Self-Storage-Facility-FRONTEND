import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invoicesApi, paymentsApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import { formatVnd } from '../components/format.js';
import { useT } from '../../i18n/I18n.jsx';

/** Pays an invoice's outstanding amount through the backend's online-gateway endpoint. */
export default function PayInvoiceButton({ invoice, className = 'se-btn se-btn-outline se-btn-sm', children = 'Thanh toán' }) {
    const queryClient = useQueryClient();
    const t = useT();
    // Asked on the page, not with window.confirm: a browser that blocks dialogs answers "no" silently, and the
    // button then seems dead.
    const [asking, setAsking] = useState(false);
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
        onSuccess: (result) => {
            setAsking(false);
            if (result !== 'redirected') ['invoices', 'reservations'].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
        },
    });

    if (!asking) {
        return <button type="button" className={className} onClick={() => { pay.reset(); setAsking(true); }}>{typeof children === 'string' ? t(children) : children}</button>;
    }
    return (
        <span className="se-pay-confirm" role="group" aria-label={t('Xác nhận thanh toán hóa đơn {number}', { number: invoice.invoiceNumber })}>
            <span>{t('Thanh toán')} <strong>{formatVnd(invoice.outstandingAmount)}</strong> {t('cho {number}?', { number: invoice.invoiceNumber })}</span>
            <button type="button" className="se-btn se-btn-ghost se-btn-sm" disabled={pay.isPending} onClick={() => setAsking(false)}>{t('Huỷ')}</button>
            <button type="button" className="se-btn se-btn-primary se-btn-sm" disabled={pay.isPending} onClick={() => pay.mutate()}>
                {t(pay.isPending ? 'Đang thanh toán…' : 'Xác nhận')}
            </button>
            {pay.isError && <span className="se-pay-error" role="alert">{errorMessage(pay.error)}</span>}
        </span>
    );
}
