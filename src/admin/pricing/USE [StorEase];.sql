USE [StorEase];
SELECT p.PricingPolicyId, p.Version, p.Status, p.EffectiveFrom, p.EffectiveTo, ut.Code AS UnitType, up.BasePricePerMonth
FROM dbo.PricingPolicy p
LEFT JOIN dbo.UnitPrice up ON up.PricingPolicyId = p.PricingPolicyId
LEFT JOIN dbo.UnitType ut ON ut.UnitTypeId = up.UnitTypeId
ORDER BY p.Version DESC, ut.Code;