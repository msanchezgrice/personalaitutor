export const themeBootScript = `
(function () {
  try {
    var p = (window.location && window.location.pathname ? window.location.pathname : "/").replace(/\\/+$/, "") || "/";
    var isDashboardPath = p === "/dashboard" || p.indexOf("/dashboard/") === 0;
    var isPublicProfilePath = p.indexOf("/u/") === 0;
    var isEmployersPath = p === "/employers" || p.indexOf("/employers/") === 0;
    var shouldHoldForStyles = p === "/" || isDashboardPath || isPublicProfilePath || isEmployersPath;
    var revealed = false;
    var probeId = "__aitutor_style_probe__";
    var shouldHoldForRuntime = isDashboardPath || p === "/employers/talent";

    document.documentElement.setAttribute("data-path", p);
    document.documentElement.setAttribute("data-runtime-ready", shouldHoldForRuntime ? "0" : "1");
    document.documentElement.setAttribute("data-style-ready", shouldHoldForStyles ? "0" : "1");

    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.style.colorScheme = "light";
    document.documentElement.style.backgroundColor = "#f8fafc";

    function syncBodyPath() {
      if (!document.body) {
        window.requestAnimationFrame(syncBodyPath);
        return;
      }
      document.body.setAttribute("data-path", p);
    }

    function styleProbeReady() {
      if (!document.body) return false;
      var probe = document.getElementById(probeId);
      var sharedStylesheet = document.getElementById("app-shared-stylesheet");
      if (!probe) {
        probe = document.createElement("div");
        probe.id = probeId;
        probe.setAttribute("aria-hidden", "true");
        probe.className = "sticky top-0 px-4 py-2";
        probe.style.position = "fixed";
        probe.style.left = "-9999px";
        probe.style.top = "-9999px";
        probe.style.visibility = "hidden";
        probe.style.pointerEvents = "none";
        document.body.appendChild(probe);
      }
      if (!sharedStylesheet) {
        sharedStylesheet = document.querySelector('link[rel="stylesheet"][href="/styles.css"]');
      }
      var styles = window.getComputedStyle(probe);
      var sharedStylesReady = styles.getPropertyValue("--aitutor-shared-styles-ready").trim() === "1";
      var stylesheetReady = !!(sharedStylesheet && sharedStylesheet.sheet);
      return styles.position === "sticky" && parseFloat(styles.paddingLeft || "0") >= 15 && sharedStylesReady && stylesheetReady;
    }

    function revealStyles() {
      if (revealed) return;
      revealed = true;
      document.documentElement.setAttribute("data-style-ready", "1");
      var probe = document.getElementById(probeId);
      if (probe && probe.parentNode) {
        probe.parentNode.removeChild(probe);
      }
    }

    syncBodyPath();

    if (shouldHoldForStyles) {
      var startedAt = Date.now();
      var tick = function () {
        if (styleProbeReady() || Date.now() - startedAt > 2200) {
          revealStyles();
          return;
        }
        window.requestAnimationFrame(tick);
      };

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
          window.requestAnimationFrame(tick);
        }, { once: true });
      } else {
        window.requestAnimationFrame(tick);
      }

      window.addEventListener("load", revealStyles, { once: true });
    }
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.style.colorScheme = "light";
    document.documentElement.style.backgroundColor = "#f8fafc";
    document.documentElement.setAttribute("data-runtime-ready", "1");
    document.documentElement.setAttribute("data-style-ready", "1");
  }
})();
`;
