import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { unitTypesApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import Icon from '../../customer/components/Icon.jsx';
import { formatVnd } from '../../customer/components/format.js';
import { Modal, PageHeader, TableState } from '../components/ui.jsx';
import { useUnitTypes } from '../queries.js';
import { useT } from '../../i18n/I18n.jsx';
import { confirmAction } from '../../customer/components/confirm.js';

const EMPTY = { code: '', name: '', areaM2: '', width: '', depth: '', height: '', isClimateControlled: false };
const DIMENSIONS = [['width', 'Width (m)'], ['depth', 'Depth (m)'], ['height', 'Height (m)']];

function SizeForm({ size, onClose }) {
    const tr = useT();
    const queryClient = useQueryClient();
    const [form, setForm] = useState(size ?? EMPTY);
    const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
    const finish = () => {
        queryClient.invalidateQueries({ queryKey: ['unit-types'] });
        onClose();
    };
    const save = useMutation({
        mutationFn: () => {
            const body = {
                code: form.code.trim(), name: form.name.trim(), isClimateControlled: form.isClimateControlled,
                areaM2: Number(form.areaM2), width: Number(form.width), depth: Number(form.depth), height: Number(form.height),
            };
            return size ? unitTypesApi.update(size.unitTypeId, body) : unitTypesApi.create(body);
        },
        onSuccess: finish,
    });
    const remove = useMutation({ mutationFn: () => unitTypesApi.remove(size.unitTypeId), onSuccess: finish });
    const number = (key, label, max) => (
        <label key={key}><span className="se-label">{tr(label)}</span>
            <div className="se-input"><input type="number" min="0.01" max={max} step="0.01" value={form[key]} onChange={set(key)} required /></div></label>
    );

    return (
        <form className="se-panel sa-side-panel" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <div className="sa-card-title"><h2>{size ? tr('Edit size {code}', { code: size.code }) : tr('New size')}</h2>
                <button type="button" className="sa-close" onClick={onClose} aria-label={tr('Close')}><Icon name="close" size={16} /></button></div>
            <div className="se-panel-grid">
                <label><span className="se-label">{tr('Code')}</span><div className="se-input"><input value={form.code} onChange={set('code')} maxLength={10} required /></div></label>
                <label><span className="se-label">{tr('Name')}</span><div className="se-input"><input value={form.name} onChange={set('name')} maxLength={50} required /></div></label>
            </div>
            {number('areaM2', 'Area (m²)', '999.99')}
            <div className="se-panel-grid sa-grid-3">{DIMENSIONS.map(([key, label]) => number(key, label, '99.99'))}</div>
            <label className="se-check"><input type="checkbox" checked={form.isClimateControlled} onChange={(e) => setForm({ ...form, isClimateControlled: e.target.checked })} />
                <span><strong>{tr('Climate controlled')}</strong></span></label>
            {[save, remove].map((m, i) => m.isError && <div key={i} className="se-alert" role="alert">{errorMessage(m.error)}</div>)}
            <div className="sa-form-actions">
                {size && (
                    <button type="button" className="se-btn se-btn-ghost" disabled={remove.isPending}
                        onClick={() => confirmAction(tr('Delete size {code}?', { code: size.code })).then((ok) => ok && remove.mutate())}>{tr('Delete size')}</button>
                )}
                <button type="submit" className="se-btn se-btn-primary" disabled={save.isPending}>{save.isPending ? tr('Saving…') : tr('Save size')}</button>
            </div>
        </form>
    );
}

/** The sizes units come in. A new size needs a price in a new price version before customers can book it. */
export default function UnitSizesPage() {
    const tr = useT();
    const sizes = useUnitTypes();
    const [editing, setEditing] = useState(null);
    const rows = sizes.data ?? [];
    const close = () => setEditing(null);

    return (
        <>
            <PageHeader title={tr('Unit sizes')} subtitle="The sizes units come in. Prices are set in Pricing & Policies">
                <button type="button" className="se-btn se-btn-primary" onClick={() => setEditing('new')}><Icon name="box" size={16} /> {tr('New size')}</button>
            </PageHeader>
            <div className="se-card se-table-wrap">
                <table className="se-table sa-table">
                    <thead><tr><th>{tr('Code')}</th><th>{tr('Name')}</th><th>{tr('Area')}</th><th>{tr('W × D × H (m)')}</th><th>{tr('Climate controlled')}</th><th>{tr('Price / mo')}</th></tr></thead>
                    <tbody>
                        {rows.map((s) => (
                            <tr key={s.unitTypeId} onClick={() => setEditing(s)}>
                                <td className="strong">{s.code}</td>
                                <td>{s.name}</td>
                                <td>{s.areaM2} m²</td>
                                <td>{s.width} × {s.depth} × {s.height}</td>
                                <td>{s.isClimateControlled ? tr('Yes') : tr('No')}</td>
                                <td className="price">{s.monthlyPrice == null ? <Link to="/admin/pricing" onClick={(e) => e.stopPropagation()}>{tr('Set a price')}</Link> : formatVnd(s.monthlyPrice)}</td>
                            </tr>
                        ))}
                        <TableState query={sizes} rows={rows} cols={6} empty="No sizes yet." />
                    </tbody>
                </table>
            </div>
            {editing && <Modal narrow onClose={close}><SizeForm size={editing === 'new' ? null : editing} onClose={close} /></Modal>}
        </>
    );
}
