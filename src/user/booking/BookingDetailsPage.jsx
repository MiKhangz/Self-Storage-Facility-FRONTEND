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
import { earlyReturnText, lateFeeText, useTerms } from '../components/terms.js';

/** The rules the customer agrees to, worded from the terms the backend enforces. */
const agreement = (t) => [
    `Tiền cọc (bằng ${t.depositMonths} tháng tiền thuê) được hoàn lại sau khi trả kho trong tình trạng tốt, trừ các khoản phí phát sinh.`,
    `Tiền thuê thanh toán hằng tháng. ${lateFeeText(t)}`,
    `Hủy trong vòng ${t.cancelFreeHours} giờ sau khi đặt kho được hoàn đủ tiền cọc; sau thời gian này tiền cọc không được hoàn lại.`,
    earlyReturnText(t),
    'Không cất hàng dễ cháy nổ, hàng dễ hư hỏng và hàng cấm theo quy định pháp luật.',
];

/** U07: review the quote, accept the agreement and create the reservation. */
export default function BookingDetailsPage() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { session } = useAuth();
    const [agreed, setAgreed] = useState(false);
    const terms = useTerms();

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
                Liên kết đặt kho này chưa đầy đủ. <Link to="/booking" className="se-link">Đặt kho lại từ đầu</Link>
            </div></div>
        );
    }

    const back = `/booking?${params}`;

    return (
        <>
            <BookingStepper current={2} />
            <div className="se-booking">
                <div className="se-container">
                    <Link to={back} className="se-back"><Icon name="arrowLeft" size={16} /> Quay lại chọn kho</Link>
                    <div className="se-booking-grid">
                        <div>
                            <section className="se-panel">
                                <h2>Thông tin người thuê</h2>
                                <span className="se-label">Họ và tên</span>
                                <div className="se-field" aria-readonly="true">{session?.fullName || '—'}</div>
                                <p className="se-hint">Số điện thoại, email và CCCD lấy từ tài khoản của bạn và được kiểm tra khi nhận kho.</p>
                            </section>

                            <section className="se-panel">
                                <h2>Thanh toán</h2>
                                <div className="se-alert info">Khi đặt kho, hệ thống tạo hóa đơn tiền cọc. Bạn có thể thanh toán trực tuyến ngay ở bước sau hoặc trong mục Thanh toán; cần đóng cọc trước khi nhận kho.</div>
                            </section>

                            <section className="se-panel">
                                <h2>Quy định thuê kho</h2>
                                {terms.isError && <div className="se-alert" role="alert">Không tải được quy định thuê kho nên hiện chưa thể đặt kho. Vui lòng tải lại trang.</div>}
                                {terms.data && <ul className="se-rules-box">{agreement(terms.data).map((r) => <li key={r}>{r}</li>)}</ul>}
                                <label className="se-check">
                                    <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                                    <span>Tôi đã đọc và đồng ý với quy định thuê kho, bao gồm danh sách hàng cấm.</span>
                                </label>
                            </section>
                        </div>

                        <BookingSummary facility={facility} type={type} moveInDate={moveInDate} rentalMonths={rentalMonths} quote={quote}>
                            {reserve.isError && <div className="se-alert" role="alert">{errorMessage(reserve.error)}</div>}
                            <button type="button" className="se-btn se-btn-primary se-btn-block se-booking-cta"
                                disabled={!agreed || !terms.data || !quote.data || reserve.isPending} onClick={() => reserve.mutate()}>
                                {reserve.isPending ? 'Đang đặt kho…' : <>Xác nhận đặt kho <Icon name="arrow" size={16} /></>}
                            </button>
                        </BookingSummary>
                    </div>
                </div>
            </div>
        </>
    );
}
