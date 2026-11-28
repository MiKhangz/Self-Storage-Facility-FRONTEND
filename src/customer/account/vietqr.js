// Pure browser-side EMVCo / NAPAS 247 VietQR payload builder (matches Rust `vietqr` crate).
// Default demo account from user's TPBank VietQR card (overridable via VITE_BANK_* env vars).

export const DEMO_RECEIVER_BANK = {
    bankName: import.meta.env.VITE_BANK_NAME || 'TPBank',
    bankBin: import.meta.env.VITE_BANK_BIN || '970423',
    accountNo: (import.meta.env.VITE_BANK_ACCOUNT_NO || '00000285636').replace(/\s+/g, ''),
    accountDisplay: import.meta.env.VITE_BANK_ACCOUNT_DISPLAY || '0000 0285 636',
    accountName: import.meta.env.VITE_BANK_ACCOUNT_NAME || 'BUI DUC THIEN',
};

export function crc16CcittFalse(str) {
    let crc = 0xffff;
    for (let i = 0; i < str.length; i++) {
        crc ^= (str.charCodeAt(i) & 0xff) << 8;
        for (let bit = 0; bit < 8; bit++) {
            if ((crc & 0x8000) !== 0) {
                crc = ((crc << 1) ^ 0x1021) & 0xffff;
            } else {
                crc = (crc << 1) & 0xffff;
            }
        }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
}

function tlv(tag, val) {
    const s = String(val);
    return `${tag}${String(s.length).padStart(2, '0')}${s}`;
}

export function normalizeVietQrCode(raw = '') {
    return String(raw)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/gi, 'd')
        .replace(/[^A-Za-z0-9]/g, '')
        .toUpperCase();
}

export function buildVietQrReference(rawCode = '', keyword = 'PAY', maxLen = 23) {
    const code = normalizeVietQrCode(rawCode);
    const kw = normalizeVietQrCode(keyword);
    const full = kw ? `${code} ${kw}` : code;
    return full.slice(0, maxLen).trim();
}

export function buildVietQrPayload({
    bin = DEMO_RECEIVER_BANK.bankBin,
    accountNo = DEMO_RECEIVER_BANK.accountNo,
    amountVnd,
    reference,
}) {
    const cleanBin = String(bin).trim();
    const cleanAcc = String(accountNo).replace(/\s+/g, '');
    const amt = Math.max(Math.round(Number(amountVnd) || 0), 1);
    const desc = String(reference || 'STOREASE PAY').slice(0, 23).trim();

    const beneficiary = `${tlv('00', cleanBin)}${tlv('01', cleanAcc)}`;
    const merchantInfo = `${tlv('00', 'A000000727')}${tlv('01', beneficiary)}${tlv('02', 'QRIBFTTA')}`;
    const additionalData = tlv('08', desc);

    const body = [
        tlv('00', '01'),
        tlv('01', '12'),
        tlv('38', merchantInfo),
        tlv('53', '704'),
        tlv('54', String(amt)),
        tlv('58', 'VN'),
        tlv('62', additionalData),
        '6304',
    ].join('');

    return `${body}${crc16CcittFalse(body)}`;
}

export function vietQrImageUrl({
    bin = DEMO_RECEIVER_BANK.bankBin,
    accountNo = DEMO_RECEIVER_BANK.accountNo,
    accountName = DEMO_RECEIVER_BANK.accountName,
    amountVnd,
    reference,
}) {
    const amt = Math.max(Math.round(Number(amountVnd) || 0), 0);
    const params = new URLSearchParams({
        amount: String(amt),
        addInfo: reference,
        accountName,
    });
    return `https://img.vietqr.io/image/${bin}-${accountNo}-compact.png?${params.toString()}`;
}
