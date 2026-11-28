import { errorMessage } from '../../api/axiosClient';
import Icon from '../components/Icon.jsx';
import { formatDate, formatVnd, rentalEndDate } from '../components/format.js';
import { useTerms } from '../components/terms.js';
import { useLang, useT } from '../../i18n/I18n.jsx';

function formatShortDate(iso, lang = 'vi') {
    if (!iso) return '—';
    const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return formatDate(iso);
    return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'vi-VN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
    });
}

function formatDayMonth(iso, lang = 'vi') {
    if (!iso) return '—';
    const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return formatDate(iso);
    return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'vi-VN', {
        day: '2-digit',
        month: 'short',
        timeZone: 'UTC',
    });
}

/*
// Old BookingSummary kept commented for reference:
export function OldBookingSummary({ facility, type, moveInDate, rentalMonths, quote, unitCode, sameDay, unitAssignmentMode = 'AUTO', children }) {
    const q = quote.data;
    const t = useT();
    // The free-cancel window counts from booking time, as the backend checks it; never hard-code it.
    const policyCancelHours = useTerms().data?.cancelFreeHours;
    const isSameDay = sameDay ?? q?.sameDay ?? false;
    const cancelHours = isSameDay ? 0 : policyCancelHours;
    const isStaffAssisted = unitAssignmentMode === 'STAFF_ASSISTED';
    const displayUnitCode = isStaffAssisted ? null : (unitCode || q?.expectedUnitCode);
    const oneDayDeposit = q ? q.depositAmount : 0;
    const upfrontRent = q ? (q.upfrontAmount || q.monthlyRent) : 0;
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
                {isStaffAssisted
                    ? <div><dt>{t('Xếp kho')}</dt><dd>{t('Nhân viên tư vấn chọn kho')}</dd></div>
                    : displayUnitCode && <div><dt>{t(unitCode ? 'Kho đã chọn' : 'Kho dự kiến')}</dt><dd>{displayUnitCode}</dd></div>}
                <div><dt>{t('Ngày nhận kho')}</dt><dd>{formatDate(moveInDate)}</dd></div>
                <div><dt>{t('Thời hạn thuê')}</dt><dd>{t('{months} tháng', { months: rentalMonths, end: formatDate(rentalEndDate(moveInDate, rentalMonths)) })}</dd></div>
            </dl>
            {quote.isError && <div className="se-alert" role="alert">{errorMessage(quote.error)}</div>}
            {q && (
                <>
                    <dl>
                        <div><dt>{t('Tiền thuê mỗi tháng')}</dt><dd>{formatVnd(q.monthlyRent)}</dd></div>
                        <div><dt>{t('Tiền thuê × {months} tháng', { months: rentalMonths })}</dt><dd>{formatVnd(q.rentSubtotal)}</dd></div>
                        {isSameDay ? (
                            <>
                                <div><dt>{t('Tiền cọc (tối thiểu 100.000₫)')}</dt><dd>{formatVnd(oneDayDeposit)}</dd></div>
                                <div><dt>{t('Thanh toán trước (1 tháng tiền thuê)')}</dt><dd>{formatVnd(upfrontRent)}</dd></div>
                            </>
                        ) : (
                            <div><dt>{t('Tiền cọc ')}</dt><dd>{formatVnd(q.depositAmount)}</dd></div>
                        )}
                    </dl>
                    <div className="se-summary-total">
                        <span>{t(isSameDay ? 'Cần thanh toán ngay' : 'Tổng cộng')}</span>
                        <strong>{formatVnd(isSameDay ? upfrontRent : q.totalAmount)}</strong>
                    </div>
                </>
            )}
            {children}
            {cancelHours > 0 && <p className="se-hint" style={{ textAlign: 'center' }}><Icon name="shield" size={13} /> {t('Hủy miễn phí trong {hours} giờ sau khi đặt kho', { hours: cancelHours })}</p>}
            {isSameDay && q && (
                <p className="se-hint" style={{ textAlign: 'center' }}>
                    {t('Khách huỷ hoặc không nhận kho trước 20:30: hoàn lại {amount} (khoản đã trả − 100.000₫).', { amount: formatVnd(Math.max(upfrontRent - 100000, 0)) })}
                </p>
            )}
        </aside>
    );
}
*/

