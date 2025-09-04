form.addEventListener('submit', async (event)=>{
  event.preventDefault(); // stop browser form submission
  clearStatus();

  const file = fileInput.files && fileInput.files[0];
  if (!file){
    setStatus('no image uploaded.');
    return;
  }
  if (!['image/png','image/jpeg','image/webp'].includes(file.type)){
    setStatus('png/jpeg/webp only');
    return;
  }
  if (file.size > 10 * 1024 * 1024){
    setStatus('file size limit: 10mb.');
    return;
  }

  // normalize text
  ['hid-title','hid-city','hid-country'].forEach(id=>{
    const el = document.getElementById(id);
    if (el) el.value = (el.value||'').toLowerCase().slice(0,30);
  });

  // Build form data
  const fd = new FormData();
  fd.append('sticker', file);
  fd.append('title', document.getElementById('hid-title').value);
  fd.append('city', document.getElementById('hid-city').value);
  fd.append('country', document.getElementById('hid-country').value);

  btn.disabled = true;
  btn.textContent = '<GO>';

  try {
    const resp = await fetch("https://script.google.com/macros/s/AKfycbxv3FKB0P30wixxKJUfYvTnCW9vzqgar4JV7PArIpirC9lk7Srpqe3SNDKIcCIvjs_4/exec", {
      method: "POST",
      body: fd,
    });

    const data = await resp.json().catch(()=>null);

    btn.disabled = false;
    btn.textContent = '<GO>';

    if (data && data.ok){
      setStatus('tag submitted. it may take a few days to see tag added to the wall.');
      form.reset();
      fileStatus && (fileStatus.textContent = '');
    } else {
      setStatus((data && data.error) ? data.error.toLowerCase() : 'upload failed.');
    }
  } catch (err){
    btn.disabled = false;
    btn.textContent = '<GO>';
    setStatus('network error.');
    console.error(err);
  }
});
