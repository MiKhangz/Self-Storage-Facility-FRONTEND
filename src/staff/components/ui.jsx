import { useEffect, useRef } from 'react';
import Icon from '../../customer/components/Icon.jsx';
import { errorMessage } from '../../api/axiosClient';
import { TONE, humanize } from '../queries.js';
import { useT } from '../../i18n/I18n.jsx';

/** Translates a prop only when it is plain text; elements pass through. */
const text = (tr, value) => (typeof value === 'string' ? tr(value) : value);

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
    const tr = useT();
    return (
        <div className="sa-page-head">
            <div><h1>{text(tr, title)}</h1>{subtitle && <p>{text(tr, subtitle)}</p>}</div>
            {children && <div className="sa-page-actions">{children}</div>}
        </div>
    );
}

export function Status({ value }) {
    const tr = useT();
    if (!value) return null;
    return <span className={`se-badge ${TONE[value] ?? ''}`}>{tr(humanize(value))}</span>;
}

export function Stat({ icon, label, value, note, tone = '' }) {
    const tr = useT();
    return (
        <div className="se-card sa-stat">
            <div className="sa-stat-top"><span>{text(tr, label)}</span><span className={`sa-stat-icon ${tone}`}><Icon name={icon} size={16} /></span></div>
            <strong>{value}</strong>
            {note && <small>{text(tr, note)}</small>}
        </div>
    );
}

/** Loading / error / empty row for a table body; renders nothing once rows exist. */
export function TableState({ query, rows, cols, empty = 'Nothing here yet.' }) {
    const tr = useT();
    if (rows?.length) return null;
    const message = query?.isLoading ? tr('Loading…') : query?.isError ? errorMessage(query.error) : text(tr, empty);
    return <tr><td colSpan={cols} className="se-empty">{message}</td></tr>;
}

/** Explains a screen or action the backend cannot serve yet. */
export function NotWired({ children }) {
    const tr = useT();
    return <div className="se-alert info sa-not-wired"><Icon name="clock" size={14} /> {text(tr, children)}</div>;
}

export function Filters({ children }) {
    return <div className="sa-filters">{children}</div>;
}

export function SelectFilter({ value, onChange, options, label: rawLabel, all = 'All' }) {
    const tr = useT();
    const label = text(tr, rawLabel);
    return (
        <label className="sa-filter">
            <span className="sr-only">{label}</span>
            <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
                <option value="">{text(tr, all)}</option>
                {options.map((o) => (typeof o === 'string'
                    ? <option key={o} value={o}>{tr(humanize(o))}</option>
                    : <option key={o.value} value={o.value}>{text(tr, o.label)}</option>))}
            </select>
        </label>
    );
}

export function SearchFilter({ value, onChange, placeholder: rawPlaceholder }) {
    const tr = useT();
    const placeholder = text(tr, rawPlaceholder);
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
