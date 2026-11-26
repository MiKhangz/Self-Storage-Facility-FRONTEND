import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../../api/axiosClient';
import Icon from '../components/Icon.jsx';
import { formatVnd } from '../components/format.js';
import { useT } from '../../i18n/I18n.jsx';

/**
 * VNPay sends the customer back here. The page forwards VNPay's signed parameters to the backend, which checks the
 * signature and records the result (the same check as VNPay's server-to-server IPN, so a repeat is harmless).
 */
export default function VnPayReturnPage() {
    const [params] = useSearchParams();
    const t = useT();
    const vnp = Object.fromEntries([...params].filter(([k]) => k.startsWith('vnp_')));
    const paid = vnp.vnp_ResponseCode === '00' && vnp.vnp_TransactionStatus === '00';
    // The generated client does not declare VNPay's dynamic query parameters, so this one call uses the shared axios client.
    const result = useQuery({
        queryKey: ['vnpay-return', vnp.vnp_TxnRef, vnp.vnp_ResponseCode],
        queryFn: () => api.get('/api/payments/vnpay-return', { params: vnp }).then((r) => r.data),
        enabled: !!vnp.vnp_TxnRef,
    });

    return (
        <section className="se-panel" style={{ maxWidth: 560, margin: '40px auto', textAlign: 'center' }}>
            {result.isLoading && <p>{t('Đang xác nhận thanh toán…')}</p>}
            {result.isError && <div className="se-alert" role="alert">{t('Không xác nhận được thanh toán:')} {errorMessage(result.error)}</div>}
            {result.data && (paid ? (
                <>
                    <span className="se-confirm-icon"><Icon name="check" size={28} /></span>
                    <h1>{t('Thanh toán thành công')}</h1>
                    <p>{t('Hóa đơn {number} · đã trả {amount}.', { number: result.data.invoiceNumber, amount: formatVnd(result.data.paidAmount) })}</p>
                </>
            ) : (
                <>
                    <h1>{t('Thanh toán chưa hoàn tất')}</h1>
                    <p>{t('Giao dịch đã bị hủy hoặc không thành công. Bạn chưa bị trừ tiền cho hóa đơn {number}.', { number: result.data.invoiceNumber })}</p>
                </>
            ))}
            {!vnp.vnp_TxnRef && <p>{t('Không có thông tin giao dịch.')}</p>}
            <Link to="/payments" className="se-btn se-btn-primary">{t('Về trang thanh toán')}</Link>
        </section>
    );
}
