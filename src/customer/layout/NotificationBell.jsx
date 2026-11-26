import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import Icon from '../components/Icon.jsx';
import { formatDateTime } from '../support/support.js';
import { useT } from '../../i18n/I18n.jsx';
import './NotificationBell.css';

const KEY = ['notifications'];

/** The customer's messages (the same ones that are emailed). Opening the list marks what it shows as read. */
export default function NotificationBell() {
    const t = useT();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const root = useRef(null);
    const button = useRef(null);
    const list = useQuery({ queryKey: KEY, queryFn: notificationsApi.list });
    const items = list.data?.items ?? [];
    const unread = list.data?.unreadCount ?? 0;
    const read = useMutation({
        mutationFn: (upToId) => notificationsApi.read({ upToId }),
        // Only the badge clears now; the rows stay highlighted until the next refresh, so the new ones can be spotted.
        onSuccess: () => queryClient.setQueryData(KEY, (data) => data && { ...data, unreadCount: 0 }),
    });

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            setOpen(false);
            button.current?.focus();
        };
        const onPointer = (e) => !root.current?.contains(e.target) && setOpen(false);
        window.addEventListener('keydown', onKey);
        document.addEventListener('pointerdown', onPointer);
        return () => {
            window.removeEventListener('keydown', onKey);
            document.removeEventListener('pointerdown', onPointer);
        };
    }, [open]);

    const toggle = () => {
        setOpen(!open);
        if (!open && unread && items.length) read.mutate(Math.max(...items.map((n) => n.notificationId)));
    };

    return (
        <div className="se-bell" ref={root}>
            <button ref={button} type="button" className="se-bell-btn" aria-expanded={open} aria-controls="se-bell-panel"
                aria-label={unread ? t('Thông báo, {n} chưa đọc', { n: unread }) : t('Thông báo')} onClick={toggle}>
                <Icon name="bell" size={20} />
                {unread > 0 && <span className="se-bell-count" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>}
            </button>
            <section id="se-bell-panel" className="se-bell-panel" aria-label={t('Thông báo')} hidden={!open}>
                <strong className="se-bell-title">{t('Thông báo')}</strong>
                {list.isError && <div className="se-alert" role="alert">{errorMessage(list.error)}</div>}
                {list.isSuccess && !items.length && <p className="se-bell-empty">{t('Bạn chưa có thông báo nào.')}</p>}
                <ul>
                    {items.map((n) => (
                        <li key={n.notificationId}>
                            <Link to={n.link} className={`se-bell-item${n.readAt ? '' : ' unread'}`} onClick={() => setOpen(false)}>
                                <strong>{n.title}</strong>
                                <span>{n.body}</span>
                                <small>{formatDateTime(n.createdAt)}</small>
                            </Link>
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}
