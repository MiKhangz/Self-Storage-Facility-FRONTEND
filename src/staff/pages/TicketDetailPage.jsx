import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { maintenanceOrdersApi, reservationsApi, supportTicketsApi, ticketQueueApi } from '../../api/generated';
import { api, errorMessage } from '../../api/axiosClient';
import { useAuth } from '../../features/auth/AuthContext';
import { Roles } from '../../features/auth/roles';
import Icon from '../../customer/components/Icon.jsx';
import { initials } from '../../customer/layout/CustomerLayout.jsx';
import { formatDate, rentalEndDate } from '../../customer/components/format.js';
import { formatDateTime } from '../../customer/support/support.js';
import { Modal, PageHeader, Status } from '../components/ui.jsx';
import { humanize } from '../queries.js';
import '../../customer/support/Support.css';
import { useT } from '../../i18n/I18n.jsx';
import { confirmAction } from '../../customer/components/confirm.js';

// Moves staff may make, per the backend's ticket status rules; Closed is left to the customer or a manager (or staff on a consult ticket).
const NEXT = { New: ['InProgress'], InProgress: ['WaitingForCustomer', 'Resolved'], WaitingForCustomer: ['InProgress', 'Resolved'], Resolved: ['InProgress'] };

/** A20: one ticket from the staff side — conversation, internal notes, status and assignment. */
/** The customer reported a problem with their unit: staff open the repair from here, the only way onto a rented unit. */
function OrderRepair({ ticket }) {
    const tr = useT();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [description, setDescription] = useState(ticket.subject ?? '');
    const create = useMutation({
        mutationFn: () => maintenanceOrdersApi.create({ ticketId: ticket.ticketId, description: description.trim() }),
        onSuccess: () => { ['maintenance-orders', 'storage-units'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] })); setOpen(false); },
    });
    return (
        <>
            {create.isSuccess && <div className="se-alert info" role="status">{tr('Maintenance order created for unit {code}.', { code: ticket.unitCode })}</div>}
            <button type="button" className="se-btn se-btn-ghost se-btn-block" onClick={() => setOpen(true)}>{tr('Order maintenance for {code}', { code: ticket.unitCode })}</button>
            {open && (
                <Modal onClose={() => setOpen(false)}>
                    <form className="se-panel sa-dialog" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
                        <div className="sa-card-title"><h2>{tr('Maintenance for unit {code}', { code: ticket.unitCode })}</h2>
                            <button type="button" className="sa-close" onClick={() => setOpen(false)} aria-label={tr('Close')}>×</button></div>
                        <p className="sa-muted">{tr("From {name}'s ticket {code}. The unit stays theirs while the work is done.", { name: ticket.customerName, code: ticket.ticketCode })}</p>
                        <label><span className="se-label">{tr('What needs doing *')}</span>
                            <textarea className="se-textarea" rows={3} maxLength={300} required value={description} onChange={(e) => setDescription(e.target.value)} /></label>
                        {create.isError && <div className="se-alert" role="alert">{errorMessage(create.error)}</div>}
                        <div className="sa-form-actions">
                            <button type="button" className="se-btn se-btn-ghost" onClick={() => setOpen(false)}>{tr('Cancel')}</button>
                            <button type="submit" className="se-btn se-btn-primary" disabled={!description.trim() || create.isPending}>{create.isPending ? tr('Creating…') : tr('Create order')}</button>
                        </div>
                    </form>
                </Modal>
            )}
        </>
    );
}

