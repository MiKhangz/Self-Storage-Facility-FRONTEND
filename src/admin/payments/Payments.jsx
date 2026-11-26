import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../auth.js';
import { Roles } from '../../features/auth/roles';
import './Payments.css';

const PAGE_SIZE = 20;
const REMINDER_ROLES = [Roles.FacilityStaff, Roles.FacilityManager, Roles.BusinessOperationsManager];
const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value ?? 0);
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const query = params => new URLSearchParams(params).toString();
const get = path => apiRequest(path);
const post = (path, body) => apiRequest(path, { method: 'POST', ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });

async function allPages(fetchPage, params = {}) {
  const first = await fetchPage({ ...params, page: 1, pageSize: 100 });
  const pages = Math.ceil((first.totalCount ?? first.items?.length ?? 0) / 100);
  if (pages <= 1) return first.items ?? [];
  const remaining = await Promise.all(Array.from({ length: pages - 1 }, (_, index) => fetchPage({ ...params, page: index + 2, pageSize: 100 })));
  return [...(first.items ?? []), ...remaining.flatMap(result => result.items ?? [])];
}

async function loadUnpaidInvoices() {
  const [issued, overdue] = await Promise.all([
    allPages(params => get(`/api/invoices?${query({ ...params, status: 'Issued' })}`)),
    allPages(params => get(`/api/invoices?${query({ ...params, status: 'Overdue' })}`)),
  ]);
  const invoices = [...issued, ...overdue];
  if (!invoices.length) return [];

  const [contracts, reservations] = await Promise.all([
    allPages(params => get(`/api/contracts?${query(params)}`)),
    allPages(params => get(`/api/reservations?${query(params)}`)),
  ]);
  const contractsById = new Map(contracts.map(contract => [contract.contractId, contract]));
  const reservationsById = new Map(reservations.map(reservation => [reservation.reservationId, reservation]));
  const facilityIds = [...new Set(invoices.map(invoice => {
    const reservationId = invoice.reservationId ?? contractsById.get(invoice.contractId)?.reservationId;
    return reservationsById.get(reservationId)?.facilityId;
  }).filter(Boolean))];
  const facilityRows = await Promise.all(facilityIds.map(id => get(`/api/facilities/${id}`)));
  const facilitiesById = new Map(facilityRows.map(facility => [facility.facilityId, facility]));

  return invoices.map(invoice => {
    const contract = contractsById.get(invoice.contractId);
    const reservationId = invoice.reservationId ?? contract?.reservationId;
    const reservation = reservationsById.get(reservationId);
    const facility = facilitiesById.get(reservation?.facilityId);
    return {
      ...invoice,
      customerName: reservation?.customerName ?? contract?.customerName ?? `Customer #${invoice.customerId}`,
      storageUnitId: reservation?.storageUnitId ?? contract?.storageUnitId ?? null,
      storageUnitCode: reservation?.unitCode ?? contract?.unitCode ?? null,
      facilityId: reservation?.facilityId ?? null,
      facilityName: reservation?.facilityName ?? null,
      facilityLocation: [facility?.district, facility?.address].filter(Boolean).join(' · '),
    };
  }).sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)) || b.invoiceId - a.invoiceId);
}

function invoiceState(invoice) {
  if (invoice.status === 'Overdue' || invoice.dueDate < today()) return 'Overdue';
  if (invoice.dueDate === today()) return 'On date';
  return 'Not yet';
}

