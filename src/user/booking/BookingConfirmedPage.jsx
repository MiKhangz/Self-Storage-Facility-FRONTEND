import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { reservationsApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import Icon from '../components/Icon.jsx';
import { formatDate, formatVnd, rentalEndDate } from '../components/format.js';
import PayInvoiceButton from '../account/PayInvoiceButton.jsx';
import BookingStepper from './BookingStepper.jsx';

const STATUS_LABEL = { Pending: 'Đang chờ xếp kho', Confirmed: 'Chờ nhận kho', CheckedIn: 'Đã nhận kho', Cancelled: 'Đã hủy', Expired: 'Đã hết hạn', Rejected: 'Bị từ chối' };

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
                    {reservation.isLoading && <p className="se-empty">Đang tải đơn đặt kho…</p>}
                    {reservation.isError && <div className="se-alert" role="alert">{errorMessage(reservation.error)}</div>}
                    {r && (
                        <>
                            <div className="se-confirm-icon"><Icon name="check" size={30} /></div>
                            <h1>Bạn đã đặt kho thành công!</h1>
                            <p>Chúng tôi giữ một kho {r.unitTypeName} cho bạn tại {r.facilityName}.</p>

                            <div className="se-ticket">
                                <div className="se-ticket-head">
                                    <div><small>MÃ ĐẶT KHO</small><strong>{r.reservationCode}</strong></div>
                                    <span className="se-badge low">{STATUS_LABEL[r.status] ?? r.status}</span>
                                </div>
                                <dl>
                                    <dt>Kho</dt><dd>{r.unitCode ? `${r.unitCode} · ` : ''}{r.unitTypeName}{r.unitCode ? '' : ' · số kho được xếp trước ngày nhận'}</dd>
                                    <dt>Cơ sở</dt><dd>{r.facilityName}</dd>
                                    <dt>Thời hạn thuê</dt><dd>{formatDate(r.moveInDate)} → {formatDate(rentalEndDate(r.moveInDate, r.rentalMonths))} ({r.rentalMonths} tháng)</dd>
                                    <dt>Ngày nhận kho</dt><dd>{formatDate(r.moveInDate)}</dd>
                                    {r.depositInvoiceId && <><dt>Tiền cọc</dt><dd>{formatVnd(r.depositAmount)} · {r.depositStatus === 'Paid' ? 'Đã thanh toán' : 'Cần thanh toán trước ngày nhận kho'}</dd></>}
                                </dl>
                                {r.depositInvoiceId && r.depositStatus !== 'Paid' && (
                                    <PayInvoiceButton invoice={{ invoiceId: r.depositInvoiceId, outstandingAmount: r.depositAmount, invoiceNumber: `DEP${r.reservationCode}` }}
                                        className="se-btn se-btn-primary se-btn-block">Thanh toán tiền cọc ngay</PayInvoiceButton>
                                )}
                            </div>

                            <div className="se-bring">
                                <strong>Mang theo khi đến nhận kho</strong>
                                <ul>
                                    <li>Căn cước công dân (CCCD) đúng tên người thuê</li>
                                    <li>Mã đặt kho {r.reservationCode}</li>
                                    <li>Nhân viên sẽ giao kho, ổ khóa và cài mã ra vào cá nhân cho bạn</li>
                                </ul>
                            </div>
                            <div className="se-confirm-actions">
                                <Link to="/my-storage" className={`se-btn ${r.depositInvoiceId && r.depositStatus !== 'Paid' ? 'se-btn-outline' : 'se-btn-primary'}`}>Đến Kho của tôi</Link>
                                <Link to="/" className="se-btn se-btn-ghost">Về trang chủ</Link>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    );
}