/** Assign or reassign an available unit for a STAFF_ASSISTED consultation ticket. */
function ConsultAssignUnit({ ticket, canCloseTicket, onCloseTicket }) {
    const tr = useT();
    const queryClient = useQueryClient();
    const reservationId = ticket.reservationId;
    const reservationQuery = useQuery({
        queryKey: ['reservations', reservationId],
        queryFn: () => reservationsApi.getById(reservationId),
        enabled: !!reservationId,
    });
    const r = reservationQuery.data;
    const availability = useQuery({
        queryKey: ['reservations', reservationId, 'available-units', r?.moveInDate, r?.rentalMonths],
        queryFn: () => api.get(`/api/reservations/${reservationId}/available-units`).then((response) => response.data),
        enabled: !!r,
        refetchInterval: 30000,
    });

    const availableUnits = (availability.data ?? []).filter((u) => u.storageUnitId !== r?.storageUnitId);
    const [unitId, setUnitId] = useState(null);
    const [promptClose, setPromptClose] = useState(false);
    const chosen = availableUnits.some((u) => u.storageUnitId === unitId) ? unitId : availableUnits[0]?.storageUnitId;
    const alreadyAssigned = !!(r?.storageUnitId && r?.status === 'Confirmed');
    const canAssign = r && ['Pending', 'PENDING_UNIT_SELECTION', 'Confirmed'].includes(r.status);

    const assign = useMutation({
        mutationFn: () => (alreadyAssigned
            ? reservationsApi.changeUnit(reservationId, { storageUnitId: chosen })
            : reservationsApi.assignUnit(reservationId, { storageUnitId: chosen })),
        onSuccess: () => {
            ['tickets', 'reservations', 'storage-units'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
            setPromptClose(true);
        },
    });

    if (!reservationId) return null;

    return (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--se-line)' }}>
            <span className="se-label">{tr(alreadyAssigned ? 'Reassign unit' : 'Assign unit')}</span>
            {promptClose && ticket.status !== 'Closed' && (
                <div className="se-alert info" role="status" style={{ marginBottom: 12 }}>
                    <p style={{ margin: '0 0 8px' }}>{tr('Unit {code} has been assigned and the customer has been notified. Close this ticket now?', { code: r?.unitCode ?? '' })}</p>
                    {canCloseTicket && (
                        <button type="button" className="se-btn se-btn-primary se-btn-sm" onClick={onCloseTicket}>
                            <Icon name="check" size={14} /> {tr('Close ticket')}
                        </button>
                    )}
                </div>
            )}
            {canAssign && ticket.status !== 'Closed' && (
                <>
                    <div className="sa-unit-options" role="radiogroup" aria-label={tr('Unit to assign')} style={{ marginBottom: 10 }}>
                        {availableUnits.map((u) => (
                            <label key={u.storageUnitId} className={`sa-unit-option${chosen === u.storageUnitId ? ' active' : ''}`}>
                                <input
                                    type="radio"
                                    name="consult-unit"
                                    aria-label={`Unit ${u.unitCode}`}
                                    checked={chosen === u.storageUnitId}
                                    onChange={() => setUnitId(u.storageUnitId)}
                                />
                                <span>
                                    <strong>{u.unitCode}</strong>
                                    <small>{[u.floorName, u.zone].filter(Boolean).join(' · ')}</small>
                                </span>
                                <span className="se-badge">{tr('Available')}</span>
                            </label>
                        ))}
                        {!availableUnits.length && (
                            <p className="sa-muted">
                                {availability.isLoading ? tr('Loading units…') : tr('No available unit of this size for the selected dates.')}
                            </p>
                        )}
                    </div>
                    {assign.isError && <div className="se-alert" role="alert" style={{ marginBottom: 10 }}>{errorMessage(assign.error)}</div>}
                    <button
                        type="button"
                        className="se-btn se-btn-primary se-btn-block"
                        disabled={!chosen || assign.isPending}
                        onClick={() => assign.mutate()}
                    >
                        <Icon name="check" size={16} /> {assign.isPending ? tr('Assigning…') : tr(alreadyAssigned ? 'Reassign unit' : 'Assign unit')}
                    </button>
                </>
            )}
        </div>
    );
}

