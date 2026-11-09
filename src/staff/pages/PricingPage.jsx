import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pricingPoliciesApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import Icon from '../../customer/components/Icon.jsx';
import { formatDate, formatVnd, todayIso } from '../../customer/components/format.js';
import { PageHeader, Status } from '../components/ui.jsx';
import { humanize, useFacilities, useUnitTypes } from '../queries.js';
import { useAuth } from '../../features/auth/AuthContext';
import { Roles } from '../../features/auth/roles';
import FacilityPriceList from './FacilityPriceList.jsx';
import { useT } from '../../i18n/I18n.jsx';
import { confirmAction } from '../../customer/components/confirm.js';
import PriceHistory from './PriceHistory.jsx';
import { policyChanges } from './priceChanges.js';

const TERMS = [
    { title: 'Deposit', icon: 'shield', rows: [['depositMonths', 'Deposit amount', 'month(s) rent']] },
    { title: 'Cancellation', icon: 'clock', rows: [['cancelFreeHours', 'Free cancellation before move-in', 'hours'], ['earlyTerminationPercent', 'Early return penalty', '% of deposit']] },
    {
        title: 'Overdue handling', icon: 'card', rows: [
            ['graceDays', 'Grace period', 'days'], ['lateFeePercentPerWeek', 'Late fee', '% / week'],
            ['suspendAfterDays', 'Suspend access after', 'days'], ['clearOutAfterDays', 'Clear out unit after', 'days'],
        ],
    },
];
const TERM_KEYS = TERMS.flatMap((t) => t.rows.map(([k]) => k));
const RULE_FIELDS = [...TERMS.flatMap((t) => t.rows), ['noticeDays', 'Notice before moving out', 'days']];

/** A standard version against the one before it, grouped as the history shows it. The first version has nothing to compare. */
function standardChanges(policy, previous) {
    if (!previous) return [];
    const c = policyChanges(policy, previous, RULE_FIELDS);
    return [
        { title: 'Prices per size', rows: c.sizes },
        { title: 'Rental terms', rows: c.rules.length ? [{ code: '', note: null, changes: c.rules }] : [] },
        { title: 'Extra fees', rows: c.fees },
    ];
}

/** Price after a percentage discount, rounded to whole đồng. */
export const discounted = (base, pct) => Math.round(base * (1 - (pct ?? 0) / 100));

function PriceRow({ policy, type, price, editable }) {
    const tr = useT();
    const queryClient = useQueryClient();
    const initial = { basePricePerMonth: price?.basePricePerMonth ?? 0, discount3Month: price?.discount3Month ?? 5, discount6Month: price?.discount6Month ?? 10, discount12Month: price?.discount12Month ?? 10 };
    const [row, setRow] = useState(initial);
    const changed = Object.keys(initial).some((k) => Number(row[k]) !== initial[k]);
    const save = useMutation({
        mutationFn: () => pricingPoliciesApi.unitPrices(policy.pricingPolicyId, type.unitTypeId, Object.fromEntries(Object.entries(row).map(([k, v]) => [k, Number(v)]))),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pricing-policies'] }),
    });
    const num = (key, step = 1000) => (editable
        ? <input type="number" min="0" step={step} className="sa-num" value={row[key]} onChange={(e) => setRow({ ...row, [key]: e.target.value })} aria-label={`${type.code} ${key}`} />
        : key === 'basePricePerMonth' ? formatVnd(row[key]) : `${row[key]}%`);

    return (
        <tr>
            <td className="strong">{type.code}</td>
            <td>{type.areaM2} m²</td>
            <td>{num('basePricePerMonth')}</td>
            <td>{num('discount3Month', 1)}<div className="sa-muted">{formatVnd(discounted(row.basePricePerMonth, row.discount3Month))}</div></td>
            <td>{num('discount6Month', 1)}<div className="sa-muted">{formatVnd(discounted(row.basePricePerMonth, row.discount6Month))}</div></td>
            <td>{num('discount12Month', 1)}<div className="sa-muted">{formatVnd(discounted(row.basePricePerMonth, row.discount12Month))}</div></td>
            <td>
                {editable && (changed || !price) && (
                    <button type="button" className="se-btn se-btn-primary se-btn-sm" disabled={save.isPending || !Number(row.basePricePerMonth)} onClick={() => save.mutate()}>
                        {save.isPending ? tr('Saving…') : tr('Save')}
                    </button>
                )}
                {save.isError && <div className="sa-bad">{errorMessage(save.error)}</div>}
            </td>
        </tr>
    );
}

