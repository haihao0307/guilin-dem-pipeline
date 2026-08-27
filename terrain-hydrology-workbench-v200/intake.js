function storageKey(scope, field) {
  return `terrain-hydrology-v200:${scope}:${field}`;
}

export function initializeIntake(panel, scope, path) {
  panel.dataset.scope = scope;
  const note = panel.querySelector('[data-note]');
  const tags = panel.querySelector('[data-tags]');
  const images = panel.querySelector('[data-images]');
  const gallery = panel.querySelector('[data-gallery]');
  const exportButton = panel.querySelector('[data-export]');
  const records = [];

  note.value = localStorage.getItem(storageKey(scope, 'note')) || '';
  tags.value = localStorage.getItem(storageKey(scope, 'tags')) || '';
  note.addEventListener('input', () => localStorage.setItem(storageKey(scope, 'note'), note.value));
  tags.addEventListener('input', () => localStorage.setItem(storageKey(scope, 'tags'), tags.value));

  images.addEventListener('change', () => {
    for (const file of images.files || []) {
      if (!file.type.startsWith('image/')) continue;
      const url = URL.createObjectURL(file);
      records.push({ name: file.name, type: file.type, bytes: file.size, lastModified: file.lastModified });
      const card = document.createElement('div');
      card.className = 'image-card';
      const image = document.createElement('img');
      image.src = url;
      image.alt = file.name;
      const label = document.createElement('span');
      label.textContent = file.name;
      card.append(image, label);
      gallery.append(card);
    }
    images.value = '';
  });

  exportButton.addEventListener('click', () => {
    const payload = {
      schema: 'terrain-hydrology-reference-intake@2.0.0',
      createdAt: new Date().toISOString(),
      scope,
      targetGitHubPath: path,
      note: note.value,
      tags: tags.value.split(/[,，;；\n]/).map((item) => item.trim()).filter(Boolean),
      files: records,
      rules: {
        sourceImagesRemainUnmodified: true,
        requiresDistillationBeforeProductionUse: true,
        referenceImagesCannotReplaceRealElevation: true,
      },
    };
    const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${scope}-terrain-hydrology-intake-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  });
}
