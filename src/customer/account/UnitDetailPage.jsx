import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accessLogsApi, contractsApi, renewalsApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import Icon from '../components/Icon.jsx';
import { addMonths, formatDate, formatVnd, todayIso } from '../components/format.js';
import PayInvoiceButton from './PayInvoiceButton.jsx';
import { discountLabel, useTerms } from '../components/terms.js';
import { CONTRACT_BADGE, OPEN_INVOICE, invoiceBadge, periodUsed, useMyInvoices, useMyReservations } from './queries.js';
import './MyStoragePage.css';
import './UnitDetailPage.css';

const RENEW_OPTIONS = [1, 3, 6, 12];
const ACCESS_RESULT = { Granted: 'Mở cổng thành công', Denied: 'Bị từ chối', Expired: 'Mã đã hết hạn' };
const formatTime = (iso) => new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function AccessCodeCard({ contract }) {
    const queryClient = useQueryClient();
    const [code, setCode] = useState(null);
    const [shown, setShown] = useState(true);
    const summary = useQuery({
        queryKey: ['contracts', contract.contractId, 'access-code'],
        queryFn: () => contractsApi.accessCode(contract.contractId),
        enabled: contract.status === 'Active',
    });
    // The backend stores only a hash, so the digits exist on screen only right after a new code is issued.
    const issue = useMutation({
        mutationFn: () => contractsApi.accessCodesRequest(contract.contractId),
        onSuccess: (dto) => {
            setCode(dto.code);
            setShown(true);
            queryClient.invalidateQueries({ queryKey: ['contracts', contract.contractId, 'access-code'] });
        },
    });

    if (contract.status !== 'Active') {
        return (
            <section className="se-code-card">
                <h2><Icon name="key" size={18} /> Mã ra vào cá nhân</h2>
                <p className="se-code-note">Mã được cấp khi nhân viên hoàn tất bàn giao kho cho bạn.</p>
            </section>
        );
    }

    const digits = code ? code.split('') : Array(6).fill('•');
    return (
        <section className="se-code-card">
            <h2><Icon name="key" size={18} /> Mã ra vào cá nhân</h2>
            <div className="se-code-digits" aria-label={code && shown ? `Mã ra vào ${code}` : 'Mã ra vào đang ẩn'}>
                {digits.map((d, i) => <span key={i}>{code && shown ? d : '•'}</span>)}
            </div>
            <div className="se-code-actions">
                {code && <button type="button" onClick={() => setShown(!shown)}><Icon name={shown ? 'eyeOff' : 'eye'} size={14} /> {shown ? 'Ẩn mã' : 'Hiện mã'}</button>}
                <button type="button" onClick={() => issue.mutate()} disabled={issue.isPending}><Icon name="key" size={14} /> {issue.isPending ? 'Đang cấp mã…' : 'Cấp mã mới'}</button>
            </div>
            {issue.isError && <p className="se-code-note error">{errorMessage(issue.error)}</p>}
            <p className="se-code-note">
                {code ? 'Hãy ghi lại mã này ngay, mã sẽ không hiển thị lại. ' : ''}
                {summary.data?.isActive ? `Mã hiện tại có hiệu lực đến ${formatDate(summary.data.expiresAt)}.` : 'Chưa có mã đang dùng. Hãy cấp mã mới để mở cổng.'} Không chia sẻ mã cho người khác.
            </p>
        </section>
    );
}

