import Icon from '../components/Icon.jsx';
import './Booking.css';

const STEPS = ['Choose unit', 'Details & payment', 'Confirmation'];

/** `current` is 1-based; pass 4 to show every step done (U08). */
export default function BookingStepper({ current }) {
    return (
        <nav className="se-stepper" aria-label="Booking steps">
            <ol>
                {STEPS.map((label, i) => {
                    const step = i + 1;
                    const state = step < current || current > STEPS.length ? 'done' : step === current ? 'current' : '';
                    return (
                        <li key={label} className={state} aria-current={state === 'current' ? 'step' : undefined}>
                            <span className="se-step-num">{state === 'done' ? <Icon name="check" size={14} /> : step}</span>
                            {label}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
