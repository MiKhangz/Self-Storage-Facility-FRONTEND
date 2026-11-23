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
import { AppointmentFields, useAppointmentPicker } from './BookingActions.jsx';
import { formatDate } from '../components/format.js';
import { earlyReturnText, lateFeeText, useTerms } from '../components/terms.js';
import { useT } from '../../i18n/I18n.jsx';

/** The rules the customer agrees to, worded from the terms the backend enforces. */
const agreement = (terms, t) => [
    t('Tiền cọc (bằng {months} tháng tiền thuê) được hoàn lại sau khi trả kho trong tình trạng tốt, trừ các khoản phí phát sinh.', { months: terms.depositMonths }),
    `${t('Tiền thuê thanh toán hằng tháng.')} ${lateFeeText(terms, t)}`,
    t('Đơn đặt kho chỉ được giữ khi đã thanh toán tiền cọc: chưa thanh toán trong 1 giờ sau khi đặt, đơn tự động bị huỷ và kho được nhường cho khách khác.'),
    t('Không đến nhận kho đúng ngày hẹn, đơn sẽ hết hạn và tiền cọc không được hoàn.'),
    t('Hủy trong vòng {hours} giờ sau khi đặt kho được hoàn đủ tiền cọc; sau thời gian này tiền cọc không được hoàn lại.', { hours: terms.cancelFreeHours }),
    earlyReturnText(terms, t),
    t('Không cất hàng dễ cháy nổ, hàng dễ hư hỏng và hàng cấm theo quy định pháp luật.'),
];

/** U07: review the quote, pick the handover appointment, accept the agreement, book and go straight to the deposit. */
export default function BookingDetailsPage() {
    const [params] = useSearchParams();
    const t = useT();
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
    const appointment = useAppointmentPicker(moveInDate);

    const facility = useFacilities().data?.items?.find((f) => f.facilityId === facilityId);
    const type = useQuery({ queryKey: ['unit-types'], queryFn: () => unitTypesApi.list() }).data?.find((t) => t.unitTypeId === unitTypeId);
    const quoteQuery = { facilityId, moveInDate, rentalMonths };
    const quote = useQuery({
        queryKey: ['quote', { unitTypeId, ...quoteQuery }],
        queryFn: () => unitTypesApi.quote(unitTypeId, quoteQuery),
        enabled: valid,
    });

    const reserve = useMutation({
        mutationFn: () => reservationsApi.create({ facilityId, unitTypeId, moveInDate, rentalMonths, handoverAt: appointment.at }),
        onSuccess: (reservation) => {
            queryClient.invalidateQueries({ queryKey: ['reservations'] });
            // The booking only holds once the deposit is paid, so the payment opens at once.
            const pay = reservation.depositInvoiceId && reservation.depositStatus !== 'Paid' ? '?pay=1' : '';
            navigate(`/booking/confirmed/${reservation.reservationId}${pay}`, { replace: true });
        },
    });

    if (!valid) {
        return (
            <div className="se-booking"><div className="se-container se-panel se-empty">
                {t('Liên kết đặt kho này chưa đầy đủ.')} <Link to="/booking" className="se-link">{t('Đặt kho lại từ đầu')}</Link>
            </div></div>
        );
    }

    const back = `/booking?${params}`;

    return (
        <>
            <BookingStepper current={2} />
            <div className="se-booking">
                <div className="se-container">
                    <Link to={back} className="se-back"><Icon name="arrowLeft" size={16} /> {t('Quay lại chọn kho')}</Link>
                    <div className="se-booking-grid">
                        <div>
                            <section className="se-panel">
                                <h2>{t('Thông tin người thuê')}</h2>
                                <span className="se-label">{t('Họ và tên')}</span>
                                <div className="se-field" aria-readonly="true">{session?.fullName || '—'}</div>
                                <p className="se-hint">{t('Số điện thoại, email và CCCD lấy từ tài khoản của bạn và được kiểm tra khi nhận kho.')}</p>
                            </section>

                            <section className="se-panel">
                                <h2>{t('Thanh toán')}</h2>
                                <div className="se-alert info">{t('Sau khi xác nhận, bạn thanh toán tiền cọc trực tuyến ngay. Đơn đặt kho chỉ được giữ khi đã thanh toán cọc.')}</div>
                            </section>

                            <section className="se-panel">
                                <h2>{t('Lịch hẹn nhận kho')}</h2>
                                <div className="se-appointment-fields"><AppointmentFields picker={appointment} /></div>
                                <p className="se-hint">{appointment.time
                                    ? t('Từ hôm nay đến ngày nhận kho {date}. Bạn có thể đổi lịch hẹn sau khi đặt, trước giờ hẹn. Không đến đúng ngày hẹn, đơn sẽ hết hạn và tiền cọc không được hoàn.', { date: formatDate(moveInDate) })
                                    : t('Hôm nay đã hết giờ nhận kho. Hãy chọn ngày nhận kho muộn hơn.')}</p>
                            </section>

                            <section className="se-panel">
                                <h2>{t('Quy định thuê kho')}</h2>
                                {terms.isError && <div className="se-alert" role="alert">{t('Không tải được quy định thuê kho nên hiện chưa thể đặt kho. Vui lòng tải lại trang.')}</div>}
                                {terms.data && <ul className="se-rules-box">{agreement(terms.data, t).map((r) => <li key={r}>{r}</li>)}</ul>}
                                <label className="se-check">
                                    <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                                    <span>{t('Tôi đã đọc và đồng ý với quy định thuê kho, bao gồm danh sách hàng cấm.')}</span>
                                </label>
                            </section>
                        </div>

                        <BookingSummary facility={facility} type={type} moveInDate={moveInDate} rentalMonths={rentalMonths} quote={quote}>
                            {reserve.isError && <div className="se-alert" role="alert">{errorMessage(reserve.error)}</div>}
                            <button type="button" className="se-btn se-btn-primary se-btn-block se-booking-cta"
                                disabled={!agreed || !terms.data || !quote.data || !appointment.at || reserve.isPending} onClick={() => reserve.mutate()}>
                                {reserve.isPending ? t('Đang đặt kho…') : <>{t('Đặt kho và thanh toán cọc')} <Icon name="arrow" size={16} /></>}
                            </button>
                        </BookingSummary>
                    </div>
                </div>
            </div>
        </>
    );
}