function RenewCard({ contract, unitTypeId }) {
    const terms = useTerms().data;
    const queryClient = useQueryClient();
    const [months, setMonths] = useState(6);
    const renewals = useQuery({ queryKey: ['renewals', contract.contractId], queryFn: () => renewalsApi.list({ contractId: contract.contractId, page: 1, pageSize: 10 }) });
    const renew = useMutation({
        mutationFn: () => renewalsApi.create({ contractId: contract.contractId, extendMonths: months }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['renewals', contract.contractId] }),
    });
    const pending = renewals.data?.items?.find((r) => r.status === 'Requested');

    return (
        <section className="se-panel">
            <h2><Icon name="calendar" size={18} /> Gia hạn thuê</h2>
            <p className="se-hint">Thời hạn hiện tại kết thúc ngày {formatDate(contract.endDate)}. Gia hạn để giữ kho; quản lý sẽ duyệt ngày kết thúc và giá thuê mới.</p>
            {pending ? (
                <div className="se-alert info">
                    Đã gửi yêu cầu gia hạn thêm {pending.extendMonths} tháng: ngày kết thúc mới {formatDate(pending.newEndDate)}, {formatVnd(pending.newMonthlyRent)} / tháng. Đang chờ duyệt.
                </div>
            ) : (
                <>
                    <div className="se-chips" role="radiogroup" aria-label="Thời gian gia hạn">
                        {RENEW_OPTIONS.map((m) => {
                            const note = discountLabel(terms, m, unitTypeId);
                            return (
                                <button key={m} type="button" role="radio" aria-checked={months === m}
                                    className={`se-chip${months === m ? ' active' : ''}`} onClick={() => setMonths(m)}>
                                    {months === m && <Icon name="check" size={14} />}+{m} tháng {note && <small>{note}</small>}
                                </button>
                            );
                        })}
                    </div>
                    <div className="se-renew-preview">Ngày kết thúc mới: <strong>{formatDate(addMonths(contract.endDate, months))}</strong></div>
                    {renew.isError && <div className="se-alert" role="alert">{errorMessage(renew.error)}</div>}
                    <button type="button" className="se-btn se-btn-primary se-btn-block" onClick={() => renew.mutate()} disabled={renew.isPending}>
                        {renew.isPending ? 'Đang gửi…' : 'Gửi yêu cầu gia hạn'}
                    </button>
                </>
            )}
        </section>
    );
}

