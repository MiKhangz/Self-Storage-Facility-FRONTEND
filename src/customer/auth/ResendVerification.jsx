import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import Icon from '../components/Icon.jsx';
import { useT } from '../../i18n/I18n.jsx';

/** Long enough for an email to arrive, so an impatient click does not send a second one. */
const WAIT_SECONDS = 60;

/** Sends a new activation link. Without an `email` it asks for one, as an expired link does not say whose it was. */
export default function ResendVerification({ email }) {
    const t = useT();
    const [typed, setTyped] = useState('');
    const [wait, setWait] = useState(0);
    const resend = useMutation({
        mutationFn: () => authApi.resendVerification({ email: email ?? typed.trim() }),
        onSuccess: () => setWait(WAIT_SECONDS),
    });
    useEffect(() => {
        if (!wait) return undefined;
        const timer = setTimeout(() => setWait(wait - 1), 1000);
        return () => clearTimeout(timer);
    }, [wait]);

    return (
        <form className="se-form se-resend" onSubmit={(e) => { e.preventDefault(); resend.mutate(); }}>
            {!email && (
                <label>
                    <span>Email</span>
                    <div className="se-input"><Icon name="mail" size={16} />
                        <input type="email" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="email" required />
                    </div>
                </label>
            )}
            {resend.isError && <div className="se-alert" role="alert">{errorMessage(resend.error)}</div>}
            {/* The same answer for every address, so this cannot be used to find out who has an account. */}
            {resend.isSuccess && <div className="se-alert info" role="status">{t('Nếu tài khoản đang chờ kích hoạt, chúng tôi đã gửi liên kết mới. Hãy kiểm tra hộp thư.')}</div>}
            <button type="submit" className="se-btn se-btn-ghost" disabled={resend.isPending || wait > 0}>
                {resend.isPending ? t('Đang gửi…') : wait > 0 ? t('Gửi lại sau {n} giây', { n: wait }) : t('Gửi lại email xác nhận')}
            </button>
        </form>
    );
}
