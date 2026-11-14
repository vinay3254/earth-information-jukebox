export const $ = (sel, root = document) => root.querySelector(sel);

// Small element builder. Props starting with "on" become listeners.
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'checked') node.checked = Boolean(v);
    else if (k === 'class') node.className = v;
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of [].concat(children)) {
    if (c == null || c === '') continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

// Update an aria-live region. Skips repeats so screen readers are not spammed.
export function announce(node, text) {
  if (!text || node.textContent === text) return;
  node.textContent = text;
}
