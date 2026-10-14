document.addEventListener('DOMContentLoaded', async () => {
  const btn = document.getElementById('ImportBtn');
  const linksContainer = document.getElementById('links');
  const status = document.createElement('p');
  document.body.appendChild(status);
  const showError = () => {
    status.textContent = 'Could not read this page. Grant GameBanana site access, reload the page and reopen the popup.';
    btn.disabled = false;
    btn.textContent = 'Retry';
    btn.onclick = () => location.reload();
  };
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return showError();
    chrome.tabs.sendMessage(tab.id, { type: 'GET_MOD_INFO' }, (modInfo) => {
      if (chrome.runtime.lastError) return showError();
      if (!modInfo || !Array.isArray(modInfo.downloadLinks) || modInfo.downloadLinks.length === 0) {
        status.textContent = 'No mod downloads available. Open a GameBanana mod page and try again.';
        return;
      }
      modInfo.downloadLinks.forEach(info => {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.dataset.filename = info.filename;
        input.dataset.href = info.href;
        const title = document.createElement('b');
        title.textContent = info.filename;
        label.appendChild(input);
        label.appendChild(title);
        linksContainer.appendChild(label);
        linksContainer.appendChild(document.createElement('br'));
      });
      btn.disabled = false;
      btn.onclick = () => {
        const checked = [...linksContainer.querySelectorAll('input[type="checkbox"]:checked')].map(input => ({
          filename: input.dataset.filename, href: input.dataset.href
        }));
        if (checked.length === 0) {
          status.textContent = 'Please select at least one file.';
          return;
        }
        const payload = {
          modName: modInfo.modName, modSource: modInfo.modSource,
          characterName: modInfo.characterName, coverImageLink: modInfo.coverImageLink,
          downloadLinks: checked
        };
        const bytes = new TextEncoder().encode(JSON.stringify(payload));
        let binary = '';
        for (const byte of bytes) binary += String.fromCharCode(byte);
        try {
          window.open(`peakymodmanager://import?data=${encodeURIComponent(btoa(binary))}`);
          status.textContent = 'Launch requested. Check PMM for the import; if it did not open, install or repair its URL handler and retry.';
        } catch {
          status.textContent = 'Could not request PMM launch. Install or repair its URL handler and retry.';
        }
        btn.textContent = 'Request launch again';
        btn.disabled = false;
      };
    });
  } catch {
    showError();
  }
});
