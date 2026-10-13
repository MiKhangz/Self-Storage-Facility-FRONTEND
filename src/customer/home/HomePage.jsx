import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { facilitiesApi, unitTypesApi } from '../../api/generated';
import Icon from '../components/Icon.jsx';
import { todayIso } from '../components/format.js';
import './HomePage.css';

const SERVICES = [
    { icon: 'home', title: 'Household items', text: 'Furniture, appliances, seasonal things during a move or renovation.' },
    { icon: 'file', title: 'Documents & files', text: 'Archive boxes for companies, with shelving and log-in access.' },
    { icon: 'gem', title: 'Valuables', text: 'Collections and high-value items in monitored, insured units.' },
    { icon: 'thermo', title: 'Wine & climate', text: 'Temperature and humidity-controlled cabinets from 18–22 °C.' },
    { icon: 'luggage', title: 'Luggage', text: 'Short-term bag storage by the hour or day near the city center.' },
    { icon: 'briefcase', title: 'Business inventory', text: 'Stock for online shops and SMEs, with receiving support.' },
];

// ponytail: marketing copy straight from Figma U01; switch to unitTypesApi.quote once pricing data is seeded.
const SIZES = [
    { code: 'S', area: '2 m²', dims: '1.4 × 1.4 × 2.4 m', fits: 'A few boxes, a bike, suitcases', price: '890,000 ₫' },
    { code: 'M', area: '5 m²', dims: '2.0 × 2.5 × 2.4 m', fits: 'Contents of a studio apartment', price: '1,850,000 ₫' },
    { code: 'L', area: '10 m²', dims: '2.5 × 4.0 × 2.4 m', fits: 'A 2-bedroom apartment', price: '3,400,000 ₫' },
    { code: 'XL', area: '20 m²', dims: '4.0 × 5.0 × 2.4 m', fits: 'A house or small office', price: '6,200,000 ₫' },
];

const STEPS = [
    { icon: 'grid', title: '1. Choose a unit', text: 'Pick a facility, unit size, move-in date and rental period.' },
    { icon: 'card', title: '2. Reserve & pay', text: 'Pay the deposit and first month online by card, e-wallet or bank transfer.' },
    { icon: 'key', title: '3. Check in', text: 'Come at your appointment, staff hand over the unit, lock and access code.' },
    { icon: 'box', title: '4. Store & manage', text: 'Renew, pay, and send support requests from your account.' },
];

const LOCATIONS = [
    { name: 'Thu Duc – Vo Nguyen Giap', note: 'Headquarters · 320 units' },
    { name: 'Thu Duc – An Phu', note: 'Near Metro Line 1 · 140 units' },
    { name: 'District 1 – Tran Khac Chan', note: 'City center · 60 units' },
    { name: 'District 7 – Tran Trong Cung', note: 'Near Phu My Hung · 110 units' },
    { name: 'District 6 – Centre Mall', note: 'In-mall lockers · 80 units' },
];

const MAP_PINS = [[17, 28], [35, 44], [25, 65], [42, 73], [57, 33], [68, 62], [76, 25], [88, 55]];
const OCCUPIED = ['A-103', 'B-102', 'B-103'];

function SectionHead({ eyebrow, title, text, center }) {
    return (
        <div className={`se-section-head${center ? ' center' : ''}`}>
            <span className="se-eyebrow">{eyebrow}</span>
            <h2>{title}</h2>
            <p>{text}</p>
        </div>
    );
}

