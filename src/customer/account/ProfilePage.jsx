import { Link } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { initials } from '../layout/CustomerLayout.jsx';
import { LIVE_CONTRACT, useMyContracts } from './queries.js';

/** U13: the signed-in customer's account. */
export default function ProfilePage() {
    const { session } = useAuth();
    const contracts = useMyContracts();
    const activeUnits = (contracts.data?.items ?? []).filter((c) => LIVE_CONTRACT.includes(c.status) && c.status !== 'Draft').length;

    return (
        <>
            <div className="se-account-title">
                <div><h1>Profile &amp; settings</h1><p>Your personal details and account.</p></div>
            </div>
            <div className="se-detail-grid">
                <section className="se-panel">
                    <h2>Personal information</h2>
                    <span className="se-label">Full name</span>
                    <div className="se-field" aria-readonly="true">{session?.fullName}</div>
                    {/* ponytail: the API has no customer profile, password-change or notification endpoints yet; add the edit forms once it does. */}
                    <div className="se-alert info" style={{ marginTop: 16 }}>
                        Editing your details, changing your password and notification settings are not available online yet.
                        To update your phone, email or address, <Link to="/support/new">send a support request</Link> or ask staff at the facility.
                    </div>
                </section>
                <aside>
                    <section className="se-panel" style={{ textAlign: 'center' }}>
                        <span className="se-avatar se-avatar-xl">{initials(session?.fullName)}</span>
                        <h2 style={{ justifyContent: 'center', margin: '12px 0 4px' }}>{session?.fullName}</h2>
                        <p className="se-hint">Customer no. {session?.userId}</p>
                    </section>
                    <section className="se-panel">
                        <h2>Account</h2>
                        <dl className="se-kv">
                            <div><dt>Role</dt><dd>Storage customer</dd></div>
                            <div><dt>Active units</dt><dd>{activeUnits}</dd></div>
                            <div><dt>Status</dt><dd><span className="se-badge">Active</span></dd></div>
                        </dl>
                    </section>
                </aside>
            </div>
        </>
    );
}
