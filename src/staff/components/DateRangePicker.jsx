import { useEffect, useRef, useState } from 'react';
import Icon from '../../customer/components/Icon.jsx';
import { todayIso } from '../../customer/components/format.js';
import {
    PRESETS, WEEKDAYS, activePreset, ensureVisibleMonth, formatRangeLabel,
    monthHeading, monthWeeks, moveDateByKey, orderRange, parseTypedInput, presetRange, shiftMonth,
} from './dateRange.js';
import './DateRangePicker.css';

const THREE_MONTH_WIDTH = 830; // enough room for 124px preset + 3 * 220px calendars + padding

export default function DateRangePicker({ value, onChange, today = todayIso(), initialMonth }) {
    const rootRef = useRef(null);
    const inputRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [anchor, setAnchor] = useState(null); // active while click-and-hold dragging a range or after "Custom range" preset
    const [hoverDate, setHoverDate] = useState(null);
    const [dragEnd, setDragEnd] = useState(null); // 'from' | 'to' | 'new' while mouse button is held down
    const [focusedDate, setFocusedDate] = useState(() => value?.from || today);
    const [monthsCount, setMonthsCount] = useState(2);
    const [viewMonth, setViewMonth] = useState(() => `${(initialMonth || value?.from || today).slice(0, 7)}-01`);
    const [typing, setTyping] = useState(false);
    const [text, setText] = useState(() => formatRangeLabel(value, null));

    useEffect(() => {
        if (!typing) setText(formatRangeLabel(value, anchor && hoverDate === anchor ? anchor : null));
    }, [value?.from, value?.to, anchor, hoverDate, typing]);

    useEffect(() => {
        if (!open) return undefined;
        const measure = () => {
            const rect = rootRef.current?.getBoundingClientRect();
            const spaceRight = rect ? window.innerWidth - rect.left - 16 : window.innerWidth;
            setMonthsCount(spaceRight >= THREE_MONTH_WIDTH ? 3 : 2);
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [open]);

    useEffect(() => {
        if (!open) return undefined;
        const onDown = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) {
                setOpen(false);
                setAnchor(null);
                setHoverDate(null);
                setDragEnd(null);
                setTyping(false);
            }
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);

    useEffect(() => {
        if (!dragEnd) return undefined;
        const onUp = () => {
            if (dragEnd === 'new' && anchor) {
                onChange(orderRange(anchor, hoverDate || anchor));
                setAnchor(null);
            } else if ((dragEnd === 'from' || dragEnd === 'to') && hoverDate && value?.from) {
                const fixed = dragEnd === 'from' ? (value.to || value.from) : value.from;
                onChange(orderRange(fixed, hoverDate));
            }
            setDragEnd(null);
            setHoverDate(null);
        };
        window.addEventListener('mouseup', onUp);
        return () => window.removeEventListener('mouseup', onUp);
    }, [dragEnd, anchor, hoverDate, value, onChange]);

    const preview = (() => {
        if ((dragEnd === 'from' || dragEnd === 'to') && value?.from) {
            const fixed = dragEnd === 'from' ? (value.to || value.from) : value.from;
            return orderRange(fixed, hoverDate || fixed);
        }
        if (anchor) return orderRange(anchor, hoverDate || anchor);
        return value?.from ? orderRange(value.from, value.to || value.from) : { from: '', to: '' };
    })();

    const currentPreset = anchor || (dragEnd && preview.from !== preview.to) ? 'Custom range' : activePreset(value, today);
    const months = Array.from({ length: monthsCount }, (_, i) => shiftMonth(viewMonth, i));

    const pickDay = (iso) => {
        setFocusedDate(iso);
        setTyping(false);
        if (anchor) {
            onChange(orderRange(anchor, iso));
            setAnchor(null);
            setHoverDate(null);
        } else {
            onChange({ from: iso, to: iso });
        }
    };

    const applyPreset = (name) => {
        setTyping(false);
        if (name === 'Custom range') {
            setAnchor(value?.from || today);
            setHoverDate(value?.from || today);
            return;
        }
        const next = presetRange(name, today);
        if (next) {
            setAnchor(null);
            setHoverDate(null);
            setFocusedDate(next.from);
            setViewMonth(ensureVisibleMonth(viewMonth, next.from, monthsCount));
            onChange(next);
        }
    };

    const commitTyped = () => {
        const parsed = parseTypedInput(text, Number((value?.from || today).slice(0, 4)));
        if (!parsed) {
            setTyping(false);
            setText(formatRangeLabel(value, anchor));
            return;
        }
        if (parsed.type === 'range') {
            setAnchor(null);
            setHoverDate(null);
            setFocusedDate(parsed.from);
            setViewMonth(ensureVisibleMonth(viewMonth, parsed.from, monthsCount));
            onChange({ from: parsed.from, to: parsed.to });
            setTyping(false);
        } else {
            setFocusedDate(parsed.date);
            setViewMonth(ensureVisibleMonth(viewMonth, parsed.date, monthsCount));
            if (anchor) {
                onChange(orderRange(anchor, parsed.date));
                setAnchor(null);
                setHoverDate(null);
            } else {
                onChange({ from: parsed.date, to: parsed.date });
            }
            setTyping(false);
        }
    };

    const onKeyDown = (e) => {
        if (e.key === 'Escape') {
            if (open) {
                e.preventDefault();
                setOpen(false);
                setAnchor(null);
                setHoverDate(null);
                setDragEnd(null);
                setTyping(false);
                inputRef.current?.focus();
            }
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            if (!open) { setOpen(true); return; }
            if (typing) { commitTyped(); return; }
            if (focusedDate) pickDay(focusedDate);
            return;
        }
        if (typing && ['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
        const moved = moveDateByKey(focusedDate || value?.from || today, e.key, e.shiftKey);
        if (moved) {
            e.preventDefault();
            if (!open) setOpen(true);
            setTyping(false);
            setFocusedDate(moved);
            if (anchor) setHoverDate(moved);
            setViewMonth((vm) => ensureVisibleMonth(vm, moved, monthsCount));
        }
    };

    return (
        <div ref={rootRef} className="sa-drp" onKeyDown={onKeyDown}>
            <div className={`sa-drp-trigger${open ? ' open' : ''}`} onClick={() => { setOpen(true); inputRef.current?.focus(); }}>
                <Icon name="calendar" size={14} className="sa-drp-icon" />
                <input
                    ref={inputRef}
                    type="text"
                    className="sa-drp-input"
                    aria-label="Date range"
                    aria-expanded={open}
                    placeholder="Select dates"
                    value={typing ? text : (value?.from || anchor ? text : '')}
                    onFocus={() => setOpen(true)}
                    onChange={(e) => { setTyping(true); setText(e.target.value); if (!open) setOpen(true); }}
                    onBlur={() => { if (typing) commitTyped(); }}
                />
                <button type="button" tabIndex={-1} className="sa-drp-chev" aria-label="Toggle calendar"
                    onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}>
                    <Icon name="down" size={12} />
                </button>
            </div>

            {open && (
                <div className="sa-drp-popover" role="dialog" aria-label="Choose date range">
                    <div className="sa-drp-presets" role="listbox" aria-label="Date presets">
                        {PRESETS.map((p) => (
                            <button key={p} type="button" role="option" aria-selected={currentPreset === p}
                                className={`sa-drp-preset${currentPreset === p ? ' active' : ''}`}
                                onClick={() => applyPreset(p)}>
                                {p}
                            </button>
                        ))}
                    </div>
                    <div className="sa-drp-calendars">
                        <button type="button" className="sa-drp-nav prev" aria-label="Previous month"
                            onClick={() => setViewMonth(shiftMonth(viewMonth, -1))}>
                            <Icon name="arrowLeft" size={14} />
                        </button>
                        <button type="button" className="sa-drp-nav next" aria-label="Next month"
                            onClick={() => setViewMonth(shiftMonth(viewMonth, 1))}>
                            <Icon name="arrow" size={14} />
                        </button>
                        {months.map((m) => (
                            <div key={m} className="sa-drp-month">
                                <div className="sa-drp-month-title">{monthHeading(m)}</div>
                                <div className="sa-drp-weekdays">
                                    {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
                                </div>
                                <div className="sa-drp-grid" role="grid" aria-label={monthHeading(m)}>
                                    {monthWeeks(m).map((week, wi) => (
                                        <div key={wi} className="sa-drp-week" role="row">
                                            {week.map((iso, di) => {
                                                if (!iso) return <span key={di} className="sa-drp-cell blank" />;
                                                const inRange = preview.from && preview.to && iso >= preview.from && iso <= preview.to;
                                                const isStart = iso === preview.from;
                                                const isEnd = iso === preview.to;
                                                const prevIso = di > 0 ? week[di - 1] : null;
                                                const nextIso = di < 6 ? week[di + 1] : null;
                                                const prevIn = prevIso && preview.from && preview.to && prevIso >= preview.from && prevIso <= preview.to;
                                                const nextIn = nextIso && preview.from && preview.to && nextIso >= preview.from && nextIso <= preview.to;
                                                const capLeft = inRange && !prevIn;
                                                const capRight = inRange && !nextIn;
                                                const isMultiRange = value?.from && value?.to && value.from !== value.to;
                                                const isCommittedStart = !anchor && !dragEnd && isMultiRange && value.from === iso;
                                                const isCommittedEnd = !anchor && !dragEnd && isMultiRange && value.to === iso;
                                                const isProvisional = (anchor && hoverDate && hoverDate !== anchor && (iso === anchor || iso === hoverDate))
                                                    || ((dragEnd === 'from' || dragEnd === 'to') && iso === hoverDate);
                                                const isToday = iso === today;
                                                const isFocused = iso === focusedDate;
                                                const dayNum = Number(iso.slice(8, 10));

                                                return (
                                                    <button
                                                        key={iso}
                                                        type="button"
                                                        role="gridcell"
                                                        aria-label={iso}
                                                        aria-selected={inRange || undefined}
                                                        className={[
                                                            'sa-drp-cell',
                                                            inRange ? 'in-range' : '',
                                                            capLeft ? 'cap-left' : '',
                                                            capRight ? 'cap-right' : '',
                                                            isStart || isEnd ? 'endpoint' : '',
                                                            isProvisional ? 'provisional' : '',
                                                            isToday ? 'today' : '',
                                                            isFocused ? 'focused' : '',
                                                        ].filter(Boolean).join(' ')}
                                                        onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            setFocusedDate(iso);
                                                            setTyping(false);
                                                            if (anchor && !dragEnd) {
                                                                // Second click of explicit "Custom range" preset mode
                                                                onChange(orderRange(anchor, iso));
                                                                setAnchor(null);
                                                                setHoverDate(null);
                                                            } else if (isCommittedStart || isCommittedEnd) {
                                                                setDragEnd(isCommittedStart ? 'from' : 'to');
                                                                setHoverDate(iso);
                                                            } else {
                                                                // Click Selects single day on mouseup; holding & moving drags a custom range
                                                                setAnchor(iso);
                                                                setHoverDate(iso);
                                                                setDragEnd('new');
                                                            }
                                                        }}
                                                        onMouseEnter={() => { if (anchor || dragEnd) setHoverDate(iso); }}
                                                    >
                                                        <span className="sa-drp-num">{dayNum}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
