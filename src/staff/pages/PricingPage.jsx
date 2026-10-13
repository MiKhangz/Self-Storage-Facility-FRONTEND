import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pricingPoliciesApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import Icon from '../../customer/components/Icon.jsx';
import { formatDate, formatVnd, todayIso } from '../../customer/components/format.js';
import { PageHeader, Status } from '../components/ui.jsx';
import { useUnitTypes } from '../queries.js';

const TERMS = [
    { title: 'Deposit', icon: 'shield', rows: [['depositMonths', 'Deposit amount', 'month(s) rent']] },
    { title: 'Cancellation', icon: 'clock', rows: [['cancelFreeHours', 'Free cancellation before move-in', 'hours'], ['noticeDays', 'Move-out notice', 'days']] },
    {
        title: 'Overdue handling', icon: 'card', rows: [
            ['graceDays', 'Grace period', 'days'], ['lateFeePercentPerWeek', 'Late fee', '% / week'],
            ['suspendAfterDays', 'Suspend access after', 'days'], ['clearOutAfterDays', 'Clear out unit after', 'days'],
        ],
    },
];
const TERM_KEYS = TERMS.flatMap((t) => t.rows.map(([k]) => k));

/** Price after a percentage discount, rounded to whole đồng. */
export const discounted = (base, pct) => Math.round(base * (1 - (pct ?? 0) / 100));

function PriceRow({ policy, type, price, editable }) {
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
                        {save.isPending ? 'Saving…' : 'Save'}
                    </button>
                )}
                {save.isError && <div className="sa-bad">{errorMessage(save.error)}</div>}
            </td>
        </tr>
    );
}

/** A08: versioned pricing policy — unit prices, discounts and rental terms. Only a draft version can be edited. */
export default function PricingPage() {
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
        // A new version starts from the active terms; prices are then entered per unit size.
        mutationFn: () => pricingPoliciesApi.create({
            ...Object.fromEntries(TERM_KEYS.map((k) => [k, active?.[k] ?? 0])),
            effectiveFrom: todayIso(),
            effectiveTo: null,
        }),
        onSuccess: (p) => { setPickedId(p.pricingPolicyId); refresh(); },
    });
    const activate = useMutation({ mutationFn: () => pricingPoliciesApi.activate(policy.pricingPolicyId), onSuccess: refresh });
    const error = newDraft.error ?? activate.error;

    return (
        <>
            <PageHeader title="Pricing & rental policies" subtitle={active ? `Policy version ${active.version} active since ${formatDate(active.effectiveFrom)}` : 'No active policy'}>
                {!draft && <button type="button" className="se-btn se-btn-ghost" disabled={newDraft.isPending} onClick={() => newDraft.mutate()}><Icon name="file" size={16} /> New draft version</button>}
                {editable && (
                    <button type="button" className="se-btn se-btn-primary" disabled={activate.isPending}
                        onClick={() => window.confirm(`Publish version ${policy.version}? It replaces the active policy for new contracts and renewals.`) && activate.mutate()}>
                        <Icon name="check" size={16} /> Publish version {policy.version}
                    </button>
                )}
            </PageHeader>
            {error && <div className="se-alert" role="alert">{errorMessage(error)}</div>}
            {policies.isError && <div className="se-alert" role="alert">{errorMessage(policies.error)}</div>}
            <div className="se-alert info sa-not-wired"><Icon name="shield" size={14} /> New prices apply to new contracts and renewals only — existing contracts keep the rent agreed at signing.</div>

            {policy && (
                <div className="sa-grid-2">
                    <section className="se-panel">
                        <div className="sa-card-title">
                            <h2>Rental price table <Status value={policy.status} /></h2>
                            <label className="sa-filter"><span className="sr-only">Policy version</span>
                                <select value={policy.pricingPolicyId} onChange={(e) => setPickedId(Number(e.target.value))} aria-label="Policy version">
                                    {all.map((p) => <option key={p.pricingPolicyId} value={p.pricingPolicyId}>Version {p.version} · {p.status}</option>)}
                                </select>
                            </label>
                        </div>
                        <div className="se-table-wrap">
                            <table className="se-table">
                                <thead><tr><th>Size</th><th>Area</th><th>1 month (₫)</th><th>3+ months</th><th>6+ months</th><th>12+ months</th><th /></tr></thead>
                                <tbody>
                                    {types.map((t) => (
                                        <PriceRow key={`${policy.pricingPolicyId}-${t.unitTypeId}`} policy={policy} type={t} editable={editable}
                                            price={policy.unitPrices?.find((u) => u.unitTypeId === t.unitTypeId)} />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {!editable && <p className="sa-muted">Published versions are read-only. Create a draft version to change prices.</p>}
                        {!!policy.fees?.length && (
                            <>
                                <span className="se-label" style={{ marginTop: 16 }}>Extra fees</span>
                                <dl className="se-kv">{policy.fees.map((f) => <div key={f.feeTypeId}><dt>{f.name}</dt><dd>{f.isPercentage ? `${f.amount}%` : formatVnd(f.amount)}</dd></div>)}</dl>
                            </>
                        )}
                    </section>
                    <div className="sa-terms">
                        {TERMS.map((group) => (
                            <section key={group.title} className="se-panel">
                                <div className="sa-card-title"><h2><span className="sa-stat-icon"><Icon name={group.icon} size={15} /></span> {group.title}</h2></div>
                                <dl className="se-kv">{group.rows.map(([k, label, unit]) => <div key={k}><dt>{label}</dt><dd>{policy[k]} {unit}</dd></div>)}</dl>
                            </section>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}