/** A08: versioned pricing policy — unit prices, discounts and rental terms. Only a draft version can be edited. */
/** T-03: a Draft policy's terms and start date, saved together; published versions stay read-only. */
function DraftTerms({ policy }) {
    const tr = useT();
    const queryClient = useQueryClient();
    const [form, setForm] = useState(() => ({
        effectiveFrom: policy.effectiveFrom,
        ...Object.fromEntries([...TERM_KEYS, 'noticeDays'].map((k) => [k, String(policy[k] ?? 0)])),
    }));
    const save = useMutation({
        mutationFn: () => pricingPoliciesApi.update(policy.pricingPolicyId, {
            ...Object.fromEntries([...TERM_KEYS, 'noticeDays'].map((k) => [k, Number(form[k])])),
            effectiveFrom: form.effectiveFrom,
            effectiveTo: policy.effectiveTo ?? null,
        }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pricing-policies'] }),
    });
    return (
        <form className="sa-term-grid" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <div className="sa-term-group">
                <h3><span className="sa-stat-icon"><Icon name="calendar" size={15} /></span> {tr('Starts on')}</h3>
                <label><span className="se-label">{tr('First day this version applies')}</span><div className="se-input"><input type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} required /></div></label>
            </div>
            {TERMS.map((group) => (
                <div key={group.title} className="sa-term-group">
                    <h3><span className="sa-stat-icon"><Icon name={group.icon} size={15} /></span> {tr(group.title)}</h3>
                    {group.rows.map(([k, label, unit]) => (
                        <label key={k}><span className="se-label">{tr(label)} ({tr(unit)})</span>
                            <div className="se-input"><input type="number" min="0" step="any" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} required /></div></label>
                    ))}
                </div>
            ))}
            <div className="sa-term-actions">
                {save.isError && <div className="se-alert" role="alert">{errorMessage(save.error)}</div>}
                {save.isSuccess && !save.isPending && <div className="se-alert info">{tr('Terms saved.')}</div>}
                <button type="submit" className="se-btn se-btn-primary" disabled={save.isPending}>{save.isPending ? tr('Saving…') : tr('Save terms')}</button>
            </div>
        </form>
    );
}

