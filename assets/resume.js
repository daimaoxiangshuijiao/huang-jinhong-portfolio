(() => {
  'use strict';
  // Keep previously cached wrapper markup on the current, directly served PDF.
  const file = 'resume-20261019.pdf';
  const viewer = document.getElementById('viewer');
  const download = document.getElementById('download');
  if (viewer) {
    if (!viewer.getAttribute('src')?.startsWith(file)) viewer.src = file + '#view=FitH';
    viewer.hidden = false;
  }
  if (download) {
    download.href = file;
    download.hidden = false;
  }
  const status = document.getElementById('status');
  if (status) status.hidden = true;
})();
