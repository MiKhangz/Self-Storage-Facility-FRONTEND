import Icon from '../components/Icon.jsx';
import { useT } from '../../i18n/I18n.jsx';
import './Booking.css';

const STEPS = ['Chọn kho', 'Thông tin và thanh toán', 'Xác nhận'];

/** `current` is 1-based; pass 4 to show every step done (U08). */
export default function BookingStepper({ current }) {
    const t = useT();
    return (
        <nav className="se-stepper" aria-label={t('Các bước đặt kho')}>
            <ol>
                {STEPS.map((label, i) => {
                    const step = i + 1;
                    const state = step < current || current > STEPS.length ? 'done' : step === current ? 'current' : '';
                    return (
                        <li key={label} className={state} aria-current={state === 'current' ? 'step' : undefined}>
                            <span className="se-step-num">{state === 'done' ? <Icon name="check" size={14} /> : step}</span>
                            <span className="se-step-label">{t(label)}</span>
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
