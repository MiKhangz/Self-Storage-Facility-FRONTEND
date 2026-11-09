import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { facilityPricesApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import Icon from '../../customer/components/Icon.jsx';
import { formatDate, formatVnd } from '../../customer/components/format.js';
import { PageHeader, Status } from '../components/ui.jsx';
import { useT } from '../../i18n/I18n.jsx';
import { confirmAction } from '../../customer/components/confirm.js';
import PriceHistory from './PriceHistory.jsx';
import { facilityVersionChanges } from './priceChanges.js';

const FIELDS = ['basePricePerMonth', 'discount3Month', 'discount6Month', 'discount12Month'];
const discounted = (base, pct) => Math.round(Number(base) * (1 - (Number(pct) || 0) / 100));

/** Every size as shown: the version's own price when it has one, else the company standard. */
function rowsOf(standard, version) {
    return standard.map((s) => {
        const own = version?.prices.find((p) => p.unitTypeId === s.unitTypeId);
        const from = own ?? s;
        return { unitTypeId: s.unitTypeId, code: s.unitTypeCode, own: !!own, ...Object.fromEntries(FIELDS.map((k) => [k, String(from[k])])) };
    });
}

/**
 * One facility's price list. Ops press "Edit prices" (a draft copying the live list), tick the sizes this facility
 * prices itself, change them, Save once, then Publish. Sizes left unticked use the company standard.
 */
export default function FacilityPriceList({ facilityId, canEdit, picker }) {
    const tr = useT();
    const queryClient = useQueryClient();
    const list = useQuery({ queryKey: ['facility-prices', facilityId], queryFn: () => facilityPricesApi.getPriceVersions(facilityId) });
    const versions = list.data?.versions ?? [];
    const standard = list.data?.standard ?? [];
    const live = versions.find((v) => v.status === 'Active');
    const draft = versions.find((v) => v.status === 'Draft');
    const editing = canEdit && !!draft;
    const [rows, setRows] = useState([]);
    useEffect(() => { setRows(rowsOf(standard, draft ?? live)); }, [list.data]); // eslint-disable-line react-hooks/exhaustive-deps
    const saved = rowsOf(standard, draft ?? live);
    const changed = rows.filter((r, i) => saved[i] && (r.own !== saved[i].own || (r.own && FIELDS.some((k) => Number(r[k]) !== Number(saved[i][k])))));
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['facility-prices', facilityId] });

    const startDraft = useMutation({ mutationFn: () => facilityPricesApi.postPriceVersions(facilityId), onSuccess: refresh });
    const save = useMutation({
        mutationFn: async () => {
            for (const r of changed) {
                if (r.own) await facilityPricesApi.putPriceVersionsUnitPrices(facilityId, draft.facilityPriceVersionId, r.unitTypeId, Object.fromEntries(FIELDS.map((k) => [k, Number(r[k])])));
                else await facilityPricesApi.deletePriceVersionsUnitPrices(facilityId, draft.facilityPriceVersionId, r.unitTypeId);
            }
        },
        onSettled: refresh,
    });
    const publish = useMutation({ mutationFn: () => facilityPricesApi.priceVersionsPublish(facilityId, draft.facilityPriceVersionId), onSuccess: refresh });
    const discard = useMutation({ mutationFn: () => facilityPricesApi.priceVersions(facilityId, draft.facilityPriceVersionId), onSuccess: refresh });
    const error = startDraft.error ?? save.error ?? publish.error ?? discard.error ?? list.error;
    const set = (i, patch) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

    return (
        <>
            <PageHeader title={tr('Pricing & rental policies')}
                subtitle={live ? tr('{name}: version {version} live since {date}', { name: list.data?.facilityName ?? '', version: live.version, date: formatDate(live.effectiveFrom) })
                    : tr('{name} uses the company standard prices', { name: list.data?.facilityName ?? '' })}>
                {canEdit && !draft && (
                    <button type="button" className="se-btn se-btn-primary" disabled={startDraft.isPending || list.isLoading} onClick={() => startDraft.mutate()}>
                        <Icon name="file" size={16} /> {tr('Edit prices')}
                    </button>
                )}
                {editing && (
                    <button type="button" className="se-btn se-btn-ghost" disabled={discard.isPending}
                        onClick={() => confirmAction(tr('Discard these unpublished changes?')).then((ok) => ok && discard.mutate())}>{tr('Discard draft')}</button>
                )}
                {editing && (
                    <button type="button" className="se-btn se-btn-primary" disabled={publish.isPending || changed.length > 0}
                        title={changed.length ? tr('Save your changes first') : undefined}
                        onClick={() => confirmAction(tr('Publish these prices for {name} from today? Existing bookings keep the price they were quoted.', { name: list.data?.facilityName ?? '' })).then((ok) => ok && publish.mutate())}>
                        <Icon name="check" size={16} /> {tr('Publish')}
                    </button>
                )}
            </PageHeader>
            {picker}
            {error && <div className="se-alert" role="alert">{errorMessage(error)}</div>}
            <div className="se-alert info sa-not-wired"><Icon name="shield" size={14} /> {tr('Rental rules (deposit, late fees, cancellation) are the same everywhere and are set in the company standard.')}</div>
            <section className="se-panel sa-pricing">
                <div className="sa-card-title">
                    <h2>{editing ? tr('Draft version {version}', { version: draft.version }) : live ? tr('Version {version}', { version: live.version }) : tr('Company standard prices')}</h2>
                    {(draft ?? live) && <Status value={(editing ? draft : live).status} />}
                </div>
                {editing && <p className="sa-muted">{tr('Tick the sizes this facility prices itself and change them; unticked sizes use the company standard. Save, then Publish.')}</p>}
                <div className="se-table-wrap">
                    <table className="se-table" aria-label={tr('Facility prices')}>
                        <thead><tr><th>{tr('Size')}</th><th>{tr('Price')}</th><th>{tr("1 month (₫)")}</th><th>{tr("3+ months (discount %)")}</th><th>{tr("6+ months (discount %)")}</th><th>{tr("12+ months (discount %)")}</th></tr></thead>
                        <tbody>
                            {rows.map((r, i) => {
                                const input = (k, step) => (editing && r.own
                                    ? <input type="number" min="0" step={step} className="sa-num" value={r[k]} onChange={(e) => set(i, { [k]: e.target.value })} aria-label={`${r.code} ${k}`} />
                                    : k === 'basePricePerMonth' ? formatVnd(Number(r[k])) : `${r[k]}%`);
                                return (
                                    <tr key={r.unitTypeId}>
                                        <td className="strong">{r.code}</td>
                                        <td>{editing
                                            ? <label className="se-check"><input type="checkbox" checked={r.own} onChange={(e) => set(i, e.target.checked ? { own: true } : { ...rowsOf(standard, null)[i], own: false })} aria-label={`${r.code} own price`} /><span>{tr('Own price')}</span></label>
                                            : <span className={`se-badge ${r.own ? 'info' : 'muted'}`}>{r.own ? tr('Own price') : tr('Company standard')}</span>}</td>
                                        <td>{input('basePricePerMonth', 1000)}</td>
                                        {['discount3Month', 'discount6Month', 'discount12Month'].map((k) => (
                                            <td key={k}>{input(k, 1)}<div className="sa-muted">{formatVnd(discounted(r.basePricePerMonth, r[k]))}</div></td>
                                        ))}
                                    </tr>
                                );
                            })}
                            {!rows.length && <tr><td colSpan={6} className="se-empty">{list.isLoading ? tr('Loading…') : tr('The company standard has no prices yet.')}</td></tr>}
                        </tbody>
                    </table>
                </div>
                {editing && (
                    <div className="sa-filters" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
                        {changed.length > 0 && <span className="sa-muted">{tr('{n} unsaved change{n:s}', { n: changed.length })}</span>}
                        <button type="button" className="se-btn se-btn-ghost" disabled={!changed.length || save.isPending} onClick={() => setRows(saved)}>{tr('Undo changes')}</button>
                        <button type="button" className="se-btn se-btn-primary" disabled={!changed.length || save.isPending || rows.some((r) => r.own && !Number(r.basePricePerMonth))} onClick={() => save.mutate()}>
                            {save.isPending ? tr('Saving…') : tr('Save changes')}
                        </button>
                    </div>
                )}
                <PriceHistory entries={versions.filter((v) => v.status !== 'Draft').map((v) => ({ ...v, id: v.facilityPriceVersionId }))}
                    changesOf={(v, previous) => [{ title: 'Prices per size', rows: facilityVersionChanges(v, previous, standard) }]} />
            </section>
        </>
    );
}