/** The "Order summary" card from Figma: what is booked and what it costs. `children` is the call to action. */
export default function BookingSummary({ facility, type, moveInDate, rentalMonths, quote, unitCode, sameDay, unitAssignmentMode = 'AUTO', children }) {
    const q = quote.data;
    const t = useT();
    const { lang } = useLang();
    const policyCancelHours = useTerms().data?.cancelFreeHours;
    const isSameDay = sameDay ?? q?.sameDay ?? false;
    const cancelHours = isSameDay ? 0 : policyCancelHours;
    const isStaffAssisted = unitAssignmentMode === 'STAFF_ASSISTED';
    const dueNow = q ? (isSameDay ? (q.upfrontAmount || q.monthlyRent) : q.depositAmount) : 0;
    const remainingRent = q ? Math.max((q.rentSubtotal ?? 0) - (isSameDay ? (q.upfrontAmount || q.monthlyRent) : 0), 0) : 0;
    const keptDeposit = q ? (isSameDay ? (q.depositAmount || Math.max(Math.round((q.monthlyRent || dueNow) / 30), 100000)) : q.depositAmount) : 100000;
    const refundBack = Math.max(dueNow - keptDeposit, 0);

    const barCount = Math.min(Math.max(Number(rentalMonths) || 1, 1), 4);
    const barLabels = Array.from({ length: barCount }, (_, i) => {
        if (i === 0) return t('Hôm nay');
        if (i === barCount - 1 && rentalMonths > barCount) return t('Tháng {n}', { n: rentalMonths });
        return t('Tháng {n}', { n: i + 1 });
    });

    const unitTitle = type
        ? `${type.name && type.name !== `${type.areaM2} m²` ? type.name : `${t('Kho')} ${type.code}`} · ${type.areaM2?.toLocaleString('vi-VN')} m²`
        : `${t('Kho')} …`;
    const unitSubtitle = isStaffAssisted
        ? t('Nhân viên sẽ giúp chọn kho cụ thể cho bạn')
        : (facility?.name ?? t('Kho sẽ được hệ thống tự động xếp.'));

    return (
        <aside className="se-panel se-summary se-summary-v2">
            <h2>{t('Tóm tắt đơn đặt kho')}</h2>

            <div className="se-sum-card se-sum-unit-card">
                <span className="se-sum-unit-icon"><Icon name="box" size={22} /></span>
                <div className="se-sum-unit-text">
                    <strong>{unitTitle}</strong>
                    <small>{unitSubtitle}</small>
                </div>
            </div>

            <div className="se-sum-meta-grid">
                <div className="se-sum-card se-sum-meta-box">
                    <small>{t('Ngày nhận')}</small>
                    <strong>{formatShortDate(moveInDate, lang)}</strong>
                </div>
                <div className="se-sum-card se-sum-meta-box">
                    <small>{t('Thời hạn thuê')}</small>
                    <strong>{t('{months} tháng', { months: rentalMonths })}</strong>
                </div>
            </div>

            {quote.isError && <div className="se-alert" role="alert">{errorMessage(quote.error)}</div>}

            {q && (
                <>
                    <div className="se-sum-card se-sum-due-card">
                        <div className="se-sum-line">
                            <span>{t('Tiền thuê')}</span>
                            <strong>{formatVnd(q.monthlyRent)}</strong>
                        </div>
                        <div className="se-sum-divider" />
                        <div className="se-sum-due-row">
                            <span>{t('Cần thanh toán ngay')}</span>
                            <strong>{formatVnd(dueNow)}</strong>
                        </div>
                    </div>

                    {isSameDay ? (
                        <div className="se-sum-policy-banner">
                            <Icon name="shield" size={18} />
                            <p>
                                <strong>{t('Hủy miễn phí trong 3 giờ sau khi đặt kho.')}</strong>{' '}
                                {t('Hủy sau 3 giờ hoặc không nhận kho trước 20:30: hoàn lại {refund} tiền thuê; giữ lại {deposit} (1/30 tiền thuê tháng, tối thiểu 100.000₫).', {
                                    refund: formatVnd(refundBack),
                                    deposit: formatVnd(keptDeposit),
                                })}
                            </p>
                        </div>
                    ) : cancelHours > 0 ? (
                        <div className="se-sum-policy-banner">
                            <Icon name="shield" size={18} />
                            <p>
                                <strong>{t('Hủy miễn phí trong {hours} giờ sau khi đặt kho', { hours: cancelHours })}.</strong>
                            </p>
                        </div>
                    ) : null}
                </>
            )}

            <div className="se-sum-cta-wrap">
                {children}
            </div>
        </aside>
    );
}
