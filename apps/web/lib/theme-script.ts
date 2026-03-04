export const themeBootScript = `
(function () {
  try {
    var p = (window.location && window.location.pathname ? window.location.pathname : "/").replace(/\\/+$/, "") || "/";
    document.documentElement.setAttribute("data-path", p);
    document.documentElement.setAttribute("data-runtime-ready", "0");

    var ai = localStorage.getItem("ai_theme");
    var legacy = localStorage.getItem("theme");
    var t = "light";
    if (ai === "light" || ai === "dark") {
      t = ai;
    } else if (legacy === "light") {
      t = "light";
    }

    localStorage.setItem("theme", t);
    localStorage.setItem("ai_theme", t);
    document.documentElement.setAttribute("data-theme", t);
    document.documentElement.style.colorScheme = t === "dark" ? "dark" : "light";
    document.documentElement.style.backgroundColor = t === "dark" ? "#0f111a" : "#f8fafc";

    var needsGate = p.indexOf("/dashboard") === 0 || p.indexOf("/u/") === 0 || p.indexOf("/employers/talent") === 0;
    if (needsGate) {
      var s = document.createElement("style");
      s.id = "runtime-gate";
      s.textContent =
        'html[data-runtime-ready="0"][data-path^="/dashboard"] body > div:first-child{opacity:0!important;pointer-events:none!important}' +
        'html[data-runtime-ready="0"][data-path^="/dashboard"] aside,html[data-runtime-ready="0"][data-path^="/dashboard"] main{opacity:0!important}' +
        'html[data-runtime-ready="0"][data-path^="/u/"] main{opacity:0!important}' +
        'html[data-runtime-ready="0"][data-path^="/employers/talent"] .grid.md\\\\:grid-cols-2.lg\\\\:grid-cols-3.gap-6{opacity:0!important}' +
        'html[data-runtime-ready="1"][data-path^="/dashboard"] body > div:first-child{transition:opacity 120ms ease-out;opacity:1!important;pointer-events:auto!important}' +
        'html[data-runtime-ready="1"][data-path^="/dashboard"] aside,html[data-runtime-ready="1"][data-path^="/dashboard"] main,html[data-runtime-ready="1"][data-path^="/u/"] main,html[data-runtime-ready="1"][data-path^="/employers/talent"] .grid.md\\\\:grid-cols-2.lg\\\\:grid-cols-3.gap-6{transition:opacity 120ms ease-out;opacity:1!important}';
      document.head.appendChild(s);
    }

    window.setTimeout(function () {
      if (document.documentElement.getAttribute("data-runtime-ready") !== "1") {
        document.documentElement.setAttribute("data-runtime-ready", "1");
      }
    }, 10000);
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.style.colorScheme = "light";
    document.documentElement.setAttribute("data-runtime-ready", "1");
  }
})();
`;
