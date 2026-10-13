import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import Icon from '../components/Icon.jsx';
import './CustomerLayout.css';

const NAV = [
    { label: 'Services', to: '/#services' },
    { label: 'Unit Sizes & Prices', to: '/sizes' },
    { label: 'Locations', to: '/locations' },
    { label: 'How it works', to: '/#how-it-works' },
    { label: 'Support', to: '/support' },
];

const FOOTER = [
    { title: 'Storage', links: ['Self-storage units', 'Shelf storage', 'Document storage', 'Wine storage', 'Business storage'] },
    { title: 'Company', links: ['About us', 'Locations', 'Careers', 'Blog'] },
    { title: 'Support', links: ['Help center', 'Terms of rental', 'Prohibited items', 'Insurance', 'Privacy policy'] },
];

export function Brand() {
    return (
        <Link to="/" className="se-brand">
            <span className="se-brand-mark"><Icon name="box" size={18} /></span>
            <span className="se-brand-name">Stor<span>Ease</span></span>
        </Link>
    );
}

// Vietnamese names end with the given name: "Huỳnh Minh Khang" → "KH", as in the Figma avatar.
const initials = (name = '') => {
    const words = name.trim().split(/\s+/).filter(Boolean);
    return ((words.at(-1)?.[0] ?? '') + (words.length > 1 ? words[0][0] : '')).toUpperCase() || '?';
};

export default function CustomerLayout() {
    const { session, logout } = useAuth();
    const navigate = useNavigate();
    const signOut = () => {
        logout();
        navigate('/', { replace: true });
    };

    return (
        <div className="se-page">
            <header className="se-header">
                <div className="se-container se-header-row">
                    <Brand />
                    <nav className="se-nav">
                        {/* Hash links share the "/" path, so NavLink would mark them all active. */}
                        {NAV.map((item) => item.to.includes('#')
                            ? <Link key={item.label} to={item.to}>{item.label}</Link>
                            : <NavLink key={item.label} to={item.to}>{item.label}</NavLink>)}
                    </nav>
                    <div className="se-header-actions">
                        <a className="se-phone" href="tel:02873001234"><Icon name="phone" size={15} /> 028 7300 1234</a>
                        {session ? (
                            <>
                                <Link to="/my-storage" className="se-account">
                                    <span className="se-avatar">{initials(session.fullName)}</span> My Storage
                                </Link>
                                <button type="button" className="se-btn se-btn-ghost" onClick={signOut}>Log out</button>
                            </>
                        ) : (
                            <>
                                <Link to="/login" className="se-btn se-btn-ghost">Log in</Link>
                                <Link to="/booking" className="se-btn se-btn-primary">Book now</Link>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <main><Outlet /></main>

            <footer className="se-footer">
                <div className="se-container">
                    <div className="se-footer-grid">
                        <div className="se-footer-about">
                            <Brand />
                            <p>Self-storage made easy, safe and convenient.<br />Access your unit 24/7 across Ho Chi Minh City.</p>
                        </div>
                        {FOOTER.map((col) => (
                            <div key={col.title}>
                                <h4>{col.title}</h4>
                                <ul>{col.links.map((l) => <li key={l}>{l}</li>)}</ul>
                            </div>
                        ))}
                        <div>
                            <h4>Contact</h4>
                            <ul>
                                <li>028 7300 1234</li>
                                <li>hello@storease.vn</li>
                                <li>Mon–Sun · 8:00–20:00</li>
                            </ul>
                        </div>
                    </div>
                    <div className="se-footer-bottom">
                        <span>© 2026 StorEase — SWP391 Group Project (FPT University). Demo design, not a real service.</span>
                        <span className="se-lang">VI&nbsp; | &nbsp;EN</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}