export default function TicketDetailPage() {
    const tr = useT();
    const ticketId = Number(useParams().ticketId);
    const { session } = useAuth();
    const queryClient = useQueryClient();
    const [body, setBody] = useState('');
    const [internal, setInternal] = useState(false);
    const [nextStatus, setNextStatus] = useState('');
    const [overrideOpen, setOverrideOpen] = useState(false);
    const [overrideReason, setOverrideReason] = useState('');
    const ticket = useQuery({ queryKey: ['tickets', ticketId], queryFn: () => supportTicketsApi.getById(ticketId) });
    const messages = useQuery({ queryKey: ['tickets', ticketId, 'messages'], queryFn: () => supportTicketsApi.getMessages(ticketId) });
    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ['tickets'] });
        queryClient.invalidateQueries({ queryKey: ['reservations'] });
    };

    const send = useMutation({
        mutationFn: () => supportTicketsApi.postMessages(ticketId, { body: body.trim(), isInternalNote: internal, ...(nextStatus && !internal ? { nextStatus } : {}) }),
        onSuccess: () => { setBody(''); setNextStatus(''); refresh(); },
    });
    const move = useMutation({
        mutationFn: (payload) => ticketQueueApi.status(ticketId, typeof payload === 'string' ? { status: payload } : payload),
        onSuccess: () => { setOverrideOpen(false); setOverrideReason(''); refresh(); },
    });
    const assign = useMutation({ mutationFn: () => ticketQueueApi.assign(ticketId, { assigneeId: session.userId }), onSuccess: refresh });

    if (ticket.isLoading) return <p className="se-empty">{tr('Loading ticket…')}</p>;
    if (ticket.isError) return <div className="se-alert" role="alert">{errorMessage(ticket.error)}</div>;
    const t = ticket.data;
    const closed = t.status === 'Closed';
    const isManager = session?.role === Roles.FacilityManager;
    const isStaffOrManager = [Roles.FacilityStaff, Roles.FacilityManager].includes(session?.role);
    const canCloseTicket = isManager || (!!t.reservationId && isStaffOrManager);
    const canOrderWork = isStaffOrManager && t.storageUnitId && !closed;
    const error = send.error ?? move.error ?? assign.error;
    const pendingUnitSelection = t.reservationStatus === 'PENDING_UNIT_SELECTION';

    const handleCloseClick = () => {
        if (pendingUnitSelection) {
            setOverrideOpen(true);
            return;
        }
        confirmAction(tr('Close this ticket?')).then((ok) => ok && move.mutate('Closed'));
    };

    return (
        <>
            <Link to="/admin/tickets" className="se-back"><Icon name="arrowLeft" size={16} /> {tr('Back to the ticket board')}</Link>
            <PageHeader title={`${t.ticketCode} · ${t.subject}`} subtitle={`Opened ${formatDateTime(t.createdAt)} by ${t.customerName}${t.unitCode ? ` · unit ${t.unitCode}` : ''} · ${t.facilityName}`}>
                {canCloseTicket && !closed && <button type="button" className="se-btn se-btn-ghost" onClick={handleCloseClick}>{tr('Close ticket')}</button>}
                {(NEXT[t.status] ?? []).includes('Resolved') && <button type="button" className="se-btn se-btn-primary" disabled={move.isPending} onClick={() => move.mutate('Resolved')}><Icon name="check" size={16} /> {tr('Resolve ticket')}</button>}
            </PageHeader>
            {t.flaggedForReview && (
                <div className="se-alert info" role="status" style={{ marginBottom: 16 }}>
                    {tr('Flagged for staff review: unit was auto-assigned 24h before move-in.')}
                </div>
            )}
            {error && <div className="se-alert" role="alert">{errorMessage(error)}</div>}
            <div className="se-support-grid">
                <section className="se-panel se-convo">
                    <h2>{tr('Conversation')} <span><Status value={t.priority} /> <Status value={t.status} /></span></h2>
                    <ol className="se-messages">
                        {messages.data?.map((m) => (
                            <li key={m.messageId} className={m.senderId === t.customerId ? '' : 'own'}>
                                <span className={`se-avatar${m.senderId === t.customerId ? '' : ' staff'}`}>{initials(m.senderName)}</span>
                                <div className={`se-bubble${m.isInternalNote ? ' internal' : ''}`}>
                                    <div className="se-bubble-head"><strong>{m.senderName}</strong><small>{formatDateTime(m.sentAt)}{m.isInternalNote ? tr(' · internal note') : ''}</small></div>
                                    <p>{m.body}</p>
                                </div>
                            </li>
                        ))}
                    </ol>
                    {!closed && (
                        <form className="se-reply" onSubmit={(e) => { e.preventDefault(); if (body.trim()) send.mutate(); }}>
                            <div className="se-tabs" role="tablist">
                                <button type="button" role="tab" aria-selected={!internal} className={!internal ? 'active' : ''} onClick={() => setInternal(false)}>{tr('Reply to customer')}</button>
                                <button type="button" role="tab" aria-selected={internal} className={internal ? 'active' : ''} onClick={() => setInternal(true)}>{tr('Internal note')}</button>
                            </div>
                            <textarea className="se-textarea" rows={3} maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} placeholder={internal ? tr('Only staff can see this note…') : tr('Type your reply…')} aria-label={tr('Message')} />
                            <div className="sa-form-actions">
                                {!internal && !!NEXT[t.status]?.length && (
                                    <label className="sa-filter"><span className="sr-only">{tr('Status after sending')}</span>
                                        <select value={nextStatus} onChange={(e) => setNextStatus(e.target.value)} aria-label={tr('Status after sending')}>
                                            <option value="">{tr('Keep status')}</option>
                                            {NEXT[t.status].map((s) => <option key={s} value={s}>{tr('Set to {status}', { status: tr(humanize(s)) })}</option>)}
                                        </select>
                                    </label>
                                )}
                                <button type="submit" className="se-btn se-btn-primary se-btn-sm" disabled={!body.trim() || send.isPending}>{send.isPending ? tr('Sending…') : internal ? tr('Save note') : tr('Send reply')}</button>
                            </div>
                        </form>
                    )}
                </section>
                <aside className="se-panel">
                    <h2>{tr('Ticket')}</h2>
                    <dl className="se-kv">
                        <div><dt>{tr('Status')}</dt><dd><Status value={t.status} /></dd></div>
                        <div><dt>{tr('Priority')}</dt><dd><Status value={t.priority} /></dd></div>
                        <div><dt>{tr('Category')}</dt><dd>{t.categoryName}</dd></div>
                        <div><dt>{tr('Customer')}</dt><dd><Link to={`/admin/customers/${t.customerId}`} className="se-link">{t.customerName}</Link></dd></div>
                        {t.reservationId && (
                            <div>
                                <dt>{tr('Booking')}</dt>
                                <dd><Link to={`/admin/reservations?reservationId=${t.reservationId}`} className="se-link">{t.reservationCode || `#${t.reservationId}`}</Link></dd>
                            </div>
                        )}
                        {t.reservationStatus && <div><dt>{tr('Booking status')}</dt><dd><Status value={t.reservationStatus} /></dd></div>}
                        {t.reservationUnitTypeName && <div><dt>{tr('Requested size')}</dt><dd>{t.reservationUnitTypeName}</dd></div>}
                        {t.reservationMoveInDate && (
                            <div>
                                <dt>{tr('Rental period')}</dt>
                                <dd>{formatDate(t.reservationMoveInDate)} → {formatDate(rentalEndDate(t.reservationMoveInDate, t.reservationRentalMonths || 1))}</dd>
                            </div>
                        )}
                        {t.reservationPreferences?.length > 0 && <div><dt>{tr('Preferences')}</dt><dd>{t.reservationPreferences.join(', ')}</dd></div>}
                        {t.reservationPreferenceNote && <div><dt>{tr('Preference note')}</dt><dd>{t.reservationPreferenceNote}</dd></div>}
                        {t.unitCode && <div><dt>{tr('Unit')}</dt><dd>{t.unitCode}</dd></div>}
                        <div><dt>{tr('Due')}</dt><dd>{t.dueDate ? formatDateTime(t.dueDate) : '—'}</dd></div>
                    </dl>
                    {isManager && !closed && <button type="button" className="se-btn se-btn-outline se-btn-block" disabled={assign.isPending} onClick={() => assign.mutate()}>{tr('Assign to me')}</button>}
                    {isStaffOrManager && t.reservationId && (
                        <ConsultAssignUnit ticket={t} canCloseTicket={canCloseTicket} onCloseTicket={handleCloseClick} />
                    )}
                    {canOrderWork && <OrderRepair ticket={t} />}
                </aside>
            </div>

            {overrideOpen && (
                <Modal narrow onClose={() => setOverrideOpen(false)}>
                    <form
                        className="se-panel sa-dialog"
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (overrideReason.trim()) {
                                move.mutate({ status: 'Closed', overrideReason: overrideReason.trim() });
                            }
                        }}
                    >
                        <div className="sa-card-title">
                            <h2>{tr('Close ticket without unit assignment')}</h2>
                            <button type="button" className="sa-close" onClick={() => setOverrideOpen(false)} aria-label={tr('Close')}>×</button>
                        </div>
                        <p className="sa-muted">
                            {tr('Reservation {code} is still pending unit selection. Provide a reason to override and close this ticket.', { code: t.reservationCode })}
                        </p>
                        <label>
                            <span className="se-label">{tr('Override reason *')}</span>
                            <textarea
                                className="se-textarea"
                                rows={3}
                                maxLength={300}
                                required
                                value={overrideReason}
                                onChange={(e) => setOverrideReason(e.target.value)}
                            />
                        </label>
                        {move.isError && <div className="se-alert" role="alert">{errorMessage(move.error)}</div>}
                        <div className="sa-form-actions">
                            <button type="button" className="se-btn se-btn-ghost" onClick={() => setOverrideOpen(false)}>{tr('Cancel')}</button>
                            <button type="submit" className="se-btn se-btn-primary" disabled={!overrideReason.trim() || move.isPending}>
                                {move.isPending ? tr('Closing…') : tr('Override & close')}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </>
    );
}
