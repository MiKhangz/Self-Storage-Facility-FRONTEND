import { useState } from 'react';
import { Link } from 'react-router-dom';
import { initials } from '../../customer/layout/CustomerLayout.jsx';
import { Filters, PageHeader, SearchFilter, SelectFilter, Status, matches } from '../components/ui.jsx';
import { useTickets } from '../queries.js';

const COLUMNS = [
    { status: 'New', dot: 'muted' }, { status: 'InProgress', dot: 'info' },
    { status: 'WaitingForCustomer', dot: 'low' }, { status: 'Resolved', dot: 'ok' },
];

/** Minutes/hours/days since a timestamp, for the age shown on each card. */
export function age(iso, now = Date.now()) {
    const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 1440) return `${Math.round(minutes / 60)} h`;
    return `${Math.round(minutes / 1440)} d`;
}

/** A09: support tickets as a board by status. Closed tickets are hidden. */
export default function TicketsPage() {
    const tr = useT();
    const [search, setSearch] = useState('');
    const [priority, setPriority] = useState('');
    const tickets = useTickets();
    const shown = (tickets.data ?? []).filter((t) => (!priority || t.priority === priority) && matches(search, t.ticketCode, t.subject, t.customerName, t.unitCode));

    return (
        <>
            <PageHeader title={tr('Support tickets')} subtitle="Requests about units, locks, access codes, payments and stored items" />
            <Filters>
                <SearchFilter value={search} onChange={setSearch} placeholder={tr('Search ticket, customer or unit')} />
                <SelectFilter label="Priority" value={priority} onChange={setPriority} options={['Urgent', 'High', 'Normal', 'Low']} all="All priorities" />
            </Filters>
            {tickets.isError && <div className="se-alert" role="alert">{tr('Tickets could not be loaded.')}</div>}
            <div className="sa-board">
                {COLUMNS.map((col) => {
                    const cards = shown.filter((t) => t.status === col.status);
                    return (
                        <section key={col.status} className="sa-column">
                            <h2><i className={`dot ${col.dot}`} /> <Status value={col.status} /> <span className="se-count">{cards.length}</span></h2>
                            {cards.map((t) => (
                                <Link key={t.ticketId} to={`/admin/tickets/${t.ticketId}`} className="se-card sa-ticket">
                                    <div className="sa-ticket-top"><small>{t.ticketCode}</small><Status value={t.priority} /></div>
                                    <strong>{t.subject}</strong>
                                    <div className="sa-tags"><span>{t.categoryName}</span>{t.unitCode && <span className="teal">{t.unitCode}</span>}</div>
                                    <div className="sa-ticket-foot">
                                        <span>{t.customerName}</span>
                                        <span>{age(t.createdAt)}{t.assignedToName && <span className="se-avatar sm" title={t.assignedToName}>{initials(t.assignedToName)}</span>}</span>
                                    </div>
                                </Link>
                            ))}
                            {!cards.length && <p className="sa-muted">{tickets.isLoading ? 'Loading…' : 'None'}</p>}
                        </section>
                    );
                })}
            </div>
        </>
    );
}
