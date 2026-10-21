import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { handoversApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import Icon from '../components/Icon.jsx';
import { formatDate, formatVnd, todayIso } from '../components/format.js';
import { earlyReturnText, useTerms } from '../components/terms.js';
import { useMyContracts, useMyReservations } from './queries.js';
import './UnitDetailPage.css';

const CHECKS = [
    'Tôi sẽ dọn trống và quét sạch kho',
    'Tôi sẽ tháo ổ khóa riêng và mang theo thẻ ra vào',
    'Tôi hiểu phí vệ sinh hoặc sửa chữa (nếu có) sẽ trừ vào tiền cọc',
    'Tôi sẽ có mặt khi kiểm tra kho, hoặc cử người có giấy ủy quyền',
];
const NEXT_STEPS = [
    'Nhân viên xác nhận yêu cầu và hẹn giờ kiểm tra kho.',
    'Bạn dọn trống kho và tháo ổ khóa trước giờ hẹn.',
    'Nhân viên cùng bạn kiểm tra kho và thu lại ổ khóa, thẻ ra vào.',
    'Tiền cọc, sau khi trừ các khoản phí (nếu có), được hoàn theo cách bạn chọn.',
];
const MOVE_OUT_BADGE = {
    Requested: ['low', 'Đã gửi yêu cầu'], Approved: ['low', 'Đã hẹn kiểm tra'], Inspected: ['low', 'Đã kiểm tra kho'],
    Completed: ['', 'Đã hoàn tất'], Cancelled: ['none', 'Đã hủy'],
};

/** U15: ask to end a rental — date, checklist and where to refund the deposit. */
export default function HandoverPage() {
    const [params] = useSearchParams();
    const queryClient = useQueryClient();
    const contracts = useMyContracts();
    const reservations = useMyReservations();
    const requests = useQuery({ queryKey: ['handovers'], queryFn: () => handoversApi.list({ page: 1, pageSize: 50 }) });

    const active = (contracts.data?.items ?? []).filter((c) => c.status === 'Active');
    const [picked, setPicked] = useState('');
    const contract = active.find((c) => c.contractId === (Number(picked) || Number(params.get('contractId')))) ?? active[0];
    const reservation = reservations.data?.items?.find((r) => r.reservationId === contract?.reservationId);
    const open = requests.data?.items?.find((m) => m.contractId === contract?.contractId && m.status !== 'Cancelled');

    const terms = useTerms();
    // No notice period any more (SR-04): any date from today; before the end date costs a share of the deposit.
    const earliest = todayIso();
    const [form, setForm] = useState({ plannedHandoverDate: '', reason: '', refundMethod: 'BankTransfer', refundAccount: '' });
    const [checked, setChecked] = useState(CHECKS.map(() => false));
    const set = (patch) => setForm((f) => ({ ...f, ...patch }));
    const needsAccount = form.refundMethod === 'BankTransfer';
    const ready = form.plannedHandoverDate && checked.every(Boolean) && (!needsAccount || form.refundAccount.trim());

    const submit = useMutation({
        mutationFn: () => handoversApi.create({
            contractId: contract.contractId,
            plannedHandoverDate: form.plannedHandoverDate,
            reason: form.reason.trim() || null,
            refundMethod: form.refundMethod,
            refundAccount: needsAccount ? form.refundAccount.trim() : null,
        }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['handovers'] }),
    });

    if (contracts.isLoading) return <p className="se-empty">Đang tải…</p>;
    if (!contract) {
        return (
            <>
                <div className="se-account-title"><div><h1>Yêu cầu trả kho</h1></div></div>
                <div className="se-card se-empty">Bạn không có kho nào đang thuê để trả. <Link to="/my-storage" className="se-link">Quay lại Kho của tôi</Link></div>
            </>
        );
    }

    return (
        <>
            <Link to={`/my-storage/units/${contract.contractId}`} className="se-back"><Icon name="arrowLeft" size={16} /> Quay lại kho {contract.unitCode}</Link>
            <div className="se-account-title">
                <div><h1>Yêu cầu trả kho</h1><p>Cho chúng tôi biết ngày bạn dọn trống kho, nhân viên sẽ hẹn lịch kiểm tra cùng bạn.</p></div>
            </div>

            <div className="se-detail-grid">
                <div className="se-panel">
                    <div className="se-summary-unit">
                        <span className="se-brand-mark"><Icon name="box" size={18} /></span>
                        <div>
                            <strong>Kho {contract.unitCode}{reservation ? ` · ${reservation.unitTypeName}` : ''}</strong>
                            <small>{reservation?.facilityName} · hợp đồng {contract.contractNumber} hết hạn {formatDate(contract.endDate)}</small>
                        </div>
                        {active.length > 1 && (
                            <select className="se-unit-switch" value={contract.contractId} onChange={(e) => setPicked(e.target.value)} aria-label="Chọn kho khác">
                                {active.map((c) => <option key={c.contractId} value={c.contractId}>{c.unitCode}</option>)}
                            </select>
                        )}
                    </div>

                    {open ? (
                        <div className="se-alert info">
                            Bạn đã yêu cầu trả kho ngày {formatDate(open.plannedHandoverDate)}. Trạng thái:{' '}
                            <span className={`se-badge ${MOVE_OUT_BADGE[open.status]?.[0] ?? ''}`}>{MOVE_OUT_BADGE[open.status]?.[1] ?? open.status}</span>
                            {open.inspectionSlot ? ` · lịch kiểm tra ${formatDate(open.inspectionSlot)}` : ''}
                        </div>
                    ) : (
                        <form className="se-form" onSubmit={(e) => { e.preventDefault(); if (ready) submit.mutate(); }}>
                            <h2>1. Khi nào bạn trả kho?</h2>
                            <div className="se-panel-grid">
                                <label><span className="se-label">Ngày dự kiến trả kho</span>
                                    <div className="se-field"><Icon name="calendar" />
                                        <input type="date" min={earliest} max={contract.endDate} value={form.plannedHandoverDate} onChange={(e) => set({ plannedHandoverDate: e.target.value })} required />
                                    </div>
                                    <p className="se-hint">{terms.data ? earlyReturnText(terms.data) : ''}</p>
                                </label>
                                <label><span className="se-label">Lý do (không bắt buộc)</span>
                                    <div className="se-input"><input maxLength={200} value={form.reason} onChange={(e) => set({ reason: e.target.value })} placeholder="Ví dụ: chuyển sang kho lớn hơn" /></div>
                                </label>
                            </div>

                            <h2>2. Xác nhận trước khi kiểm tra kho</h2>
                            <div className="se-checklist">
                                {CHECKS.map((label, i) => (
                                    <label key={label} className="se-check">
                                        <input type="checkbox" checked={checked[i]} onChange={(e) => setChecked(checked.map((v, j) => (j === i ? e.target.checked : v)))} />
                                        <span>{label}</span>
                                    </label>
                                ))}
                            </div>

                            <h2>3. Hoàn tiền cọc vào đâu?</h2>
                            <div className="se-panel-grid">
                                <label><span className="se-label">Cách nhận tiền cọc</span>
                                    <div className="se-field"><Icon name="card" />
                                        <select value={form.refundMethod} onChange={(e) => set({ refundMethod: e.target.value })}>
                                            <option value="BankTransfer">Chuyển khoản ngân hàng</option>
                                            <option value="Cash">Nhận tiền mặt tại cơ sở</option>
                                        </select>
                                    </div>
                                </label>
                                {needsAccount && (
                                    <label><span className="se-label">Ngân hàng và số tài khoản</span>
                                        <div className="se-input"><input maxLength={50} value={form.refundAccount} onChange={(e) => set({ refundAccount: e.target.value })} placeholder="Vietcombank 0071 000 123 456" required /></div>
                                    </label>
                                )}
                            </div>

                            {submit.isError && <div className="se-alert" role="alert">{errorMessage(submit.error)}</div>}
                            <div className="se-form-actions">
                                <Link to={`/my-storage/units/${contract.contractId}`} className="se-btn se-btn-ghost">Hủy</Link>
                                <button type="submit" className="se-btn se-btn-primary" disabled={!ready || submit.isPending}>
                                    {submit.isPending ? 'Đang gửi…' : <>Gửi yêu cầu trả kho <Icon name="arrow" size={16} /></>}
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                <aside>
                    <section className="se-panel">
                        <h2>Tiền cọc</h2>
                        <dl className="se-kv">
                            <div><dt>Tiền cọc đang giữ</dt><dd>{formatVnd(contract.depositAmount)}</dd></div>
                            <div><dt>Phí vệ sinh, hư hỏng</dt><dd>xác định khi kiểm tra kho</dd></div>
                        </dl>
                        <p className="se-hint">Số tiền hoàn lại cuối cùng được xác nhận sau khi kiểm tra kho.</p>
                    </section>
                    <section className="se-panel">
                        <h2>Các bước tiếp theo</h2>
                        <ol className="se-next-steps">{NEXT_STEPS.map((s) => <li key={s}>{s}</li>)}</ol>
                    </section>
                    <div className="se-due-card">
                        <strong>Trả kho trước hạn</strong>
                        <small>Hợp đồng của bạn có hiệu lực đến ngày {formatDate(contract.endDate)}. Bạn vẫn có thể trả kho sớm hơn; hãy hỏi nhân viên về tiền thuê của những tháng còn lại.</small>
                    </div>
                </aside>
            </div>
        </>
    );
}
