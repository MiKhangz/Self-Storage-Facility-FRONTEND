import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { reservationsApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import Icon from '../components/Icon.jsx';
import { formatDate, formatVnd, rentalEndDate } from '../components/format.js';
import PayInvoiceButton from '../account/PayInvoiceButton.jsx';
import BookingStepper from './BookingStepper.jsx';
import CancelBooking from './CancelBooking.jsx';
import { useT } from '../../i18n/I18n.jsx';

const STATUS_LABEL = { Pending: 'Đang chờ xếp kho', Confirmed: 'Chờ nhận kho', HandedOver: 'Đã nhận kho', Cancelled: 'Đã hủy', Expired: 'Đã hết hạn', Rejected: 'Bị từ chối' };

/** U08: the saved reservation, re-read from the API so a refresh still shows it. */
export default function BookingConfirmedPage() {
    const { id } = useParams();
    const t = useT();
    const reservation = useQuery({ queryKey: ['reservations', Number(id)], queryFn: () => reservationsApi.getById(Number(id)) });
    const r = reservation.data;

    return (
        <>
            <BookingStepper current={4} />
            <div className="se-booking">
                <div className="se-container se-confirm">
                    {reservation.isLoading && <p className="se-empty">{t('Đang tải đơn đặt kho…')}</p>}
                    {reservation.isError && <div className="se-alert" role="alert">{errorMessage(reservation.error)}</div>}
                    {r && (
                        <>
                            <div className="se-confirm-icon"><Icon name={r.status === 'Cancelled' ? 'arrowLeft' : 'check'} size={30} /></div>
                            <h1>{r.status === 'Cancelled' ? t('Đơn đặt kho đã huỷ') : t('Bạn đã đặt kho thành công!')}</h1>
                            <p>{t('Chúng tôi giữ một kho {type} cho bạn tại {facility}.', { type: r.unitTypeName, facility: r.facilityName })}</p>

                            <div className="se-ticket">
                                <div className="se-ticket-head">
                                    <div><small>{t('MÃ ĐẶT KHO')}</small><strong>{r.reservationCode}</strong></div>
                                    <span className="se-badge low">{t(STATUS_LABEL[r.status] ?? r.status)}</span>
                                </div>
                                <dl>
                                    <dt>{t('Kho')}</dt><dd>{r.unitCode ? `${r.unitCode} · ` : ''}{r.unitTypeName}{r.unitCode ? '' : ` · ${t('số kho được xếp trước ngày nhận')}`}</dd>
                                    <dt>{t('Cơ sở')}</dt><dd>{r.facilityName}</dd>
                                    <dt>{t('Thời hạn thuê')}</dt><dd>{formatDate(r.moveInDate)} → {formatDate(rentalEndDate(r.moveInDate, r.rentalMonths))} ({t('{months} tháng', { months: r.rentalMonths })})</dd>
                                    <dt>{t('Ngày nhận kho')}</dt><dd>{formatDate(r.moveInDate)}</dd>
                                    {r.depositInvoiceId && <><dt>{t('Tiền cọc')}</dt><dd>{formatVnd(r.depositAmount)} · {r.depositStatus === 'Paid' ? t('Đã thanh toán') : t('Cần thanh toán trước ngày nhận kho')}</dd></>}
                                </dl>
                                {r.depositInvoiceId && r.depositStatus !== 'Paid' && (
                                    <PayInvoiceButton invoice={{ invoiceId: r.depositInvoiceId, outstandingAmount: r.depositAmount, invoiceNumber: `DEP${r.reservationCode}` }}
                                        className="se-btn se-btn-primary se-btn-block">{t('Thanh toán tiền cọc ngay')}</PayInvoiceButton>
                                )}
                            </div>

                            <div className="se-bring">
                                <strong>{t('Mang theo khi đến nhận kho')}</strong>
                                <ul>
                                    <li>{t('Căn cước công dân (CCCD) đúng tên người thuê')}</li>
                                    <li>{t('Mã đặt kho {code}', { code: r.reservationCode })}</li>
                                    <li>{t('Nhân viên sẽ giao kho, ổ khóa và cài mã ra vào cá nhân cho bạn')}</li>
                                </ul>
                            </div>
                            <div className="se-confirm-actions">
                                <Link to="/my-storage" className={`se-btn ${r.depositInvoiceId && r.depositStatus !== 'Paid' ? 'se-btn-outline' : 'se-btn-primary'}`}>{t('Đến Kho của tôi')}</Link>
                                <Link to="/" className="se-btn se-btn-ghost">{t('Về trang chủ')}</Link>
                            </div>
                            {['Pending', 'Confirmed'].includes(r.status) && <CancelBooking key={r.reservationId} reservation={r} />}
                        </>
                    )}
                </div>
            </div>
        </>
    );
}
