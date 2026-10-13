import { useState } from 'react';
import Icon from '../../customer/components/Icon.jsx';
import { formatDate, formatVnd } from '../../customer/components/format.js';
import { Filters, NotWired, PageHeader, SearchFilter, SelectFilter, Status, TableState, matches } from '../components/ui.jsx';
import { humanize, useContracts, useFacilities, useUnits } from '../queries.js';

const STATUSES = ['Available', 'Reserved', 'Occupied', 'Maintenance', 'Retired'];
const LIVE = ['Draft', 'Active', 'PendingMoveOut', 'Overdue', 'Suspended'];

/** A04: unit board — every unit, its status and who rents it. */
export default function UnitsPage() {
    const [status, setStatus] = useState('');
    const [facilityId, setFacilityId] = useState('');
    const [size, setSize] = useState('');
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState(null);
    const facilities = useFacilities();
    const units = useUnits(facilityId ? { facilityId: Number(facilityId) } : undefined);
    const contracts = useContracts();

    const all = units.data ?? [];
    const contractOf = Object.fromEntries((contracts.data ?? []).filter((c) => LIVE.includes(c.status)).map((c) => [c.storageUnitId, c]));
    const sizes = [...new Set(all.map((u) => u.unitTypeCode).filter(Boolean))];
    const shown = all.filter((u) => (!status || u.status === status) && (!size || u.unitTypeCode === size)
        && matches(search, u.unitCode, contractOf[u.storageUnitId]?.customerName));
    const unit = all.find((u) => u.storageUnitId === selected);
    const contract = unit && contractOf[unit.storageUnitId];

    return (
        <>
            <PageHeader title="Storage units" subtitle={`${all.length} units${facilityId ? '' : ' across all facilities'}`} />
            <div className="sa-chip-row" role="tablist">
                <button type="button" role="tab" aria-selected={!status} className={!status ? 'active' : ''} onClick={() => setStatus('')}>All <b>{all.length}</b></button>
                {STATUSES.map((s) => (
                    <button key={s} type="button" role="tab" aria-selected={status === s} className={status === s ? 'active' : ''} onClick={() => setStatus(s)}>
                        <i className={`dot ${s}`} />{humanize(s)} <b>{all.filter((u) => u.status === s).length}</b>
                    </button>
                ))}
            </div>
            <Filters>
                <SearchFilter value={search} onChange={setSearch} placeholder="Search unit code or customer" />
                <SelectFilter label="Facility" value={facilityId} onChange={setFacilityId} all="All facilities"
                    options={(facilities.data ?? []).map((f) => ({ value: f.facilityId, label: f.name }))} />
                <SelectFilter label="Size" value={size} onChange={setSize} options={sizes} all="All sizes" />
            </Filters>
            <div className={`sa-split${unit ? ' open' : ''}`}>
                <div className="se-card se-table-wrap">
                    <table className="se-table sa-table">
                        <thead><tr><th>Unit</th><th>Size</th><th>Floor</th><th>Price / mo</th><th>Status</th><th>Customer</th><th>Contract end</th></tr></thead>
                        <tbody>
                            {shown.map((u) => {
                                const c = contractOf[u.storageUnitId];
                                return (
                                    <tr key={u.storageUnitId} className={selected === u.storageUnitId ? 'active' : ''} onClick={() => setSelected(u.storageUnitId)}>
                                        <td className="strong">{u.unitCode}</td>
                                        <td>{u.unitTypeCode} · {u.areaM2} m²</td>
                                        <td>{u.floorName}{u.zone ? ` · ${u.zone}` : ''}</td>
                                        <td className="price">{formatVnd(u.currentPrice)}</td>
                                        <td><Status value={u.status} /></td>
                                        <td>{c?.customerName ?? '—'}</td>
                                        <td>{c ? formatDate(c.endDate) : '—'}</td>
                                    </tr>
                                );
                            })}
                            <TableState query={units} rows={shown} cols={7} empty="No units match." />
                        </tbody>
                    </table>
                </div>
                {unit && (
                    <aside className="se-panel sa-side-panel">
                        <div className="sa-card-title"><h2>Unit {unit.unitCode} <Status value={unit.status} /></h2>
                            <button type="button" className="sa-close" onClick={() => setSelected(null)} aria-label="Close"><Icon name="arrowLeft" size={16} /></button></div>
                        <dl className="se-kv">
                            <div><dt>Size</dt><dd>{unit.unitTypeName} · {unit.areaM2} m²</dd></div>
                            <div><dt>Floor / zone</dt><dd>{unit.floorName}{unit.zone ? ` · ${unit.zone}` : ''}</dd></div>
                            <div><dt>Monthly price</dt><dd>{formatVnd(unit.currentPrice)}</dd></div>
                            <div><dt>Customer</dt><dd>{contract?.customerName ?? '—'}</dd></div>
                            <div><dt>Contract</dt><dd>{contract ? `${contract.contractNumber} · ${humanize(contract.status)}` : '—'}</dd></div>
                            {contract && <div><dt>Period</dt><dd>{formatDate(contract.startDate)} → {formatDate(contract.endDate)}</dd></div>}
                        </dl>
                        {/* ponytail: no unit create/update endpoint yet; add the edit form once PUT /api/storage-units/{id} exists. */}
                        <NotWired>Editing units and adding new ones needs a storage-unit update endpoint on the backend.</NotWired>
                    </aside>
                )}
            </div>
        </>
    );
}
