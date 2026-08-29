const DB_NAME = 'terrain-hydrology-reference-cache-v210';
const DB_VERSION = 1;
const STORE_NAME = 'images';

function storageKey(scope, field) {
  return `terrain-hydrology-v200:${scope}:${field}`;
}

function openImageDatabase() {
  if (!('indexedDB' in window)) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('scope', 'scope', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('无法打开参考图缓存'));
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('参考图缓存操作失败'));
  });
}

async function loadScopeRecords(database, scope) {
  if (!database) return [];
  const transaction = database.transaction(STORE_NAME, 'readonly');
  const index = transaction.objectStore(STORE_NAME).index('scope');
  const records = await requestResult(index.getAll(scope));
  return records.sort((left, right) => left.addedAt - right.addedAt);
}

async function saveRecord(database, record) {
  if (!database) return;
  const transaction = database.transaction(STORE_NAME, 'readwrite');
  await requestResult(transaction.objectStore(STORE_NAME).put(record));
}

async function deleteRecord(database, key) {
  if (!database) return;
  const transaction = database.transaction(STORE_NAME, 'readwrite');
  await requestResult(transaction.objectStore(STORE_NAME).delete(key));
}

function bytesToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
  }
  return btoa(binary);
}

async function sha256Hex(buffer) {
  if (!crypto?.subtle) return null;
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function updateExportLabel(button, count) {
  button.textContent = count > 0 ? `导出含原图知识包（${count} 张）` : '导出含原图知识包';
}

function addHelp(panel) {
  if (panel.querySelector('[data-intake-help]')) return;
  const help = document.createElement('p');
  help.dataset.intakeHelp = 'true';
  help.className = 'intake-sync-note';
  help.textContent = '参考图会保存在当前浏览器，并可在刷新后恢复。小华无法直接读取你的浏览器缓存。选图后请点击“导出含原图知识包”，再把下载的 JSON 文件上传到对话，原图才会随包传给小华。';
  const gallery = panel.querySelector('[data-gallery]');
  panel.insertBefore(help, gallery);
}

function createImageCard(record, gallery, remove) {
  const card = document.createElement('div');
  card.className = 'image-card';
  card.dataset.imageKey = record.key;

  const image = document.createElement('img');
  const blob = new Blob([record.buffer], { type: record.type || 'application/octet-stream' });
  const objectUrl = URL.createObjectURL(blob);
  image.src = objectUrl;
  image.alt = record.name;
  image.addEventListener('load', () => URL.revokeObjectURL(objectUrl), { once: true });

  const label = document.createElement('span');
  label.textContent = record.name;

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'image-remove';
  removeButton.textContent = '移除';
  removeButton.title = `从当前浏览器缓存移除 ${record.name}`;
  removeButton.style.cssText = 'position:absolute;top:4px;right:4px;z-index:3;padding:3px 5px;border-radius:6px;background:rgba(0,0,0,.72);font-size:7px;';
  removeButton.addEventListener('click', () => remove(record, card));

  card.append(image, label, removeButton);
  gallery.append(card);
}

export function initializeIntake(panel, scope, path) {
  panel.dataset.scope = scope;
  const note = panel.querySelector('[data-note]');
  const tags = panel.querySelector('[data-tags]');
  const images = panel.querySelector('[data-images]');
  const gallery = panel.querySelector('[data-gallery]');
  const exportButton = panel.querySelector('[data-export]');
  const records = [];
  const recordKeys = new Set();
  let database = null;

  addHelp(panel);
  note.value = localStorage.getItem(storageKey(scope, 'note')) || '';
  tags.value = localStorage.getItem(storageKey(scope, 'tags')) || '';
  note.addEventListener('input', () => localStorage.setItem(storageKey(scope, 'note'), note.value));
  tags.addEventListener('input', () => localStorage.setItem(storageKey(scope, 'tags'), tags.value));
  updateExportLabel(exportButton, records.length);

  const remove = async (record, card) => {
    const index = records.findIndex((item) => item.key === record.key);
    if (index >= 0) records.splice(index, 1);
    recordKeys.delete(record.key);
    card.remove();
    await deleteRecord(database, record.key).catch(() => {});
    updateExportLabel(exportButton, records.length);
  };

  const addRecord = (record) => {
    if (recordKeys.has(record.key)) return false;
    recordKeys.add(record.key);
    records.push(record);
    createImageCard(record, gallery, remove);
    updateExportLabel(exportButton, records.length);
    return true;
  };

  openImageDatabase()
    .then(async (opened) => {
      database = opened;
      const restored = await loadScopeRecords(database, scope);
      restored.forEach(addRecord);
    })
    .catch((error) => {
      console.warn(`参考图浏览器缓存不可用: ${error.message}`);
    });

  images.addEventListener('change', async () => {
    images.disabled = true;
    try {
      for (const file of images.files || []) {
        if (!file.type.startsWith('image/')) continue;
        const buffer = await file.arrayBuffer();
        const sha256 = await sha256Hex(buffer);
        const key = `${scope}:${sha256 || `${file.name}:${file.size}:${file.lastModified}`}`;
        const record = {
          key,
          scope,
          name: file.name,
          type: file.type,
          bytes: file.size,
          lastModified: file.lastModified,
          addedAt: Date.now(),
          sha256,
          buffer,
        };
        if (addRecord(record)) await saveRecord(database, record).catch(() => {});
      }
    } finally {
      images.value = '';
      images.disabled = false;
    }
  });

  exportButton.addEventListener('click', async () => {
    exportButton.disabled = true;
    exportButton.textContent = '正在封装原图…';
    try {
      const files = records.map((record) => ({
        name: record.name,
        type: record.type,
        bytes: record.bytes,
        lastModified: record.lastModified,
        sha256: record.sha256,
        encoding: 'base64',
        dataBase64: bytesToBase64(record.buffer),
      }));
      const createdAt = new Date().toISOString();
      const intakeId = `${scope}-${createdAt.replace(/[:.]/g, '-')}`;
      const payload = {
        schema: 'terrain-hydrology-reference-intake@2.1.0',
        intakeId,
        createdAt,
        scope,
        targetGitHubPath: path,
        note: note.value,
        tags: tags.value.split(/[,，;；\n]/).map((item) => item.trim()).filter(Boolean),
        files,
        transfer: {
          sourceImagesEmbedded: true,
          imageEncoding: 'base64',
          imageCount: files.length,
          totalSourceBytes: files.reduce((sum, file) => sum + file.bytes, 0),
          instruction: '将本 JSON 上传到 ChatGPT 对话或交给 Codex，小华即可解包查看原始参考图。',
        },
        rules: {
          sourceImagesRemainUnmodified: true,
          requiresDistillationBeforeProductionUse: true,
          referenceImagesCannotReplaceRealElevation: true,
        },
      };
      const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${intakeId}.terrain-intake.json`;
      link.click();
      URL.revokeObjectURL(link.href);
    } finally {
      exportButton.disabled = false;
      updateExportLabel(exportButton, records.length);
    }
  });
}
