import { useEffect, useRef } from 'react';
import Icon from '../../customer/components/Icon.jsx';
import { errorMessage } from '../../api/axiosClient';
import { TONE, humanize } from '../queries.js';

/**
 * A pop-up over a dimmed page (native <dialog>: focus stays inside, Esc closes). A click on the dimmed backdrop
 * closes it too. `wide` fits a form laid out in columns.
 */
export function Modal({ onClose, wide, children }) {
    const ref = useRef(null);
    useEffect(() => { ref.current?.showModal(); }, []);
    return (
        <dialog ref={ref} className={`sa-modal${wide ? ' wide' : ''}`} onClose={onClose}
            onClick={(e) => { if (e.target === ref.current) ref.current.close(); }}>
            {children}
        </dialog>
    );
}

export function PageHeader({ title, subtitle, children }) {
    return (
        <div className="sa-page-head">
            <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
            {children && <div className="sa-page-actions">{children}</div>}
        </div>
    );
}

export function Status({ value }) {
    if (!value) return null;
    return <span className={`se-badge ${TONE[value] ?? ''}`}>{humanize(value)}</span>;
}

export function Stat({ icon, label, value, note, tone = '' }) {
    return (
        <div className="se-card sa-stat">
            <div className="sa-stat-top"><span>{label}</span><span className={`sa-stat-icon ${tone}`}><Icon name={icon} size={16} /></span></div>
            <strong>{value}</strong>
            {note && <small>{note}</small>}
        </div>
    );
}

/** Loading / error / empty row for a table body; renders nothing once rows exist. */
export function TableState({ query, rows, cols, empty = 'Nothing here yet.' }) {
    if (rows?.length) return null;
    const text = query?.isLoading ? 'Loading…' : query?.isError ? errorMessage(query.error) : empty;
    return <tr><td colSpan={cols} className="se-empty">{text}</td></tr>;
}

/** Explains a screen or action the backend cannot serve yet. */
export function NotWired({ children }) {
    return <div className="se-alert info sa-not-wired"><Icon name="clock" size={14} /> {children}</div>;
}

export function Filters({ children }) {
    return <div className="sa-filters">{children}</div>;
}

export function SelectFilter({ value, onChange, options, label, all = 'All' }) {
    return (
        <label className="sa-filter">
            <span className="sr-only">{label}</span>
            <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
                <option value="">{all}</option>
                {options.map((o) => (typeof o === 'string'
                    ? <option key={o} value={o}>{humanize(o)}</option>
                    : <option key={o.value} value={o.value}>{o.label}</option>))}
            </select>
        </label>
    );
}

export function SearchFilter({ value, onChange, placeholder }) {
    return (
        <div className="se-field sa-search"><Icon name="search" />
            <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
        </div>
    );
}

/** Case-insensitive match of a search term against any of the given values. */
export const matches = (term, ...values) => !term.trim() || values.some((v) => String(v ?? '').toLowerCase().includes(term.trim().toLowerCase()));

/** Saves a file the API streams (CSV exports) under the given name. */
export async function downloadFile(api, url, params, filename) {
    const response = await api.get(url, { params, responseType: 'blob' });
    const href = URL.createObjectURL(response.data);
    const link = Object.assign(document.createElement('a'), { href, download: filename });
    link.click();
    URL.revokeObjectURL(href);
}
