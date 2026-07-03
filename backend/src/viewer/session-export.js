/* Session Export — fetch markdown export + copy to clipboard */

/** Export current session as markdown. */
async function exportSession() {
  const sessionId = document.getElementById('sess-detail-id')?.textContent;
  if (!sessionId) return;
  const btn = document.getElementById('export-btn');
  if (btn) btn.textContent = '⏳ Exporting...';
  try {
    const r = await fetch(API + '/sessions/' + sessionId + '/export');
    if (!r.ok) throw new Error('Export failed: ' + r.status);
    const markdown = await r.text();
    await copyToClipboard(markdown);
    if (btn) btn.textContent = '✅ Copied!';
    setTimeout(() => { if (btn) btn.textContent = '📋 Export'; }, 2000);
  } catch (e) {
    console.error('[export]', e);
    if (btn) btn.textContent = '❌ Failed';
    setTimeout(() => { if (btn) btn.textContent = '📋 Export'; }, 2000);
  }
}

/** Copy text to clipboard with fallback. */
async function copyToClipboard(text) {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
  } else {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}
