import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { Roles } from '../features/auth/roles';
import Icon from '../customer/components/Icon.jsx';
import { initials } from '../customer/layout/CustomerLayout.jsx';
import { humanize, useMoveOuts, useReservations, useTickets } from './queries.js';
import '../customer/layout/CustomerLayout.css';
import './Admin.css';

const { SystemAdministrator: ADMIN, BusinessOperationsManager: BOM, FacilityManager: FM, FacilityStaff: FS } = Roles;
const OPS = [FS, FM, ADMIN, BOM];

const NAV = [
    { section: 'Overview', items: [{ to: '/admin', end: true, icon: 'grid', label: 'Dashboard', roles: OPS }] },
    {
        section: 'Operations', items: [
            { to: '/admin/facilities', icon: 'building', label: 'Facilities', roles: OPS },
            { to: '/admin/units', icon: 'box', label: 'Storage Units', roles: OPS },
            { to: '/admin/reservations', icon: 'calendar', label: 'Reservations', roles: [FS, FM, ADMIN], badge: 'reservations' },
            { to: '/admin/check-in', icon: 'key', label: 'Check-in & Handover', roles: [FS, FM] },
            { to: '/admin/move-outs', icon: 'arrowLeft', label: 'Returns & Move-out', roles: [FS, FM, BOM], badge: 'moveOuts' },
            { to: '/admin/staff', icon: 'clock', label: 'Staff & Shifts', roles: [FM, ADMIN] },
            { to: '/admin/contracts', icon: 'file', label: 'Customers & Contracts', roles: OPS },
            { to: '/admin/payments', icon: 'card', label: 'Payments', roles: [FS, FM, BOM] },
            { to: '/admin/tickets', icon: 'chat', label: 'Support Tickets', roles: OPS, badge: 'tickets' },
        ],
    },
    {
        section: 'Business', items: [
            { to: '/admin/pricing', icon: 'gem', label: 'Pricing & Policies', roles: [BOM] },
            { to: '/admin/reports', icon: 'grid', label: 'Reports & Exports', roles: [BOM, FM, ADMIN] },
        ],
    },
    {
        section: 'System', items: [
            { to: '/admin/users', icon: 'shield', label: 'Users & Roles', roles: [ADMIN] },
            { to: '/admin/activity', icon: 'clock', label: 'Activity Log', roles: [ADMIN] },
        ],
    },
];

/** Shell for every admin screen: role-filtered sidebar, user chip, page outlet. */
export default function AdminLayout() {
    const { session, logout } = useAuth();
    const navigate = useNavigate();
    const role = session?.role;
    const canOperate = [FS, FM, ADMIN].includes(role);
    // Sidebar counters: work waiting in each queue.
    const reservations = useReservations({ status: 'Pending' });
    const moveOuts = useMoveOuts({ status: 'Requested' });
    const tickets = useTickets({ status: 'New' });
    const counts = canOperate ? {
        reservations: reservations.data?.length,
        moveOuts: moveOuts.data?.length,
        tickets: tickets.data?.length,
    } : {};

    return (
        <div className="se-page sa-shell">
            <aside className="sa-side">
                <div className="sa-brand">
                    <span className="se-brand-mark"><Icon name="box" size={18} /></span>
                    <div><span className="se-brand-name">Stor<span>Ease</span></span><small>ADMIN PORTAL</small></div>
                </div>
                <nav>
                    {NAV.map((group) => {
                        const items = group.items.filter((i) => i.roles.includes(role));
                        if (!items.length) return null;
                        return (
                            <div key={group.section} className="sa-nav-group">
                                <span className="sa-nav-title">{group.section}</span>
                                {items.map((i) => (
                                    <NavLink key={i.to} to={i.to} end={i.end}>
                                        <Icon name={i.icon} size={16} /><span>{i.label}</span>
                                        {!!counts[i.badge] && <span className="sa-nav-badge">{counts[i.badge]}</span>}
                                    </NavLink>
                                ))}
                            </div>
                        );
                    })}
                </nav>
                {/* A new tab keeps this admin session open; the customer site starts signed out there. */}
                <a href="/" target="_blank" rel="noopener noreferrer" className="sa-logout">
                    <Icon name="home" size={16} /> Customer site
                </a>
                <button type="button" className="sa-logout" onClick={() => { logout(); navigate('/admin/login', { replace: true }); }}>
                    <Icon name="arrowLeft" size={16} /> Log out
                </button>
            </aside>
            <div className="sa-main">
                <header className="sa-top">
                    <div className="sa-user">
                        <span className="se-avatar">{initials(session?.fullName)}</span>
                        <div><strong>{session?.fullName}</strong><small>{humanize(role)}</small></div>
                    </div>
                </header>
                <main className="sa-content"><Outlet /></main>
            </div>
        </div>
    );
}
