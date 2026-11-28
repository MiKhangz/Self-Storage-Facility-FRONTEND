import { createContext, useContext, useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invoicesApi, paymentsApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import Icon from '../components/Icon.jsx';
import { formatVnd } from '../components/format.js';
import { Modal } from '../../staff/components/ui.jsx';
import { useT } from '../../i18n/I18n.jsx';
import {
    DEMO_RECEIVER_BANK,
    buildVietQrPayload,
    buildVietQrReference,
    vietQrImageUrl,
} from './vietqr.js';

const PaidContext = createContext(() => {});
const RUST_PAYMENT_API = import.meta.env.VITE_PAYMENT_RECEIVER_URL || 'http://localhost:4100';

/** Holds the "paid" pop-up above the pages: a refresh removes the pay button once the invoice is paid, so it cannot live there. */
export function PaidPopup({ children }) {
    const t = useT();
    const [message, setMessage] = useState(null);
    return (
        <PaidContext.Provider value={setMessage}>
            {children}
            {message && (
                <Modal narrow onClose={() => setMessage(null)}>
                    <div className="se-panel se-pay-done" role="status">
                        <div className="se-confirm-icon"><Icon name="check" size={30} /></div>
                        <h2>{t(message)}</h2>
                        <button type="button" className="se-btn se-btn-primary" autoFocus onClick={() => setMessage(null)}>{t('Đóng')}</button>
                    </div>
                </Modal>
            )}
        </PaidContext.Provider>
    );
}

/** Pays an invoice's outstanding amount via VietQR (with live SSE + MockBankFeed simulation) or the backend gateway. */
export default function PayInvoiceButton({ invoice, className = 'se-btn se-btn-outline se-btn-sm', title = 'Xác nhận thanh toán', paidText = 'Đã nhận thanh toán của bạn.', children = 'Thanh toán' }) {
    const queryClient = useQueryClient();
    const showPaid = useContext(PaidContext);
    const t = useT();
    const [asking, setAsking] = useState(false);
    const [copiedField, setCopiedField] = useState(null);
    const [secondsLeft, setSecondsLeft] = useState(900);
    const [rustReq, setRustReq] = useState(null);

    const isDeposit = String(invoice.invoiceNumber ?? '').startsWith('DEP');
    const keyword = isDeposit ? 'PAY' : 'RENT';
    const rawSubject = String(invoice.invoiceNumber ?? '').replace(/^DEP/, '');
    const reference = rustReq?.reference || buildVietQrReference(rawSubject || `INV${invoice.invoiceId}`, keyword, 23);
    const amountVnd = Math.round(Number(invoice.outstandingAmount) || 0);
    const qrPayload = rustReq?.qr_payload || buildVietQrPayload({ amountVnd, reference });
    const qrSrc = vietQrImageUrl({ amountVnd, reference });

    useEffect(() => {
        if (!asking) return undefined;
        setSecondsLeft(900);
        const timer = setInterval(() => {
            setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [asking]);

    // Try registering the payment request with the Rust PaymentReceiver service (if running on port 4100) and subscribe to SSE
    useEffect(() => {
        if (!asking || amountVnd <= 0) return undefined;
        let es = null;
        let cancelled = false;

        fetch(`${RUST_PAYMENT_API}/payment-requests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subject_type: isDeposit ? 'RESERVATION' : 'CONTRACT',
                subject_id: rawSubject || String(invoice.invoiceId),
                purpose: isDeposit ? 'DEPOSIT' : 'RENT',
                amount_vnd: amountVnd,
                expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            }),
        })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                if (cancelled || !data?.id) return;
                setRustReq(data);
                es = new EventSource(`${RUST_PAYMENT_API}/payment-requests/${data.id}/events`);
                es.addEventListener('payment_status', (ev) => {
                    try {
                        const msg = JSON.parse(ev.data);
                        if (msg.status === 'PAID') {
                            pay.mutate();
                        }
                    } catch {
                        // ignore parse error
                    }
                });
            })
            .catch(() => {
                // Rust sidecar not running; local VietQR payload + backend simulateSuccess fallback remains active
            });

        return () => {
            cancelled = true;
            es?.close();
        };
    }, [asking, invoice.invoiceId, amountVnd]);

    const copyText = (key, text) => {
        try {
            navigator.clipboard?.writeText(text);
        } catch {
            // ignore
        }
        setCopiedField(key);
        setTimeout(() => setCopiedField(null), 1600);
    };

    const downloadQr = async () => {
        const fileName = `VietQR-${reference.replace(/\s+/g, '-')}.png`;
        try {
            const res = await fetch(qrSrc, { mode: 'cors' });
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch {
            window.open(qrSrc, '_blank', 'noopener,noreferrer');
        }
    };

    const pay = useMutation({
        mutationFn: async () => {
            if (rustReq?.id) {
                await fetch(`${RUST_PAYMENT_API}/demo/simulate-transfer`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        amount_vnd: amountVnd,
                        description: `IBFT ${DEMO_RECEIVER_BANK.bankName} ${reference}`,
                    }),
                }).catch(() => {});
            }
            const intent = await invoicesApi.paymentsOnline(invoice.invoiceId, { amount: invoice.outstandingAmount, referenceNo: reference });
            if (intent.checkoutUrl?.includes('vnp_TmnCode=')) {
                window.location.assign(intent.checkoutUrl);
                return 'redirected';
            }
            return paymentsApi.simulateSuccess(intent.paymentCode);
        },
        onSuccess: (result) => {
            setAsking(false);
            if (result === 'redirected') return;
            ['invoices', 'reservations', 'payments'].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
            showPaid(paidText);
        },
    });

    const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
    const ss = String(secondsLeft % 60).padStart(2, '0');

    return (
        <>
            <button type="button" className={className} onClick={() => { pay.reset(); setRustReq(null); setAsking(true); }}>{typeof children === 'string' ? t(children) : children}</button>
            {asking && (
                <Modal narrow onClose={() => setAsking(false)}>
                    <div className="se-panel se-qr-modal">
                        <div className="se-qr-header">
                            <h2>{t(title)}</h2>
                            <span className="se-qr-timer" title={t('Thời gian giữ mã QR')}>
                                <span className="se-qr-timer-dot" />
                                ⏱ {mm}:{ss}
                            </span>
                        </div>

                        <div className="se-qr-amount-banner">
                            <span className="se-qr-amount-label">{t('Số tiền cần thanh toán')}</span>
                            <strong className="se-qr-amount-value">{formatVnd(invoice.outstandingAmount)}</strong>
                        </div>

                        <div className="se-qr-center">
                            <div className="se-qr-frame">
                                <img
                                    src={qrSrc}
                                    alt={`VietQR ${reference}`}
                                    className="se-qr-img"
                                />
                            </div>
                            <p className="se-qr-caption">
                                {t('Quét bằng app ngân hàng để tự động điền thông tin')}
                            </p>
                            <button
                                type="button"
                                className="se-qr-download-btn"
                                onClick={downloadQr}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M12 3v12" />
                                    <path d="m7 10 5 5 5-5" />
                                    <path d="M5 21h14" />
                                </svg>
                                {t('Tải mã QR')}
                            </button>
                        </div>

                        <div className="se-qr-manual-box">
                            <div className="se-qr-manual-title">{t('HOẶC CHUYỂN KHOẢN THỦ CÔNG')}</div>
                            <dl className="se-qr-lines">
                                <dt>{t('Ngân hàng')}</dt>
                                <dd><strong>{DEMO_RECEIVER_BANK.bankName} · {DEMO_RECEIVER_BANK.accountName}</strong></dd>

                                <dt>{t('Số tài khoản')}</dt>
                                <dd className="se-qr-copy-dd">
                                    <code className="se-qr-acc-code">{DEMO_RECEIVER_BANK.accountDisplay}</code>
                                    <button
                                        type="button"
                                        className="se-qr-copy-btn"
                                        onClick={() => copyText('acc', DEMO_RECEIVER_BANK.accountNo)}
                                    >
                                        {copiedField === 'acc' ? t('Đã chép') : t('Chép')}
                                    </button>
                                </dd>

                                <dt>{t('Nội dung CK')}</dt>
                                <dd className="se-qr-copy-dd">
                                    <code className="se-qr-ref-pill">
                                        {reference}
                                    </code>
                                    <button
                                        type="button"
                                        className="se-qr-copy-btn"
                                        onClick={() => copyText('ref', reference)}
                                    >
                                        {copiedField === 'ref' ? t('Đã chép') : t('Chép')}
                                    </button>
                                </dd>
                            </dl>
                        </div>

                        <details className="se-qr-payload-details">
                            <summary>{t('Dữ liệu kỹ thuật (VietQR Payload · BIN {bin})', { bin: DEMO_RECEIVER_BANK.bankBin })}</summary>
                            <code>{qrPayload}</code>
                        </details>

                        {pay.isError && <div className="se-alert" role="alert">{errorMessage(pay.error)}</div>}
                        <div className="se-qr-actions">
                            <button type="button" className="se-btn se-btn-ghost se-qr-cancel-btn" disabled={pay.isPending} onClick={() => setAsking(false)}>{t('Huỷ')}</button>
                            <button type="button" className="se-btn se-btn-primary se-qr-confirm-btn" disabled={pay.isPending || secondsLeft === 0} onClick={() => pay.mutate()}>
                                {t(pay.isPending ? 'Đang đối soát…' : 'Giả lập đã chuyển khoản (Demo)')}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </>
    );
}

