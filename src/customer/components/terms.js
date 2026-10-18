import { useQuery } from '@tanstack/react-query';
import { pricingPoliciesApi } from '../../api/generated';

/** The rental terms in force today: the same rules the backend enforces, so the site never promises others. */
export const useTerms = () => useQuery({ queryKey: ['terms'], queryFn: () => pricingPoliciesApi.currentTerms(), staleTime: 10 * 60_000 });

/** Percent off for a stay of `months` (the 3 / 6 / 12-month tier it reaches); the largest across sizes when no size is given. */
export function discountFor(terms, months, unitTypeId) {
    const key = months >= 12 ? 'discount12Month' : months >= 6 ? 'discount6Month' : months >= 3 ? 'discount3Month' : null;
    const rows = (terms?.discounts ?? []).filter((d) => unitTypeId == null || d.unitTypeId === unitTypeId);
    return key ? Math.max(0, ...rows.map((d) => d[key] ?? 0)) : 0;
}

/** "−5%" for a period chip, or undefined when that period has no discount. */
export function discountLabel(terms, months, unitTypeId) {
    const percent = discountFor(terms, months, unitTypeId);
    return percent > 0 ? `−${percent}%` : undefined;
}

/** The early-return rule (SR-04): no notice needed; before the contract's end date a share of the deposit is kept. */
export const earlyReturnText = (t) =>
    `Có thể trả kho bất cứ lúc nào, không cần báo trước${t.earlyTerminationPercent > 0 ? `; trả trước ngày hết hạn hợp đồng sẽ bị giữ lại ${t.earlyTerminationPercent}% tiền cọc` : ''}.`;

/** One sentence for the late-fee rule, shared by the sizes page and the rental agreement. */
export const lateFeeText = (t) =>
    `Phí trễ hạn: ${t.lateFeePercentPerWeek}% tiền thuê cho mỗi tuần trễ trọn vẹn, sau ${t.graceDays} ngày ân hạn. Quyền ra vào bị tạm khóa khi trễ hạn quá ${t.suspendAfterDays} ngày.`;
