export const themeBootScript = `
(function () {
  try {
    var p = (window.location && window.location.pathname ? window.location.pathname : "/").replace(/\\/+$/, "") || "/";
    document.documentElement.setAttribute("data-path", p);
    document.documentElement.setAttribute("data-runtime-ready", "0");

    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.style.colorScheme = "light";
    document.documentElement.style.backgroundColor = "#f8fafc";

    var needsGate =
      p === "/" ||
      p.indexOf("/dashboard") === 0 ||
      p.indexOf("/u/") === 0 ||
      p.indexOf("/employers") === 0;
    if (needsGate) {
      var s = document.createElement("style");
      s.id = "runtime-gate";
      s.textContent =
        'html[data-runtime-ready="0"] [data-gemini-shell="1"]{opacity:0!important;pointer-events:none!important}' +
        'html[data-runtime-ready="0"][data-path^="/dashboard"] [data-mobile-nav-toggle="1"]{opacity:0!important;pointer-events:none!important}' +
        'html[data-runtime-ready="1"] [data-gemini-shell="1"]{opacity:1!important;pointer-events:auto!important;transition:opacity 100ms ease-out}';
      document.head.appendChild(s);
    }

    var revealTimeoutMs = p === "/dashboard/chat" ? 4500 : 1800;
    window.setTimeout(function () {
      if (document.documentElement.getAttribute("data-runtime-ready") !== "1") {
        document.documentElement.setAttribute("data-runtime-ready", "1");
      }
    }, revealTimeoutMs);
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.style.colorScheme = "light";
    document.documentElement.style.backgroundColor = "#f8fafc";
    document.documentElement.setAttribute("data-runtime-ready", "1");
  }
})();
`;
