/** The limits HandoverEvidenceService enforces, checked before upload so staff can fix a photo while the customer is there. */
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

/** The message for a file the server would refuse, or null when it is fine. */
export function photoProblem(file) {
    if (!PHOTO_TYPES.includes(file.type)) return 'Only JPEG, PNG or WebP photos are accepted.';
    if (file.size <= 0 || file.size > PHOTO_MAX_BYTES) return 'A photo must be between 1 byte and 5 MB.';
    return null;
}
