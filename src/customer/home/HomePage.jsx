import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { unitTypesApi } from '../../api/generated';
import Icon from '../components/Icon.jsx';
import { formatVnd, todayIso } from '../components/format.js';
import { useFacilities } from '../sizes/SizesPage.jsx';
import './HomePage.css';

// Only what a locked self-storage unit is really used for; no services StorEase does not offer.
const SERVICES = [
    { icon: 'home', title: 'Đồ đạc khi chuyển nhà', text: 'Nội thất, đồ điện gia dụng, đồ theo mùa trong lúc chuyển nhà hoặc sửa nhà.' },
    { icon: 'file', title: 'Hồ sơ, tài liệu', text: 'Thùng hồ sơ của công ty hoặc gia đình, cất gọn trong kho có khóa riêng.' },
    { icon: 'briefcase', title: 'Hàng hóa kinh doanh', text: 'Hàng tồn của shop online và doanh nghiệp nhỏ, lấy ra khi cần.' },
];

const STEPS = [
    { icon: 'grid', title: '1. Chọn kho', text: 'Chọn cơ sở, kích thước, ngày nhận kho và thời hạn thuê.' },
    { icon: 'card', title: '2. Đặt kho và đóng cọc', text: 'Đặt kho trên trang web, rồi thanh toán tiền cọc trực tuyến trước ngày nhận kho.' },
    { icon: 'key', title: '3. Nhận kho', text: 'Đến cơ sở vào ngày hẹn. Nhân viên bàn giao kho, ổ khóa và mã ra vào cho bạn.' },
    { icon: 'box', title: '4. Cất đồ và quản lý', text: 'Gia hạn, thanh toán và gửi yêu cầu hỗ trợ ngay trong tài khoản.' },
];

const MAP_PINS = [[17, 28], [35, 44], [25, 65], [42, 73], [57, 33], [68, 62], [76, 25], [88, 55]];
const OCCUPIED = ['A-103', 'B-102', 'B-103'];
const formatArea = (n) => n.toLocaleString('vi-VN');

function SectionHead({ title, text, center }) {
    return (
        <div className={`se-section-head${center ? ' center' : ''}`}>
            <h2>{title}</h2>
            <p>{text}</p>
        </div>
    );
}

function QuickSearch() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ facilityId: '', unitTypeId: '', moveInDate: '', rentalMonths: '3' });
    const facilities = useFacilities();
    const unitTypes = useQuery({ queryKey: ['unit-types'], queryFn: () => unitTypesApi.list() });
    const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

    const submit = (e) => {
        e.preventDefault();
        const params = new URLSearchParams(Object.entries(form).filter(([, v]) => v));
        navigate(`/booking?${params}`);
    };

    return (
        <form className="se-search" onSubmit={submit}>
            <label>
                <span>Cơ sở</span>
                <div className="se-field"><Icon name="pin" />
                    <select value={form.facilityId} onChange={set('facilityId')}>
                        <option value="">{facilities.isError ? 'Không tải được danh sách cơ sở' : 'Chọn cơ sở'}</option>
                        {facilities.data?.items?.map((f) => <option key={f.facilityId} value={f.facilityId}>{f.name}</option>)}
                    </select>
                </div>
            </label>
            <label>
                <span>Kích thước</span>
                <div className="se-field"><Icon name="box" />
                    <select value={form.unitTypeId} onChange={set('unitTypeId')}>
                        <option value="">Mọi kích thước</option>
                        {unitTypes.data?.map((u) => <option key={u.unitTypeId} value={u.unitTypeId}>{u.code} · {formatArea(u.areaM2)} m²</option>)}
                    </select>
                </div>
            </label>
            <label>
                <span>Ngày nhận kho</span>
                <div className="se-field"><Icon name="calendar" />
                    <input type="date" value={form.moveInDate} min={todayIso()} onChange={set('moveInDate')} />
                </div>
            </label>
            <label>
                <span>Thời hạn thuê</span>
                <div className="se-field"><Icon name="clock" />
                    <select value={form.rentalMonths} onChange={set('rentalMonths')}>
                        {[1, 3, 6, 12].map((m) => <option key={m} value={m}>{m} tháng</option>)}
                    </select>
                </div>
            </label>
            <button type="submit" className="se-btn se-btn-outline se-btn-lg"><Icon name="search" /> Tìm kho trống</button>
        </form>
    );
}