/** The company standard: rental rules and the default price of every size, in versions. */
function CompanyStandard({ picker }) {
    const tr = useT();
    const queryClient = useQueryClient();
    const policies = useQuery({ queryKey: ['pricing-policies'], queryFn: () => pricingPoliciesApi.list({ page: 1, pageSize: 50 }) });
    const types = [...(useUnitTypes().data ?? [])].sort((a, b) => a.areaM2 - b.areaM2);
    const all = [...(policies.data?.items ?? [])].sort((a, b) => b.version - a.version);
    const active = all.find((p) => p.status === 'Active');
    const draft = all.find((p) => p.status === 'Draft');
    const [pickedId, setPickedId] = useState(null);
    const policy = all.find((p) => p.pricingPolicyId === pickedId) ?? draft ?? active ?? all[0];
    const editable = policy?.status === 'Draft';
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['pricing-policies'] });

    const newDraft = useMutation({
        // A new version copies the one on screen (prices, discounts, fees, terms), so an old price comes back by copying
        // its version and publishing it: past dates keep the version that applied. With no version yet, start blank.
        mutationFn: () => (policy ? pricingPoliciesApi.copy(policy.pricingPolicyId) : pricingPoliciesApi.create({
            ...Object.fromEntries(TERM_KEYS.map((k) => [k, 0])),
            effectiveFrom: todayIso(),
            effectiveTo: null,
        })),
        onSuccess: (p) => { setPickedId(p.pricingPolicyId); refresh(); },
    });
    const activate = useMutation({ mutationFn: () => pricingPoliciesApi.activate(policy.pricingPolicyId), onSuccess: refresh });
    const removeDraft = useMutation({ mutationFn: () => pricingPoliciesApi.remove(policy.pricingPolicyId), onSuccess: () => { setPickedId(null); refresh(); } });
    const error = newDraft.error ?? activate.error ?? removeDraft.error;

    return (
        <>
            <PageHeader title={tr('Pricing & rental policies')} subtitle={active ? tr('Policy version {version} active since {date}', { version: active.version, date: formatDate(active.effectiveFrom) }) : tr('No active policy')}>
                {!draft && (
                    <button type="button" className="se-btn se-btn-ghost" disabled={newDraft.isPending} onClick={() => newDraft.mutate()}>
                        <Icon name="file" size={16} /> {policy ? tr('Copy version {version} to a new draft', { version: policy.version }) : tr('New draft version')}
                    </button>
                )}
                {editable && (
                    <button type="button" className="se-btn se-btn-ghost" disabled={removeDraft.isPending}
                        onClick={() => confirmAction(tr('Delete draft version {version}? Its prices and fees are removed; published versions are not touched.', { version: policy.version })).then((ok) => ok && removeDraft.mutate())}>
                        {tr('Delete draft')}
                    </button>
                )}
                {editable && (
                    <button type="button" className="se-btn se-btn-primary" disabled={activate.isPending}
                        onClick={() => confirmAction(tr('Publish version {version}? It replaces the active policy for new contracts and renewals.', { version: policy.version })).then((ok) => ok && activate.mutate())}>
                        <Icon name="check" size={16} /> {tr('Publish version {version}', { version: policy.version })}
                    </button>
                )}
            </PageHeader>
            {picker}
            {error && <div className="se-alert" role="alert">{errorMessage(error)}</div>}
            {policies.isError && <div className="se-alert" role="alert">{errorMessage(policies.error)}</div>}
            <div className="se-alert info sa-not-wired"><Icon name="shield" size={14} /> {tr('New prices apply to new contracts and renewals only — existing contracts keep the rent agreed at signing.')}</div>

            {policy && (
                <div className="sa-filters">
                    <label className="sa-version-pick"><span className="se-label">{tr('Policy version')}</span>
                        <div className="se-field"><select value={policy.pricingPolicyId} onChange={(e) => setPickedId(Number(e.target.value))} aria-label={tr('Policy version')}>
                            {all.map((p) => <option key={p.pricingPolicyId} value={p.pricingPolicyId}>{tr('Version {version}', { version: p.version })} · {tr(humanize(p.status))}</option>)}
                        </select></div>
                    </label>
                </div>
            )}
            {policy && (
                <section className="se-panel sa-pricing">
                        <div className="sa-card-title">
                            <h2>{tr('Version {version}', { version: policy.version })} <Status value={policy.status} /></h2>
                        </div>
                        {editable && <p className="sa-muted">{tr("Set the prices (Save each row), then the rental terms (Save terms), then Publish.")}</p>}
                        <h3 className="sa-pricing-step">{tr('1 · Prices per size')}</h3>
                        <div className="se-table-wrap">
                            <table className="se-table">
                                <thead><tr><th>{tr('Size')}</th><th>{tr('Area')}</th><th>{tr("1 month (₫)")}</th><th>{tr("3+ months (discount %)")}</th><th>{tr("6+ months (discount %)")}</th><th>{tr("12+ months (discount %)")}</th><th /></tr></thead>
                                <tbody>
                                    {types.map((t) => (
                                        <PriceRow key={`${policy.pricingPolicyId}-${t.unitTypeId}`} policy={policy} type={t} editable={editable}
                                            price={policy.unitPrices?.find((u) => u.unitTypeId === t.unitTypeId)} />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {!editable && <p className="sa-muted">{tr('Published versions are read-only. To change these prices, or bring them back later, copy this version to a new draft.')}</p>}
                        {!!policy.fees?.length && (
                            <>
                                <span className="se-label" style={{ marginTop: 16 }}>{tr('Extra fees')}</span>
                                <dl className="se-kv">{policy.fees.map((f) => <div key={f.feeTypeId}><dt>{f.name}</dt><dd>{f.isPercentage ? `${f.amount}%` : formatVnd(f.amount)}</dd></div>)}</dl>
                            </>
                        )}
                        <h3 className="sa-pricing-step">{tr('2 · Rental terms')}</h3>
                        {editable ? <DraftTerms key={policy.pricingPolicyId} policy={policy} /> : (
                            <div className="sa-term-grid">
                                <div className="sa-term-group">
                                    <h3><span className="sa-stat-icon"><Icon name="calendar" size={15} /></span> {tr('In force')}</h3>
                                    <dl className="se-kv"><div><dt>{tr('From')}</dt><dd>{formatDate(policy.effectiveFrom)}</dd></div><div><dt>{tr('Until')}</dt><dd>{policy.effectiveTo ? formatDate(policy.effectiveTo) : '—'}</dd></div></dl>
                                </div>
                                {TERMS.map((group) => (
                                    <div key={group.title} className="sa-term-group">
                                        <h3><span className="sa-stat-icon"><Icon name={group.icon} size={15} /></span> {tr(group.title)}</h3>
                                        <dl className="se-kv">{group.rows.map(([k, label, unit]) => <div key={k}><dt>{tr(label)}</dt><dd>{policy[k]} {tr(unit)}</dd></div>)}</dl>
                                    </div>
                                ))}
                            </div>
                        )}
                        <PriceHistory entries={all.filter((p) => p.status !== 'Draft').map((p) => ({ ...p, id: p.pricingPolicyId }))} changesOf={standardChanges} />
                </section>
            )}
        </>
    );
}

/**
 * A08: prices by price list. The company standard holds the rental rules and every size's default price; each
 * facility may keep its own list in versions, which wins there for the sizes it prices. Managers read their facilities.
 */
export default function PricingPage() {
    const tr = useT();
    const role = useAuth().session?.role;
    const canEdit = [Roles.BusinessOperationsManager, Roles.SystemAdministrator].includes(role);
    const facilities = useFacilities().data ?? [];
    const [scope, setScope] = useState(canEdit ? 'standard' : '');
    const current = scope || String(facilities[0]?.facilityId ?? '');
    const picker = (
        <div className="sa-filters">
            <label className="sa-version-pick"><span className="se-label">{tr('Price list')}</span>
                <div className="se-field"><select value={current} onChange={(e) => setScope(e.target.value)} aria-label={tr('Price list')}>
                    {canEdit && <option value="standard">{tr('Company standard')}</option>}
                    {facilities.map((f) => <option key={f.facilityId} value={f.facilityId}>{f.name}</option>)}
                </select></div>
            </label>
        </div>
    );
    if (current === 'standard') return <CompanyStandard picker={picker} />;
    return current
        ? <FacilityPriceList key={current} facilityId={Number(current)} canEdit={canEdit} picker={picker} />
        : <PageHeader title={tr('Pricing & rental policies')} />;
}