/** U10: one rented unit — access code, renewal, contract, payments and access log. */
export default function UnitDetailPage() {
    const contractId = Number(useParams().contractId);
    const queryClient = useQueryClient();
    const contract = useQuery({ queryKey: ['contracts', contractId], queryFn: () => contractsApi.getById(contractId) });
    const reservations = useMyReservations();
    const invoices = useMyInvoices();
    const logs = useQuery({ queryKey: ['access-logs', 'mine'], queryFn: () => accessLogsApi.mine({ page: 1, pageSize: 50 }) });
    const sign = useMutation({
        mutationFn: () => contractsApi.sign(contractId),
        onSuccess: (dto) => {
            queryClient.setQueryData(['contracts', contractId], dto);
            queryClient.invalidateQueries({ queryKey: ['contracts'] });
        },
    });

    if (contract.isLoading) return <p className="se-empty">Đang tải thông tin kho…</p>;
    if (contract.isError) return <div className="se-alert" role="alert">{errorMessage(contract.error)}</div>;

    const c = contract.data;
    const r = reservations.data?.items?.find((x) => x.reservationId === c.reservationId);
    const mine = (invoices.data?.items ?? []).filter((i) => i.contractId === contractId);
    const due = mine.filter((i) => OPEN_INVOICE.includes(i.status)).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    const myLogs = (logs.data?.items ?? []).filter((l) => l.contractId === contractId).slice(0, 6);
    const live = ['Active', 'Overdue', 'Suspended'].includes(c.status);
    // The API renews and moves out only Active contracts; an overdue one must be paid up first.
    const active = c.status === 'Active';
    const used = periodUsed(c.startDate, c.endDate, todayIso());

    return (
        <>
            <Link to="/my-storage" className="se-back"><Icon name="arrowLeft" size={16} /> Quay lại Kho của tôi</Link>
            <div className="se-account-title">
                <div>
                    <h1>Kho {c.unitCode} <span className={`se-badge ${CONTRACT_BADGE[c.status]?.[0] ?? 'low'}`}>{CONTRACT_BADGE[c.status]?.[1] ?? c.status}</span></h1>
                    <p>{[r?.unitTypeName, r?.facilityName].filter(Boolean).join(' · ')}</p>
                </div>
                <div className="se-title-actions">
                    <Link to={`/support/new?contractId=${contractId}`} className="se-btn se-btn-ghost"><Icon name="shield" size={16} /> Báo sự cố</Link>
                    {active && <Link to={`/move-out?contractId=${contractId}`} className="se-btn se-btn-danger">Yêu cầu trả kho</Link>}
                </div>
            </div>

            {c.status === 'Draft' && !c.signedAt && (
                <div className="se-due">
                    <Icon name="file" size={20} />
                    <div><strong>Vui lòng ký hợp đồng thuê kho</strong><small>Sau khi bạn ký, nhân viên sẽ bàn giao và kích hoạt kho.</small></div>
                    <button type="button" className="se-btn se-btn-amber se-btn-sm" onClick={() => sign.mutate()} disabled={sign.isPending}>{sign.isPending ? 'Đang ký…' : 'Ký hợp đồng'}</button>
                </div>
            )}
            {sign.isError && <div className="se-alert" role="alert">{errorMessage(sign.error)}</div>}

            <div className="se-detail-grid">
                <div>
                    <AccessCodeCard contract={c} />
                    {active && <RenewCard contract={c} unitTypeId={r?.unitTypeId} />}
                    {live && !active && <div className="se-alert info">Hãy thanh toán tiền thuê quá hạn để có thể gia hạn hoặc yêu cầu trả kho.</div>}
                    <section className="se-panel">
                        <h2>Lịch sử thanh toán</h2>
                        <div className="se-table-wrap">
                            <table className="se-table">
                                <thead><tr><th>Ngày lập</th><th>Nội dung</th><th>Số tiền</th><th>Trạng thái</th></tr></thead>
                                <tbody>
                                    {mine.map((inv) => {
                                        const [tone, label] = invoiceBadge(inv);
                                        return (
                                            <tr key={inv.invoiceId}>
                                                <td>{formatDate(inv.issueDate)}</td>
                                                <td>{inv.items?.[0]?.description ?? inv.invoiceNumber}</td>
                                                <td className="price">{formatVnd(inv.totalAmount)}</td>
                                                <td><span className={`se-badge ${tone}`}>{label}</span></td>
                                            </tr>
                                        );
                                    })}
                                    {!mine.length && <tr><td colSpan={4} className="se-empty">Kho này chưa có hóa đơn nào.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>

                <aside>
                    {due && (
                        <div className="se-due-card">
                            <strong>{formatVnd(due.outstandingAmount)} · hạn {formatDate(due.dueDate)}</strong>
                            <small>{due.items?.[0]?.description ?? due.invoiceNumber}</small>
                            <PayInvoiceButton invoice={due} className="se-btn se-btn-amber se-btn-block se-btn-sm">Thanh toán ngay</PayInvoiceButton>
                        </div>
                    )}
                    <section className="se-panel">
                        <h2>Hợp đồng</h2>
                        <dl className="se-kv">
                            <div><dt>Số hợp đồng</dt><dd>{c.contractNumber}</dd></div>
                            <div><dt>Ngày bắt đầu</dt><dd>{formatDate(c.startDate)}</dd></div>
                            <div><dt>Ngày kết thúc</dt><dd>{formatDate(c.endDate)}</dd></div>
                            <div><dt>Tiền thuê mỗi tháng</dt><dd>{formatVnd(c.monthlyRent)}</dd></div>
                            <div><dt>Tiền cọc đang giữ</dt><dd>{formatVnd(c.depositAmount)}</dd></div>
                            <div><dt>Ngày thanh toán</dt><dd>Ngày {c.paymentDay} hằng tháng</dd></div>
                            <div><dt>Ngày ký</dt><dd>{c.signedAt ? formatDate(c.signedAt) : 'Chưa ký'}</dd></div>
                        </dl>
                        {live && <>
                            <p className="se-hint">Đã dùng {used}% thời hạn thuê</p>
                            <div className="se-progress flat"><span style={{ width: `${used}%` }} /></div>
                        </>}
                    </section>
                    <section className="se-panel">
                        <h2>Lịch sử ra vào</h2>
                        <ul className="se-log">
                            {myLogs.map((l) => <li key={l.accessLogId}><strong>{formatTime(l.accessTime)}</strong> {ACCESS_RESULT[l.result] ?? l.result}</li>)}
                            {!myLogs.length && <li className="se-hint">Chưa có lượt ra vào nào.</li>}
                        </ul>
                    </section>
                </aside>
            </div>
        </>
    );
}
