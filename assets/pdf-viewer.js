import { getDocument, GlobalWorkerOptions } from './vendor/pdfjs/pdf.mjs';

GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.mjs', import.meta.url).href;

export function mountPdfViewer(root, source) {
  const canvas = root.querySelector('canvas');
  const status = root.querySelector('[data-pdf-status]');
  const progress = root.querySelector('[data-pdf-progress]');
  const current = root.querySelector('[data-pdf-page]');
  const total = root.querySelector('[data-pdf-total]');
  const prev = root.querySelector('[data-pdf-prev]');
  const next = root.querySelector('[data-pdf-next]');

  const totalPages = source.pages;
  const chunkPages = source.chunkPages;
  let pdf = null;
  let chunkNo = 0;
  let chunkFirst = 1;
  let pageNo = 1;
  let renderTask = null;
  let loadingTask = null;
  let downloadController = null;
  let destroyed = false;
  let resizeTimer = null;
  let loadSequence = 0;
  let renderSequence = 0;
  let isLoading = false;

  root.tabIndex = 0;

  const setProgress = (value) => {
    if (progress) progress.style.transform = `scaleX(${Math.max(0, Math.min(1, value))})`;
  };

  const sync = () => {
    current.textContent = String(pageNo);
    total.textContent = String(totalPages);
    prev.disabled = isLoading || pageNo <= 1;
    next.disabled = isLoading || pageNo >= totalPages;
  };

  const render = async () => {
    if (!pdf || destroyed) return;
    const sequence = ++renderSequence;
    const doc = pdf;
    const targetPage = pageNo;
    const localPage = targetPage - chunkFirst + 1;
    if (localPage < 1 || localPage > doc.numPages) return;
    status.textContent = `正在打开第 ${targetPage} 页…`;
    canvas.classList.add('is-turning');
    renderTask?.cancel();
    try {
      const page = await doc.getPage(localPage);
      if (destroyed || sequence !== renderSequence || doc !== pdf) return;
      const base = page.getViewport({ scale: 1 });
      const available = Math.max(280, root.clientWidth - 32);
      const scale = Math.min(1.65, available / base.width);
      const viewport = page.getViewport({ scale });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const context = canvas.getContext('2d', { alpha: false });

      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      renderTask = page.render({
        canvasContext: context,
        viewport,
        transform: dpr === 1 ? null : [dpr, 0, 0, dpr, 0, 0],
      });
      await renderTask.promise;
      if (!destroyed && sequence === renderSequence && doc === pdf && targetPage === pageNo) {
        status.textContent = `第 ${targetPage} 页，共 ${totalPages} 页`;
        requestAnimationFrame(() => canvas.classList.remove('is-turning'));
      }
    } catch (error) {
      if (error?.name !== 'RenderingCancelledException' && !destroyed) {
        canvas.classList.remove('is-turning');
        status.textContent = '这一页暂时无法显示，请使用“新窗口打开”阅读。';
      }
    }
  };

  const loadChunkFor = async (targetPage) => {
    const wantedChunk = Math.floor((targetPage - 1) / chunkPages) + 1;
    if (pdf && wantedChunk === chunkNo) return render();

    const sequence = ++loadSequence;
    renderSequence++;
    downloadController?.abort();
    renderTask?.cancel();
    const oldPdf = pdf;
    const oldLoadingTask = loadingTask;
    pdf = null;
    loadingTask = null;
    chunkNo = 0;
    if (oldPdf) oldPdf.destroy().catch(() => {});
    else oldLoadingTask?.destroy();
    downloadController = new AbortController();
    const first = (wantedChunk - 1) * chunkPages + 1;
    const last = Math.min(first + chunkPages - 1, totalPages);
    status.textContent = `正在加载第 ${first}–${last} 页…`;
    setProgress(0.04);
    isLoading = true;
    sync();

    try {
      const response = await fetch(source.chunkUrl(wantedChunk), {
        cache: 'no-cache', signal: downloadController.signal,
      });
      if (!response.ok) throw new Error(`PDF request failed: ${response.status}`);
      const totalBytes = Number(response.headers.get('content-length')) || 0;
      let bytes;
      if (response.body?.getReader) {
        const reader = response.body.getReader();
        const chunks = [];
        let received = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.byteLength;
          if (!destroyed && sequence === loadSequence) {
            const ratio = totalBytes ? received / totalBytes : Math.min(.9, received / 1572864);
            setProgress(ratio);
            const label = totalBytes ? `${Math.round(ratio * 100)}%` : `${(received / 1048576).toFixed(1)} MB`;
            status.textContent = `正在加载第 ${first}–${last} 页：${label}`;
          }
        }
        bytes = new Uint8Array(received);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      } else {
        bytes = new Uint8Array(await response.arrayBuffer());
      }
      if (destroyed || sequence !== loadSequence) return;
      setProgress(1);
      status.textContent = '下载完成，正在打开…';
      loadingTask = getDocument({ data: bytes });
      const doc = await loadingTask.promise;
      if (destroyed || sequence !== loadSequence) { await doc.destroy(); return; }
      pdf = doc;
      chunkNo = wantedChunk;
      chunkFirst = first;
      isLoading = false;
      sync();
      await render();
    } catch (error) {
      if (error?.name === 'AbortError' || destroyed || sequence !== loadSequence) return;
      console.error('PDF preview failed', error);
      isLoading = false;
      sync();
      setProgress(0);
      status.textContent = 'PDF 预览加载失败，请使用“新窗口打开”或“下载 PDF”。';
    }
  };

  const go = (delta) => {
    const wanted = Math.max(1, Math.min(totalPages, pageNo + delta));
    if (wanted === pageNo) return;
    pageNo = wanted;
    sync();
    loadChunkFor(pageNo);
  };

  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    if (event.target instanceof HTMLButtonElement || event.target instanceof HTMLAnchorElement) return;
    event.preventDefault();
    go(event.key === 'ArrowRight' ? 1 : -1);
  });

  const observer = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 140);
  });
  observer.observe(root);
  sync();
  loadChunkFor(1);

  return () => {
    destroyed = true;
    loadSequence++;
    clearTimeout(resizeTimer);
    observer.disconnect();
    renderTask?.cancel();
    downloadController?.abort();
    if (pdf) pdf.destroy();
    else loadingTask?.destroy();
  };
}