function QuickSearch() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ facilityId: '', unitTypeId: '', moveInDate: '', rentalMonths: '3' });
    const facilities = useQuery({ queryKey: ['facilities', { page: 1, pageSize: 50 }], queryFn: () => facilitiesApi.list({ page: 1, pageSize: 50 }) });
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
                <span>Location</span>
                <div className="se-field"><Icon name="pin" />
                    <select value={form.facilityId} onChange={set('facilityId')}>
                        <option value="">Select a facility</option>
                        {facilities.data?.items?.map((f) => <option key={f.facilityId} value={f.facilityId}>{f.name}</option>)}
                    </select>
                </div>
            </label>
            <label>
                <span>Unit size</span>
                <div className="se-field"><Icon name="box" />
                    <select value={form.unitTypeId} onChange={set('unitTypeId')}>
                        <option value="">Any size</option>
                        {unitTypes.data?.map((u) => <option key={u.unitTypeId} value={u.unitTypeId}>{u.name} · {u.areaM2} m²</option>)}
                    </select>
                </div>
            </label>
            <label>
                <span>Move-in date</span>
                <div className="se-field"><Icon name="calendar" />
                    <input type="date" value={form.moveInDate} min={todayIso()} onChange={set('moveInDate')} />
                </div>
            </label>
            <label>
                <span>Rental period</span>
                <div className="se-field"><Icon name="clock" />
                    <select value={form.rentalMonths} onChange={set('rentalMonths')}>
                        {[1, 3, 6, 12].map((m) => <option key={m} value={m}>{m} {m === 1 ? 'month' : 'months'}</option>)}
                    </select>
                </div>
            </label>
            <button type="submit" className="se-btn se-btn-primary se-btn-lg"><Icon name="search" /> Find available units</button>
        </form>
    );
}

