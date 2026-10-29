import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { useT } from '../../i18n/I18n.jsx';
import './AuthShell.css';

/** The two-panel card shared by U02 Login, U03 Register and U12 Forgot Password. */
export default function AuthShell({ title, benefits, wide, children }) {
    const t = useT();
    return (
        <div className="se-auth-bg">
            <div className={`se-auth-card${wide ? ' wide' : ''}`}>
                <aside className="se-auth-side">
                    <h2>{t(title)}</h2>
                    <ul>
                        {benefits.map((b) => (
                            <li key={b.title}>
                                <span className="se-auth-side-icon"><Icon name={b.icon} size={20} /></span>
                                <div><strong>{t(b.title)}</strong><p>{t(b.text)}</p></div>
                            </li>
                        ))}
                    </ul>
                </aside>
                <section className="se-auth-main">{children}</section>
            </div>
        </div>
    );
}

export function PasswordInput({ value, onChange, invalid, autoComplete }) {
    const [shown, setShown] = useState(false);
    const t = useT();
    return (
        <div className={`se-input${invalid ? ' invalid' : ''}`}>
            <Icon name="lock" size={16} />
            <input type={shown ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete} required />
            <button type="button" className="se-input-eye" onClick={() => setShown(!shown)} aria-label={shown ? t('Ẩn mật khẩu') : t('Hiện mật khẩu')}>
                <Icon name={shown ? 'eyeOff' : 'eye'} size={16} />
            </button>
        </div>
    );
}
