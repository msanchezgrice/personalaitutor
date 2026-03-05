export const themeBootScript = `
(function () {
  try {
    var p = (window.location && window.location.pathname ? window.location.pathname : "/").replace(/\\/+$/, "") || "/";
    document.documentElement.setAttribute("data-path", p);
    document.documentElement.setAttribute("data-runtime-ready", "1");

    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.style.colorScheme = "light";
    document.documentElement.style.backgroundColor = "#f8fafc";
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.style.colorScheme = "light";
    document.documentElement.style.backgroundColor = "#f8fafc";
    document.documentElement.setAttribute("data-runtime-ready", "1");
  }
})();
`;
