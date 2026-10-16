// Outline icons drawn from the Figma file. Figma's own asset URLs expire, so the paths live here.
const PATHS = {
    box: 'M21 8l-9-5-9 5 9 5 9-5z M3 8v8l9 5 9-5V8 M12 13v8',
    menu: 'M4 7h16 M4 12h16 M4 17h16',
    close: 'M6 6l12 12 M18 6L6 18',
    phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z',
    arrow: 'M5 12h14 M13 6l6 6-6 6',
    lock: 'M5 11h14v10H5z M8 11V7a4 4 0 0 1 8 0v4',
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4',
    pin: 'M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    down: 'M6 9l6 6 6-6',
    calendar: 'M4 6h16v15H4z M4 10h16 M8 3v4 M16 3v4',
    clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2',
    search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3',
    home: 'M3 11l9-8 9 8 M5 9.5V21h14V9.5 M10 21v-6h4v6',
    file: 'M14 3H6v18h12V7z M14 3v4h4 M9 13h6 M9 17h6',
    gem: 'M6 3h12l4 6-10 12L2 9z M2 9h20',
    thermo: 'M14 14.8V4a2 2 0 0 0-4 0v10.8a4 4 0 1 0 4 0z',
    luggage: 'M7 7h10v13H7z M10 7V3h4v4 M9 20v1 M15 20v1',
    briefcase: 'M3 7h18v13H3z M8 7V4h8v3 M3 12h18',
    check: 'M5 12l5 5 9-10',
    grid: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z',
    card: 'M3 6h18v12H3z M3 10h18',
    key: 'M7.5 21a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z M10.7 13.3L21 3 M17 7l3 3',
    mail: 'M3 5h18v14H3z M3 6l9 7 9-7',
    eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    eyeOff: 'M3 3l18 18 M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.9 M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6 M9.9 9.9a3 3 0 0 0 4.2 4.2',
    chat: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
    arrowLeft: 'M19 12H5 M11 6l-6 6 6 6',
    building:'M5 21V3h14v18 M9 7h2 M13 7h2 M9 11h2 M13 11h2 M9 15h2 M13 15h2 M3 21h18',
};

export default function Icon({ name, size = 18, className = '' }) {
    return (
        <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={PATHS[name]} />
        </svg>
    );
}
