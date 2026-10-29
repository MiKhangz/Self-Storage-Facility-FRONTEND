import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supportTicketsApi, ticketCategoriesApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import Icon from '../components/Icon.jsx';
import { useFacilities } from '../sizes/SizesPage.jsx';
import { LIVE_CONTRACT, useMyContracts, useMyReservations, useMyTickets } from '../account/queries.js';
import { formatDateTime, ticketBadge } from './support.js';
import './Support.css';
import { useT } from '../../i18n/I18n.jsx';

const URGENCY = [
    { value: 'Low', label: 'Không gấp' },
    { value: 'Normal', label: 'Bình thường' },
    { value: 'Urgent', label: 'Khẩn cấp: không vào được kho' },
];

/** U11: raise a support request, with the customer's own requests alongside. */
export default function SupportRequestPage() {
    const [params] = useSearchParams();
    const tr = useT();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const contracts = useMyContracts();
    const reservations = useMyReservations();
    const facilities = useFacilities();
    const tickets = useMyTickets();
    const categories = useQuery({ queryKey: ['ticket-categories'], queryFn: () => ticketCategoriesApi.list() });

    const units = (contracts.data?.items ?? []).filter((c) => LIVE_CONTRACT.includes(c.status));
    const facilityOfReservation = Object.fromEntries((reservations.data?.items ?? []).map((r) => [r.reservationId, r]));
    const preset = units.find((c) => c.contractId === Number(params.get('contractId')));

    const [form, setForm] = useState({ storageUnitId: preset?.storageUnitId ?? '', facilityId: '', categoryId: '', priority: 'Normal', subject: '', description: '' });
    const set = (patch) => setForm((f) => ({ ...f, ...patch }));
    // A preset unit from "Report issue" can arrive after the first render, once contracts load.
    const storageUnitId = form.storageUnitId === '' && preset ? preset.storageUnitId : form.storageUnitId;
    const facilityId = Number(form.facilityId) || facilities.data?.items?.[0]?.facilityId;

    const create = useMutation({
        mutationFn: () => supportTicketsApi.create({
            categoryId: Number(form.categoryId),
            subject: form.subject.trim(),
            description: form.description.trim(),
            priority: form.priority,
            ...(storageUnitId ? { storageUnitId: Number(storageUnitId) } : { facilityId }),
        }),
        onSuccess: (ticket) => {
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            navigate(`/support/requests/${ticket.ticketId}`);
        },
    });
    const canSend = form.categoryId && form.subject.trim() && form.description.trim() && (storageUnitId || facilityId);

    return (
        <>
            <div className="se-account-title">
                <div><h1>{tr('Gửi yêu cầu hỗ trợ')}</h1><p>{tr('Cho chúng tôi biết chuyện gì đã xảy ra. Nhân viên tại cơ sở sẽ trả lời ngay trong yêu cầu này.')}</p></div>
            </div>
            <div className="se-support-grid">
                <form className="se-panel se-form" onSubmit={(e) => { e.preventDefault(); if (canSend) create.mutate(); }}>
                    <div className="se-panel-grid">
                        <label><span className="se-label">{tr('Kho liên quan')}</span>
                            <div className="se-field"><Icon name="box" />
                                <select value={storageUnitId} onChange={(e) => set({ storageUnitId: e.target.value })}>
                                    <option value="">{tr('Không liên quan đến kho cụ thể')}</option>
                                    {units.map((c) => (
                                        <option key={c.contractId} value={c.storageUnitId}>
                                            {c.unitCode}{facilityOfReservation[c.reservationId] ? ` · ${facilityOfReservation[c.reservationId].facilityName}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </label>
                        {!storageUnitId && (
                            <label><span className="se-label">{tr('Cơ sở')}</span>
                                <div className="se-field"><Icon name="pin" />
                                    <select value={facilityId ?? ''} onChange={(e) => set({ facilityId: e.target.value })}>
                                        {facilities.data?.items?.map((f) => <option key={f.facilityId} value={f.facilityId}>{f.name}</option>)}
                                    </select>
                                </div>
                            </label>
                        )}
                    </div>

                    <span className="se-label">{tr('Vấn đề thuộc loại nào?')}</span>
                    <div className="se-chips" role="radiogroup" aria-label={tr('Loại vấn đề')}>
                        {categories.data?.map((c) => (
                            <button key={c.categoryId} type="button" role="radio" aria-checked={Number(form.categoryId) === c.categoryId}
                                className={`se-chip${Number(form.categoryId) === c.categoryId ? ' active' : ''}`}
                                onClick={() => set({ categoryId: c.categoryId, priority: c.defaultPriority === 'Urgent' ? 'Urgent' : form.priority })}>
                                {Number(form.categoryId) === c.categoryId && <Icon name="check" size={14} />}{c.name}
                            </button>
                        ))}
                        {categories.isError && <span className="se-hint">{tr('Không tải được danh sách loại vấn đề. Vui lòng tải lại trang.')}</span>}
                        {categories.data?.length === 0 && <span className="se-hint">{tr('Chưa thể gửi yêu cầu trực tuyến. Vui lòng liên hệ nhân viên tại cơ sở.')}</span>}
                    </div>

                    <span className="se-label">{tr('Mức độ khẩn')}</span>
                    <div className="se-chips" role="radiogroup" aria-label={tr('Mức độ khẩn')}>
                        {URGENCY.map((u) => (
                            <button key={u.value} type="button" role="radio" aria-checked={form.priority === u.value}
                                className={`se-chip${form.priority === u.value ? ' active' : ''}`} onClick={() => set({ priority: u.value })}>
                                {form.priority === u.value && <Icon name="check" size={14} />}{tr(u.label)}
                            </button>
                        ))}
                    </div>

                    <label><span className="se-label">{tr('Tiêu đề')}</span>
                        <div className="se-input"><input value={form.subject} maxLength={200} onChange={(e) => set({ subject: e.target.value })} required /></div>
                    </label>
                    <label><span className="se-label">{tr('Mô tả chi tiết')}</span>
                        <textarea className="se-textarea" rows={4} maxLength={1000} value={form.description} onChange={(e) => set({ description: e.target.value })} required />
                    </label>

                    {create.isError && <div className="se-alert" role="alert">{errorMessage(create.error)}</div>}
                    <div className="se-form-actions">
                        <Link to="/my-storage" className="se-btn se-btn-ghost">{tr('Hủy')}</Link>
                        <button type="submit" className="se-btn se-btn-primary" disabled={!canSend || create.isPending}>
                            {create.isPending ? tr('Đang gửi…') : <>{tr('Gửi yêu cầu')} <Icon name="arrow" size={16} /></>}
                        </button>
                    </div>
                </form>

                <aside>
                    <h2 className="se-side-title">{tr('Yêu cầu của tôi')}</h2>
                    <div className="se-ticket-list">
                        {(tickets.data?.items ?? []).map((t) => {
                            const [tone, label] = ticketBadge(t.status);
                            return (
                                <Link key={t.ticketId} to={`/support/requests/${t.ticketId}`} className="se-card se-ticket-item">
                                    <div className="se-ticket-item-top"><small>{t.ticketCode}</small><span className={`se-badge ${tone}`}>{tr(label)}</span></div>
                                    <strong>{t.subject}</strong>
                                    <small>{[t.unitCode, formatDateTime(t.createdAt)].filter(Boolean).join(' · ')}</small>
                                </Link>
                            );
                        })}
                        {!tickets.data?.items?.length && <p className="se-hint">{tr(tickets.isLoading ? 'Đang tải…' : tickets.isError ? 'Không tải được yêu cầu của bạn.' : 'Bạn chưa gửi yêu cầu nào.')}</p>}
                    </div>
                </aside>
            </div>
        </>
    );
}
