import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import Icon from '../components/Icon.jsx';
import './ForgotPasswordPage.css';
import { useT } from '../../i18n/I18n.jsx';

/** Landing page of the activation link emailed after registration. */
export default function VerifyEmailPage() {
    const token = useSearchParams()[0].get('token') ?? '';
    const t = useT();
    // A query, not an effect: the token works once, and react-query sends it once even under StrictMode.
    const verify = useQuery({ queryKey: ['verify-email', token], queryFn: () => authApi.verifyEmail({ token }).then(() => true), enabled: !!token, retry: false, staleTime: Infinity });

    return (
        <div className="se-auth-bg">
            <div className="se-reset-card">
                <span className="se-reset-icon green"><Icon name="mail" size={22} /></span>
                {!token ? <><h1>{t('Liên kết chưa đầy đủ')}</h1><p className="se-auth-lead">{t('Hãy mở đúng đường liên kết trong email kích hoạt.')}</p></>
                    : verify.isPending ? <h1>{t('Đang kích hoạt tài khoản…')}</h1>
                        : verify.isError ? <><h1>{t('Kích hoạt không thành công')}</h1><div className="se-alert" role="alert">{errorMessage(verify.error)}</div></>
                            : <><h1>{t('Đã xác nhận email')}</h1><p className="se-auth-lead">{t('Tài khoản của bạn đã được kích hoạt. Bạn có thể đăng nhập ngay.')}</p></>}
                <Link to="/login" className="se-btn se-btn-primary se-btn-block">{t('Đến trang đăng nhập')}</Link>
            </div>
        </div>
    );
}
