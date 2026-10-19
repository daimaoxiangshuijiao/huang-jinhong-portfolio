/* Small portfolio actions: real Clipboard feedback, no background work. */
(() => {
  'use strict';
  const button = document.getElementById('contact-copy-email');
  const address = document.getElementById('contact-email-address');
  const status = document.getElementById('contact-copy-status');
  if (!button || !address || !status) return;
  const label = button.querySelector('span');
  let pending = false;
  const selectAddress = () => {
    const range = document.createRange();
    range.selectNodeContents(address);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    status.textContent = '已选中邮箱，请复制后粘贴联系。';
    label.textContent = '复制邮箱';
  };
  button.addEventListener('click', async () => {
    if (pending) return;
    pending = true;
    button.setAttribute('aria-busy', 'true');
    const email = address.textContent.trim();
    try {
      if (!navigator.clipboard?.writeText) { selectAddress(); return; }
      await navigator.clipboard.writeText(email);
      label.textContent = '已复制';
      status.textContent = '邮箱已复制，可以直接粘贴联系。';
    } catch {
      selectAddress();
    } finally {
      pending = false;
      button.removeAttribute('aria-busy');
    }
  });
})();
