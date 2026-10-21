import { errorMessage } from '../../api/axiosClient';
import Icon from '../components/Icon.jsx';
import { formatDate, formatVnd, rentalEndDate } from '../components/format.js';
import { useTerms } from '../components/terms.js';

/** The "Order summary" card from Figma: what is booked and what it costs. `children` is the call to action. */
export default function BookingSummary({ facility, type, moveInDate, rentalMonths, quote, children }) {
    const q = quote.data;
    // The free-cancel window counts from booking time, as the backend checks it; never hard-code it.
    const cancelHours = useTerms().data?.cancelFreeHours;
    return (
        <aside className="se-panel se-summary">
            <h2>Tóm tắt đơn đặt kho</h2>
            <div className="se-summary-unit">
                <span className="se-brand-mark"><Icon name="box" size={18} /></span>
                <div>
                    <strong>Kho {type?.code ?? '…'} ({type?.areaM2?.toLocaleString('vi-VN') ?? '…'} m²)</strong>
                    <small>{facility?.name ?? '…'}</small>
                </div>
            </div>
            <dl>
                <div><dt>Ngày nhận kho</dt><dd>{formatDate(moveInDate)}</dd></div>
                <div><dt>Thời hạn thuê</dt><dd>{rentalMonths} tháng (đến {formatDate(rentalEndDate(moveInDate, rentalMonths))})</dd></div>
            </dl>
            {quote.isError && <div className="se-alert" role="alert">{errorMessage(quote.error)}</div>}
            {q && (
                <>
                    <dl>
                        <div><dt>Tiền thuê mỗi tháng</dt><dd>{formatVnd(q.monthlyRent)}</dd></div>
                        <div><dt>Tiền thuê × {rentalMonths} tháng</dt><dd>{formatVnd(q.rentSubtotal)}</dd></div>
                        <div><dt>Tiền cọc (được hoàn lại)</dt><dd>{formatVnd(q.depositAmount)}</dd></div>
                        {q.fees?.map((f) => <div key={f.code}><dt>{f.name}</dt><dd>{formatVnd(f.amount)}</dd></div>)}
                    </dl>
                    <div className="se-summary-total"><span>Tổng cộng</span><strong>{formatVnd(q.totalAmount)}</strong></div>
                </>
            )}
            {children}
            {cancelHours > 0 && <p className="se-hint" style={{ textAlign: 'center' }}><Icon name="shield" size={13} /> Hủy miễn phí trong {cancelHours} giờ sau khi đặt kho</p>}
        </aside>
    );
}
