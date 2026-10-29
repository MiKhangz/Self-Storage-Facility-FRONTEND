import { errorMessage } from '../../api/axiosClient';
import Icon from '../components/Icon.jsx';
import { formatDate, formatVnd, rentalEndDate } from '../components/format.js';
import { useTerms } from '../components/terms.js';
import { useT } from '../../i18n/I18n.jsx';

/** The "Order summary" card from Figma: what is booked and what it costs. `children` is the call to action. */
export default function BookingSummary({ facility, type, moveInDate, rentalMonths, quote, children }) {
    const q = quote.data;
    const t = useT();
    // The free-cancel window counts from booking time, as the backend checks it; never hard-code it.
    const cancelHours = useTerms().data?.cancelFreeHours;
    return (
        <aside className="se-panel se-summary">
            <h2>{t('Tóm tắt đơn đặt kho')}</h2>
            <div className="se-summary-unit">
                <span className="se-brand-mark"><Icon name="box" size={18} /></span>
                <div>
                    <strong>{t('Kho')} {type?.code ?? '…'} ({type?.areaM2?.toLocaleString('vi-VN') ?? '…'} m²)</strong>
                    <small>{facility?.name ?? '…'}</small>
                </div>
            </div>
            <dl>
                <div><dt>{t('Ngày nhận kho')}</dt><dd>{formatDate(moveInDate)}</dd></div>
                <div><dt>{t('Thời hạn thuê')}</dt><dd>{t('{months} tháng (đến {end})', { months: rentalMonths, end: formatDate(rentalEndDate(moveInDate, rentalMonths)) })}</dd></div>
            </dl>
            {quote.isError && <div className="se-alert" role="alert">{errorMessage(quote.error)}</div>}
            {q && (
                <>
                    <dl>
                        <div><dt>{t('Tiền thuê mỗi tháng')}</dt><dd>{formatVnd(q.monthlyRent)}</dd></div>
                        <div><dt>{t('Tiền thuê × {months} tháng', { months: rentalMonths })}</dt><dd>{formatVnd(q.rentSubtotal)}</dd></div>
                        <div><dt>{t('Tiền cọc (được hoàn lại)')}</dt><dd>{formatVnd(q.depositAmount)}</dd></div>
                        {q.fees?.map((f) => <div key={f.code}><dt>{f.name}</dt><dd>{formatVnd(f.amount)}</dd></div>)}
                    </dl>
                    <div className="se-summary-total"><span>{t('Tổng cộng')}</span><strong>{formatVnd(q.totalAmount)}</strong></div>
                </>
            )}
            {children}
            {cancelHours > 0 && <p className="se-hint" style={{ textAlign: 'center' }}><Icon name="shield" size={13} /> {t('Hủy miễn phí trong {hours} giờ sau khi đặt kho', { hours: cancelHours })}</p>}
        </aside>
    );
}
