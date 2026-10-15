import { useState } from 'react';
import './DashboardLayout.css';
import DashboardContent from './DashboardContent.jsx';
import FacilityPage from '../management/Facilities.jsx';
import UnitsPage from '../management/Units.jsx';
import Reservations from '../management/Reservations.jsx';
import HandoverDesk from '../handover/HandoverDesk.jsx';
import NotFound from '../errors/NotFound.jsx';
import PricingPage from '../pricing/PricingPage.jsx';


// 1. IMPORT SVG ICONS
import Logo from '../assets/logo.svg';

export default function DashboardLayout({ onLogOut, user }) {
    const [activePage, setActivePage] = useState('Dashboard');
    const [pricingDirty, setPricingDirty] = useState(false);
    const [facilityId, setFacilityId] = useState(null);
    const [reservationId,setReservationId]=useState(null);
    const canLeave = () => !pricingDirty || window.confirm('Discard unsaved changes?');

    // 2. UPDATE THE ARRAY TO USE THE IMPORTED VARIABLES
    const menuItems = [
        { name: 'Dashboard', type: 'OVERVIEW', glyph: '▥' },
        { name: 'Facilities', type: 'OPERATIONS', glyph: '▦' },
        { name: 'Storage Units', type: 'OPERATIONS', glyph: '⊞', page: 'Storage units' },
        { name: 'Reservations', type: 'OPERATIONS', glyph: '▣', badge: '12' },
        { name: 'Handover', type: 'OPERATIONS', glyph: '⚿', badge: '5', page: 'Handover desk' },
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
            case 'Dashboard': return <DashboardContent user={user} />;
            case 'Facilities': return <FacilityPage user={user} onDirtyChange={setPricingDirty} openUnits={id => { setFacilityId(id); setActivePage('Storage units'); }} />;
            case 'Storage units': return <UnitsPage user={user} initialFacilityId={facilityId} onDirtyChange={setPricingDirty} />;
            case 'Reservations': return <Reservations user={user} initialReservationId={reservationId} onDirtyChange={setPricingDirty} />;
            case 'Handover desk': return <HandoverDesk user={user} onDirtyChange={setPricingDirty} openReservation={id=>{if(canLeave()){setReservationId(id);setActivePage('Reservations');}}}/>;
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
                
                <div className="logout-button-wrapper" onClick={() => { if (canLeave()) onLogOut(); }}>
                    🚪 Log out
                </div>
            </aside>

            <div className="main-content-window">
                <main className="page-view-mount">
                    {renderPageView()}
                </main>
            </div>
        </div>
    );
}