export default function Payments({ user, facilityId = '' }) {
  const [tab, setTab] = useState('Unpaid Invoices');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [invoices, setInvoices] = useState([]);
  const [selected, setSelected] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [invoicePayments, setInvoicePayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [adjustment, setAdjustment] = useState({ description: '', amount: '' });
  const canRemind = REMINDER_ROLES.includes(user?.role);
  const canManageMoney = user?.role === Roles.BusinessOperationsManager;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setInvoices(await loadUnpaidInvoices());
    } catch (reason) {
      setError(reason.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setSelected(null);
    setPage(1);
    load();
  }, [facilityId, load]);

  useEffect(() => {
    if (!selected) return undefined;
    let active = true;
    setDetailLoading(true);
    setError('');
    Promise.all([
      get(`/api/invoices/${selected.invoiceId}/reminders`),
      get(`/api/payments?${query({ invoiceId: selected.invoiceId, page: 1, pageSize: 100 })}`),
    ]).then(([history, paymentRows]) => {
      if (active) {
        setReminders(history ?? []);
        setInvoicePayments(paymentRows.items ?? []);
      }
    }).catch(reason => {
      if (active) setError(reason.message);
    }).finally(() => {
      if (active) setDetailLoading(false);
    });
    return () => { active = false; };
  }, [selected?.invoiceId]);

  const scopedInvoices = useMemo(() => {
    const scoped = facilityId ? invoices.filter(invoice => invoice.facilityId === Number(facilityId)) : invoices;
    const term = search.trim().toLocaleLowerCase();
    return term ? scoped.filter(invoice => [invoice.invoiceNumber, invoice.customerName, invoice.storageUnitCode, invoice.facilityName]
      .some(value => String(value ?? '').toLocaleLowerCase().includes(term))) : scoped;
  }, [facilityId, invoices, search]);

  useEffect(() => setPage(1), [facilityId, search]);

  const maxPage = Math.max(1, Math.ceil(scopedInvoices.length / PAGE_SIZE));
  const visibleInvoices = scopedInvoices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function sendReminder() {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await post(`/api/invoices/${selected.invoiceId}/reminders`);
      setReminders(rows => [result, ...rows]);
      setNotice('Reminder sent.');
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  async function saveAdjustment(event) {
    event.preventDefault();
    const amount = Number(adjustment.amount);
    if (!adjustment.description.trim() || !Number.isFinite(amount) || amount === 0) {
      setError('Enter a description and a non-zero amount. Use a negative amount for a credit.');
      return;
    }
    setBusy(true); setError(''); setNotice('');
    try {
      await post(`/api/invoices/${selected.invoiceId}/adjustments`, { description: adjustment.description.trim(), amount });
      setNotice('Invoice adjusted.');
      setAdjustment({ description: '', amount: '' });
      setSelected(null);
      await load();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  async function refundPayment(payment) {
    const reason = window.prompt(`Reason for refunding ${payment.paymentCode}:`);
    if (reason === null) return;
    if (!window.confirm(`Confirm refund of ${money(payment.amount)} for ${payment.paymentCode}?`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await post(`/api/payments/${payment.paymentId}/refund`, { reason: reason.trim() || null });
      setNotice('Payment refunded.');
      setSelected(null);
      await load();
    } catch (problem) { setError(problem.message); }
    finally { setBusy(false); }
  }

  return <section className="pm-page">
    <header className="pm-header"><div><h1>Payments</h1><p>Review unpaid invoices and payment activity.</p></div><button type="button" onClick={load} disabled={loading}>Refresh</button></header>
    <nav className="pm-tabs" aria-label="Payment views">{['Unpaid Invoices', 'Record Payment', 'Refund', 'All payments'].map(name => <button key={name} aria-pressed={tab === name} className={tab === name ? 'selected' : ''} onClick={() => { setTab(name); setSelected(null); setNotice(''); setError(''); }}>{name}{name === 'Unpaid Invoices' && <span>{scopedInvoices.length}</span>}</button>)}</nav>

    {tab === 'Unpaid Invoices' ? <>
      <div className="pm-filters"><input aria-label="Search unpaid invoices" placeholder="Search invoice, customer, unit or facility" value={search} onChange={event => setSearch(event.target.value)} /></div>
      {error && <p className="pm-warning" role="alert">{error}</p>}
      {notice && <p className="pm-notice" role="status">{notice}</p>}
      <div className={`pm-layout ${selected ? 'with-detail' : ''}`}>
        <div className="pm-table-card"><div className="pm-table-scroll"><table><thead><tr><th>Invoice</th><th>Customer</th><th>Storage ID</th><th>Facility location</th><th>Due date</th><th>Outstanding</th><th>Status</th></tr></thead><tbody>
          {visibleInvoices.map(invoice => <tr key={invoice.invoiceId} className={selected?.invoiceId === invoice.invoiceId ? 'selected' : ''} onClick={() => { setSelected(invoice); setReminders([]); setInvoicePayments([]); setNotice(''); }}>
            <td><button className="pm-link" type="button" onClick={event => { event.stopPropagation(); setSelected(invoice); setReminders([]); setInvoicePayments([]); setNotice(''); }}>{invoice.invoiceNumber}</button></td>
            <td>{invoice.customerName}</td><td>{invoice.storageUnitCode ?? `ID ${invoice.storageUnitId ?? '—'}`}</td>
            <td>{invoice.facilityName ?? '—'}{invoice.facilityLocation && <small>{invoice.facilityLocation}</small>}</td>
            <td>{invoice.dueDate}</td><td>{money(invoice.outstandingAmount)}</td><td><span className={`pm-status ${invoiceState(invoice).toLowerCase().replaceAll(' ', '-')}`}>{invoiceState(invoice)}</span></td>
          </tr>)}
        </tbody></table>{!loading && !error && !visibleInvoices.length && <p className="pm-state">No unpaid invoices found.</p>}{loading && <p className="pm-state">Loading invoices…</p>}</div>
          <footer className="pm-pager"><span>{scopedInvoices.length} unpaid invoices</span><div><button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button> {page} / {maxPage} <button disabled={page >= maxPage} onClick={() => setPage(page + 1)}>Next</button></div></footer>
        </div>

        {selected && <aside className="pm-detail"><button className="pm-close" aria-label="Close invoice details" onClick={() => setSelected(null)}>×</button>
          <h2>{selected.invoiceNumber}</h2><p>{selected.customerName} · {selected.facilityName ?? 'Facility not available'}</p>
          {error && <p className="pm-warning" role="alert">{error}</p>}{notice && <p className="pm-notice" role="status">{notice}</p>}
          <dl>
            <div><dt>Storage ID</dt><dd>{selected.storageUnitCode ?? 'Not assigned'}{selected.storageUnitId ? ` · #${selected.storageUnitId}` : ''}</dd></div>
            <div><dt>Facility location</dt><dd>{selected.facilityLocation || selected.facilityName || '—'}</dd></div>
            <div><dt>Issue date</dt><dd>{selected.issueDate}</dd></div><div><dt>Due date</dt><dd>{selected.dueDate} · {invoiceState(selected)}</dd></div>
            <div><dt>Invoice total</dt><dd>{money(selected.totalAmount)}</dd></div><div><dt>Paid</dt><dd>{money(selected.paidAmount)}</dd></div><div><dt>Outstanding</dt><dd>{money(selected.outstandingAmount)}</dd></div>
          </dl>
          <section className="pm-subsection"><h3>Invoice items</h3>{(selected.items ?? []).map(item => <div className="pm-line-item" key={item.invoiceItemId}><span>{item.description}</span><strong>{money(item.lineAmount)}</strong></div>)}</section>

          <section className="pm-action-section"><h3>Actions</h3>
            {canRemind && <button className="pm-primary" disabled={busy} onClick={sendReminder}>Send reminder</button>}
            {canManageMoney && <form className="pm-adjust-form" onSubmit={saveAdjustment}><strong>Adjust invoice</strong><label>Description<input value={adjustment.description} onChange={event => setAdjustment({ ...adjustment, description: event.target.value })} maxLength={200} required /></label><label>Amount <small>Negative = credit</small><input type="number" step="0.01" value={adjustment.amount} onChange={event => setAdjustment({ ...adjustment, amount: event.target.value })} required /></label><button disabled={busy}>Apply adjustment</button></form>}
            {canManageMoney && <div className="pm-refund-list"><strong>Refund a payment</strong>{invoicePayments.filter(payment => payment.status === 'Succeeded').map(payment => <div key={payment.paymentId}><span>{payment.paymentCode} · {money(payment.amount)}</span><button disabled={busy} onClick={() => refundPayment(payment)}>Refund</button></div>)}{!invoicePayments.some(payment => payment.status === 'Succeeded') && <small>No successful payments to refund.</small>}</div>}
            {!canRemind && !canManageMoney && <p className="pm-readonly">You can view this invoice but cannot perform payment actions.</p>}
          </section>

          <section className="pm-subsection pm-reminder-history"><h3>Reminder history</h3>{detailLoading ? <small>Loading history…</small> : reminders.length ? reminders.map(item => <div key={item.reminderId}><span>{item.channel} · {item.status}</span><small>{item.sentAt ? new Date(item.sentAt).toLocaleString() : 'Queued'}</small></div>) : <small>No reminders sent.</small>}</section>
          <section className="pm-subsection"><h3>Payment history</h3>{detailLoading ? <small>Loading payments…</small> : invoicePayments.length ? invoicePayments.map(payment => <div className="pm-payment-line" key={payment.paymentId}><span>{payment.paymentCode} · {payment.method} · {payment.status}</span><strong>{money(payment.amount)}</strong></div>) : <small>No payments recorded.</small>}</section>
        </aside>}
      </div>
    </> : <div className="pm-placeholder"><h2>{tab}</h2><p>This view is ready for the next payment workflow. The current implementation is focused on unpaid invoices.</p></div>}
  </section>;
}
