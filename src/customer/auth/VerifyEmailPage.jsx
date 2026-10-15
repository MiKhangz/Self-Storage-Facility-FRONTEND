import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import Icon from '../components/Icon.jsx';
import './ForgotPasswordPage.css';

/** Landing page of the activation link emailed after registration. */
export default function VerifyEmailPage() {
    const token = useSearchParams()[0].get('token') ?? '';
    // A query, not an effect: the token works once, and react-query sends it once even under StrictMode.
    const verify = useQuery({ queryKey: ['verify-email', token], queryFn: () => authApi.verifyEmail({ token }).then(() => true), enabled: !!token, retry: false, staleTime: Infinity });

    return (
        <div className="se-auth-bg">
            <div className="se-reset-card">
                <span className="se-reset-icon green"><Icon name="mail" size={22} /></span>
                {!token ? <><h1>Link incomplete</h1><p className="se-auth-lead">Open the full link from your email.</p></>
                    : verify.isPending ? <h1>Activating your account…</h1>
                        : verify.isError ? <><h1>Activation failed</h1><div className="se-alert" role="alert">{errorMessage(verify.error)}</div></>
                            : <><h1>Email verified</h1><p className="se-auth-lead">Your account is active. You can log in now.</p></>}
                <Link to="/login" className="se-btn se-btn-primary se-btn-block">Go to login</Link>
            </div>
        </div>
    );
}
