document.addEventListener("DOMContentLoaded", () => {
  const html = document.documentElement;
  const button = document.getElementById("theme-toggle");
  const icon = document.getElementById("theme-icon");
  const storedTheme = localStorage.getItem("theme");
  const activeTheme = storedTheme || html.getAttribute("data-theme") || "light";

  function applyTheme(theme) {
    if (theme === "light") {
      html.setAttribute("data-theme", "light");
      if (icon) {
        icon.classList.remove("fa-sun");
        icon.classList.add("fa-moon");
      }
      if (button) {
        button.classList.remove("text-white", "border-white/10");
        button.classList.add("text-gray-800", "border-gray-300");
      }
    } else {
      html.removeAttribute("data-theme");
      if (icon) {
        icon.classList.remove("fa-moon");
        icon.classList.add("fa-sun");
      }
      if (button) {
        button.classList.remove("text-gray-800", "border-gray-300");
        button.classList.add("text-white", "border-white/10");
      }
    }
    localStorage.setItem("theme", theme);
  }

  applyTheme(activeTheme);

  if (button) {
    button.addEventListener("click", () => {
      const nextTheme = html.getAttribute("data-theme") === "light" ? "dark" : "light";
      applyTheme(nextTheme);
    });
  }
});