export default function HomePage() {
    return (
        <div className="se-home">
            <section className="se-hero">
                <div className="se-container se-hero-grid">
                    <div>
                        <span className="se-hero-tag">Easy · Safe · Convenient</span>
                        <h1>Extra space for your home &amp; business</h1>
                        <p className="se-hero-lead">Secure, flexible self-storage units from 1 m² to 30 m². Rent by the month, access 24/7 with your own code, and manage everything online.</p>
                        <div className="se-hero-actions">
                            <Link to="/booking" className="se-btn se-btn-primary se-btn-lg">Book a unit now <Icon name="arrow" size={16} /></Link>
                            <Link to="/sizes" className="se-btn se-btn-outline se-btn-lg">See sizes &amp; prices</Link>
                        </div>
                        <dl className="se-hero-stats">
                            <div><dt>24/7</dt><dd>Self access</dd></div>
                            <div><dt>8</dt><dd>Locations in HCMC</dd></div>
                            <div><dt>4.9/5</dt><dd>From 600+ reviews</dd></div>
                        </dl>
                    </div>

                    <div className="se-hero-art" aria-hidden="true">
                        <div className="se-art-badge top"><Icon name="shield" size={16} /> CCTV · Fire alarm · Insured</div>
                        <div className="se-art-sign">STOREASE · SELF STORAGE</div>
                        <div className="se-art-units">
                            {['A-101', 'A-102', 'A-103', 'A-104', 'B-101', 'B-102', 'B-103', 'B-104'].map((u) => (
                                <div key={u} className={`se-art-unit${OCCUPIED.includes(u) ? ' busy' : ''}`}><span>{u}</span></div>
                            ))}
                        </div>
                        <div className="se-art-badge bottom">
                            <span className="se-art-lock"><Icon name="lock" size={18} /></span>
                            <div><strong>Unit B-103 unlocked</strong><small>Access code verified · 07:42</small></div>
                        </div>
                    </div>
                </div>
                <div className="se-container"><QuickSearch /></div>
            </section>

            <section id="services" className="se-section">
                <div className="se-container">
                    <SectionHead eyebrow="OUR SERVICES" title="What do you want to store?" text="From a few boxes to a whole office — pick the storage that fits your needs." />
                    <div className="se-services">
                        {SERVICES.map((s) => (
                            <article key={s.title} className="se-card se-service">
                                <span className="se-icon-tile"><Icon name={s.icon} size={20} /></span>
                                <h3>{s.title}</h3>
                                <p>{s.text}</p>
                                <Link to="/sizes" className="se-link">Learn more <Icon name="arrow" size={14} /></Link>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section className="se-section soft">
                <div className="se-container">
                    <SectionHead center eyebrow="COMPARE" title="Two ways to store" text="Choose full control with your own unit, or let us pick up and store your boxes on shelves." />
                    <div className="se-compare">
                        <article className="se-card se-plan featured">
                            <div className="se-plan-top"><h3>Self-storage unit</h3><span className="se-pill">Most popular</span></div>
                            <p>You keep the key. Private locked room with your own access code.</p>
                            <div className="se-plan-price">from 890,000 ₫ / month</div>
                            <ul className="se-checks">
                                {['24/7 access with personal code', 'Sizes from 1 m² to 30 m²', 'Your own lock, CCTV monitored', 'Monthly or long-term contracts'].map((t) => <li key={t}><Icon name="check" size={16} />{t}</li>)}
                            </ul>
                            <Link to="/booking" className="se-btn se-btn-primary se-btn-block">Book a self-storage unit</Link>
                        </article>
                        <article className="se-card se-plan">
                            <div className="se-plan-top"><h3>Shelf storage</h3></div>
                            <p>We collect, label and store your boxes on shared shelves.</p>
                            <div className="se-plan-price">from 99,000 ₫ / box / month</div>
                            <ul className="se-checks">
                                {['Free pick-up for 10+ boxes', 'Photo inventory of every box', 'Request delivery online', 'Pay only for what you store'].map((t) => <li key={t}><Icon name="check" size={16} />{t}</li>)}
                            </ul>
                            <Link to="/support/new" className="se-btn se-btn-outline se-btn-block">Request shelf storage</Link>
                        </article>
                    </div>
                </div>
            </section>

            <section className="se-section">
                <div className="se-container">
                    <SectionHead eyebrow="UNIT SIZES" title="Popular unit sizes" text="Not sure what fits? Each size shows what it can typically hold." />
                    <div className="se-sizes">
                        {SIZES.map((s) => (
                            <article key={s.code} className="se-card se-size">
                                <div className="se-size-top">
                                    <strong>{s.code}</strong>
                                    <div><span>{s.area}</span><small>{s.dims}</small></div>
                                </div>
                                <div className="se-size-body">
                                    <p>Fits: {s.fits}</p>
                                    <div className="se-size-price">{s.price} <small>/ month</small></div>
                                    <Link to="/booking" className="se-btn se-btn-outline se-btn-block">Book</Link>
                                </div>
                            </article>
                        ))}
                    </div>
                    <Link to="/sizes" className="se-link se-more">Compare all sizes &amp; prices <Icon name="arrow" size={16} /></Link>
                </div>
            </section>

            <section id="how-it-works" className="se-section soft">
                <div className="se-container">
                    <SectionHead center eyebrow="PROCESS" title="How it works" text="Rent a unit in 4 simple steps — fully online." />
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

            <section className="se-section">
                <div className="se-container">
                    <SectionHead eyebrow="LOCATIONS" title="8 locations across Ho Chi Minh City" text="Find a facility near your home or office." />
                    <div className="se-locations">
                        <div className="se-map" aria-hidden="true">
                            {MAP_PINS.map(([x, y], i) => (
                                <span key={i} className={`se-map-pin${i === 0 ? ' hq' : ''}`} style={{ left: `${x}%`, top: `${y}%` }}><Icon name="pin" size={14} /></span>
                            ))}
                        </div>
                        <div className="se-location-list">
                            {LOCATIONS.map((l, i) => (
                                <Link key={l.name} to="/locations" className={`se-location${i === 0 ? ' active' : ''}`}>
                                    <span className="se-icon-tile sm"><Icon name="building" size={16} /></span>
                                    <span className="se-location-text"><strong>{l.name}</strong><small>{l.note}</small></span>
                                    <Icon name="arrow" size={16} className="se-location-arrow" />
                                </Link>
                            ))}
                            <Link to="/locations" className="se-btn se-btn-outline se-btn-block">View all 8 locations</Link>
                        </div>
                    </div>
                </div>
            </section>

            <section className="se-cta">
                <div className="se-container se-cta-row">
                    <div>
                        <h2>Not sure how much space you need?</h2>
                        <p>Tell us what you want to store — we will suggest the right size and a free quote.</p>
                    </div>
                    <div className="se-cta-actions">
                        <Link to="/support/new" className="se-btn se-btn-amber">Get a free quote</Link>
                        <Link to="/register" className="se-btn se-btn-white">Create an account</Link>
                    </div>
                </div>
            </section>
        </div>
    );
}
