import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reservationsApi, unitTypesApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import { useAuth } from '../../features/auth/AuthContext';
import Icon from '../components/Icon.jsx';
import { useFacilities } from '../sizes/SizesPage.jsx';
import BookingStepper from './BookingStepper.jsx';
import BookingSummary from './BookingSummary.jsx';

const AGREEMENT = [
    'Deposit is refunded within 7 days after the unit is returned in good condition.',
    'Rent is due monthly. Late fee: 5% per week; access suspended after 15 days overdue.',
    'Cancel free of charge up to 48 hours before move-in. After that, the deposit is non-refundable.',
    'Hazardous, perishable and illegal items are prohibited.',
];

/** U07: review the quote, accept the agreement and create the reservation. */
export default function BookingDetailsPage() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { session } = useAuth();
    const [agreed, setAgreed] = useState(false);

    const facilityId = Number(params.get('facilityId'));
    const unitTypeId = Number(params.get('unitTypeId'));
    const moveInDate = params.get('moveInDate') ?? '';
    const rentalMonths = Number(params.get('rentalMonths'));
    const valid = facilityId > 0 && unitTypeId > 0 && /^\d{4}-\d{2}-\d{2}$/.test(moveInDate) && rentalMonths > 0;

    const facility = useFacilities().data?.items?.find((f) => f.facilityId === facilityId);
    const type = useQuery({ queryKey: ['unit-types'], queryFn: () => unitTypesApi.list() }).data?.find((t) => t.unitTypeId === unitTypeId);
    const quoteQuery = { facilityId, moveInDate, rentalMonths };
    const quote = useQuery({
        queryKey: ['quote', { unitTypeId, ...quoteQuery }],
        queryFn: () => unitTypesApi.quote(unitTypeId, quoteQuery),
        enabled: valid,
    });

    const reserve = useMutation({
        mutationFn: () => reservationsApi.create({ facilityId, unitTypeId, moveInDate, rentalMonths }),
        onSuccess: (reservation) => {
            queryClient.invalidateQueries({ queryKey: ['reservations'] });
            navigate(`/booking/confirmed/${reservation.reservationId}`, { replace: true });
        },
    });

    if (!valid) {
        return (
            <div className="se-booking"><div className="se-container se-panel se-empty">
                This booking link is incomplete. <Link to="/booking" className="se-link">Start a new booking</Link>
            </div></div>
        );
    }

    const back = `/booking?${params}`;

    return (
        <>
            <BookingStepper current={2} />
            <div className="se-booking">
                <div className="se-container">
                    <Link to={back} className="se-back"><Icon name="arrowLeft" size={16} /> Back to unit selection</Link>
                    <div className="se-booking-grid">
                        <div>
                            <section className="se-panel">
                                <h2>Renter information</h2>
                                <span className="se-label">Full name</span>
                                <div className="se-field" aria-readonly="true">{session?.fullName || '—'}</div>
                                <p className="se-hint">Your phone, email and Citizen ID come from your account and are checked at check-in.</p>
                            </section>

                            <section className="se-panel">
                                <h2>Payment</h2>
                                <div className="se-alert info">Reserving issues a deposit invoice. Pay it online on the next screen or later under Payments; check-in needs the deposit paid.</div>
                            </section>

                            <section className="se-panel">
                                <h2>Rental agreement</h2>
                                <ul className="se-rules-box">{AGREEMENT.map((r) => <li key={r}>{r}</li>)}</ul>
                                <label className="se-check">
                                    <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                                    <span>I have read and agree to the rental agreement and prohibited items policy.</span>
                                </label>
                            </section>
                        </div>

                        <BookingSummary facility={facility} type={type} moveInDate={moveInDate} rentalMonths={rentalMonths} quote={quote}>
                            {reserve.isError && <div className="se-alert" role="alert">{errorMessage(reserve.error)}</div>}
                            <button type="button" className="se-btn se-btn-primary se-btn-block se-booking-cta"
                                disabled={!agreed || !quote.data || reserve.isPending} onClick={() => reserve.mutate()}>
                                {reserve.isPending ? 'Reserving…' : <>Reserve this unit <Icon name="arrow" size={16} /></>}
                            </button>
                        </BookingSummary>
                    </div>
                </div>
            </div>
        </>
    );
}
