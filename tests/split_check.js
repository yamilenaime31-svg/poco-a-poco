(sel) => {
  // Detect words broken across lines and elements overflowing horizontally within elements matching sel
  const out = { split: [], overflow: [], docOverflow: document.documentElement.scrollWidth > window.innerWidth };
  const roots = Array.from(document.querySelectorAll(sel));
  roots.forEach((root) => {
    const id = root.getAttribute('data-testid');
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const text = n.textContent;
      const re = /\S+/g;
      let m;
      while ((m = re.exec(text))) {
        const r = document.createRange();
        r.setStart(n, m.index);
        r.setEnd(n, m.index + m[0].length);
        const rects = Array.from(r.getClientRects()).filter((x) => x.width > 0);
        const tops = new Set(rects.map((x) => Math.round(x.top)));
        if (tops.size > 1) out.split.push(id + ': ' + m[0]);
      }
    }
    const rb = root.getBoundingClientRect();
    root.querySelectorAll('*').forEach((c) => {
      const cb = c.getBoundingClientRect();
      if (cb.width && (cb.right > rb.right + 1 || cb.left < rb.left - 1)) out.overflow.push(id + ' child ' + (c.textContent || '').slice(0, 20));
      if (c.scrollWidth > c.clientWidth + 1 && getComputedStyle(c).overflow !== 'visible' && c.children.length === 0) out.overflow.push(id + ' clipped ' + (c.textContent || '').slice(0, 20));
    });
  });
  out.rects = roots.map((r) => { const b = r.getBoundingClientRect(); return [r.getAttribute('data-testid'), Math.round(b.left), Math.round(b.width), Math.round(b.height)]; });
  return out;
}
