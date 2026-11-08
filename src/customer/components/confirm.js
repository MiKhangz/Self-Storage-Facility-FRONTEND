/**
 * Asks a yes/no question in the page's own dialog and resolves true for yes.
 * Replaces window.confirm(), which some embedded browsers (the Claude app's preview pane among them) answer "no"
 * straight away without showing anything, so the guarded action silently never ran.
 * @param {string} message
 * @returns {Promise<boolean>}
 */
export function confirmAction(message) {
    const vi = document.documentElement.lang === 'vi';
    return new Promise((resolve) => {
        const dialog = document.createElement('dialog');
        dialog.className = 'se-confirm';
        // Focus lands on Confirm, so screen readers need the question as the dialog's name.
        dialog.setAttribute('aria-label', message);
        const text = document.createElement('p');
        text.textContent = message;
        const actions = document.createElement('div');
        actions.className = 'se-confirm-actions';
        const button = (label, cls, answer) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = `se-btn ${cls}`;
            b.textContent = label;
            b.onclick = () => dialog.close(answer);
            return b;
        };
        const yes = button(vi ? 'Đồng ý' : 'Confirm', 'se-btn-primary', 'yes');
        actions.append(button(vi ? 'Huỷ' : 'Cancel', 'se-btn-ghost', 'no'), yes);
        dialog.append(text, actions);
        // Escape closes with an empty returnValue: treated as no.
        dialog.addEventListener('close', () => { dialog.remove(); resolve(dialog.returnValue === 'yes'); });
        document.body.append(dialog);
        dialog.showModal();
        yes.focus();
    });
}
