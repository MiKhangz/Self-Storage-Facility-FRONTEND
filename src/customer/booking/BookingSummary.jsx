import { errorMessage } from '../../api/axiosClient';
import Icon from '../components/Icon.jsx';
import { formatDate, formatVnd, rentalEndDate } from '../components/format.js';

/** The "Order summary" card from Figma: what is booked and what it costs. `children` is the call to action. */
export default function BookingSummary({ facility, type, moveInDate, rentalMonths, quote, children }) {
    const q = quote.data;
    return (
        <aside className="se-panel se-summary">
            <h2>Booking summary</h2>
            <div className="se-summary-unit">
                <span className="se-brand-mark"><Icon name="box" size={18} /></span>
                <div>
                    <strong>Size {type?.code ?? '…'} ({type?.areaM2 ?? '…'} m²)</strong>
                    <small>{facility?.name ?? '…'}</small>
                </div>
            </div>
            <dl>
                <div><dt>Move-in date</dt><dd>{formatDate(moveInDate)}</dd></div>
                <div><dt>Rental period</dt><dd>{rentalMonths} {rentalMonths === 1 ? 'month' : 'months'} (to {formatDate(rentalEndDate(moveInDate, rentalMonths))})</dd></div>
            </dl>
            {quote.isError && <div className="se-alert" role="alert">{errorMessage(quote.error)}</div>}
            {q && (
                <>
                    <dl>
                        <div><dt>Monthly rent</dt><dd>{formatVnd(q.monthlyRent)}</dd></div>
                        <div><dt>Rent × {rentalMonths}</dt><dd>{formatVnd(q.rentSubtotal)}</dd></div>
                        <div><dt>Deposit (refundable)</dt><dd>{formatVnd(q.depositAmount)}</dd></div>
                        {q.fees?.map((f) => <div key={f.code}><dt>{f.name}</dt><dd>{formatVnd(f.amount)}</dd></div>)}
                    </dl>
                    <div className="se-summary-total"><span>Total</span><strong>{formatVnd(q.totalAmount)}</strong></div>
                </>
            )}
            {children}
            <p className="se-hint" style={{ textAlign: 'center' }}><Icon name="shield" size={13} /> Free cancellation up to 48h before move-in</p>
        </aside>
    );
}
