import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../auth.js';
import './Management.css';

export const ROOT = '/api';
export const money = n => new Intl.NumberFormat('vi-VN').format(n ?? 0) + ' ₫';
export const write = (url, method, body) => apiRequest(url, { method, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
export function useData(url) {
  const [state, set] = useState({ data: [], loading: true, error: '' });
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    const request = ++sequence.current;
    if (!url) { set({ data: [], loading: false, error: '' }); return; }
    set(s => ({ ...s, loading: true, error: '' }));
    try { const data = await apiRequest(url); if (request === sequence.current) set({ data, loading: false, error: '' }); }
    catch (e) { if (request === sequence.current) set({ data: [], loading: false, error: e.message }); }
  }, [url]);
  useEffect(() => { reload(); return () => { sequence.current++; }; }, [reload]);
  return { ...state, reload };
}
export function State({ query, empty = 'No records yet.' }) {
  if (query.loading) return <p className="mg-state" role="status">Loading…</p>;
  if (query.error) return <div className="mg-error" role="alert">{query.error} <button onClick={query.reload}>Retry</button></div>;
  if (!(query.data?.items ?? query.data)?.length) return <p className="mg-state">{empty}</p>;
  return null;
}
export function Badge({ value }) { return <span className={'mg-badge ' + value}>{value}</span>; }
export function Field({ label, ...props }) { return <label>{label}<input {...props} /></label>; }
export function Pager({ page, setPage, total, size = 10 }) {
  const pages = Math.max(1, Math.ceil(total / size));
  return <footer className="mg-pager"><span>{total ? (page - 1) * size + 1 : 0}–{Math.min(page * size, total)} of {total}</span>
    <div><button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button> <span>{page} / {pages}</span> <button disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></div></footer>;
}
export function exportCsv(name, headers, rows) {
  const cell = value => '"' + String(value ?? '').replace(/^[=+@-]/, "'$&").replaceAll('"', '""') + '"';
  const blob = new Blob(['\uFEFF' + [headers, ...rows].map(r => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
export function useUnsaved(dirty, notify) {
  useEffect(() => { notify?.(dirty); return () => notify?.(false); }, [dirty, notify]);
  useEffect(() => { if (!dirty) return; const warn = e => { e.preventDefault(); e.returnValue = ''; }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty]);
}

