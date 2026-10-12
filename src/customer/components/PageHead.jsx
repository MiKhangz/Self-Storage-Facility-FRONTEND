import { Link } from 'react-router-dom';

/** Teal page banner with a Home / Page breadcrumb (U04, U05, U09...). */
export default function PageHead({ crumb, title, children }) {
    return (
        <section className="se-page-head">
            <div className="se-container">
                <nav className="se-crumbs" aria-label="Breadcrumb">
                    <Link to="/">Home</Link><span>/</span><strong>{crumb}</strong>
                </nav>
                <h1>{title}</h1>
                {children && <p>{children}</p>}
            </div>
        </section>
    );
}
