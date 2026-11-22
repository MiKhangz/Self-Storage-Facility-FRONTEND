import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { contractsApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import { useAuth } from '../../features/auth/AuthContext';
import { Roles } from '../../features/auth/roles';
import { formatDate, formatVnd } from '../../customer/components/format.js';
import { confirmAction } from '../../customer/components/confirm.js';
import { Modal, Status } from './ui.jsx';
import { useT } from '../../i18n/I18n.jsx';

/** Staff note after calling the renter: what they decided, so the next shift does not call again. */
function ContactNote({ row, onClose }) {
    const tr = useT();
    const queryClient = useQueryClient();
    const [note, setNote] = useState('');
    const save = useMutation({
        mutationFn: () => contractsApi.endContact(row.contractId, { note: note.trim() }),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rental-ends'] }); onClose(); },
    });
    return (
        <form className="se-panel" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <h2>{tr('Call {name}', { name: row.customerName })}</h2>
            <p className="sa-muted">{row.customerPhone} · {tr('Kho')} {row.unitCode} · {tr('ends {date}', { date: formatDate(row.endDate) })}</p>
            <label><span className="se-label">{tr('What did the customer say?')}</span>
                <textarea className="se-textarea" rows={3} maxLength={400} required value={note} onChange={(e) => setNote(e.target.value)} /></label>
            {save.isError && <div className="se-alert" role="alert">{errorMessage(save.error)}</div>}
            <div className="sa-form-actions">
                <button type="button" className="se-btn se-btn-ghost" onClick={onClose}>{tr('Cancel')}</button>
                <button type="submit" className="se-btn se-btn-primary" disabled={save.isPending || !note.trim()}>{tr('Save note')}</button>
            </div>
        </form>
    );
}

/**
 * Rentals near or past their end date. Staff call the renter (reminder sent 10 days before); past the end date the
 * overstay fee grows daily, and after the grace days a manager or Business Operations moves the goods to the central warehouse.
 */
export default function RentalEnds({ overstayOnly = false }) {
    const tr = useT();
    const queryClient = useQueryClient();
    const role = useAuth().session?.role;
    const isOperations = role === Roles.BusinessOperationsManager;
    const canMove = isOperations || role === Roles.FacilityManager;
    const [calling, setCalling] = useState(null);
    const list = useQuery({ queryKey: ['rental-ends', overstayOnly], queryFn: () => contractsApi.ending({ overstayOnly }) });
    const moveOut = useMutation({
        mutationFn: (id) => contractsApi.moveToCentralStorage(id),
        onSuccess: () => ['rental-ends', 'contracts', 'storage-units', 'deposit-refunds', 'invoices'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] })),
    });
    const rows = list.data ?? [];
    if (!rows.length && !list.isError) return null;

    return (
        <section className="se-panel" style={{ marginBottom: 20 }}>
            <div className="sa-card-title"><h2>{tr(overstayOnly ? 'Past end date' : 'Rentals ending soon')}</h2><span className="se-count">{rows.length}</span></div>
            {list.isError && <div className="se-alert" role="alert">{errorMessage(list.error)}</div>}
            {moveOut.isError && <div className="se-alert" role="alert">{errorMessage(moveOut.error)}</div>}
            <div className="se-table-wrap">
                <table className="se-table">
                    <thead><tr><th>{tr('Contract')}</th><th>{tr('Customer')}</th><th>{tr('Unit')}</th><th>{tr('End date')}</th><th>{tr('Decision')}</th><th>{tr('Overstay fee')}</th><th>{tr('Last contact')}</th><th /></tr></thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.contractId}>
                                <td className="strong">{r.contractNumber}</td>
                                <td><Link to={`/admin/customers/${r.customerId}`} className="se-link">{r.customerName}</Link><div className="sa-muted">{r.customerPhone}</div></td>
                                <td>{r.unitCode}<div className="sa-muted">{r.facilityName}</div></td>
                                <td>{formatDate(r.endDate)}<div className="sa-muted">{r.status === 'Overstay'
                                    ? tr('{n} day{n:s} past', { n: r.overstayDays })
                                    : tr('{n} day{n:s} left', { n: r.daysLeft })}</div></td>
                                <td>{r.status === 'Overstay' ? <Status value="Overstay" /> : tr(r.decision)}</td>
                                <td className="price">{r.overstayFee ? formatVnd(r.overstayFee) : '—'}</td>
                                <td className="sa-muted">{r.endContactNote ?? (r.endReminderAt ? tr('Reminder sent') : '—')}</td>
                                <td className="sa-row-actions">
                                    {!isOperations && <button type="button" className="se-btn se-btn-ghost se-btn-sm" onClick={() => setCalling(r)}>{tr('Record call')}</button>}
                                    {canMove && r.canMoveOut && (
                                        <button type="button" className="se-btn se-btn-danger se-btn-sm" disabled={moveOut.isPending}
                                            onClick={() => confirmAction(tr('Move the goods in {unit} to the central warehouse? The contract closes, the overstay fee and unpaid rent come out of the deposit, and the unit goes to the next booking.', { unit: r.unitCode })).then((ok) => ok && moveOut.mutate(r.contractId))}>
                                            {tr('Move to central warehouse')}
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {calling && <Modal narrow onClose={() => setCalling(null)}><ContactNote row={calling} onClose={() => setCalling(null)} /></Modal>}
        </section>
    );
}
