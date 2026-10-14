import { Link } from 'react-router-dom';
import Icon from '../../customer/components/Icon.jsx';
import { NotWired, PageHeader } from '../components/ui.jsx';
import { useFacilities, useUnitTypes } from '../queries.js';

// ponytail: these three screens have no backend endpoints yet (activity log list, staff-created reservations,
// facility create). Each shows the Figma layout read-only; wire the forms when the endpoints land.

/** A16: system activity log. */
export function ActivityLogPage() {
    return (
        <>
            <PageHeader title="Activity log" subtitle="Every action taken in the system, with user, role and result" />
            <NotWired>The backend records activity (ActivityLog table) but has no endpoint to list it yet — needs GET /api/activity-logs.</NotWired>
            <div className="se-card se-table-wrap">
                <table className="se-table">
                    <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>Facility</th><th>Result</th></tr></thead>
                    <tbody><tr><td colSpan={6} className="se-empty">No activity to show.</td></tr></tbody>
                </table>
            </div>
        </>
    );
}

/** A18: reservation created by staff at the front desk. */
export function WalkInBookingPage() {
    const types = useUnitTypes().data ?? [];
    return (
        <>
            <Link to="/admin/reservations" className="se-back"><Icon name="arrowLeft" size={16} /> Back to reservations</Link>
            <PageHeader title="New walk-in booking" subtitle="Create a reservation for a customer at the desk" />
            <NotWired>Only customers can create reservations (POST /api/reservations is customer-only), and staff cannot register a customer yet. Until then, help the customer book on the website, then assign the unit under Reservations.</NotWired>
            <ol className="sa-steps">
                <li><span><strong>Customer</strong><small>New or existing customer, Citizen ID checked at the desk</small></span></li>
                <li><span><strong>Unit &amp; rental period</strong><small>Sizes offered: {types.map((t) => t.code).join(', ') || '—'}</small></span></li>
                <li><span><strong>Payment</strong><small>Deposit and first month taken at the desk</small></span></li>
                <li><span><strong>Handover</strong><small>Continue in Check-in &amp; Handover</small></span></li>
            </ol>
        </>
    );
}

/** A19: create a new facility. */
export function AddFacilityPage() {
    const facilities = useFacilities().data ?? [];
    return (
        <>
            <Link to="/admin/facilities" className="se-back"><Icon name="arrowLeft" size={16} /> Back to facilities</Link>
            <PageHeader title="Add a facility" subtitle="Create a new storage location and generate its units" />
            <NotWired>The API can list facilities but not create them yet — needs POST /api/facilities (and a bulk unit create). {facilities.length} facilities exist today.</NotWired>
            <section className="se-panel">
                <h2>Basic information</h2>
                <div className="se-panel-grid">
                    {['Facility name', 'Facility code', 'Street address', 'District', 'Phone', 'Opening hours'].map((label) => (
                        <label key={label}><span className="se-label">{label}</span><div className="se-input"><input disabled placeholder="Available when the API supports it" /></div></label>
                    ))}
                </div>
            </section>
        </>
    );
}
