/* Counsel shell: one header and one menu on every page.
   Usage: <header class="top" id="top"></header><div class="shell"><nav class="rail" id="rail"></nav><main>…</main></div>
          <script src="shell.js" data-page="transfer"></script>  (before the page's own script) */
(function () {
  const NAV = [
    ["Practice", [
      ["agenda", "Agenda", "index.html#/agenda"],
      ["matters", "Matters", "index.html#/matters"],
      ["journal", "AI journal", "index.html#/journal"]]],
    ["Disputes", [
      ["credit", "Credit refusal", "index.html#/dispute", "HZ-2026-04417"],
      ["transfer", "Disputed transfer", "linked.html", "INV-2209"],
      ["promise", "Chatbot promise", "conversation.html", "C-0903-1841"]]],
    ["Controls", [
      ["decision", "Decision to payment", "binding.html#decision"],
      ["gate", "Payment gate", "binding.html#gate"]]]
  ];
  const me = document.currentScript, page = me.dataset.page || "";
  document.getElementById("top").innerHTML =
    `<a class="mark" href="index.html#/agenda">Counsel</a>
     <div class="go"><input id="goto" placeholder="Go to a receipt, a log line, a reference" autocomplete="off" spellcheck="false"><div id="gostatus"></div></div>
     <div class="firm"><span>Cabinet Laurent</span><div class="av">CL</div></div>`;
  const rail = document.getElementById("rail");
  rail.innerHTML = NAV.map(([group, items]) => `<div class="grp">${group}</div>` + items.map(([key, label, href, ref]) =>
      `<a class="nav" data-key="${key}" href="${href}"><span>${label}${ref ? `<small>${ref}</small>` : ""}</span><i id="n-${key}"></i></a>`).join("")).join("")
    + `<div class="rail-foot"><span>Every AI action is sealed by Recognitium and verifiable offline.</span><span id="mstatus"></span>${page === "index" ? `<button data-act="reset">Reset the demo</button>` : ""}</div>`;
  window.Shell = { setActive(key) { rail.querySelectorAll(".nav").forEach(a => a.classList.toggle("on", a.dataset.key === key)); } };
  if (page && page !== "index") Shell.setActive(page);
  if (page !== "index") document.getElementById("goto").addEventListener("keydown", e => {
    const q = e.target.value.trim();
    if (e.key === "Enter" && q) location.href = "index.html#" + encodeURIComponent(q);
  });
})();
