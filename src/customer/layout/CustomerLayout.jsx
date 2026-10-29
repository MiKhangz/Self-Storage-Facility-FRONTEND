import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import Icon from '../components/Icon.jsx';
import { LanguageSelect, useT } from '../../i18n/I18n.jsx';
import './CustomerLayout.css';

const NAV = [
    { label: 'Dịch vụ', to: '/#services' },
    { label: 'Kích thước và giá', to: '/sizes' },
    { label: 'Cơ sở', to: '/locations' },
    { label: 'Cách thuê', to: '/#how-it-works' },
    { label: 'Hỗ trợ', to: '/support/requests' },
];

// Every footer entry is a real route; no links to pages the product does not have.
const FOOTER = [
    { title: 'Thuê kho', links: [['Kích thước và giá', '/sizes'], ['Các cơ sở', '/locations'], ['Đặt kho', '/booking']] },
    { title: 'Tài khoản', links: [['Đăng nhập', '/login'], ['Đăng ký', '/register'], ['Kho của tôi', '/my-storage']] },
    { title: 'Hỗ trợ', links: [['Gửi yêu cầu hỗ trợ', '/support/new'], ['Yêu cầu của tôi', '/support/requests']] },
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
export const initials = (name = '') => {
    const words = name.trim().split(/\s+/).filter(Boolean);
    return ((words.at(-1)?.[0] ?? '') + (words.length > 1 ? words[0][0] : '')).toUpperCase() || '?';
};

export default function CustomerLayout() {
    const { session, logout } = useAuth();
    const t = useT();
    const navigate = useNavigate();
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);
    useEffect(() => setMenuOpen(false), [location.pathname, location.hash]);
    useEffect(() => {
        if (!menuOpen) return undefined;
        const onKey = (e) => e.key === 'Escape' && setMenuOpen(false);
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [menuOpen]);
    const signOut = () => {
        logout();
        navigate('/', { replace: true });
    };

    return (
        <div className="se-page">
            <header className="se-header">
                <div className="se-container se-header-row">
                    <Brand />
                    <nav id="se-nav" className={`se-nav${menuOpen ? ' open' : ''}`} aria-label={t('Điều hướng chính')}>
                        {/* Hash links share the "/" path, so NavLink would mark them all active. */}
                        {NAV.map((item) => item.to.includes('#')
                            ? <Link key={item.label} to={item.to}>{t(item.label)}</Link>
                            : <NavLink key={item.label} to={item.to}>{t(item.label)}</NavLink>)}
                        {/* On phones the header only fits one action; the other moves into the menu. */}
                        {session
                            ? <button type="button" className="se-nav-extra" onClick={signOut}>{t('Đăng xuất')}</button>
                            : <Link to="/login" className="se-nav-extra">{t('Đăng nhập')}</Link>}
                    </nav>
                    <div className="se-header-actions">
                        <LanguageSelect />
                        {session ? (
                            <>
                                <Link to="/my-storage" className="se-account">
                                    <span className="se-avatar">{initials(session.fullName)}</span> {t('Kho của tôi')}
                                </Link>
                                <button type="button" className="se-btn se-btn-ghost se-header-secondary" onClick={signOut}>{t('Đăng xuất')}</button>
                            </>
                        ) : (
                            <>
                                <Link to="/login" className="se-btn se-btn-ghost se-header-secondary">{t('Đăng nhập')}</Link>
                                <Link to="/booking" className="se-btn se-btn-outline">{t('Đặt kho ngay')}</Link>
                            </>
                        )}
                        <button type="button" className="se-menu-btn" aria-expanded={menuOpen} aria-controls="se-nav"
                            aria-label={menuOpen ? t('Đóng menu') : t('Mở menu')} onClick={() => setMenuOpen((o) => !o)}>
                            <Icon name={menuOpen ? 'close' : 'menu'} size={22} />
                        </button>
                    </div>
                </div>
            </header>

            <main><Outlet /></main>

            <footer className="se-footer">
                <div className="se-container">
                    <div className="se-footer-grid">
                        <div className="se-footer-about">
                            <Brand />
                            <p>{t('Kho tự quản dễ thuê, an toàn và tiện lợi.')}<br />{t('Đặt kho và quản lý trực tuyến tại TP. Hồ Chí Minh.')}</p>
                        </div>
                        {FOOTER.map((col) => (
                            <div key={col.title}>
                                <h4>{t(col.title)}</h4>
                                <ul>{col.links.map(([label, to]) => <li key={to}><Link to={to}>{t(label)}</Link></li>)}</ul>
                            </div>
                        ))}
                        <div>
                            <h4>{t('Liên hệ')}</h4>
                            <ul><li><Link to="/locations">{t('Số điện thoại và giờ mở cửa của từng cơ sở')}</Link></li></ul>
                        </div>
                    </div>
                    <div className="se-footer-bottom">
                        <span>© 2026 StorEase. {t('Đồ án môn SWP391, Trường Đại học FPT. Đây là sản phẩm học tập, không phải dịch vụ thật.')}</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}
