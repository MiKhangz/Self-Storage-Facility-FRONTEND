import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { contractsApi, depositRefundsApi, reservationsApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import Icon from '../components/Icon.jsx';
import { depositDeadline, formatDate, formatVnd, rentalEndDate } from '../components/format.js';
import PayInvoiceButton from '../account/PayInvoiceButton.jsx';
import BookingStepper from './BookingStepper.jsx';
import CancelBooking from './CancelBooking.jsx';
import { HandoverAppointment, UnitProposal } from './BookingActions.jsx';
import { useT } from '../../i18n/I18n.jsx';

const STATUS_LABEL = {
    Pending: 'Đang chờ xếp kho',
    PENDING_UNIT_SELECTION: 'Đang chờ chọn kho',
    Confirmed: 'Chờ nhận kho',
    HandedOver: 'Đã nhận kho',
    Cancelled: 'Đã hủy',
    Expired: 'Đã hết hạn',
    Rejected: 'Bị từ chối',
};

const CLOSED = ['Cancelled', 'Expired'];
const STAFF_REPLY_HOURS = 2;

function formatShortDdMm(iso) {
    if (!iso) return '—';
    const [, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}`;
}

function formatDeadlineTimeDate(iso) {
    if (!iso) return '—';
    const d = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso) ? iso : `${iso}Z`);
    const hhmm = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' });
    const ddmmyyyy = formatDate(iso);
    return `${hhmm} · ${ddmmyyyy}`;
}

/*
// Old BookingConfirmedPage ticket kept commented for reference:
export function OldBookingConfirmedTicket() { ... }
*/

/** U08: the saved reservation, re-read from the API so a refresh still shows it. */
export default function BookingConfirmedPage() {
    const { id } = useParams();
    const t = useT();
    const queryClient = useQueryClient();
    const [copied, setCopied] = useState(false);
    const [policyOpen, setPolicyOpen] = useState(false);
    const reservation = useQuery({ queryKey: ['reservations', Number(id)], queryFn: () => reservationsApi.getById(Number(id)) });
    const refunds = useQuery({ queryKey: ['deposit-refunds', 'mine'], queryFn: () => depositRefundsApi.list({ page: 1, pageSize: 50 }) });
    const r = reservation.data;
    const linkedContract = useQuery({
        queryKey: ['contracts', r?.contractId],
        queryFn: () => contractsApi.getById(r.contractId),
        enabled: !!r?.contractId,
    });
    const isContractSigned = !!(linkedContract.data?.signedAt || r?.status === 'HandedOver');
    const depositOwed = !!r?.depositInvoiceId && r.depositStatus !== 'Paid' && !CLOSED.includes(r.status);
    const existingRefund = (refunds.data?.items ?? []).find((x) => x.reservationId === r?.reservationId);
    const canRequestSameDayRefund = !!(r && r.sameDay && CLOSED.includes(r.status) && r.depositStatus === 'Paid' && !existingRefund);
    const isStaffAssisted = r?.unitAssignmentMode === 'STAFF_ASSISTED';
    const requestRefund = useMutation({
        mutationFn: () => reservationsApi.requestRefund(r.reservationId),
        onSuccess: () => ['deposit-refunds', 'reservations'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] })),
    });

    const copyCode = () => {
        if (!r?.reservationCode) return;
        try {
            navigator.clipboard?.writeText(r.reservationCode);
        } catch {
            // ignore clipboard failure
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
    };

    const endIso = r ? rentalEndDate(r.moveInDate, r.rentalMonths) : '';
    const sameMoveInYear = r && endIso && r.moveInDate.slice(0, 4) === endIso.slice(0, 4);
    const periodText = r
        ? `${sameMoveInYear ? formatShortDdMm(r.moveInDate) : formatDate(r.moveInDate)} → ${formatDate(endIso)}`
        : '';

    const unitHeading = r
        ? (isContractSigned && r.unitCode
            ? `${t('Kho')} ${r.unitCode}${r.unitTypeName ? ` · ${r.unitTypeName}` : ''}`
            : `${r.reservationCode}${r.unitTypeName ? ` · ${r.unitTypeName}` : ''}`)
        : '';

    const retainedFund = r ? Math.max(Math.round((r.depositAmount ?? 0) / 30), 100000) : 100000;

    return (
        <>
            <BookingStepper current={4} />
            <div className="se-booking">
                <div className="se-container se-confirm">
                    {reservation.isLoading && <p className="se-empty">{t('Đang tải đơn đặt kho…')}</p>}
                    {reservation.isError && <div className="se-alert" role="alert">{errorMessage(reservation.error)}</div>}
                    {r && (
                        <>
                            <div className="se-confirm-icon"><Icon name={CLOSED.includes(r.status) ? 'arrowLeft' : 'check'} size={30} /></div>
                            <h1>{r.status === 'Cancelled' ? t('Đơn đặt kho đã huỷ') : r.status === 'Expired' ? t('Đơn đặt kho đã hết hạn') : t('Bạn đã đặt kho thành công!')}</h1>
                            {!CLOSED.includes(r.status) && (
                                isStaffAssisted ? (
                                    <p>
                                        {t('Đơn đặt kho của bạn đã được xác nhận. Nhân viên sẽ giúp bạn chọn kho.')}
                                        <br />
                                        <small>{t('Nhân viên thường phản hồi trong vòng {hours} giờ.', { hours: STAFF_REPLY_HOURS })}</small>
                                    </p>
                                ) : (
                                    <p>{t('Chúng tôi giữ một kho {type} cho bạn tại {facility}.', { type: r.unitTypeName, facility: r.facilityName })}</p>
                                )
                            )}

                            <div className="se-ticket se-ticket-v2">
                                <div className="se-ticket-v2-head">
                                    <div className="se-ticket-v2-title">
                                        <h2>{unitHeading}</h2>
                                        <p>{r.facilityName}</p>
                                    </div>
                                    <div className="se-ticket-v2-meta">
                                        <span className={`se-ticket-v2-badge ${CLOSED.includes(r.status) ? 'closed' : r.status === 'HandedOver' ? 'done' : 'pending'}`}>
                                            <span className="se-ticket-v2-dot" />
                                            {t(STATUS_LABEL[r.status] ?? r.status)}
                                        </span>
                                        <button
                                            type="button"
                                            className="se-ticket-v2-code"
                                            onClick={copyCode}
                                            title={t('Sao chép mã đặt kho')}
                                        >
                                            <span>{t('Mã')}: {r.reservationCode}</span>
                                            {copied ? (
                                                <Icon name="check" size={14} />
                                            ) : (
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                                                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div className="se-ticket-v2-body">
                                    {r.depositInvoiceId && (
                                        <div className={`se-ticket-v2-paybox${r.depositStatus === 'Paid' ? ' paid' : ''}`}>
                                            <div className="se-ticket-v2-paytop">
                                                <span>{t(r.sameDay ? 'Thanh toán trước (1 tháng)' : 'Tiền cọc')}</span>
                                                <strong>{formatVnd(r.depositAmount)}</strong>
                                            </div>
                                            {(depositOwed || r.depositStatus === 'Paid' || existingRefund) && (
                                                <>
                                                    <div className="se-ticket-v2-payline" />
                                                    <div className="se-ticket-v2-paysub">
                                                        {r.depositStatus === 'Paid' ? (
                                                            <>
                                                                <Icon name="check" size={15} />
                                                                <span>
                                                                    {t('Đã thanh toán')}
                                                                    {existingRefund ? ` · ${t('Hoàn tiền')}: ${formatVnd(existingRefund.amount)} (${t(existingRefund.status === 'Paid' ? 'Đã hoàn tiền' : 'Đang chờ hoàn')})` : ''}
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Icon name="clock" size={15} />
                                                                <span>
                                                                    {t('Thanh toán trước {time} để giữ đơn', {
                                                                        time: formatDeadlineTimeDate(depositDeadline(r.createdAt, r.moveInDate, r.sameDay)),
                                                                    })}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    <div className="se-ticket-v2-dates">
                                        <div className="se-ticket-v2-datecol">
                                            <small>{t('Thời hạn thuê')}</small>
                                            <div className="se-ticket-v2-dateval">
                                                <strong>{periodText}</strong>
                                                <span className="se-ticket-v2-pill">{t('{months} tháng', { months: r.rentalMonths })}</span>
                                            </div>
                                        </div>
                                        <div className="se-ticket-v2-datecol">
                                            <small>{t('Ngày nhận kho')}</small>
                                            <div className="se-ticket-v2-dateval">
                                                <strong>{formatDate(r.moveInDate)}</strong>
                                                {r.sameDay && <span className="se-ticket-v2-pill">{t('Nhận trong ngày')}</span>}
                                            </div>
                                        </div>
                                    </div>

                                    {(r.preferences?.length > 0 || r.preferenceNote || r.ticketId) && (
                                        <div className="se-ticket-v2-extra">
                                            {!isContractSigned && (
                                                <div className="se-ticket-v2-extrarow">
                                                    <span>{t('Mã đặt kho')}</span>
                                                    <strong>{r.reservationCode}</strong>
                                                </div>
                                            )}
                                            {r.preferences?.length > 0 && (
                                                <div className="se-ticket-v2-extrarow">
                                                    <span>{t('Ưu tiên vị trí')}</span>
                                                    <strong>{r.preferences.map((p) => t(p)).join(', ')}</strong>
                                                </div>
                                            )}
                                            {r.preferenceNote && (
                                                <div className="se-ticket-v2-extrarow">
                                                    <span>{t('Ghi chú')}</span>
                                                    <strong>{r.preferenceNote}</strong>
                                                </div>
                                            )}
                                            {r.ticketId && (
                                                <div className="se-ticket-v2-extrarow">
                                                    <span>{t('Yêu cầu tư vấn')}</span>
                                                    <strong>
                                                        <Link to={`/support/requests/${r.ticketId}`} className="se-link">{r.ticketCode || `#${r.ticketId}`}</Link>
                                                    </strong>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {r.sameDay && (
                                        <div className="se-ticket-v2-policy">
                                            <div className="se-ticket-v2-policy-head">
                                                <div className="se-ticket-v2-policy-title">
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <circle cx="12" cy="12" r="10" />
                                                        <path d="M12 16v-4" />
                                                        <path d="M12 8h.01" />
                                                    </svg>
                                                    <strong>{t('Chính sách nhận kho trong ngày')}</strong>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="se-ticket-v2-policy-toggle"
                                                    aria-expanded={policyOpen}
                                                    onClick={() => setPolicyOpen((o) => !o)}
                                                >
                                                    <span>{t('Chi tiết')}</span>
                                                    <span className={`se-ticket-v2-chev${policyOpen ? ' open' : ''}`}>▾</span>
                                                </button>
                                            </div>
                                            <ul className="se-ticket-v2-policy-list">
                                                <li>{t('Cọc giữ chỗ: 1/30 tháng (tối thiểu 100.000₫)')}</li>
                                                <li>{t('Huỷ miễn phí trong 3 giờ · Sau 3 giờ hoặc quá 20:30 giữ cọc')}</li>
                                            </ul>
                                            {policyOpen && (
                                                <p className="se-ticket-v2-policy-detail">
                                                    {t('Cọc nhận kho trong ngày bằng 1/30 tiền thuê tháng sau giảm giá (tối thiểu 100.000₫). Thanh toán trước 1 tháng tiền thuê sau giảm giá. Huỷ trong 3 giờ sau khi đặt được hoàn đủ; huỷ sau 3 giờ hoặc không nhận kho trước 20:30 sẽ giữ lại 1/30 tiền thuê tháng (tối thiểu 100.000₫).')}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {depositOwed && (
                                        <PayInvoiceButton
                                            invoice={{ invoiceId: r.depositInvoiceId, outstandingAmount: r.depositAmount, invoiceNumber: `DEP${r.reservationCode}` }}
                                            title={r.sameDay ? 'Thanh toán trước 1 tháng tiền thuê' : 'Thanh toán tiền cọc'}
                                            paidText="Tiền cọc của bạn đã được thanh toán."
                                            className="se-btn se-btn-primary se-btn-block se-ticket-v2-cta"
                                        >
                                            {t(r.sameDay ? 'Thanh toán trước ngay' : 'Thanh toán tiền cọc ngay')}
                                        </PayInvoiceButton>
                                    )}

                                    {canRequestSameDayRefund && (
                                        <div>
                                            {requestRefund.isError && <div className="se-alert" role="alert" style={{ marginBottom: 10 }}>{errorMessage(requestRefund.error)}</div>}
                                            <button type="button" className="se-btn se-btn-primary se-btn-block se-ticket-v2-cta" disabled={requestRefund.isPending} onClick={() => requestRefund.mutate()}>
                                                {requestRefund.isPending ? t('Đang gửi yêu cầu…') : t('Yêu cầu hoàn tiền ({amount})', { amount: formatVnd(Math.max(r.depositAmount - retainedFund, 0)) })}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <HandoverAppointment reservation={r} />
                            <UnitProposal reservation={r} />

                            <div className="se-bring">
                                <strong>{t('Mang theo khi đến nhận kho')}</strong>
                                <ul>
                                    <li>{t('Căn cước công dân (CCCD) đúng tên người thuê')}</li>
                                    <li>{t('Mã đặt kho {code}', { code: r.reservationCode })}</li>
                                    <li>{t('Nhân viên sẽ giao kho, ổ khóa và cài mã ra vào cá nhân cho bạn')}</li>
                                </ul>
                            </div>
                            <div className="se-confirm-actions">
                                {isStaffAssisted && r.ticketId ? (
                                    <>
                                        <Link to={`/support/requests/${r.ticketId}`} className="se-btn se-btn-primary">
                                            <Icon name="chat" size={16} /> {t('Trò chuyện với nhân viên')}
                                        </Link>
                                        <Link to="/my-storage" className="se-btn se-btn-outline">{t('Xem đơn đặt kho của tôi')}</Link>
                                    </>
                                ) : (
                                    <>
                                        <Link to="/my-storage" className={`se-btn ${depositOwed ? 'se-btn-outline' : 'se-btn-primary'}`}>{t('Xem đơn đặt kho của tôi')}</Link>
                                        <Link to="/" className="se-btn se-btn-ghost">{t('Về trang chủ')}</Link>
                                    </>
                                )}
                            </div>
                            {['Pending', 'PENDING_UNIT_SELECTION', 'Confirmed'].includes(r.status) && <CancelBooking key={r.reservationId} reservation={r} />}
                        </>
                    )}
                </div>
            </div>
        </>
    );
}
