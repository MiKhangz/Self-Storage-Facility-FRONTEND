import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supportTicketsApi, ticketQueueApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import { useAuth } from '../../features/auth/AuthContext';
import Icon from '../components/Icon.jsx';
import { initials } from '../layout/CustomerLayout.jsx';
import { PRIORITY_TONE, formatDateTime, ticketBadge } from './support.js';
import './Support.css';

/** U16: one support request — the conversation, replies and closing it. */
export default function TicketDetailPage() {
    const ticketId = Number(useParams().ticketId);
    const { session } = useAuth();
    const queryClient = useQueryClient();
    const [reply, setReply] = useState('');
    const ticket = useQuery({ queryKey: ['tickets', ticketId], queryFn: () => supportTicketsApi.getById(ticketId) });
    const messages = useQuery({ queryKey: ['tickets', ticketId, 'messages'], queryFn: () => supportTicketsApi.getMessages(ticketId) });
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['tickets'] });

    const send = useMutation({
        mutationFn: () => supportTicketsApi.postMessages(ticketId, { body: reply.trim(), isInternalNote: false }),
        onSuccess: () => { setReply(''); refresh(); },
    });
    const close = useMutation({
        mutationFn: () => ticketQueueApi.status(ticketId, { status: 'Closed' }),
        onSuccess: refresh,
    });

    if (ticket.isLoading) return <p className="se-empty">Loading request…</p>;
    if (ticket.isError) return <div className="se-alert" role="alert">{errorMessage(ticket.error)}</div>;

    const t = ticket.data;
    const [tone, label] = ticketBadge(t.status);
    const closed = t.status === 'Closed';
    const error = send.error ?? close.error;

    return (
        <>
            <Link to="/support/requests" className="se-back"><Icon name="arrowLeft" size={16} /> Back to all requests</Link>
            <div className="se-account-title">
                <div>
                    <h1>{t.subject} <span className={`se-badge ${tone}`}>{label}</span></h1>
                    <p>{[t.ticketCode, `opened ${formatDateTime(t.createdAt)}`, t.unitCode && `unit ${t.unitCode}`, t.facilityName].filter(Boolean).join(' · ')}</p>
                </div>
                {!closed && (
                    <button type="button" className="se-btn se-btn-ghost" onClick={() => window.confirm('Close this request? You cannot reply after closing.') && close.mutate()} disabled={close.isPending}>
                        <Icon name="check" size={16} /> Close request
                    </button>
                )}
            </div>
            {error && <div className="se-alert" role="alert">{errorMessage(error)}</div>}

            <div className="se-support-grid">
                <section className="se-panel se-convo">
                    <h2>Conversation <small>{messages.data?.length ?? 0} messages</small></h2>
                    <ol className="se-messages">
                        {messages.data?.map((m) => {
                            const own = m.senderId === session?.userId;
                            return (
                                <li key={m.messageId} className={own ? 'own' : ''}>
                                    <span className={`se-avatar${own ? '' : ' staff'}`}>{initials(m.senderName)}</span>
                                    <div className="se-bubble">
                                        <div className="se-bubble-head"><strong>{m.senderName}</strong><small>{formatDateTime(m.sentAt)}</small></div>
                                        <p>{m.body}</p>
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                    {t.status === 'WaitingForCustomer' && <div className="se-alert info"><Icon name="clock" size={14} /> Staff are waiting for your reply.</div>}
                    {closed ? (
                        <p className="se-hint">This request is closed. <Link to="/support/new" className="se-link">Open a new request</Link></p>
                    ) : (
                        <form className="se-reply" onSubmit={(e) => { e.preventDefault(); if (reply.trim()) send.mutate(); }}>
                            <textarea className="se-textarea" rows={3} maxLength={1000} placeholder="Write a reply…" value={reply} onChange={(e) => setReply(e.target.value)} aria-label="Reply" />
                            <button type="submit" className="se-btn se-btn-primary se-btn-sm" disabled={!reply.trim() || send.isPending}>{send.isPending ? 'Sending…' : 'Send reply'}</button>
                        </form>
                    )}
                </section>

                <aside className="se-panel">
                    <h2>Request details</h2>
                    <dl className="se-kv">
                        <div><dt>Request no.</dt><dd>{t.ticketCode}</dd></div>
                        <div><dt>Status</dt><dd><span className={`se-badge ${tone}`}>{label}</span></dd></div>
                        <div><dt>Priority</dt><dd><span className={`se-badge ${PRIORITY_TONE[t.priority] ?? ''}`}>{t.priority}</span></dd></div>
                        <div><dt>Category</dt><dd>{t.categoryName}</dd></div>
                        {t.unitCode && <div><dt>Unit</dt><dd>{t.unitCode}</dd></div>}
                        <div><dt>Facility</dt><dd>{t.facilityName}</dd></div>
                        <div><dt>Opened</dt><dd>{formatDateTime(t.createdAt)}</dd></div>
                        {t.resolvedAt && <div><dt>Resolved</dt><dd>{formatDateTime(t.resolvedAt)}</dd></div>}
                    </dl>
                </aside>
            </div>
        </>
    );
}
