import { getDocument, GlobalWorkerOptions } from './vendor/pdfjs/pdf.mjs';

GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.mjs', import.meta.url).href;

export function mountPdfViewer(root, src) {
  const canvas = root.querySelector('canvas');
  const status = root.querySelector('[data-pdf-status]');
  const current = root.querySelector('[data-pdf-page]');
  const total = root.querySelector('[data-pdf-total]');
  const prev = root.querySelector('[data-pdf-prev]');
  const next = root.querySelector('[data-pdf-next]');

  let pdf = null;
  let pageNo = 1;
  let renderTask = null;
  let loadingTask = null;
  let destroyed = false;
  let resizeTimer = null;

  const sync = () => {
    current.textContent = String(pageNo);
    total.textContent = pdf ? String(pdf.numPages) : '…';
    prev.disabled = !pdf || pageNo <= 1;
    next.disabled = !pdf || pageNo >= pdf.numPages;
  };

  const render = async () => {
    if (!pdf || destroyed) return;
    status.textContent = `正在加载第 ${pageNo} 页…`;
    canvas.classList.add('is-turning');
    renderTask?.cancel();
    const page = await pdf.getPage(pageNo);
    if (destroyed) return;

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
    try {
      await renderTask.promise;
      if (!destroyed) {
        status.textContent = `第 ${pageNo} 页，共 ${pdf.numPages} 页`;
        requestAnimationFrame(() => canvas.classList.remove('is-turning'));
      }
    } catch (error) {
      if (error?.name !== 'RenderingCancelledException' && !destroyed) {
        canvas.classList.remove('is-turning');
        status.textContent = '这一页暂时无法显示，请使用“新窗口打开”阅读。';
      }
    }
  };

  const go = (delta) => {
    if (!pdf) return;
    pageNo = Math.max(1, Math.min(pdf.numPages, pageNo + delta));
    sync();
    render();
  };

  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));

  const observer = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 140);
  });
  observer.observe(root);

  loadingTask = getDocument({ url: src });
  loadingTask.promise.then((doc) => {
    if (destroyed) { doc.destroy(); return; }
    pdf = doc;
    sync();
    render();
  }).catch((error) => {
    console.error('PDF preview failed', error);
    if (!destroyed) status.textContent = 'PDF 预览加载失败，请使用“新窗口打开”或“下载 PDF”。';
  });

  sync();
  return () => {
    destroyed = true;
    clearTimeout(resizeTimer);
    observer.disconnect();
    renderTask?.cancel();
    loadingTask?.destroy();
    pdf?.destroy();
  };
}
