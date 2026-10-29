import { Link } from 'react-router-dom';
import { useT } from '../../i18n/I18n.jsx';

/** Teal page banner with a Home / Page breadcrumb (U04, U05, U09...). */
export default function PageHead({ crumb, title, children }) {
    const t = useT();
    return (
        <section className="se-page-head">
            <div className="se-container">
                <nav className="se-crumbs" aria-label={t('Đường dẫn')}>
                    <Link to="/">{t('Trang chủ')}</Link><span>/</span><strong>{t(crumb)}</strong>
                </nav>
                <h1>{t(title)}</h1>
                {children && <p>{typeof children === 'string' ? t(children) : children}</p>}
            </div>
        </section>
    );
}
