import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { facilitiesApi, unitTypesApi } from '../../api/generated';
import Icon from '../components/Icon.jsx';
import PageHead from '../components/PageHead.jsx';
import { availability, formatVnd, todayIso } from '../components/format.js';
import { discountFor, lateFeeText, useTerms } from '../components/terms.js';
import './SizesPage.css';

// Shelf storage is not a StorEase service, so only the real unit filters remain.
const TABS = [{ key: 'all', label: 'Tất cả' }, { key: 'climate', label: 'Có điều hòa' }];
// The three price columns in Figma: 1–2 months, 3–5 months, 6+ months.
const TIERS = [1, 3, 6];
const PERIODS = [1, 3, 6, 12];

/** The four policy cards, worded from the terms the backend enforces. */
function feeCards(t) {
    const months = (n) => `${n} tháng`;
    const tiers = [3, 6, 12].map((m) => [m, discountFor(t, m)]).filter(([, p]) => p > 0);
    return [
        { icon: 'shield', title: 'Tiền cọc', text: `Bằng ${months(t.depositMonths)} tiền thuê. Được hoàn lại sau khi trả kho trong tình trạng tốt, trừ các khoản phí phát sinh.` },
        { icon: 'calendar', title: 'Trả kho', text: `Báo trước ${t.noticeDays} ngày khi muốn trả kho. Nhân viên sẽ cùng bạn kiểm tra kho.` },
        { icon: 'clock', title: 'Phí trễ hạn', text: lateFeeText(t) },
        { icon: 'card', title: 'Giảm giá thuê dài hạn', text: tiers.length ? tiers.map(([m, p]) => `−${p}% khi thuê từ ${months(m)}`).join(', ') + '.' : 'Hiện chưa có giảm giá cho thuê dài hạn.' },
    ];
}

const tierFor = (months) => (months >= 6 ? 6 : months >= 3 ? 3 : 1);

export function useFacilities() {
    return useQuery({ queryKey: ['facilities', { page: 1, pageSize: 50 }], queryFn: () => facilitiesApi.list({ page: 1, pageSize: 50 }) });
}

/** Monthly rent per tier and free-unit count for every unit type at one facility. */
function useTypeRows(types, facilityId) {
    const moveInDate = todayIso();
    const enabled = !!facilityId;
    const quotes = useQueries({
        queries: types.flatMap((t) => TIERS.map((rentalMonths) => ({
            queryKey: ['quote', { unitTypeId: t.unitTypeId, facilityId, moveInDate, rentalMonths }],
            queryFn: () => unitTypesApi.quote(t.unitTypeId, { facilityId, moveInDate, rentalMonths }),
            enabled,
        }))),
    });
    const stock = useQueries({
        queries: types.map((t) => ({
            queryKey: ['availability', { unitTypeId: t.unitTypeId, facilityId, moveInDate }],
            queryFn: () => unitTypesApi.availability(t.unitTypeId, { facilityId, moveInDate }),
            enabled,
        })),
    });
    return types.map((t, i) => ({
        ...t,
        prices: TIERS.map((_, j) => quotes[i * TIERS.length + j].data?.monthlyRent),
        free: stock[i].data?.availableUnits,
    }));
}

function SizeArt({ area, max }) {
    // Box edge grows with the square root of the area so a 30 m² unit is not 30× wider than 1 m².
    const edge = 24 + 86 * Math.sqrt(area / max);
    return (
        <div className="se-size-art" aria-hidden="true">
            <span className="se-size-box" style={{ width: edge, height: edge * 0.85 }} />
            <span className="se-size-person" />
        </div>
    );
}

const PRICE_LABELS = ['Giá 1–2 tháng', 'Giá 3–5 tháng', 'Giá từ 6 tháng'];

