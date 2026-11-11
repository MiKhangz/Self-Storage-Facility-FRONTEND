import { formatDate, formatVnd } from '../../customer/components/format.js';
import { Status } from '../components/ui.jsx';
import { useT } from '../../i18n/I18n.jsx';
import { percentChange } from './priceChanges.js';
import { toVietnamTime } from '../../admin/activityLog/logic.js';

const value = (tr, v, unit) => (v == null ? '—' : unit === 'vnd' ? formatVnd(v) : unit === '%' ? `${v}%` : `${v} ${tr(unit)}`);

/**
 * A price list's published versions, newest first. Each line opens to what changed against the version before it:
 * every number from → to (money with its percent change), who drafted and published it, and the bookings quoted on it.
 * `changesOf(entry, previous)` returns groups: [{ title, rows: [{ code, note, changes }] }].
 */
export default function PriceHistory({ entries, changesOf }) {
    const tr = useT();
    if (!entries.length) return null;
    return (
        <details className="sa-history" style={{ marginTop: 16 }}>
            <summary className="se-label">{tr('History')}</summary>
            {entries.map((e, i) => {
                const previous = entries[i + 1];
                const groups = changesOf(e, previous).filter((g) => g.rows.length);
                const a = e.audit;
                return (
                    <details key={e.id} className="sa-history-entry">
                        <summary>
                            <strong>{tr('Version {version}', { version: e.version })}</strong> · {formatDate(e.effectiveFrom)}{' '}
                            {/* Publishing ends the old version yesterday, so one replaced on its first day ends before it starts. */}
                            {e.effectiveTo && e.effectiveTo < e.effectiveFrom ? tr('replaced the same day') : <>→ {e.effectiveTo ? formatDate(e.effectiveTo) : tr('now')}</>} <Status value={e.status} />
                            {a && <span className="sa-muted"> · {tr('{n} booking{n:s} quoted on it', { n: a.bookings })}</span>}
                        </summary>
                        {a && (
                            <p className="sa-muted">
                                {a.createdByName && tr('Drafted by {name}', { name: a.createdByName })}
                                {a.publishedByName && <> · {tr('published by {name} on {date}', { name: a.publishedByName, date: toVietnamTime(a.publishedAt).dateLabel })}</>}
                            </p>
                        )}
                        {!groups.length ? <p className="sa-muted">{previous ? tr('Same numbers as version {version}.', { version: previous.version }) : tr('First version.')}</p>
                                : (
                                    <div className="se-table-wrap">
                                        <table className="se-table sa-changes" aria-label={tr('Changes in version {version}', { version: e.version })}>
                                            <thead><tr><th>{tr('Item')}</th><th>{tr('What changed')}</th><th>{tr('Before')}</th><th>{tr('After')}</th><th>{tr('Change')}</th></tr></thead>
                                            <tbody>
                                                {groups.flatMap((g) => [
                                                    <tr key={g.title} className="sa-changes-group"><th colSpan={5}>{tr(g.title)} · {previous ? tr('compared with version {version}', { version: previous.version }) : tr('compared with the company standard')}</th></tr>,
                                                    ...g.rows.flatMap((r) => (r.changes.length ? r.changes : [null]).map((c, j) => (
                                                        <tr key={`${g.title}-${r.code}-${c?.key ?? 'note'}`}>
                                                            <td className="strong">{j === 0 ? r.code : ''}</td>
                                                            <td>{c ? tr(c.label) : ''}{r.note && j === 0 && <div className="sa-muted">{tr(r.note)}</div>}</td>
                                                            <td>{c ? value(tr, c.from, c.unit) : ''}</td>
                                                            <td className="strong">{c ? value(tr, c.to, c.unit) : ''}</td>
                                                            <td>{c?.unit === 'vnd' && <Delta pct={percentChange(c.from, c.to)} />}</td>
                                                        </tr>
                                                    ))),
                                                ])}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                    </details>
                );
            })}
        </details>
    );
}

function Delta({ pct }) {
    if (pct == null) return null;
    return <span className={`sa-delta ${pct > 0 ? 'up' : pct < 0 ? 'down' : ''}`}>{pct > 0 ? '+' : ''}{pct}%</span>;
}
