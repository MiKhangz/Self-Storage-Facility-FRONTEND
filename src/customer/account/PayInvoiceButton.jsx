import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invoicesApi, paymentsApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import { formatVnd } from '../components/format.js';
import { Modal } from '../../staff/components/ui.jsx';
import { useT } from '../../i18n/I18n.jsx';

/** Pays an invoice's outstanding amount through the backend's online-gateway endpoint. */
export default function PayInvoiceButton({ invoice, className = 'se-btn se-btn-outline se-btn-sm', title = 'Xác nhận thanh toán', children = 'Thanh toán' }) {
    const queryClient = useQueryClient();
    const t = useT();
    // A page pop-up, not window.confirm: a browser that blocks dialogs answers "no" silently, and the button then
    // seems dead.
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

    return (
        <>
            <button type="button" className={className} onClick={() => { pay.reset(); setAsking(true); }}>{typeof children === 'string' ? t(children) : children}</button>
            {asking && (
                <Modal narrow onClose={() => setAsking(false)}>
                    <div className="se-panel">
                        <h2>{t(title)}</h2>
                        <dl className="se-pay-lines">
                            <dt>{t('Hóa đơn')}</dt><dd>{invoice.invoiceNumber}</dd>
                            <dt>{t('Số tiền')}</dt><dd className="se-pay-amount">{formatVnd(invoice.outstandingAmount)}</dd>
                        </dl>
                        {pay.isError && <div className="se-alert" role="alert">{errorMessage(pay.error)}</div>}
                        <div className="se-pay-actions">
                            <button type="button" className="se-btn se-btn-ghost" disabled={pay.isPending} onClick={() => setAsking(false)}>{t('Huỷ')}</button>
                            <button type="button" className="se-btn se-btn-primary" disabled={pay.isPending} onClick={() => pay.mutate()}>
                                {t(pay.isPending ? 'Đang thanh toán…' : 'Xác nhận')}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </>
    );
}
