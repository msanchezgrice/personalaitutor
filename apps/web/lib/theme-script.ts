export const themeBootScript = `
(function () {
  try {
    var p = (window.location && window.location.pathname ? window.location.pathname : "/").replace(/\\/+$/, "") || "/";
    document.documentElement.setAttribute("data-path", p);
    document.documentElement.setAttribute("data-runtime-ready", "0");
    var isLandingPath = p === "/";
    var isDashboardPath = p === "/dashboard" || p.indexOf("/dashboard/") === 0;
    var isPublicProfilePath = p.indexOf("/u/") === 0;

    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.style.colorScheme = "light";
    document.documentElement.style.backgroundColor = "#f8fafc";

    var needsGate = isDashboardPath || isLandingPath || isPublicProfilePath;
    if (needsGate) {
      var s = document.createElement("style");
      s.id = "runtime-gate";
      s.textContent =
        'html[data-runtime-ready="0"] [data-gemini-shell="1"]{opacity:0!important;pointer-events:none!important}' +
        'html[data-runtime-ready="0"][data-path^="/dashboard"] [data-mobile-nav-toggle="1"]{opacity:0!important;pointer-events:none!important}' +
        'html[data-runtime-ready="1"] [data-gemini-shell="1"]{opacity:1!important;pointer-events:auto!important;transition:opacity 100ms ease-out}';
      document.head.appendChild(s);
    }
    if (!needsGate) {
      document.documentElement.setAttribute("data-runtime-ready", "1");
    }
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.style.colorScheme = "light";
    document.documentElement.style.backgroundColor = "#f8fafc";
    document.documentElement.setAttribute("data-runtime-ready", "1");
  }
})();
`;
