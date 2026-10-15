import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { reservationsApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import Icon from '../components/Icon.jsx';
import { formatDate, formatVnd, rentalEndDate } from '../components/format.js';
import PayInvoiceButton from '../account/PayInvoiceButton.jsx';
import BookingStepper from './BookingStepper.jsx';

const STATUS_LABEL = { Pending: 'Awaiting unit assignment', Confirmed: 'Awaiting check-in', CheckedIn: 'Checked in' };

/** U08: the saved reservation, re-read from the API so a refresh still shows it. */
export default function BookingConfirmedPage() {
    const { id } = useParams();
    const reservation = useQuery({ queryKey: ['reservations', Number(id)], queryFn: () => reservationsApi.getById(Number(id)) });
    const r = reservation.data;

    return (
        <>
            <BookingStepper current={4} />
            <div className="se-booking">
                <div className="se-container se-confirm">
                    {reservation.isLoading && <p className="se-empty">Loading your reservation…</p>}
                    {reservation.isError && <div className="se-alert" role="alert">{errorMessage(reservation.error)}</div>}
                    {r && (
                        <>
                            <div className="se-confirm-icon"><Icon name="check" size={30} /></div>
                            <h1>Your unit is reserved!</h1>
                            <p>We hold a {r.unitTypeName} unit for you at {r.facilityName}.</p>

                            <div className="se-ticket">
                                <div className="se-ticket-head">
                                    <div><small>RESERVATION CODE</small><strong>{r.reservationCode}</strong></div>
                                    <span className="se-badge low">{STATUS_LABEL[r.status] ?? r.status}</span>
                                </div>
                                <dl>
                                    <dt>Unit</dt><dd>{r.unitCode ? `${r.unitCode} · ` : ''}{r.unitTypeName}{r.unitCode ? '' : ' · assigned before check-in'}</dd>
                                    <dt>Facility</dt><dd>{r.facilityName}</dd>
                                    <dt>Rental period</dt><dd>{formatDate(r.moveInDate)} → {formatDate(rentalEndDate(r.moveInDate, r.rentalMonths))} ({r.rentalMonths} {r.rentalMonths === 1 ? 'month' : 'months'})</dd>
                                    <dt>Check-in</dt><dd>{formatDate(r.moveInDate)}</dd>
                                    {r.depositInvoiceId && <><dt>Deposit</dt><dd>{formatVnd(r.depositAmount)} · {r.depositStatus === 'Paid' ? 'Paid' : 'Due before check-in'}</dd></>}
                                </dl>
                                {r.depositInvoiceId && r.depositStatus !== 'Paid' && (
                                    <PayInvoiceButton invoice={{ invoiceId: r.depositInvoiceId, outstandingAmount: r.depositAmount, invoiceNumber: `DEP${r.reservationCode}` }}
                                        className="se-btn se-btn-primary se-btn-block">Pay deposit now</PayInvoiceButton>
                                )}
                            </div>

                            <div className="se-bring">
                                <strong>Bring to your check-in</strong>
                                <ul>
                                    <li>Your Citizen ID (CCCD) — must match the renter name</li>
                                    <li>Your reservation code {r.reservationCode}</li>
                                    <li>Staff will hand over your unit, disc lock and set up your personal access code</li>
                                </ul>
                            </div>
                            <div className="se-confirm-actions">
                                <Link to="/my-storage" className="se-btn se-btn-primary">Go to My Storage</Link>
                                <Link to="/" className="se-btn se-btn-ghost">Back to home</Link>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    );
}
