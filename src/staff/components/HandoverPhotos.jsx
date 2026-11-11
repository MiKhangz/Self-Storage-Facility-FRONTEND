import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../api/axiosClient';
import { handoversApi } from '../../api/generated';
import Icon from '../../customer/components/Icon.jsx';
import { useT } from '../../i18n/I18n.jsx';
import { PHOTO_TYPES, photoProblem } from '../photoRules.js';

/** Sends one photo to a handover. */
export function uploadPhoto(handoverId, file) {
    const body = new FormData();
    body.append('file', file);
    return handoversApi.photos(handoverId, body);
}

function PhotoInput({ onPick, label }) {
    return (
        <label className="se-btn se-btn-ghost se-btn-sm sa-photo-add"><Icon name="file" size={14} /> {label}
            <input type="file" className="sr-only" aria-label={label} accept={PHOTO_TYPES.join(',')} multiple
                onChange={(e) => { onPick([...e.target.files]); e.target.value = ''; }} />
        </label>
    );
}

function Preview({ file, onRemove }) {
    const tr = useT();
    const [url, setUrl] = useState(null);
    useEffect(() => {
        const made = URL.createObjectURL(file);
        setUrl(made);
        return () => URL.revokeObjectURL(made);
    }, [file]);
    return (
        <div className="sa-photo">
            {url && <img src={url} alt={file.name} />}
            <button type="button" aria-label={tr('Remove {name}', { name: file.name })} onClick={onRemove}><Icon name="close" size={12} /></button>
        </div>
    );
}

/** Photos chosen before the handover exists; they are sent right after it is completed. */
export function PhotoPicker({ files, onChange }) {
    const tr = useT();
    const [problem, setProblem] = useState(null);
    const pick = (picked) => {
        const bad = picked.map(photoProblem).find(Boolean);
        setProblem(bad ?? null);
        onChange([...files, ...picked.filter((f) => !photoProblem(f))]);
    };
    return (
        <div>
            <span className="se-label">{tr('Condition photos (optional)')}</span>
            <div className="sa-photos">
                {files.map((f, i) => <Preview key={`${f.name}-${i}`} file={f} onRemove={() => onChange(files.filter((_, n) => n !== i))} />)}
                <PhotoInput label={tr('Add photos')} onPick={pick} />
            </div>
            {problem && <div className="se-alert" role="alert">{tr(problem)}</div>}
        </div>
    );
}

/** Photo files need the portal header, which an <img src> cannot send, so each is fetched as a blob. */
function SavedPhoto({ handoverId, photo }) {
    const tr = useT();
    const [url, setUrl] = useState(null);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        let gone = false;
        let made = null;
        api.get(`/api/handovers/${handoverId}/photos/${photo.handoverPhotoId}`, { responseType: 'blob' })
            .then((r) => {
                if (gone) return;
                made = URL.createObjectURL(r.data);
                setUrl(made);
            })
            .catch(() => !gone && setFailed(true));
        return () => {
            gone = true;
            if (made) URL.revokeObjectURL(made);
        };
    }, [handoverId, photo.handoverPhotoId]);
    if (failed) return <div className="sa-photo sa-photo-missing">{tr('Not available')}</div>;
    return <a className="sa-photo" href={url ?? undefined} target="_blank" rel="noreferrer">{url && <img src={url} alt={photo.fileName} />}</a>;
}

/** The photos taken at a handover. With `canAdd`, staff can add more, for example after a failed upload. */
export default function HandoverPhotos({ handover, canAdd, actions }) {
    const tr = useT();
    const queryClient = useQueryClient();
    const [problem, setProblem] = useState(null);
    const add = useMutation({
        mutationFn: async (files) => {
            for (const file of files) await uploadPhoto(handover.handoverId, file);
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: ['handovers'] }),
    });
    const pick = (picked) => {
        const bad = picked.map(photoProblem).find(Boolean);
        setProblem(bad ?? null);
        const good = picked.filter((f) => !photoProblem(f));
        if (good.length) add.mutate(good);
    };
    const photos = handover.photos ?? [];
    if (!photos.length && !canAdd && !actions) return null;
    return (
        <div>
            <span className="se-label">{tr('Photos at handover')}</span>
            <div className="sa-photos">
                {photos.map((p) => <SavedPhoto key={p.handoverPhotoId} handoverId={handover.handoverId} photo={p} />)}
                {canAdd && <PhotoInput label={add.isPending ? tr('Uploading…') : tr('Add photos')} onPick={pick} />}
                {actions}
            </div>
            {problem && <div className="se-alert" role="alert">{tr(problem)}</div>}
            {add.isError && <div className="se-alert" role="alert">{errorMessage(add.error)}</div>}
        </div>
    );
}
