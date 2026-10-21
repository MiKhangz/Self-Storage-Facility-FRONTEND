// Isolated browser test fixture. No requests are sent to the real backend.
// Not referenced by index.html and not included in the production build.
import React from 'react';
import { createRoot } from 'react-dom/client';
import PricingPage from '../src/admin/pricing/PricingPage.jsx';
const mode = new URLSearchParams(location.search).get('state');
let units = mode === 'empty' ? [] : ['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((code, i) => ({ unitTypeId: i + 1, code, name: `${code} storage`, areaM2: [1, 2, 5, 10, 20, 30][i], width: 1 + i, depth: 1 + i, height: 2, isClimateControlled: false }));
let policies = mode === 'empty' ? [] : [{ pricingPolicyId: 1, version: 1, effectiveFrom: '2026-10-14', effectiveTo: null,
  depositMonths: 1, graceDays: 3, noticeDays: 30, lateFeePercentPerWeek: 5, suspendAfterDays: 7, clearOutAfterDays: 60,
  cancelFreeHours: 48, status: 'Draft', unitPrices: units.map((u, i) => ({ unitTypeId: u.unitTypeId, basePricePerMonth: [490000, 890000, 1950000, 3400000, 6200000, 8900000][i], discount3Month: 5, discount6Month: 10, discount12Month: 10 })),
  fees: [{ code: 'LOST_KEY', name: 'Lost key / card', amount: 300000, isPercentage: false, chargeWhen: 'LostKey', ruleDescription: 'Once per replacement.' }] }];
window.fetch = async (url, options = {}) => {
  if (mode === 'loading') return new Promise(() => {});
  const answer = (data, status = 200) => Promise.resolve(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }));
  if (mode === 'error') return answer({ title: 'Preview: service unavailable. Retry when the server is running.' }, 503);
  const body = options.body ? JSON.parse(options.body) : null;
  if (url === '/api/unit-types' && options.method === 'POST') { const unit = { ...body, unitTypeId: Math.max(0, ...units.map(u => u.unitTypeId)) + 1 }; units.push(unit); return answer(unit); }
  if (url === '/api/unit-types') return answer(units);
  if (url.startsWith('/api/unit-types/')) {
    const id = Number(url.split('/').pop());
    if (options.method === 'DELETE') units = units.filter(u => u.unitTypeId !== id);
    else units = units.map(u => u.unitTypeId === id ? { ...body, unitTypeId: id } : u);
    return answer(null);
  }
  if (url === '/api/pricing-policies' && options.method === 'POST') {
    const id = policies.length + 1; const policy = { ...body, pricingPolicyId: id, version: id, status: 'Draft', unitPrices: [], fees: [] };
    policies.unshift(policy); return answer(policy);
  }
  if (url.startsWith('/api/pricing-policies?')) return answer({ items: policies, totalPages: 1 });
  const id = Number(url.split('/')[3]); const p = policies.find(p => p.pricingPolicyId === id);
  if (url.endsWith('/activate')) { policies.forEach(p => { if (p.status === 'Active') p.status = 'Superseded'; }); p.status = 'Active'; }
  else if (options.method === 'PUT') Object.assign(p, body.settings, { unitPrices: body.unitPrices, fees: body.fees });
  return answer(p);
};
createRoot(document.getElementById('root')).render(<><div style={{ padding: 8, background: '#fff3cd', font: '12px system-ui' }}>Isolated UI test fixture — sample data, no database writes.</div><PricingPage user={{ role: 'SystemAdministrator' }} /></>);
