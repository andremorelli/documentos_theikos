// ================= ESTADO GLOBAL =================
const estado = {
  pdfs: [],
  docs: [],
  fotos: [],
  busca: ''
};

// ================= ABAS =================
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// ================= BUSCA =================
document.getElementById('search').addEventListener('input', e => {
  estado.busca = e.target.value.toLowerCase().trim();
  renderizarTudo();
});

function filtrar(lista) {
  if (!estado.busca) return lista;
  return lista.filter(i => i.nome.toLowerCase().includes(estado.busca));
}

// ================= CARREGAR CATÁLOGO =================
async function carregarCatalogo() {
  // Evita erro no file://
  if (location.protocol === 'file:') {
    console.warn('⚠️ Rodando via file:// — use Live Server para carregar o arquivos.json.');
    renderizarTudo();
    return;
  }

  try {
    const resp = await fetch('arquivos.json');
    if (!resp.ok) throw new Error('arquivos.json não encontrado');
    const dados = await resp.json();
    estado.pdfs = dados.pdfs || [];
    estado.docs = dados.docs || [];
    estado.fotos = dados.fotos || [];
  } catch (e) {
    console.warn('Falha ao carregar arquivos.json:', e);
  }
  renderizarTudo();
}

// ================= RENDERIZAR PDFs e DOCS =================
function renderArquivos(lista, containerId, emptyId, icone) {
  const container = document.getElementById(containerId);
  const empty = document.getElementById(emptyId);
  const filtrados = filtrar(lista);

  if (!filtrados.length) {
    container.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  container.innerHTML = filtrados.map(item => `
    <div class="card">
      <div class="icon">${icone}</div>
      <h3>${item.nome}</h3>
      
      <!-- Botão Baixar: usa o atributo download -->
      <a href="${item.arquivo}" download="${item.nome}" style="background:#3498db;">⬇ Baixar</a>
      
      <!-- Botão Ver: abre o PDF direto no navegador em nova aba (se for PDF) -->
      ${item.arquivo.toLowerCase().endsWith('.pdf') ? `<a href="${item.arquivo}" target="_blank" rel="noopener" style="margin-left:6px;background:#2ecc71;">👁 Ver</a>` : ''}
    </div>
  `).join('');
}

// ================= RENDERIZAR FOTOS =================
function renderFotos(lista, containerId, emptyId) {
  const container = document.getElementById(containerId);
  const empty = document.getElementById(emptyId);
  const filtrados = filtrar(lista);

  if (!filtrados.length) {
    container.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  container.innerHTML = filtrados.map(foto => `
    <div class="card foto">
      <img src="${foto.arquivo}" alt="${foto.nome}" loading="lazy">
      <h3>${foto.nome}</h3>
      <a href="${foto.arquivo}" download>⬇ Baixar Foto</a>
    </div>
  `).join('');

  container.querySelectorAll('img').forEach(img => {
    img.addEventListener('click', () => abrirModal(img.src, img.alt));
  });
}

// ================= MODAL =================
const modal = document.getElementById('modal');
const modalImg = document.getElementById('modal-img');
const caption = document.getElementById('caption');

function abrirModal(src, alt) {
  modal.classList.add('show');
  modalImg.src = src;
  caption.textContent = alt;
}

document.querySelector('.close').addEventListener('click', () => modal.classList.remove('show'));
modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('show'); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') modal.classList.remove('show'); });

// ================= INDEXEDDB (UPLOAD LOCAL) =================
const DB_NAME = 'CentralArquivosDB';
const STORE = 'arquivos';
let db;

function abrirDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = e => { db = e.target.result; resolve(db); };
    req.onerror = e => reject(e.target.error);
  });
}

function salvarArquivo(registro) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).add(registro);
    req.onsuccess = () => resolve(req.result);
    req.onerror = e => reject(e.target.error);
  });
}

function listarArquivos() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = e => reject(e.target.error);
  });
}

function removerArquivo(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = e => reject(e.target.error);
  });
}

// ================= UPLOAD =================
function tipoDeArquivo(nome) {
  const ext = nome.split('.').pop().toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (['doc','docx','xls','xlsx','txt'].includes(ext)) return 'doc';
  if (['jpg','jpeg','png','gif','webp'].includes(ext)) return 'foto';
  return 'outro';
}

function iconeDe(t) {
  return t === 'pdf' ? '📄' : t === 'doc' ? '📝' : t === 'foto' ? '🖼️' : '📁';
}

const input = document.getElementById('file-input');
const dropLabel = document.querySelector('.upload-label');

async function processarArquivos(files) {
  for (const file of files) {
    const buffer = await file.arrayBuffer();
    await salvarArquivo({
      nome: file.name,
      tipo: tipoDeArquivo(file.name),
      tamanho: file.size,
      blob: new Blob([buffer], { type: file.type }),
      criadoEm: Date.now()
    });
  }
  await renderizarLocais();
}

input.addEventListener('change', async e => {
  await processarArquivos(e.target.files);
  input.value = '';
});

['dragenter','dragover'].forEach(evt => dropLabel.addEventListener(evt, e => {
  e.preventDefault(); dropLabel.classList.add('dragover');
}));
['dragleave','drop'].forEach(evt => dropLabel.addEventListener(evt, e => {
  e.preventDefault(); dropLabel.classList.remove('dragover');
}));
dropLabel.addEventListener('drop', async e => {
  await processarArquivos(e.dataTransfer.files);
});

// ================= RENDERIZAR LOCAIS =================
async function renderizarLocais() {
  const container = document.getElementById('local-list');
  const empty = document.getElementById('local-empty');
  if (!container || !db) return;

  const lista = await listarArquivos();
  const filtrados = estado.busca
    ? lista.filter(i => i.nome.toLowerCase().includes(estado.busca))
    : lista;

  if (!filtrados.length) {
    container.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  container.innerHTML = filtrados.map(item => {
    const url = URL.createObjectURL(item.blob);
    const isFoto = item.tipo === 'foto';
    const isPdf = item.tipo === 'pdf';
    return `
      <div class="card ${isFoto ? 'foto' : ''}" data-id="${item.id}">
        ${isFoto ? `<img src="${url}" alt="${item.nome}">` : `<div class="icon">${iconeDe(item.tipo)}</div>`}
        <h3>${item.nome}</h3>
        <a href="${url}" download="${item.nome}">⬇ Baixar</a>
        ${isPdf ? `<a href="${url}" target="_blank" style="margin-left:6px;background:#2ecc71;">👁 Ver</a>` : ''}
        <button class="btn-remove" data-id="${item.id}">🗑 Remover</button>
      </div>
    `;
  }).join('');

  container.querySelectorAll('img').forEach(img => {
    img.addEventListener('click', () => abrirModal(img.src, img.alt));
  });
  container.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Remover este arquivo?')) {
        await removerArquivo(Number(btn.dataset.id));
        await renderizarLocais();
      }
    });
  });
}

// ================= RENDERIZAR TUDO =================
function renderizarTudo() {
  renderArquivos(estado.pdfs, 'pdf-list', 'pdf-empty', '📄');
  renderArquivos(estado.docs, 'docs-list', 'docs-empty', '📝');
  renderFotos(estado.fotos, 'fotos-list', 'fotos-empty');
  renderizarLocais();
}

// ================= INICIAR =================
abrirDB()
  .then(() => {
    renderizarLocais();
    carregarCatalogo();
  })
  .catch(err => console.error('Erro IndexedDB:', err));