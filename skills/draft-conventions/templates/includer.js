// _shared/includer.js
(async function () {
  const targets = document.querySelectorAll("[data-include]");
  await Promise.all(
    Array.from(targets).map(async (el) => {
      const url = el.getAttribute("data-include");
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(res.statusText);
        el.outerHTML = await res.text();
      } catch (e) {
        el.outerHTML = `<div style="padding:8px;background:#fee;color:#900">[include 실패: ${url}] ${e.message}</div>`;
      }
    })
  );
  document.dispatchEvent(new Event("partials:loaded"));
})();
