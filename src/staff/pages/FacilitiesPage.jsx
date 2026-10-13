import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../customer/components/Icon.jsx';
import { PageHeader, SearchFilter, SelectFilter, Filters, Stat, TableState, matches } from '../components/ui.jsx';
import { useFacilities, useUnits } from '../queries.js';
import { occupancy } from './DashboardPage.jsx';

/** A03: every facility with its size and how full it is. */
export default function FacilitiesPage() {
    const [search, setSearch] = useState('');
    const [district, setDistrict] = useState('');
    const facilities = useFacilities();
    const units = useUnits();
    const all = facilities.data ?? [];
    const allUnits = units.data ?? [];
    const districts = [...new Set(all.map((f) => f.district).filter(Boolean))];
    const shown = all.filter((f) => matches(search, f.name, f.address, f.code) && (!district || f.district === district));

    return (
        <>
            <PageHeader title="Facilities" subtitle={`${all.length} facilities · ${allUnits.length} storage units`}>
                <Link to="/admin/facilities/new" className="se-btn se-btn-primary"><Icon name="building" size={16} /> Add facility</Link>
            </PageHeader>
            <div className="sa-stats">
                <Stat icon="building" label="Facilities" value={all.length} />
                <Stat icon="grid" label="Total units" value={allUnits.length} note={`${allUnits.filter((u) => u.status === 'Available').length} available`} />
                <Stat icon="box" label="Occupied units" value={allUnits.filter((u) => u.status === 'Occupied').length} />
                <Stat icon="grid" label="Avg. occupancy" value={`${occupancy(allUnits)}%`} />
            </div>
            <Filters>
                <SearchFilter value={search} onChange={setSearch} placeholder="Search facility name or address" />
                <SelectFilter label="District" value={district} onChange={setDistrict} options={districts} all="All districts" />
            </Filters>
            <div className="se-card se-table-wrap">
                <table className="se-table sa-table">
                    <thead><tr><th>Facility</th><th>Address</th><th>Units</th><th>Occupancy</th><th>Available</th><th>Hours</th><th /></tr></thead>
                    <tbody>
                        {shown.map((f) => {
                            const mine = allUnits.filter((u) => u.facilityId === f.facilityId);
                            const pct = occupancy(mine);
                            return (
                                <tr key={f.facilityId}>
                                    <td className="strong"><Link to={`/admin/facilities/${f.facilityId}`}>{f.name}</Link><div className="sa-muted">{f.code}</div></td>
                                    <td>{f.address}{f.district ? `, ${f.district}` : ''}</td>
                                    <td>{mine.length}</td>
                                    <td><div className="sa-inline-bar"><div className="se-progress flat"><span style={{ width: `${pct}%` }} className={pct >= 90 ? 'hot' : ''} /></div>{pct}%</div></td>
                                    <td>{f.availableUnits}</td>
                                    <td><span className="se-badge">{f.openingHours || '—'}</span></td>
                                    <td><Link to={`/admin/facilities/${f.facilityId}`} className="se-btn se-btn-ghost se-btn-sm">View</Link></td>
                                </tr>
                            );
                        })}
                        <TableState query={facilities} rows={shown} cols={7} empty="No facilities match." />
                    </tbody>
                </table>
            </div>
        </>
    );
}