export default function SizesPage() {
    const [tab, setTab] = useState('all');
    const [facilityId, setFacilityId] = useState('');
    const [months, setMonths] = useState(3);
    const [selected, setSelected] = useState(null);

    const facilities = useFacilities();
    const unitTypes = useQuery({ queryKey: ['unit-types'], queryFn: () => unitTypesApi.list() });
    const activeFacility = Number(facilityId) || facilities.data?.items?.[0]?.facilityId;

    const types = (unitTypes.data ?? [])
        .filter((t) => tab !== 'climate' || t.isClimateControlled)
        .sort((a, b) => a.areaM2 - b.areaM2);
    const rows = useTypeRows(types, activeFacility);
    const maxArea = Math.max(...types.map((t) => t.areaM2), 1);
    const highlight = tierFor(months);
    const terms = useTerms();
    const bookLink = (t) => `/booking?facilityId=${activeFacility}&unitTypeId=${t.unitTypeId}&rentalMonths=${months}`;

    return (
        <>
            <PageHead crumb="Kích thước và giá" title="Kích thước và giá thuê">
                Giá thuê theo tháng, lấy từ bảng giá đang áp dụng. Thuê càng lâu càng được giảm giá.
            </PageHead>

            <section className="se-section se-sizes-page">
                <div className="se-container">
                    <div className="se-sizes-toolbar">
                        <div className="se-tabs" role="tablist">
                            {TABS.map((t) => (
                                <button key={t.key} role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>{t.label}</button>
                            ))}
                        </div>
                        <div className="se-sizes-filters">
                            <label><span>Cơ sở</span>
                                <div className="se-field"><Icon name="pin" />
                                    <select value={activeFacility ?? ''} onChange={(e) => setFacilityId(e.target.value)}>
                                        {facilities.data?.items?.map((f) => <option key={f.facilityId} value={f.facilityId}>{f.name}</option>)}
                                    </select>
                                </div>
                            </label>
                            <label><span>Thời hạn thuê</span>
                                <div className="se-field"><Icon name="clock" />
                                    <select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
                                        {PERIODS.map((m) => <option key={m} value={m}>{m} tháng</option>)}
                                    </select>
                                </div>
                            </label>
                        </div>
                    </div>

                    {unitTypes.isError || facilities.isError ? (
                        <div className="se-card se-empty">Không tải được bảng giá. Vui lòng tải lại trang sau ít phút.</div>
                    ) : (
                        <>
                            <div className="se-size-picker">
                                {types.map((t) => (
                                    <button key={t.unitTypeId} className={`se-card se-size-pick${selected === t.unitTypeId ? ' active' : ''}`} onClick={() => setSelected(t.unitTypeId)}>
                                        <SizeArt area={t.areaM2} max={maxArea} />
                                        <strong>{t.code}</strong>
                                        <span>{t.areaM2.toLocaleString('vi-VN')} m²</span>
                                    </button>
                                ))}
                            </div>
                            <p className="se-hint">Hình người cao 1,7 m để so sánh kích thước.</p>

                            <div className="se-card se-table-wrap">
                                <table className="se-table se-stack">
                                    <thead>
                                        <tr>
                                            <th>Cỡ</th><th>Diện tích</th><th>Kích thước (R×S×C)</th><th>Loại kho</th>
                                            <th className={highlight === 1 ? 'hl' : ''}>1–2 tháng</th>
                                            <th className={highlight === 3 ? 'hl' : ''}>3–5 tháng</th>
                                            <th className={highlight === 6 ? 'hl' : ''}>Từ 6 tháng</th>
                                            <th>Tình trạng</th><th><span className="sr-only">Thao tác</span></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((t) => {
                                            const badge = availability(t.free);
                                            return (
                                                <tr key={t.unitTypeId} className={selected === t.unitTypeId ? 'active' : ''} onClick={() => setSelected(t.unitTypeId)}>
                                                    <td className="strong se-stack-title">{t.code}</td>
                                                    <td data-label="Diện tích">{t.areaM2.toLocaleString('vi-VN')} m²</td>
                                                    <td className="muted" data-label="Kích thước">{[t.width, t.depth, t.height].map((n) => n.toLocaleString('vi-VN')).join(' × ')} m</td>
                                                    <td data-label="Loại kho">{t.name}</td>
                                                    {t.prices.map((p, i) => <td key={i} data-label={PRICE_LABELS[i]} className={`price${TIERS[i] === highlight ? ' hl' : ''}`}>{formatVnd(p)}</td>)}
                                                    <td data-label="Tình trạng">{badge && <span className={`se-badge ${badge.tone}`}>{badge.label}</span>}</td>
                                                    <td className="se-stack-action">
                                                        {t.free === 0
                                                            ? <Link to="/support/new" className="se-btn se-btn-ghost se-btn-sm">Hỏi khi có kho trống</Link>
                                                            : <Link to={bookLink(t)} className="se-btn se-btn-outline se-btn-sm">Đặt kho</Link>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {!rows.length && <tr><td colSpan={9} className="se-empty">{unitTypes.isLoading ? 'Đang tải các cỡ kho…' : tab === 'climate' ? 'Hiện chưa có kho có điều hòa.' : 'Hiện chưa có cỡ kho nào để thuê.'}</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                    <h2 className="se-sizes-sub">Phí và quy định</h2>
                    <div className="se-fees">
                        {terms.data && feeCards(terms.data).map((f) => (
                            <article key={f.title} className="se-card se-fee">
                                <span className="se-icon-tile sm"><Icon name={f.icon} size={16} /></span>
                                <h3>{f.title}</h3>
                                <p>{f.text}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>
        </>
    );
}
