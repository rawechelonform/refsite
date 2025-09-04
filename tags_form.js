form.addEventListener('submit', (event) => {
  const f = form.querySelector('input[type="file"]');
  const file = f.files && f.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { // 10MB
    event.preventDefault();
    msg.className = 'err';
    msg.textContent = 'file too large (max 10mb)';
    return;
  }
});
