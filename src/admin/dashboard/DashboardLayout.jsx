import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../auth.js';
import { Roles } from '../../features/auth/roles';
import './DashboardLayout.css';
import DashboardContent from './DashboardContent.jsx';
import FacilityPage from '../management/Facilities.jsx';
import UnitsPage from '../management/Units.jsx';
import Reservations from '../management/Reservations.jsx';
import ActiveStorageAccess from '../management/ActiveStorageAccess.jsx';
import HandoverDesk from '../handover/HandoverDesk.jsx';
import NotFound from '../errors/NotFound.jsx';
import PricingPage from '../pricing/PricingPage.jsx';
import Payments from '../payments/Payments.jsx';
import ReportsPage from '../reports/ReportsPage.jsx';
import ActivityLog from '../activityLog/ActivityLog.jsx';


// 1. IMPORT SVG ICONS
import Logo from '../assets/logo.svg';

export default function DashboardLayout({ onLogOut, user }) {
    const [activePage, setActivePage] = useState('Dashboard');
    const [pricingDirty, setPricingDirty] = useState(false);
    const [facilityId, setFacilityId] = useState(null);
    const [reservationId,setReservationId]=useState(null);
    const [facilities, setFacilities] = useState([]);
    const [facilityError, setFacilityError] = useState('');
    const [facilityMenuOpen, setFacilityMenuOpen] = useState(false);
    const [selectedFacilityId, setSelectedFacilityId] = useState('');
    const [logoutPromptOpen, setLogoutPromptOpen] = useState(false);
    const logoutDialogRef = useRef(null);
    const canSwitchFacility = [Roles.SystemAdministrator, Roles.BusinessOperationsManager].includes(user?.role);
    const activeFacility = facilities.find(f => String(f.facilityId) === selectedFacilityId);
    const assignedFacility = facilities.find(f => String(f.facilityId) === String(user?.facilityId)) || facilities[0];
    const facilityLabel = assignedFacility?.name || user?.facilityName || 'No assigned facility';
    const canLeave = () => !pricingDirty || window.confirm('Discard unsaved changes?');

    useEffect(() => {
        let active = true;
        apiRequest('/api/facilities/my-scope')
            .then(data => {
                if (!active) return;
                const rows = Array.isArray(data) ? data : [];
                setFacilities(rows);
                if (!canSwitchFacility && rows[0]) {
                    setFacilityId(rows[0].facilityId);
                }
            })
            .catch(error => { if (active) setFacilityError(error.message); });
        return () => { active = false; };
    }, [canSwitchFacility, user?.token]);

    useEffect(() => {
        const dialog = logoutDialogRef.current;
        if (!dialog) return;
        if (logoutPromptOpen && !dialog.open) dialog.showModal();
        if (!logoutPromptOpen && dialog.open) dialog.close();
    }, [logoutPromptOpen]);

    const changeFacility = id => {
        setSelectedFacilityId(id);
        setFacilityId(id || null);
        setFacilityMenuOpen(false);
    };
    const requestLogout = () => { if (canLeave()) setLogoutPromptOpen(true); };
    const confirmLogout = () => {
        setLogoutPromptOpen(false);
        onLogOut?.();
    };

    // 2. UPDATE THE ARRAY TO USE THE IMPORTED VARIABLES
    const menuItems = [
        { name: 'Dashboard', type: 'OVERVIEW', glyph: '▥' },
        { name: 'Facilities', type: 'OPERATIONS', glyph: '▦' },
        { name: 'Storage Units', type: 'OPERATIONS', glyph: '⊞', page: 'Storage units' },
        { name: 'Reservations', type: 'OPERATIONS', glyph: '▣', badge: '12' },
        { name: 'Handover', type: 'OPERATIONS', glyph: '⚿', badge: '5', page: 'Handover desk' },
        { name: 'Active Storage & Access', type: 'OPERATIONS', glyph: '⬡', page: 'Active Storage & Access' },
        { name: 'Staff Access', type: 'OPERATIONS', glyph: '⬡' },
        { name: 'Returns & Move-out', type: 'OPERATIONS', glyph: '⟳', badge: '2' },
        { name: 'Staff & Shifts', type: 'OPERATIONS', glyph: '♙' },
        { name: 'Customers & Contracts', type: 'OPERATIONS', glyph: '▤' },
        { name: 'Payments', type: 'OPERATIONS', glyph: '▱', badge: '3' },
        { name: 'Support Tickets', type: 'OPERATIONS', glyph: '▱', badge: '4' },
        { name: 'Pricing & Policies', type: 'BUSINESS', glyph: '◇', page: 'Unit Types & Pricing' },
        { name: 'Reports & Exports', type: 'BUSINESS', glyph: '▥' },
        { name: 'Users & Roles', type: 'SYSTEM', glyph: '♙' },
        { name: 'Activity Log', type: 'SYSTEM', glyph: '∿' },
    ];
    const sections = ['OVERVIEW', 'OPERATIONS', 'BUSINESS', 'SYSTEM'];

    const renderPageView = () => {
        switch (activePage) {
            case 'Dashboard': return <DashboardContent user={user} facilityId={facilityId ?? ''} />;
            case 'Facilities': return <FacilityPage user={user} onDirtyChange={setPricingDirty} openUnits={id => { setFacilityId(id); setActivePage('Storage units'); }} />;
            case 'Storage units': return <UnitsPage user={user} initialFacilityId={facilityId} onDirtyChange={setPricingDirty} />;
            case 'Reservations': return <Reservations user={user} initialReservationId={reservationId} onDirtyChange={setPricingDirty} />;
            case 'Active Storage & Access': return <ActiveStorageAccess user={user} facilityId={facilityId ?? ''} />;
            case 'Handover desk': return <HandoverDesk user={user} />;
            case 'Payments': return <Payments user={user} facilityId={facilityId ?? ''} />;
            case 'Reports & Exports': return <ReportsPage user={user} facilities={facilities} facilityId={facilityId ?? ''} canSelectFacility={canSwitchFacility} onFacilityChange={changeFacility} />;
            case 'Activity Log': return <ActivityLog user={user} />;
            case 'Unit Types & Pricing': return <PricingPage user={user} onDirtyChange={setPricingDirty} />;
            default: return <NotFound pageName={activePage} />;
        }
    };

    return (
        <div className="admin-app-wrapper">
            <aside className="app-sidebar">
                <div className="sidebar-brand">
                    <div className="brand-logo"><img className="portal-logo" src={Logo} alt="Logo" /></div>
                    <div>
                        <div className="brand-text">StorEase</div>
                        <div className="brand-sub">ADMIN PORTAL</div>
                    </div>
                </div>

                <nav className="sidebar-navigation">
                    {sections.map((sectionType) => (
                        <div key={sectionType} className="nav-section">
                            <span className="section-title">{sectionType}</span>
                            <ul>
                                {menuItems
                                    .filter(item => item.type === sectionType)
                                    .map((item) => (
                                        <li 
                                            key={item.name}
                                            className={activePage === (item.page||item.name) ? 'active-link' : ''}
                                            onClick={() => { const page=item.page||item.name; if (page !== activePage && canLeave()) setActivePage(page); }}
                                        >
                                            <span aria-hidden="true" className="sidebar-icon-placeholder">{item.glyph}</span>
                                            <span className="link-text">{item.name}</span>
                                            {item.badge && <span className="link-badge">{item.badge}</span>}
                                        </li>
                                    ))
                                }
                            </ul>
                        </div>
                    ))}
                </nav>
                
            </aside>

            <div className="main-content-window">
                <header className="top-navbar">
                    <div className="admin-topbar-right">
                        <div className="facility-context">
                            {canSwitchFacility ? <>
                                <button className="facility-context-button" type="button" aria-expanded={facilityMenuOpen} aria-haspopup="listbox" onClick={() => setFacilityMenuOpen(open => !open)}>
                                    <span aria-hidden="true">▦</span>{selectedFacilityId ? activeFacility?.name ?? 'Select facility' : `All facilities (${facilities.length})`}<span className="facility-chevron" aria-hidden="true">⌄</span>
                                </button>
                                {facilityMenuOpen && <div className="facility-context-menu" role="listbox" aria-label="Choose facility">
                                    <button type="button" role="option" aria-selected={!selectedFacilityId} onClick={() => changeFacility('')}>
                                        All facilities <span>({facilities.length})</span>
                                    </button>
                                    {facilities.map(f => <button key={f.facilityId} type="button" role="option" aria-selected={selectedFacilityId === String(f.facilityId)} onClick={() => changeFacility(String(f.facilityId))}>{f.name}</button>)}
                                </div>}
                            </> : <div className="facility-context-locked" title={facilities.map(f => f.name).join(', ')}><span aria-hidden="true">▦</span>{facilityLabel}</div>}
                        </div>
                        <div className="admin-user-profile"><span className="admin-user-avatar">{(user?.fullName || 'U').trim().split(/\s+/).slice(-2).map(part => part[0]).join('').toUpperCase()}</span><span className="admin-user-copy"><strong>{user?.fullName || 'Employee'}</strong><small>{({[Roles.SystemAdministrator]:'System Administrator',[Roles.BusinessOperationsManager]:'Business Operations Manager',[Roles.FacilityManager]:'Facility Manager',[Roles.FacilityStaff]:'Facility Staff'})[user?.role] ?? user?.role}</small></span></div>
                        <button className="admin-logout-button" type="button" onClick={requestLogout}>Log out</button>
                    </div>
                </header>
                {facilityError && <p className="facility-context-error" role="alert">Could not load facility access: {facilityError}</p>}
                <main className="page-view-mount">
                    {renderPageView()}
                </main>
            </div>
            <dialog ref={logoutDialogRef} className="admin-logout-dialog" onCancel={event => { event.preventDefault(); logoutDialogRef.current?.close(); setLogoutPromptOpen(false); }}>
                <h2>Log out?</h2>
                <p>Are you sure you want to log out?</p>
                <div className="admin-logout-dialog-actions">
                    <button type="button" onClick={() => { logoutDialogRef.current?.close(); setLogoutPromptOpen(false); }}>Cancel</button>
                    <button type="button" className="admin-logout-confirm" onClick={confirmLogout}>Log out</button>
                </div>
            </dialog>
        </div>
    );
}