export default function HomePage() {
    const facilities = useFacilities();
    const locations = facilities.data?.items ?? [];
    const unitTypes = useQuery({ queryKey: ['unit-types'], queryFn: () => unitTypesApi.list() });
    const allTypes = [...(unitTypes.data ?? [])].sort((a, b) => a.areaM2 - b.areaM2);
    const types = allTypes.slice(0, 4);
    // ponytail: prices are the 1-month quote at the first facility only; quote the customer's chosen facility once there are several.
    const quote = { facilityId: locations[0]?.facilityId, moveInDate: todayIso(), rentalMonths: 1 };
    const quotes = useQueries({
        queries: types.map((t) => ({
            queryKey: ['quote', { unitTypeId: t.unitTypeId, ...quote }],
            queryFn: () => unitTypesApi.quote(t.unitTypeId, quote),
            enabled: !!quote.facilityId,
        })),
    });
    const sizes = types.map((t, i) => ({
        ...t,
        price: quotes[i].data?.monthlyRent,
        // The type name is often just the area, which the card header already shows.
        note: [t.name !== `${t.areaM2} m²` && t.name, t.isClimateControlled && 'Có điều hòa nhiệt độ'].filter(Boolean).join(' · '),
    }));

    // Hero figures come from the API, never from copy (PRODUCT.md: no invented stats).
    const prices = sizes.map((s) => s.price).filter((p) => p != null);
    const freeUnits = locations.reduce((sum, f) => sum + (f.availableUnits ?? 0), 0);
    const areaRange = allTypes.length
        ? `${formatArea(allTypes[0].areaM2)}${allTypes.length > 1 ? ` đến ${formatArea(allTypes.at(-1).areaM2)}` : ''} m²`
        : null;

    return (
        <div className="se-home">
            <section className="se-hero">
                <div className="se-container se-hero-grid">
                    <div>
                        <h1>Thêm chỗ chứa đồ cho gia đình và công việc của bạn</h1>
                        <p className="se-hero-lead">
                            Kho tự quản có khóa riêng tại TP. Hồ Chí Minh{areaRange ? `, diện tích từ ${areaRange}` : ''}. Thuê theo tháng, ra vào bằng mã cá nhân và quản lý mọi thứ trực tuyến.
                        </p>
                        <div className="se-hero-actions">
                            <Link to="/booking" className="se-btn se-btn-primary se-btn-lg">Đặt kho ngay <Icon name="arrow" size={16} /></Link>
                            <Link to="/sizes" className="se-btn se-btn-outline se-btn-lg">Xem kích thước và giá</Link>
                        </div>
                        {!!locations.length && (
                            <dl className="se-hero-stats">
                                <div><dt>{locations.length}</dt><dd>cơ sở đang hoạt động</dd></div>
                                <div><dt>{freeUnits}</dt><dd>kho đang trống</dd></div>
                                {!!prices.length && <div><dt>{formatVnd(Math.min(...prices))}</dt><dd>giá thuê thấp nhất / tháng</dd></div>}
                            </dl>
                        )}
                    </div>

                    <div className="se-hero-art" aria-hidden="true">
                        <div className="se-art-badge top"><Icon name="shield" size={16} /> Mã ra vào riêng cho mỗi kho</div>
                        <div className="se-art-sign">STOREASE · KHO TỰ QUẢN</div>
                        <div className="se-art-units">
                            {['A-101', 'A-102', 'A-103', 'A-104', 'B-101', 'B-102', 'B-103', 'B-104'].map((u) => (
                                <div key={u} className={`se-art-unit${OCCUPIED.includes(u) ? ' busy' : ''}`}><span>{u}</span></div>
                            ))}
                        </div>
                        <div className="se-art-badge bottom">
                            <span className="se-art-lock"><Icon name="lock" size={18} /></span>
                            <div><strong>Đã mở kho B-103</strong><small>Mã ra vào hợp lệ · 07:42</small></div>
                        </div>
                    </div>
                </div>
                <div className="se-container"><QuickSearch /></div>
            </section>

            <section id="services" className="se-section">
                <div className="se-container">
                    <SectionHead title="Bạn cần cất gì?" text="Từ vài thùng đồ đến cả kho hàng: chọn kích thước vừa với nhu cầu của bạn." />
                    <div className="se-services">
                        {SERVICES.map((s) => (
                            <article key={s.title} className="se-card se-service">
                                <span className="se-icon-tile"><Icon name={s.icon} size={20} /></span>
                                <h3>{s.title}</h3>
                                <p>{s.text}</p>
                                <Link to="/sizes" className="se-link">Xem kích thước phù hợp <Icon name="arrow" size={14} /></Link>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section className="se-section soft">
                <div className="se-container">
                    <SectionHead title="Các cỡ kho"
                        text={locations[0] ? `Giá thuê 1 tháng tại ${locations[0].name}.` : 'So sánh các cỡ kho bên dưới.'} />
                    <div className="se-sizes">
                        {sizes.map((s) => (
                            <article key={s.unitTypeId} className="se-card se-size">
                                <div className="se-size-top">
                                    <strong>{s.code}</strong>
                                    <div><span>{formatArea(s.areaM2)} m²</span><small>{formatArea(s.width)} × {formatArea(s.depth)} × {formatArea(s.height)} m</small></div>
                                </div>
                                <div className="se-size-body">
                                    {s.note && <p>{s.note}</p>}
                                    {s.price != null
                                        ? <div className="se-size-price">{formatVnd(s.price)} <small>/ tháng</small></div>
                                        : <p className="se-size-noprice">Chưa có giá cho cơ sở này. Xem giá ở bước đặt kho.</p>}
                                    <Link to={`/booking?unitTypeId=${s.unitTypeId}`} className="se-btn se-btn-outline se-btn-block">Đặt kho {s.code}</Link>
                                </div>
                            </article>
                        ))}
                        {!sizes.length && (
                            <p className="se-hint">
                                {unitTypes.isLoading ? 'Đang tải các cỡ kho…'
                                    : unitTypes.isError ? 'Không tải được các cỡ kho. Vui lòng tải lại trang.'
                                        : 'Hiện chưa có cỡ kho nào để thuê.'}
                            </p>
                        )}
                    </div>
                    <Link to="/sizes" className="se-link se-more">So sánh tất cả kích thước và giá <Icon name="arrow" size={16} /></Link>
                </div>
            </section>

            <section id="how-it-works" className="se-section">
                <div className="se-container">
                    <SectionHead center title="Cách thuê kho" text="Thuê kho trong 4 bước, ngay trên trang web." />
                    <div className="se-steps">
                        {STEPS.map((s) => (
                            <article key={s.title} className="se-card se-step">
                                <span className="se-step-icon"><Icon name={s.icon} size={22} /></span>
                                <h3>{s.title}</h3>
                                <p>{s.text}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section className="se-section soft">
                <div className="se-container">
                    <SectionHead title={locations.length ? `${locations.length} cơ sở tại TP. Hồ Chí Minh` : 'Các cơ sở của StorEase'}
                        text="Tìm cơ sở gần nhà hoặc gần nơi làm việc của bạn." />
                    <div className="se-locations">
                        <div className="se-map" aria-hidden="true">
                            {MAP_PINS.slice(0, Math.max(locations.length, 1)).map(([x, y], i) => (
                                <span key={i} className={`se-map-pin${i === 0 ? ' hq' : ''}`} style={{ left: `${x}%`, top: `${y}%` }}><Icon name="pin" size={14} /></span>
                            ))}
                        </div>
                        <div className="se-location-list">
                            {locations.slice(0, 5).map((l, i) => (
                                <Link key={l.facilityId} to={`/booking?facilityId=${l.facilityId}`} className={`se-location${i === 0 ? ' active' : ''}`}>
                                    <span className="se-icon-tile sm"><Icon name="building" size={16} /></span>
                                    <span className="se-location-text"><strong>{l.name}</strong><small>{[l.district, `${l.availableUnits} kho trống`].filter(Boolean).join(' · ')}</small></span>
                                    <Icon name="arrow" size={16} className="se-location-arrow" />
                                </Link>
                            ))}
                            {!locations.length && (
                                <p className="se-hint">
                                    {facilities.isLoading ? 'Đang tải danh sách cơ sở…'
                                        : facilities.isError ? 'Không tải được danh sách cơ sở. Vui lòng tải lại trang.'
                                            : 'Hiện chưa có cơ sở nào mở cửa.'}
                                </p>
                            )}
                            <Link to="/locations" className="se-btn se-btn-outline se-btn-block">Xem tất cả cơ sở</Link>
                        </div>
                    </div>
                </div>
            </section>

            <section className="se-cta">
                <div className="se-container se-cta-row">
                    <div>
                        <h2>Chưa biết cần kho cỡ nào?</h2>
                        <p>Cho chúng tôi biết bạn muốn cất những gì, nhân viên sẽ gợi ý cỡ kho phù hợp.</p>
                    </div>
                    <div className="se-cta-actions">
                        <Link to="/support/new" className="se-btn se-btn-white">Gửi yêu cầu tư vấn</Link>
                        <Link to="/register" className="se-btn se-btn-on-dark">Tạo tài khoản</Link>
                    </div>
                </div>
            </section>
        </div>
    );
}
