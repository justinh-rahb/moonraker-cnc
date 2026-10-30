// Focus and scroll belong to the topmost dialog, including nested confirmations.
const stack = [];
let previousOverflow = '';
export function dialog(node, options = {}) {
    const previousFocus = document.activeElement;
    let currentOptions = options;
    if (!stack.length) { previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
    stack.push(node);
    node.setAttribute('role','dialog');
    node.setAttribute('aria-modal','true');
    node.setAttribute('tabindex','-1');
    if(options.label) node.setAttribute('aria-label',options.label);
    const focusable = () => [...node.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')].filter(el => el.getClientRects().length && !el.closest('[inert]'));
    queueMicrotask(() => {if(node.isConnected) (focusable()[0] || node).focus();});
    function keydown(event) {
        if (stack.at(-1) !== node) return;
        if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); currentOptions.close?.(); }
        if (event.key === 'Tab') {
            const list = focusable();
            const first = list[0] || node, last = list.at(-1) || node;
            if(event.shiftKey && (document.activeElement === first || document.activeElement === node)) {event.preventDefault();last.focus();}
            else if(!event.shiftKey && (document.activeElement === last || document.activeElement === node)) {event.preventDefault();first.focus();}
        }
    }
    document.addEventListener('keydown',keydown,true);
    return { update(value) {currentOptions = value;}, destroy() {
        document.removeEventListener('keydown',keydown,true);
        stack.splice(stack.indexOf(node),1);
        if(!stack.length) document.body.style.overflow = previousOverflow;
        if(previousFocus?.isConnected) previousFocus.focus();
    }};
}
