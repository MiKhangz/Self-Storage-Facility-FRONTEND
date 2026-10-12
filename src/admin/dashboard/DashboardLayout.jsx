import { useState } from 'react';
import './DashboardLayout.css';
import DashboardContent from './DashboardContent.jsx';
import FacilityPage from '../facilitiesPage/FacilityPage.jsx';
import NotFound from '../errors/NotFound.jsx';


// 1. IMPORT SVG ICONS
import DashboardIcon from '../assets/business.svg';
import FacilitiesIcon from '../assets/building.svg';
import Logo from '../assets/logo.svg';

export default function DashboardLayout({ onLogOut }) {
    const [activePage, setActivePage] = useState('Dashboard');

    // 2. UPDATE THE ARRAY TO USE THE IMPORTED VARIABLES
    const menuItems = [
        { name: 'Dashboard', icon: DashboardIcon, type: 'OVERVIEW' },
        { name: 'Facilities', icon: FacilitiesIcon, type: 'OPERATIONS' }
    ];

    const renderPageView = () => {
        switch (activePage) {
            case 'Dashboard': return <DashboardContent />;
            case 'Facilities': return <FacilityPage />;
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
                    {['OVERVIEW', 'OPERATIONS', 'BUSINESS'].map((sectionType) => (
                        <div key={sectionType} className="nav-section">
                            <span className="section-title">{sectionType}</span>
                            <ul>
                                {menuItems
                                    .filter(item => item.type === sectionType)
                                    .map((item) => (
                                        <li 
                                            key={item.name}
                                            className={activePage === item.name ? 'active-link' : ''}
                                            onClick={() => setActivePage(item.name)}
                                        >
                                            {/* 3. RENDER AS AN IMG TAG WITH CSS FOR COLOR CONTROL */}
                                            <img 
                                                src={item.icon} 
                                                alt="" 
                                                className="sidebar-svg-icon" 
                                            />
                                            <span className="link-text">{item.name}</span>
                                            {item.badge && <span className="link-badge">{item.badge}</span>}
                                        </li>
                                    ))
                                }
                            </ul>
                        </div>
                    ))}
                </nav>
                
                <div className="logout-button-wrapper" onClick={onLogOut}>
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
