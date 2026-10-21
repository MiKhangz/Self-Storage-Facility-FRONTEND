import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import Icon from '../components/Icon.jsx';
import AuthShell, { PasswordInput } from './AuthShell.jsx';

const BENEFITS = [
    { icon: 'grid', title: 'Đặt kho trực tuyến', text: 'Xem số kho còn trống ở từng cơ sở theo thời gian thực.' },
    { icon: 'file', title: 'Hợp đồng điện tử', text: 'Ký và xem lại hợp đồng thuê kho ngay trong tài khoản.' },
    { icon: 'building', title: 'Quản lý nhiều kho', text: 'Thuê và theo dõi nhiều kho trong cùng một tài khoản.' },
];

const EMPTY = { fullName: '', phoneNumber: '', email: '', password: '', confirm: '', agreed: false };
export const PASSWORD_RULE = 'Ít nhất 8 ký tự, có cả chữ cái và chữ số';

/** Field errors shown under each input; empty object means the form can be sent. */
export function validateRegister(f) {
    const errors = {};
    if (!f.fullName.trim()) errors.fullName = 'Vui lòng nhập họ và tên';
    if (!/^\S+@\S+\.\S+$/.test(f.email)) errors.email = 'Email chưa đúng định dạng, ví dụ ten@gmail.com';
    if (!/^0\d{9}$/.test(f.phoneNumber.replace(/\s/g, ''))) errors.phoneNumber = 'Số điện thoại gồm 10 chữ số, bắt đầu bằng số 0';
    // Same rule the backend enforces: at least 8 characters with a letter and a digit.
    if (f.password.length < 8 || !/[A-Za-z]/.test(f.password) || !/\d/.test(f.password)) errors.password = PASSWORD_RULE;
    if (f.confirm !== f.password) errors.confirm = 'Mật khẩu nhập lại không khớp';
    if (!f.agreed) errors.agreed = 'Vui lòng đồng ý với quy định thuê kho để tiếp tục';
    return errors;
}

export default function RegisterPage() {
    const [form, setForm] = useState(EMPTY);
    const [touched, setTouched] = useState(false);
    const register = useMutation({
        mutationFn: () => authApi.register({ fullName: form.fullName.trim(), email: form.email.trim(), phoneNumber: form.phoneNumber.replace(/\s/g, ''), password: form.password }),
    });
    const set = (key) => (e) => setForm({ ...form, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
    const errors = validateRegister(form);
    const show = (key) => touched && errors[key];

    const submit = (e) => {
        e.preventDefault();
        setTouched(true);
        if (Object.keys(errors).length) return;
        register.mutate();
    };

    return (
        <AuthShell wide title="Tạo tài khoản trong 1 phút." benefits={BENEFITS}>
            <Link to="/login" className="se-back"><Icon name="arrowLeft" size={16} /> Quay lại đăng nhập</Link>
            <h1>Tạo tài khoản</h1>
            <p className="se-auth-lead">Đăng ký tài khoản khách hàng để đặt và quản lý kho.</p>
            <form className="se-form" onSubmit={submit} noValidate>
                <div className="se-form-row">
                    <label><span>Họ và tên *</span>
                        <div className={`se-input${show('fullName') ? ' invalid' : ''}`}><input value={form.fullName} onChange={set('fullName')} autoComplete="name" required /></div>
                        {show('fullName') && <p className="se-hint error">{errors.fullName}</p>}
                    </label>
                    <label><span>Số điện thoại *</span>
                        <div className={`se-input${show('phoneNumber') ? ' invalid' : ''}`}><input type="tel" value={form.phoneNumber} onChange={set('phoneNumber')} placeholder="0901 234 567" autoComplete="tel" required /></div>
                        {show('phoneNumber') && <p className="se-hint error">{errors.phoneNumber}</p>}
                    </label>
                </div>
                <label><span>Email *</span>
                    <div className={`se-input${show('email') ? ' invalid' : ''}`}><Icon name="mail" size={16} /><input type="email" value={form.email} onChange={set('email')} autoComplete="email" required /></div>
                    {show('email') && <p className="se-hint error">{errors.email}</p>}
                </label>
                <div className="se-form-row">
                    <label><span>Mật khẩu *</span>
                        <PasswordInput value={form.password} onChange={set('password')} invalid={show('password')} autoComplete="new-password" />
                        <p className={`se-hint${show('password') ? ' error' : ''}`}>{PASSWORD_RULE}</p>
                    </label>
                    <label><span>Nhập lại mật khẩu *</span>
                        <PasswordInput value={form.confirm} onChange={set('confirm')} invalid={(touched || form.confirm) && errors.confirm} autoComplete="new-password" />
                        {(touched || form.confirm) && errors.confirm && <p className="se-hint error">{errors.confirm}</p>}
                    </label>
                </div>
                <label className="se-check">
                    <input type="checkbox" checked={form.agreed} onChange={set('agreed')} />
                    <span>Tôi đồng ý với <Link to="/sizes">quy định thuê kho</Link> và cam kết không cất hàng cấm</span>
                </label>
                {show('agreed') && <p className="se-hint error">{errors.agreed}</p>}
                {register.isError && <div className="se-alert" role="alert">{errorMessage(register.error)}</div>}
                {register.isSuccess && (
                    <div className="se-alert info" role="status">
                        {register.data.status === 'Active'
                            ? <>Đã tạo tài khoản. <Link to="/login">Đăng nhập ngay</Link>.</>
                            : <>Đã tạo tài khoản. Mở liên kết chúng tôi gửi tới {register.data.email} để kích hoạt, rồi đăng nhập.</>}
                    </div>
                )}
                <button type="submit" className="se-btn se-btn-primary" disabled={register.isPending || register.isSuccess}>
                    {register.isPending ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}
                </button>
            </form>
            <p className="se-auth-switch">Đã có tài khoản?<Link to="/login">Đăng nhập</Link></p>
        </AuthShell>
    );
}
