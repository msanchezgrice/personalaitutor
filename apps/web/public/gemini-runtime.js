(function () {
  var currentPath = window.location.pathname.replace(/\/+$/, "") || "/";
  if (document && document.documentElement) {
    document.documentElement.setAttribute("data-path", currentPath);
  }
  if (document && document.body) {
    document.body.setAttribute("data-path", currentPath);
  }
  var CTX_KEY = "ai_tutor_user_ctx_v1";
  var isDashboardPath = currentPath === "/dashboard" || currentPath.indexOf("/dashboard/") === 0;

  function uuidv4() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (char) {
      var random = Math.floor(Math.random() * 16);
      var value = char === "x" ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    });
  }

  function readCtx() {
    try {
      var raw = window.localStorage.getItem(CTX_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function saveCtx(ctx) {
    try {
      window.localStorage.setItem(CTX_KEY, JSON.stringify(ctx));
    } catch {
      return null;
    }
  }

  function ensureCtx() {
    var existing = readCtx();
    if (existing && typeof existing === "object") {
      if (!existing.userId) {
        existing.sessionId = null;
        existing.projectId = null;
        existing.handle = null;
        existing.avatarUrl = null;
      }
      return existing;
    }

    var created = {
      userId: null,
      name: "New Learner",
      handle: null,
      sessionId: null,
      projectId: null,
      careerPathId: "product-management",
      avatarUrl: null,
      email: null,
    };
    saveCtx(created);
    return created;
  }

  var ctx = ensureCtx();
  var hasAppliedAuthCtx = false;

  function applyCtxImmediately() {
    if (!ctx || !ctx.name || !isDashboardPath) return;
    var sidebarProfileLink = document.querySelector("aside a[href='/dashboard/profile/'], aside a[href='/dashboard/profile']");
    if (sidebarProfileLink) {
      var nameEl = sidebarProfileLink.querySelector(".font-medium");
      var roleEl = sidebarProfileLink.querySelector(".text-xs");
      if (nameEl) nameEl.textContent = ctx.name;
      if (roleEl && ctx.headline) roleEl.textContent = ctx.headline;
      var sidebarAvatar = sidebarProfileLink.querySelector("img");
      if (sidebarAvatar && ctx.avatarUrl) {
        sidebarAvatar.setAttribute("src", ctx.avatarUrl);
        sidebarAvatar.setAttribute("alt", ctx.name);
      }
    }
    if (ctx.handle) {
      Array.prototype.forEach.call(
        document.querySelectorAll("a[href='/u/alex-chen-ai/'], a[href='/u/test-user-0001/'], a[href='/u/alex-chen-ai'], a[href='/u/test-user-0001']"),
        function (node) {
          node.setAttribute("href", "/u/" + ctx.handle + "/");
        },
      );
    }
    renameSocialNavLabels();
  }

  // Patch sidebar from cached ctx immediately (before any async API calls)
  // so users don't see placeholder "Alex Chen" flash on tab switch.
  applyCtxImmediately();

  function byText(selector, text) {
    return Array.prototype.find.call(document.querySelectorAll(selector), function (el) {
      return (el.textContent || "").trim().indexOf(text) !== -1;
    });
  }

  function setText(node, value) {
    if (!node) return;
    node.textContent = value;
  }

  function setHref(node, value) {
    if (!node || !value) return;
    node.setAttribute("href", value);
  }

  function renameSocialNavLabels() {
    Array.prototype.forEach.call(
      document.querySelectorAll("a[href='/dashboard/social/'], a[href='/dashboard/social']"),
      function (node) {
        if (typeof node.innerHTML === "string" && node.innerHTML.indexOf("Social Hooks") !== -1) {
          node.innerHTML = node.innerHTML.replace(/Social Hooks/g, "Social Media");
        }
      },
    );
  }

  function normalizeUrl(value) {
    var raw = typeof value === "string" ? value.trim() : "";
    if (!raw) return "";
    if (!/^https?:\/\//i.test(raw)) {
      raw = "https://" + raw;
    }
    try {
      return new URL(raw).toString();
    } catch {
      return "";
    }
  }

  function toast(message, isError) {
    var node = document.createElement("div");
    node.textContent = message;
    node.style.position = "fixed";
    node.style.right = "16px";
    node.style.bottom = "16px";
    node.style.zIndex = "9999";
    node.style.padding = "10px 14px";
    node.style.borderRadius = "10px";
    node.style.fontSize = "12px";
    node.style.border = "1px solid " + (isError ? "rgba(239,68,68,0.5)" : "rgba(16,185,129,0.5)");
    node.style.background = isError ? "rgba(127,29,29,0.9)" : "rgba(6,78,59,0.9)";
    node.style.color = "#fff";
    document.body.appendChild(node);
    window.setTimeout(function () {
      node.remove();
    }, 2800);
  }

  function isUnauthenticatedError(err) {
    if (!err) return false;
    if (err.code === "UNAUTHENTICATED") return true;
    if (typeof err.message === "string" && err.message.toLowerCase().indexOf("sign in required") !== -1) return true;
    return false;
  }

  function redirectToSignIn(path) {
    window.location.href = "/sign-in?redirect_url=" + encodeURIComponent(path || "/dashboard/");
  }

  function requestHeaders(json) {
    var headers = {
      "cache-control": "no-store",
    };
    if (ctx.userId) {
      headers["x-user-id"] = ctx.userId;
    }
    if (json) headers["content-type"] = "application/json";
    return headers;
  }

  function pathWithUserId(path) {
    if (!ctx.userId) return path;
    var delimiter = path.indexOf("?") === -1 ? "?" : "&";
    return path + delimiter + "userId=" + encodeURIComponent(ctx.userId);
  }

  var authRequiredPaths = [
    "/dashboard",
    "/dashboard/chat",
    "/dashboard/projects",
    "/dashboard/social",
    "/dashboard/updates",
    "/dashboard/profile",
  ];

  function needsAuth() {
    return Array.isArray(authRequiredPaths) && authRequiredPaths.indexOf(currentPath) !== -1;
  }

  function readTheme() {
    try {
      var explicit = window.localStorage.getItem("ai_theme");
      if (explicit === "light" || explicit === "dark") return explicit;
      var legacy = window.localStorage.getItem("theme");
      if (legacy === "light") return "light";
    } catch {
      return "light";
    }
    return "light";
  }

  function persistTheme(theme) {
    try {
      window.localStorage.setItem("ai_theme", theme);
      window.localStorage.setItem("theme", theme);
    } catch {
      return null;
    }
  }

  function syncThemeToggleUi(theme) {
    var icon = document.getElementById("theme-icon");
    var toggle = document.getElementById("theme-toggle");
    if (icon) {
      icon.classList.remove("fa-sun", "fa-moon");
      icon.classList.add(theme === "light" ? "fa-moon" : "fa-sun");
    }
    if (toggle) {
      if (theme === "light") {
        toggle.classList.remove("text-white", "border-white/10", "bg-white/10", "hover:bg-white/20");
        toggle.classList.add("text-gray-800", "border-gray-300", "bg-white", "hover:bg-gray-100");
      } else {
        toggle.classList.remove("text-gray-800", "border-gray-300", "bg-white", "hover:bg-gray-100");
        toggle.classList.add("text-white", "border-white/10", "bg-white/10", "hover:bg-white/20");
      }
    }
  }

  function wireThemeToggle(attempt) {
    var themeToggle = document.getElementById("theme-toggle");
    if (!themeToggle) {
      if ((attempt || 0) < 6) {
        window.setTimeout(function () {
          wireThemeToggle((attempt || 0) + 1);
        }, 120);
      }
      return;
    }

    var current = readTheme();
    document.documentElement.setAttribute("data-theme", current);
    syncThemeToggleUi(current);

    themeToggle.addEventListener("click", function () {
      var theme = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", theme);
      persistTheme(theme);
      syncThemeToggleUi(theme);
    });
  }

  async function syncAuthContext() {
    if (!needsAuth()) return null;
    var data = await getJson("/api/auth/session");
    if (!data || !data.auth) return null;
    var incomingUserId = data.auth.userId || null;
    if (incomingUserId && ctx.userId && incomingUserId !== ctx.userId) {
      ctx.sessionId = null;
      ctx.projectId = null;
      ctx.handle = null;
    }
    ctx.userId = incomingUserId || ctx.userId;
    if (data.auth.name) ctx.name = data.auth.name;
    if (data.auth.avatarUrl) ctx.avatarUrl = data.auth.avatarUrl;
    if (data.auth.email) ctx.email = data.auth.email;
    if (data.summary && data.summary.user && data.summary.user.handle) {
      ctx.handle = data.summary.user.handle;
      ctx.headline = headlineForUser(data.summary.user);
      if (data.summary.user.avatarUrl) ctx.avatarUrl = data.summary.user.avatarUrl;
    }
    saveCtx(ctx);
    hasAppliedAuthCtx = true;
    applyCtxImmediately();
    return data;
  }

  function applyLandingAuthUi(summary) {
    if (currentPath !== "/") return;
    var navLogIn = Array.prototype.find.call(document.querySelectorAll("a"), function (node) {
      var text = (node.textContent || "").trim().toLowerCase();
      var href = node.getAttribute("href") || "";
      return text === "log in" || href.indexOf("/sign-in") === 0;
    });
    if (!navLogIn) return;

    var isSignedIn = Boolean(summary && summary.user && summary.user.handle);
    if (!isSignedIn) {
      navLogIn.setAttribute("href", "/sign-in?redirect_url=/dashboard/");
      navLogIn.textContent = "Log In";
      return;
    }

    navLogIn.setAttribute("href", "/dashboard/");
    navLogIn.textContent = "Dashboard";
  }

  async function trySyncLandingAuth() {
    if (currentPath !== "/") return;
    try {
      var data = await getJson("/api/auth/session");
      if (data && data.summary) {
        if (data.auth && data.auth.userId) ctx.userId = data.auth.userId;
        if (data.auth && data.auth.name) ctx.name = data.auth.name;
        if (data.auth && data.auth.avatarUrl) ctx.avatarUrl = data.auth.avatarUrl;
        if (data.summary.user && data.summary.user.handle) ctx.handle = data.summary.user.handle;
        saveCtx(ctx);
        applyLandingAuthUi(data.summary);
      } else {
        ctx.userId = null;
        ctx.handle = null;
        ctx.sessionId = null;
        ctx.projectId = null;
        ctx.avatarUrl = null;
        ctx.email = null;
        saveCtx(ctx);
        applyLandingAuthUi(null);
      }
    } catch {
      ctx.userId = null;
      ctx.handle = null;
      ctx.sessionId = null;
      ctx.projectId = null;
      ctx.avatarUrl = null;
      ctx.email = null;
      saveCtx(ctx);
      applyLandingAuthUi(null);
    }
  }

  async function postJson(url, body) {
    var payload = body || {};
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      var cleaned = {};
      Object.keys(payload).forEach(function (key) {
        var value = payload[key];
        if (value !== null && value !== undefined) {
          cleaned[key] = value;
        }
      });
      payload = cleaned;
    }
    var res = await fetch(url, {
      method: "POST",
      headers: requestHeaders(true),
      cache: "no-store",
      credentials: "same-origin",
      body: JSON.stringify(payload),
    });
    var data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok || !data.ok) {
      var details = data && data.error && data.error.details ? data.error.details : {};
      var message = data && data.error && data.error.message ? data.error.message : "Request failed";
      var err = new Error(message);
      err.code = data && data.error ? data.error.code : "REQUEST_FAILED";
      err.details = details;
      throw err;
    }
    return data;
  }

  async function getJson(url) {
    var res = await fetch(url, {
      method: "GET",
      headers: requestHeaders(false),
      cache: "no-store",
      credentials: "same-origin",
    });
    var data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok || !data.ok) {
      var details = data && data.error && data.error.details ? data.error.details : {};
      var message = data && data.error && data.error.message ? data.error.message : "Request failed";
      var err = new Error(message);
      err.code = data && data.error ? data.error.code : "REQUEST_FAILED";
      err.details = details;
      throw err;
    }
    return data;
  }

  function projectStateRank(state) {
    if (state === "showcased") return 5;
    if (state === "built") return 4;
    if (state === "building") return 3;
    if (state === "planned") return 2;
    if (state === "idea") return 1;
    return 0;
  }

  function headlineForUser(user) {
    if (!user || !user.headline) return "AI Builder";
    return user.headline;
  }

  function updateSharedUserUi(summary) {
    if (!summary || !summary.user) return;
    var user = summary.user;
    ctx.handle = user.handle;
    ctx.name = user.name;
    ctx.headline = headlineForUser(user);
    if (user.avatarUrl) ctx.avatarUrl = user.avatarUrl;
    saveCtx(ctx);

    var sidebarProfileLink = document.querySelector("aside a[href='/dashboard/profile/'], aside a[href='/dashboard/profile']");
    if (sidebarProfileLink) {
      var nameEl = sidebarProfileLink.querySelector(".font-medium");
      var roleEl = sidebarProfileLink.querySelector(".text-xs");
      setText(nameEl, user.name);
      setText(roleEl, headlineForUser(user));
      var avatar = sidebarProfileLink.querySelector("img");
      if (avatar) {
        avatar.setAttribute("alt", user.name);
        if (ctx.avatarUrl) avatar.setAttribute("src", ctx.avatarUrl);
      }
    }

    var publicProfileLinks = document.querySelectorAll("a[href='/u/alex-chen-ai/'], a[href='/u/test-user-0001/'], a[href='/u/alex-chen-ai'], a[href='/u/test-user-0001']");
    Array.prototype.forEach.call(publicProfileLinks, function (link) {
      setHref(link, "/u/" + user.handle + "/");
    });

    var greeting = Array.prototype.find.call(document.querySelectorAll("header h1"), function (el) {
      var text = (el.textContent || "").toLowerCase();
      return text.indexOf("good morning") !== -1 || text.indexOf("good afternoon") !== -1 || text.indexOf("good evening") !== -1;
    });

    if (greeting) {
      var firstName = user.name.split(" ")[0] || user.name;
      greeting.textContent = "Good Morning, " + firstName + " 👋";
    }

    if (ctx.avatarUrl && isDashboardPath) {
      Array.prototype.forEach.call(
        document.querySelectorAll("aside img[src='/assets/avatar.png'], aside a[href='/dashboard/profile'] img[src='/assets/avatar.png'], aside a[href='/dashboard/profile/'] img[src='/assets/avatar.png']"),
        function (node) {
          node.setAttribute("src", ctx.avatarUrl);
          if (!node.getAttribute("alt")) node.setAttribute("alt", user.name);
        },
      );
    }

    if (isDashboardPath) {
      renameSocialNavLabels();
      ensureDashboardSettingsMenu();
      ensureSidebarSettingsMenu();
    }
  }

  function ensureDashboardSettingsMenu() {
    if (!isDashboardPath) return;
    if (document.getElementById("dashboard-settings-menu")) return;

    var header = document.querySelector("main header");
    if (!header) return;

    var rightControls = header.querySelector(".flex.items-center.gap-4") || header.querySelector(".flex.items-center.gap-2");
    if (!rightControls) {
      rightControls = document.createElement("div");
      rightControls.className = "flex items-center gap-2";
      header.appendChild(rightControls);
    }

    var menu = document.createElement("div");
    menu.id = "dashboard-settings-menu";
    menu.className = "relative";
    menu.innerHTML =
      '<button type="button" class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-gray-300" data-settings-toggle="1">' +
      '<i class="fa-solid fa-gear"></i><span class="hidden md:inline">Settings</span></button>' +
      '<div class="hidden absolute right-0 top-full mt-2 min-w-[170px] rounded-xl border border-white/10 bg-[#0f111a]/95 backdrop-blur-xl shadow-2xl p-1 z-40" data-settings-panel="1">' +
      '<a href="/dashboard/profile/" class="block px-3 py-2 text-sm text-gray-200 rounded-lg hover:bg-white/10"><i class="fa-regular fa-user mr-2"></i>Profile Settings</a>' +
      '<button type="button" class="w-full text-left px-3 py-2 text-sm text-red-300 rounded-lg hover:bg-red-500/20" data-sign-out="1"><i class="fa-solid fa-right-from-bracket mr-2"></i>Sign Out</button>' +
      "</div>";

    rightControls.appendChild(menu);
    var toggle = menu.querySelector("[data-settings-toggle='1']");
    var panel = menu.querySelector("[data-settings-panel='1']");
    var signOut = menu.querySelector("[data-sign-out='1']");

    if (toggle && panel) {
      toggle.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        panel.classList.toggle("hidden");
      });

      document.addEventListener("click", function (event) {
        if (!menu.contains(event.target)) {
          panel.classList.add("hidden");
        }
      });
    }

    if (signOut) {
      signOut.addEventListener("click", async function () {
        try {
          if (window.Clerk && typeof window.Clerk.signOut === "function") {
            await window.Clerk.signOut({ redirectUrl: "/" });
            return;
          }
        } catch {
          // Fallback redirect below.
        }
        window.location.href = "/";
      });
    }
  }

  function ensureSidebarSettingsMenu() {
    if (!isDashboardPath) return;
    if (document.getElementById("dashboard-sidebar-settings")) return;
    var aside = document.querySelector("aside");
    if (!aside) return;
    var nav = aside.querySelector("nav.space-y-1");
    if (!nav) return;

    var row = document.createElement("div");
    row.id = "dashboard-sidebar-settings";
    row.className = "mt-3 pt-3 border-t border-white/10";
    row.innerHTML =
      '<button type="button" class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-gray-300" data-sidebar-sign-out="1">' +
      '<i class="fa-solid fa-right-from-bracket"></i><span>Sign Out</span></button>';
    nav.appendChild(row);

    var signOut = row.querySelector("[data-sidebar-sign-out='1']");
    if (signOut) {
      signOut.addEventListener("click", async function () {
        try {
          if (window.Clerk && typeof window.Clerk.signOut === "function") {
            await window.Clerk.signOut({ redirectUrl: "/" });
            return;
          }
        } catch {
          // fallback below
        }
        window.location.href = "/";
      });
    }
  }

  async function ensureSession() {
    if (ctx.sessionId) return { id: ctx.sessionId, userId: ctx.userId, onboardingOptions: ctx.onboardingOptions || [] };

    var baseHandle = ctx.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "learner";

    var data = await postJson("/api/onboarding/start", {
      name: ctx.name,
      handleBase: baseHandle,
      careerPathId: ctx.careerPathId || "product-management",
      avatarUrl: ctx.avatarUrl || null,
    });

    ctx.sessionId = data.session.id;
    if (data.user && data.user.id) ctx.userId = data.user.id;
    if (data.user && data.user.handle) ctx.handle = data.user.handle;
    if (data.user && data.user.name) ctx.name = data.user.name;
    if (data.user && data.user.avatarUrl) ctx.avatarUrl = data.user.avatarUrl;
    if (Array.isArray(data.onboardingOptions)) ctx.onboardingOptions = data.onboardingOptions;
    saveCtx(ctx);

    return {
      id: data.session.id,
      userId: data.session.userId || ctx.userId,
      onboardingOptions: Array.isArray(data.onboardingOptions) ? data.onboardingOptions : [],
    };
  }

  async function getDashboardSummary() {
    try {
      var response = await getJson("/api/dashboard/summary");
      return response.summary;
    } catch (err) {
      await ensureSession();
      var retry = await getJson("/api/dashboard/summary");
      return retry.summary;
    }
  }

  async function ensurePrimaryProject(summary) {
    var projects = (summary && summary.projects) || [];
    var ranked = projects.slice().sort(function (a, b) {
      return projectStateRank(b.state) - projectStateRank(a.state);
    });

    if (ranked.length) {
      ctx.projectId = ranked[0].id;
      saveCtx(ctx);
      return ranked[0];
    }

    var created = await postJson("/api/projects", {
      title: "Customer Support Copilot",
      description: "Automated responder project scaffolded from onboarding.",
      userId: ctx.userId,
      slug: "customer-support-copilot",
    });
    ctx.projectId = created.project.id;
    saveCtx(ctx);
    return created.project;
  }

  async function hydrateDashboardHome() {
    var summary = await getDashboardSummary();
    updateSharedUserUi(summary);

    var projects = summary.projects || [];
    var active = projects.find(function (project) {
      return project.state === "building" || project.state === "planned" || project.state === "idea";
    }) || projects[0] || null;

    var completed = projects.find(function (project) {
      return project.state === "built" || project.state === "showcased";
    }) || projects[1] || null;

    var cards = document.querySelectorAll("section .grid.sm\\:grid-cols-2 > a");
    if (cards[0] && active) {
      var title = cards[0].querySelector("h3");
      var desc = cards[0].querySelector("p.text-xs");
      setText(title, active.title);
      setText(desc, active.description);
      setHref(cards[0], "/dashboard/projects/");
    }

    if (cards[1] && completed) {
      var title2 = cards[1].querySelector("h3");
      var desc2 = cards[1].querySelector("p.text-xs");
      setText(title2, completed.title);
      setText(desc2, completed.description);
      setHref(cards[1], "/dashboard/projects/");
    }

    var skillStack = Array.prototype.find.call(document.querySelectorAll("section .glass.p-6.rounded-xl"), function (node) {
      return (node.textContent || "").indexOf("Add Target Skill") !== -1;
    });

    if (skillStack && summary.user && Array.isArray(summary.user.skills) && summary.user.skills.length) {
      var addTarget = Array.prototype.find.call(skillStack.children, function (child) {
        return (child.textContent || "").indexOf("Add Target Skill") !== -1;
      });
      skillStack.innerHTML = "";
      summary.user.skills.slice(0, 3).forEach(function (skill, index) {
        var pill = document.createElement("div");
        if (index === 0 && skill.status === "verified") {
          pill.className = "flex border border-emerald-500/30 bg-emerald-500/10 rounded-full items-center pl-1 pr-3 py-1";
          pill.innerHTML = '<img src="/assets/badge.png" class="w-6 h-6 mr-1" alt="verified"><span class="text-xs font-medium text-emerald-400"></span>';
          var label = pill.querySelector("span");
          setText(label, skill.skill);
        } else {
          pill.className = "flex border border-white/10 bg-white/5 rounded-full items-center px-3 py-1.5";
          pill.innerHTML = '<span class="text-xs text-gray-300"></span>';
          var text = skill.skill + " (" + Math.round((skill.score || 0) * 100) + "%)";
          setText(pill.querySelector("span"), text);
        }
        skillStack.appendChild(pill);
      });

      if (addTarget) skillStack.appendChild(addTarget);
    }

    var socialQuote = document.querySelector("section p.text-sm.text-gray-300.mb-4.italic");
    if (socialQuote) {
      try {
        var drafts = await postJson("/api/social/drafts/generate", { userId: ctx.userId, projectId: active ? active.id : null });
        var linkedinDraft = (drafts.drafts || []).find(function (entry) { return entry.platform === "linkedin"; });
        if (linkedinDraft) {
          socialQuote.textContent = '"' + linkedinDraft.text.slice(0, 160) + '..."';
        }
      } catch {
        return null;
      }
    }
  }

  async function hydrateProjectsPage() {
    var summary = await getDashboardSummary();
    updateSharedUserUi(summary);

    var projects = (summary.projects || []).slice();
    var active = projects.find(function (project) {
      return project.state === "building" || project.state === "planned" || project.state === "idea";
    }) || projects[0] || null;

    var activeBanner = document.querySelector("a[href='/dashboard/chat/'].glass-panel");
    if (activeBanner && active) {
      var title = activeBanner.querySelector("h3");
      var desc = activeBanner.querySelector("p.text-sm.text-gray-400");
      setText(title, active.title);
      setText(desc, active.description);
      var pct = activeBanner.querySelector(".absolute.inset-0.flex.items-center.justify-center");
      if (pct) {
        var progress = Math.min(95, Math.max(20, active.buildLog ? active.buildLog.length * 12 : 40));
        setText(pct, progress + "%");
      }
    }

    var completed = projects.filter(function (project) {
      return project.state === "built" || project.state === "showcased";
    });

    var grid = document.querySelector("section .grid.md\\:grid-cols-2.gap-6");
    if (grid) {
      var template = grid.children[0] ? grid.children[0].cloneNode(true) : null;
      grid.innerHTML = "";

      var rows = completed.length ? completed.slice(0, 6) : (active ? [active] : []);
      rows.forEach(function (project) {
        if (!template) return;
        var card = template.cloneNode(true);
        var title = card.querySelector("h3");
        var desc = card.querySelector("p.text-sm.text-gray-400");
        setText(title, project.title);
        setText(desc, project.description);

        var publicLink = card.querySelector("a[href*='/u/']");
        if (publicLink && ctx.handle) {
          setHref(publicLink, "/u/" + ctx.handle + "/projects/" + project.slug + "/");
        }

        var copyBtn = card.querySelector("button[title='Copy Link']");
        if (copyBtn && ctx.handle) {
          copyBtn.dataset.copyUrl = window.location.origin + "/u/" + ctx.handle + "/projects/" + project.slug + "/";
        }

        grid.appendChild(card);
      });
    }

    Array.prototype.forEach.call(document.querySelectorAll("button[title='Copy Link']"), function (button) {
      button.addEventListener("click", async function () {
        var value = button.dataset.copyUrl;
        if (!value) {
          var row = button.closest("div.flex.items-center.gap-3");
          var link = row ? row.querySelector("a[href]") : null;
          if (link) {
            var href = link.getAttribute("href") || "";
            value = href.startsWith("http") ? href : window.location.origin + href;
          }
        }

        if (!value) return;
        try {
          await navigator.clipboard.writeText(value);
          toast("Project link copied.", false);
        } catch {
          toast("Clipboard unavailable.", true);
        }
      });
    });
  }

  function createBubble(html, isUser) {
    var wrapper = document.createElement("div");
    var theme = document.documentElement.getAttribute("data-theme") || "dark";
    wrapper.className = isUser
      ? "flex items-start justify-end gap-4 max-w-4xl ml-auto"
      : "flex items-start gap-4 max-w-4xl";

    if (isUser) {
      var userAvatar = ctx.avatarUrl || "/assets/avatar.png";
      var userAlt = ctx.name || "Learner";
      wrapper.innerHTML =
        '<div class="chat-user-bubble bg-emerald-600 text-white p-5 rounded-2xl rounded-tr-sm text-sm shadow-[0_5px_15px_rgba(16,185,129,0.2)]"></div>' +
        '<img src="' + userAvatar + '" class="w-8 h-8 rounded-full object-cover border border-white/20 flex-shrink-0 mt-1" alt="' + userAlt + '">';
      wrapper.querySelector("div").innerHTML = html;
      if (theme === "light") {
        wrapper.querySelector(".chat-user-bubble").classList.add("chat-user-bubble-light");
      }
    } else {
      wrapper.innerHTML =
        '<div class="w-8 h-8 rounded-full bg-gradient-to-b from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 mt-1 shadow-[0_0_10px_rgba(16,185,129,0.3)]"><i class="fa-solid fa-robot text-white text-[10px]"></i></div>' +
        '<div class="chat-ai-bubble glass p-5 rounded-2xl rounded-tl-sm text-sm border-emerald-500/20 bg-emerald-500/5"></div>';
      wrapper.querySelector("div.glass").innerHTML = html;
      if (theme === "light") {
        wrapper.querySelector(".chat-ai-bubble").classList.add("chat-ai-bubble-light");
      }
    }

    return wrapper;
  }

  async function hydrateChatPage() {
    var summary = await getDashboardSummary();
    updateSharedUserUi(summary);
    var projectPromise = ensurePrimaryProject(summary);

    var subtitle = document.querySelector("header .text-xs.text-gray-400");
    projectPromise.then(function (project) {
      if (subtitle && project) {
        subtitle.textContent = project.title + " • Active Build";
      }
    }).catch(function () {
      return null;
    });

    var history = document.querySelector("main .flex-1.overflow-y-auto");
    var textarea = document.querySelector("textarea");
    var sendBtn = Array.prototype.find.call(document.querySelectorAll("button"), function (btn) {
      return btn.querySelector(".fa-paper-plane");
    });

    if (!history || !textarea || !sendBtn) return;

    var sending = false;

    async function sendMessage() {
      if (sending) return;
      var text = (textarea.value || "").trim();
      if (!text) return;
      sending = true;

      var userBubble = createBubble("<p></p>", true);
      setText(userBubble.querySelector("p"), text);
      history.appendChild(userBubble);
      history.scrollTop = history.scrollHeight;
      textarea.value = "";

      try {
        var project = await projectPromise;
        if (!project || !project.id) {
          throw new Error("Project context unavailable");
        }
        var result = await postJson("/api/projects/" + encodeURIComponent(project.id) + "/chat", {
          message: text,
        });

        var replyText = result.reply || "My AI Skill Tutor: I logged this step in your project build log.";
        var aiBubble = createBubble("<p></p>", false);
        setText(aiBubble.querySelector("p"), replyText);
        history.appendChild(aiBubble);
        history.scrollTop = history.scrollHeight;
      } catch (err) {
        var errorBubble = createBubble("<p></p>", false);
        setText(errorBubble.querySelector("p"), "My AI Skill Tutor failed to respond: " + (err && err.message ? err.message : "Unknown error"));
        history.appendChild(errorBubble);
        history.scrollTop = history.scrollHeight;
      } finally {
        sending = false;
      }
    }

    sendBtn.addEventListener("click", function () {
      void sendMessage();
    });

    textarea.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void sendMessage();
      }
    });
  }

  async function hydrateSocialPage() {
    var summary = await getDashboardSummary();
    updateSharedUserUi(summary);
    var primaryProject = await ensurePrimaryProject(summary);

    renameSocialNavLabels();

    var socialHeading = document.querySelector("header h1");
    if (socialHeading) {
      socialHeading.innerHTML = '<i class="fa-solid fa-share-nodes text-[#0077b5]"></i> Social Media';
    }
    var socialSubheading = document.querySelector("header p.text-xs.text-gray-400");
    if (socialSubheading) {
      socialSubheading.textContent = "AI-generated LinkedIn + Tweet ideas based on your current learner memory.";
    }
    if (typeof document.title === "string" && document.title.indexOf("Social Hooks") !== -1) {
      document.title = document.title.replace(/Social Hooks/g, "Social Media");
    }

    var contentWrap = document.querySelector("main .p-10.max-w-4xl.mx-auto.w-full.pb-24.space-y-8");
    if (!contentWrap) return;

    contentWrap.innerHTML =
      '<section class="glass p-6 md:p-8 rounded-2xl border border-white/10 bg-white/5">' +
      '<div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">' +
      '<div><h2 class="text-lg font-[Outfit] font-semibold text-white">Social Media Drafts</h2>' +
      '<p class="text-xs text-gray-400">Edit and share native drafts for LinkedIn and X/Twitter.</p>' +
      '<p class="text-[11px] text-gray-500 mt-1">Voice: <span data-social-author="1"></span></p></div>' +
      '<button type="button" data-social-refresh="1" class="btn btn-secondary text-sm whitespace-nowrap"><i class="fa-solid fa-rotate-right mr-2"></i>Refresh Ideas</button>' +
      "</div>" +
      '<div class="grid gap-4 md:grid-cols-2">' +
      '<article class="rounded-xl border border-[#0a66c2]/35 bg-[#0a66c2]/10 p-4">' +
      '<div class="flex items-center justify-between mb-3"><span class="text-[11px] uppercase tracking-wider text-[#53a9ff] font-semibold">LinkedIn</span><span class="text-[10px] text-gray-300">Native share</span></div>' +
      '<textarea data-social-input="linkedin" class="w-full min-h-[180px] rounded-lg border border-white/10 bg-[#0f172a]/70 p-3 text-[13px] text-gray-100 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/50" readonly></textarea>' +
      '<div class="flex items-center gap-2 mt-3">' +
      '<button type="button" data-social-edit="linkedin" class="btn btn-secondary text-xs"><i class="fa-solid fa-pen mr-2"></i>Edit</button>' +
      '<button type="button" data-social-share="linkedin" class="btn bg-[#0a66c2] text-white hover:bg-[#095592] text-xs"><i class="fa-brands fa-linkedin-in mr-2"></i>Share</button>' +
      "</div></article>" +
      '<article class="rounded-xl border border-white/15 bg-black/30 p-4">' +
      '<div class="flex items-center justify-between mb-3"><span class="text-[11px] uppercase tracking-wider text-white font-semibold">Tweet</span><span class="text-[10px] text-gray-300">Native composer</span></div>' +
      '<textarea data-social-input="x" class="w-full min-h-[180px] rounded-lg border border-white/10 bg-[#0f172a]/70 p-3 text-[13px] text-gray-100 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-white/30" readonly></textarea>' +
      '<div class="flex items-center gap-2 mt-3">' +
      '<button type="button" data-social-edit="x" class="btn btn-secondary text-xs"><i class="fa-solid fa-pen mr-2"></i>Edit</button>' +
      '<button type="button" data-social-share="x" class="btn bg-white text-[#111827] hover:bg-gray-200 text-xs"><i class="fa-brands fa-x-twitter mr-2"></i>Tweet</button>' +
      "</div></article>" +
      "</div>" +
      '<div class="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">' +
      '<span data-social-context="1">Context: loading...</span>' +
      '<span>•</span>' +
      '<span data-social-source="1">Generating...</span>' +
      "</div>" +
      "</section>";

    var linkedInInput = contentWrap.querySelector("textarea[data-social-input='linkedin']");
    var xInput = contentWrap.querySelector("textarea[data-social-input='x']");
    var linkedInEditButton = contentWrap.querySelector("button[data-social-edit='linkedin']");
    var xEditButton = contentWrap.querySelector("button[data-social-edit='x']");
    var linkedInShareButton = contentWrap.querySelector("button[data-social-share='linkedin']");
    var xShareButton = contentWrap.querySelector("button[data-social-share='x']");
    var refreshButton = contentWrap.querySelector("button[data-social-refresh='1']");
    var contextNode = contentWrap.querySelector("[data-social-context='1']");
    var sourceNode = contentWrap.querySelector("[data-social-source='1']");
    var authorNode = contentWrap.querySelector("[data-social-author='1']");

    if (authorNode) {
      authorNode.textContent = summary.user.name + " · " + (summary.user.headline || "AI Builder");
    }

    var draftState = {
      linkedin: "",
      x: "",
      contextLabel: primaryProject ? "Project: " + primaryProject.title : "Profile momentum",
    };

    function normalizeDraftText(value) {
      return String(value || "")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }

    function shareUrl(platform, text) {
      if (platform === "linkedin") {
        return "https://www.linkedin.com/feed/?shareActive=true&text=" + encodeURIComponent(text);
      }
      return "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text);
    }

    function readDraft(platform) {
      var input = platform === "linkedin" ? linkedInInput : xInput;
      if (!input) return "";
      return normalizeDraftText(input.value);
    }

    function updateDraftInputs() {
      if (linkedInInput) linkedInInput.value = draftState.linkedin || "";
      if (xInput) xInput.value = draftState.x || "";
      if (contextNode) contextNode.textContent = "Context: " + (draftState.contextLabel || "Fresh ideas");
    }

    function setEditMode(platform, editing) {
      var input = platform === "linkedin" ? linkedInInput : xInput;
      var button = platform === "linkedin" ? linkedInEditButton : xEditButton;
      if (!input || !button) return;
      input.readOnly = !editing;
      button.setAttribute("data-editing", editing ? "1" : "0");
      button.innerHTML = editing
        ? '<i class="fa-solid fa-check mr-2"></i>Save'
        : '<i class="fa-solid fa-pen mr-2"></i>Edit';
      if (editing) {
        input.focus();
        input.selectionStart = input.value.length;
      }
    }

    function lockAllEdits() {
      setEditMode("linkedin", false);
      setEditMode("x", false);
    }

    async function loadIdeas(showToastOnSuccess) {
      try {
        var ideasResult = await postJson("/api/social/drafts/ideas", {
          userId: ctx.userId,
          projectId: primaryProject ? primaryProject.id : null,
        });
        var ideas = ideasResult.ideas || {};
        draftState.linkedin = normalizeDraftText(ideas.linkedin || "");
        draftState.x = normalizeDraftText(ideas.x || "");
        draftState.contextLabel = normalizeDraftText(ideas.contextLabel || draftState.contextLabel || "Fresh ideas");
        if (!draftState.linkedin || !draftState.x) {
          throw new Error("Generated ideas were empty");
        }
        updateDraftInputs();
        if (sourceNode) {
          sourceNode.textContent = ideasResult.source === "llm" ? "Personalized with user memory" : "Generated from profile context";
        }
        if (showToastOnSuccess) {
          toast(ideasResult.source === "llm" ? "Fresh social ideas ready." : "Fallback social ideas ready.", false);
        }
        return;
      } catch {
        var fallback = await postJson("/api/social/drafts/generate", {
          userId: ctx.userId,
          projectId: primaryProject ? primaryProject.id : null,
        });
        var drafts = fallback.drafts || [];
        var linkedInDraft = drafts.find(function (entry) {
          return entry.platform === "linkedin";
        });
        var xDraft = drafts.find(function (entry) {
          return entry.platform === "x";
        });
        draftState.linkedin = normalizeDraftText(linkedInDraft ? linkedInDraft.text : "");
        draftState.x = normalizeDraftText(xDraft ? xDraft.text : "");
        draftState.contextLabel = primaryProject ? "Project: " + primaryProject.title : "Profile momentum";
        updateDraftInputs();
        if (sourceNode) {
          sourceNode.textContent = "Generated from template drafts";
        }
        if (showToastOnSuccess) {
          toast("Drafts refreshed.", false);
        }
      }
    }

    if (linkedInEditButton) {
      linkedInEditButton.addEventListener("click", function () {
        var editing = linkedInEditButton.getAttribute("data-editing") === "1";
        if (editing) {
          draftState.linkedin = readDraft("linkedin");
          setEditMode("linkedin", false);
          toast("LinkedIn draft updated.", false);
          return;
        }
        setEditMode("linkedin", true);
      });
    }

    if (xEditButton) {
      xEditButton.addEventListener("click", function () {
        var editing = xEditButton.getAttribute("data-editing") === "1";
        if (editing) {
          draftState.x = readDraft("x");
          setEditMode("x", false);
          toast("Tweet draft updated.", false);
          return;
        }
        setEditMode("x", true);
      });
    }

    if (linkedInShareButton) {
      linkedInShareButton.addEventListener("click", function () {
        draftState.linkedin = readDraft("linkedin");
        if (!draftState.linkedin) {
          toast("LinkedIn draft is empty.", true);
          return;
        }
        window.open(shareUrl("linkedin", draftState.linkedin), "_blank", "noopener,noreferrer");
        toast("Opening LinkedIn share.", false);
      });
    }

    if (xShareButton) {
      xShareButton.addEventListener("click", function () {
        draftState.x = readDraft("x");
        if (!draftState.x) {
          toast("Tweet draft is empty.", true);
          return;
        }
        window.open(shareUrl("x", draftState.x), "_blank", "noopener,noreferrer");
        toast("Opening native Tweet composer.", false);
      });
    }

    if (refreshButton) {
      refreshButton.addEventListener("click", async function () {
        var original = refreshButton.innerHTML;
        refreshButton.disabled = true;
        refreshButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>Refreshing';
        try {
          lockAllEdits();
          await loadIdeas(true);
        } catch (err) {
          toast(err instanceof Error ? err.message : "Unable to refresh social ideas", true);
        } finally {
          refreshButton.disabled = false;
          refreshButton.innerHTML = original;
        }
      });
    }

    lockAllEdits();
    try {
      await loadIdeas(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to generate social ideas", true);
    }

    var params = new URLSearchParams(window.location.search);
    var oauth = params.get("oauth");
    if (oauth === "linkedin_connected") toast("LinkedIn connected.", false);
    if (oauth === "x_connected") toast("X connected.", false);
    if (oauth === "linkedin_denied" || oauth === "x_denied") toast("OAuth connection was denied.", true);
  }

  async function hydrateUpdatesPage() {
    var summary = await getDashboardSummary();
    updateSharedUserUi(summary);

    var updates = summary.latestEvents || [];
    if (updates.length) {
      var firstTitle = Array.prototype.find.call(document.querySelectorAll("h4.font-medium"), function (el) {
        return (el.textContent || "").indexOf("Released") !== -1 || (el.textContent || "").indexOf("Daily Task") !== -1;
      });
      if (firstTitle) setText(firstTitle, updates[0].message || "New tutor update");
    }

    var applyButton = byText("button", "Apply to Project");
    if (applyButton) {
      applyButton.addEventListener("click", async function () {
        try {
          await postJson("/api/scheduler/news-refresh", {});
          await postJson("/api/scheduler/daily-update", {});
          toast("Update applied and daily digest queued.", false);
        } catch (err) {
          toast(err instanceof Error ? err.message : "Unable to apply update", true);
        }
      });
    }
  }

  async function hydrateProfilePage() {
    var summary = await getDashboardSummary();
    updateSharedUserUi(summary);

    var profileForm = document.querySelector("form");
    var inputs = profileForm ? profileForm.querySelectorAll("input[type='text']") : [];
    var nameInput = inputs[0] || null;
    var roleInput = inputs[1] || null;
    var bioInput = profileForm ? profileForm.querySelector("textarea") : null;
    var linkedInInput = inputs[2] || null;
    var avatarUrlInput = document.getElementById("profile-avatar-url");

    if (!avatarUrlInput && profileForm) {
      var avatarField = document.createElement("div");
      avatarField.innerHTML =
        '<label class="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Avatar URL</label>' +
        '<input id="profile-avatar-url" type="url" placeholder="https://..." class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition">';
      var submitRow = profileForm.querySelector("div.pt-4.mt-4.border-t");
      if (submitRow && submitRow.parentElement) {
        profileForm.insertBefore(avatarField, submitRow);
      } else {
        profileForm.appendChild(avatarField);
      }
      avatarUrlInput = avatarField.querySelector("#profile-avatar-url");
    }

    if (nameInput) nameInput.value = summary.user.name || "";
    if (roleInput) roleInput.value = summary.user.headline || "";
    if (bioInput) bioInput.value = summary.user.bio || "";
    if (linkedInInput) linkedInInput.value = (summary.user.socialLinks && summary.user.socialLinks.linkedin) || "";
    var currentAvatarUrl = ctx.avatarUrl || summary.user.avatarUrl || "";
    if (avatarUrlInput) {
      avatarUrlInput.value = currentAvatarUrl;
    }
    if (ctx.email) {
      var emailNode = Array.prototype.find.call(document.querySelectorAll("p.text-sm"), function (node) {
        return (node.textContent || "").indexOf("@") !== -1;
      });
      if (emailNode) emailNode.textContent = ctx.email;
    }

    var avatarElements = document.querySelectorAll("img[src='/assets/avatar.png']");
    if (currentAvatarUrl) {
      Array.prototype.forEach.call(avatarElements, function (img) {
        img.setAttribute("src", currentAvatarUrl);
        if (summary.user && summary.user.name) {
          img.setAttribute("alt", summary.user.name);
        }
      });
    }

    var publicBtn = Array.prototype.find.call(document.querySelectorAll("a"), function (node) {
      return (node.textContent || "").indexOf("View Public Profile") !== -1;
    });
    if (publicBtn) {
      setHref(publicBtn, "/u/" + summary.user.handle + "/");
    }

    var saveButton = Array.prototype.find.call(document.querySelectorAll("button"), function (node) {
      return (node.textContent || "").trim() === "Save Changes";
    });

    if (saveButton) {
      saveButton.addEventListener("click", async function () {
        try {
          var normalizedAvatar = avatarUrlInput && avatarUrlInput.value ? normalizeUrl(avatarUrlInput.value) : undefined;
          var nextAvatar = normalizedAvatar || currentAvatarUrl || null;
          var payload = {
            name: nameInput ? nameInput.value.trim() : summary.user.name,
            headline: roleInput ? roleInput.value.trim() : summary.user.headline,
            bio: bioInput ? bioInput.value.trim() : summary.user.bio,
            avatarUrl: nextAvatar,
            socialLinks: {
              linkedin: linkedInInput && linkedInInput.value ? normalizeUrl(linkedInInput.value) : undefined,
            },
          };

          if (linkedInInput && linkedInInput.value && !payload.socialLinks.linkedin) {
            throw new Error("LinkedIn URL is invalid");
          }
          if (avatarUrlInput && avatarUrlInput.value && !normalizedAvatar) {
            throw new Error("Avatar URL is invalid");
          }

          var response = await fetch("/api/profile", {
            method: "PATCH",
            headers: requestHeaders(true),
            cache: "no-store",
            credentials: "same-origin",
            body: JSON.stringify(payload),
          });

          var data = await response.json().catch(function () {
            return {};
          });
          if (!response.ok || !data.ok) {
            throw new Error(data && data.error && data.error.message ? data.error.message : "Profile save failed");
          }

          if (data.profile && data.profile.handle) {
            ctx.handle = data.profile.handle;
            if (data.profile.avatarUrl) {
              ctx.avatarUrl = data.profile.avatarUrl;
              currentAvatarUrl = data.profile.avatarUrl;
            } else if (nextAvatar) {
              ctx.avatarUrl = nextAvatar;
              currentAvatarUrl = nextAvatar;
            }
            saveCtx(ctx);
            if (publicBtn) setHref(publicBtn, "/u/" + data.profile.handle + "/");
            if (avatarUrlInput && currentAvatarUrl) avatarUrlInput.value = currentAvatarUrl;
            Array.prototype.forEach.call(document.querySelectorAll("img[src='/assets/avatar.png'], img[src='" + nextAvatar + "']"), function (img) {
              if (currentAvatarUrl) img.setAttribute("src", currentAvatarUrl);
            });
          }

          toast("Profile saved.", false);
        } catch (err) {
          toast(err instanceof Error ? err.message : "Profile save failed", true);
        }
      });
    }

    var avatarButton = Array.prototype.find.call(document.querySelectorAll("button"), function (node) {
      return (node.textContent || "").trim() === "Change Avatar";
    });
    if (avatarButton) {
      avatarButton.addEventListener("click", async function () {
        var current = currentAvatarUrl || "";
        var next = window.prompt("Paste avatar image URL", current);
        if (next === null) return;
        var trimmed = (next || "").trim();
        if (!trimmed) {
          toast("Avatar URL cannot be empty.", true);
          return;
        }
        try {
          new URL(trimmed);
        } catch {
          toast("Avatar URL must be valid.", true);
          return;
        }
        try {
          var res = await fetch("/api/profile", {
            method: "PATCH",
            headers: requestHeaders(true),
            cache: "no-store",
            credentials: "same-origin",
            body: JSON.stringify({ avatarUrl: trimmed }),
          });
          var data = await res.json().catch(function () {
            return {};
          });
          if (!res.ok || !data.ok) {
            throw new Error(data && data.error && data.error.message ? data.error.message : "Avatar update failed");
          }
          ctx.avatarUrl = trimmed;
          currentAvatarUrl = trimmed;
          saveCtx(ctx);
          if (avatarUrlInput) avatarUrlInput.value = trimmed;
          Array.prototype.forEach.call(document.querySelectorAll("img[src='/assets/avatar.png'], img[src='" + current + "']"), function (img) {
            img.setAttribute("src", trimmed);
          });
          toast("Avatar updated.", false);
        } catch (err) {
          toast(err instanceof Error ? err.message : "Avatar update failed", true);
        }
      });
    }
  }

  function buildTalentCardHtml(candidate) {
    var skills = (candidate.topSkills || []).slice(0, 2);
    var tools = (candidate.topTools || []).slice(0, 3);
    var projectCount = Math.max(1, Math.round((candidate.evidenceScore || 45) / 30));

    return (
      '<a href="/employers/talent/' +
      candidate.handle +
      '/" class="glass p-6 rounded-2xl hover:bg-white/5 transition border border-white/10 hover:border-emerald-500/40 group relative cursor-pointer">' +
      '<div class="flex justify-between items-start mb-4">' +
      '<img src="' +
      (candidate.avatarUrl || "/assets/avatar.png") +
      '" width="64" height="64" style="width:64px;height:64px;object-fit:cover;" class="w-16 h-16 rounded-full object-cover border border-white/20" alt="' +
      candidate.name +
      '">' +
      '<div class="bg-emerald-500/20 text-emerald-400 w-8 h-8 rounded-full flex items-center justify-center border border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.3)]" title="Verified Human Builder"><i class="fa-solid fa-check text-sm font-bold"></i></div>' +
      "</div>" +
      '<h3 class="text-lg font-medium text-white group-hover:text-emerald-400 transition mb-1">' +
      candidate.name +
      "</h3>" +
      '<p class="text-gray-400 text-sm mb-4">' +
      candidate.role +
      "</p>" +
      '<div class="space-y-2 mb-6">' +
      '<div class="flex items-center gap-2 text-xs"><i class="fa-solid fa-diagram-project text-gray-500 w-4"></i><span class="text-gray-300">' +
      projectCount +
      " Verified Projects built</span></div>" +
      '<div class="flex items-center gap-2 text-xs"><i class="fa-solid fa-code text-gray-500 w-4"></i><span class="text-gray-300">' +
      tools.join(", ") +
      "</span></div>" +
      "</div>" +
      '<div class="flex flex-wrap gap-2 mt-auto border-t border-white/10 pt-4">' +
      skills
        .map(function (skill) {
          return '<span class="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded px-2 py-0.5">' + skill + "</span>";
        })
        .join("") +
      "</div></a>"
    );
  }

  async function hydrateEmployerTalentPage() {
    var header = document.querySelector("h2.text-xl.font-\\[Outfit\\].text-white");
    var grid = document.querySelector(".grid.md\\:grid-cols-2.lg\\:grid-cols-3.gap-6");
    var search = document.querySelector("header input[type='text']");

    if (!grid) return;

    var selectedSkill = null;
    var selectedStatus = "";

    var skillSection = Array.prototype.find.call(document.querySelectorAll("aside .mb-6"), function (node) {
      return (node.textContent || "").indexOf("Filter by Skill") !== -1;
    });

    async function loadRows() {
      if (!grid.dataset.initialized) {
        grid.dataset.initialized = "1";
        grid.innerHTML =
          '<div class="glass p-6 rounded-2xl border border-white/10 text-gray-400">Loading talent profiles...</div>';
      }
      var params = new URLSearchParams();
      if (selectedSkill) params.set("skill", selectedSkill);
      if (selectedStatus) params.set("status", selectedStatus);
      if (search && search.value.trim()) params.set("q", search.value.trim());

      var data = await getJson("/api/employers/talent" + (params.toString() ? "?" + params.toString() : ""));
      var rows = data.rows || [];
      var facets = data.facets || {};
      var isDefaultView = !selectedSkill && !selectedStatus && !(search && search.value.trim());
      if (isDefaultView) {
        rows = rows
          .filter(function (candidate) {
            return /^candidate-\d{3}$/i.test(candidate.handle || "");
          })
          .slice(0, 20);
      }

      if (header) {
        header.textContent = rows.length + " Candidates Match Criteria";
      }

      if (skillSection && facets.skills && facets.skills.length) {
        var list = skillSection.querySelector(".space-y-2");
        if (list && !list.dataset.hydrated) {
          list.dataset.hydrated = "1";
          list.innerHTML = "";
          facets.skills.slice(0, 8).forEach(function (skill, index) {
            var id = "skill-filter-" + index;
            var label = document.createElement("label");
            label.className = "flex items-center gap-3 text-gray-300 hover:text-white cursor-pointer group";
            label.innerHTML =
              '<input id="' +
              id +
              '" type="checkbox" class="rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-emerald-500">' +
              '<span class="group-hover:underline"></span>';
            setText(label.querySelector("span"), skill);
            var checkbox = label.querySelector("input");
            checkbox.checked = false;
            checkbox.addEventListener("change", function () {
              selectedSkill = checkbox.checked ? skill : null;
              Array.prototype.forEach.call(list.querySelectorAll("input[type='checkbox']"), function (node) {
                if (node !== checkbox) node.checked = false;
              });
              void loadRows();
            });
            list.appendChild(label);
          });
        }
      }

      grid.innerHTML = "";
      if (!rows.length) {
        var empty = document.createElement("div");
        empty.className = "glass p-6 rounded-2xl border border-white/10 text-gray-400";
        empty.textContent = "No candidates matched the current filters.";
        grid.appendChild(empty);
        return;
      }

      rows.forEach(function (candidate) {
        var wrapper = document.createElement("div");
        wrapper.innerHTML = buildTalentCardHtml(candidate);
        var card = wrapper.firstElementChild;
        if (card) grid.appendChild(card);
      });
    }

    var radios = document.querySelectorAll("input[type='radio'][name='level']");
    var allCandidatesRadio = Array.prototype.find.call(radios, function (radio) {
      var label = radio.closest("label");
      var text = label ? (label.textContent || "").toLowerCase() : "";
      return text.indexOf("all") !== -1;
    });
    if (allCandidatesRadio) {
      allCandidatesRadio.checked = true;
      selectedStatus = "";
    } else if (radios.length > 1) {
      radios[1].checked = true;
      selectedStatus = "";
    }
    Array.prototype.forEach.call(radios, function (radio, index) {
      radio.addEventListener("change", function () {
        if (!radio.checked) return;
        selectedStatus = index === 0 ? "verified" : "";
        void loadRows();
      });
    });

    if (search) {
      var timeout = null;
      search.addEventListener("input", function () {
        window.clearTimeout(timeout);
        timeout = window.setTimeout(function () {
          void loadRows();
        }, 220);
      });
    }

    await loadRows();
  }

  function ensureEmailButton(container, redirectPath) {
    if (!container) return;
    if (container.querySelector("[data-email-auth='1']")) return;
    var btn = document.createElement("a");
    btn.href = "/sign-in?redirect_url=" + encodeURIComponent(redirectPath);
    btn.dataset.emailAuth = "1";
    btn.className = "w-full flex items-center justify-center gap-3 p-3 rounded-lg border border-white/10 bg-white/5 text-white hover:bg-white/10 transition-all font-medium";
    btn.innerHTML = '<i class="fa-regular fa-envelope text-lg"></i><span>Continue with Email</span>';
    container.appendChild(btn);
  }

  if (currentPath === "/onboarding") {
    var selectedResumeFilename = null;
    var uploadLabel = byText("p", "Upload Resume (PDF)");
    var uploadCard = uploadLabel ? uploadLabel.closest("div.border-2") : null;
    var careerPathSelect = document.getElementById("onboarding-career-path");
    var linkedinInput = document.getElementById("onboarding-linkedin-url");
    var situationSelect = document.getElementById("onboarding-situation");
    var beginButton = document.getElementById("onboarding-start-assessment");
    var scoreButtons = document.querySelectorAll("button.onboarding-score");
    var chosenScore = Number((ctx && ctx.aiKnowledgeScore) || 3);

    function applySelectedScore() {
      Array.prototype.forEach.call(scoreButtons, function (button) {
        var score = Number(button.getAttribute("data-ai-score") || "3");
        if (score === chosenScore) {
          button.classList.add("bg-emerald-500", "border-emerald-500/50", "text-white");
        } else {
          button.classList.remove("bg-emerald-500", "border-emerald-500/50", "text-white");
        }
      });
    }

    Array.prototype.forEach.call(scoreButtons, function (button) {
      button.addEventListener("click", function () {
        chosenScore = Number(button.getAttribute("data-ai-score") || "3");
        applySelectedScore();
      });
    });
    applySelectedScore();

    if (uploadCard) {
      var uploader = document.createElement("input");
      uploader.type = "file";
      uploader.accept = ".pdf";
      uploader.style.display = "none";
      document.body.appendChild(uploader);

      uploadCard.addEventListener("click", function () {
        uploader.click();
      });

      uploader.addEventListener("change", async function () {
        var file = uploader.files && uploader.files[0];
        if (!file) return;
        selectedResumeFilename = file.name;
        var subtitle = uploadCard.querySelector("p.text-xs");
        if (subtitle) subtitle.textContent = "Selected: " + file.name;
      });
    }

    ensureSession()
      .then(function (bootstrap) {
        var options = (bootstrap && bootstrap.onboardingOptions) || [];
        if (!careerPathSelect) return;
        careerPathSelect.innerHTML = "";
        if (!options.length) {
          options = [{ id: ctx.careerPathId || "product-management", name: "Product Management" }];
        }
        options.forEach(function (option) {
          var item = document.createElement("option");
          item.value = option.id;
          item.textContent = option.name;
          if (option.id === (ctx.careerPathId || "product-management")) item.selected = true;
          careerPathSelect.appendChild(item);
        });

        if (linkedinInput && ctx.linkedinUrl) {
          linkedinInput.value = ctx.linkedinUrl;
        }
      })
      .catch(function (err) {
        toast(err instanceof Error ? err.message : "Unable to initialize onboarding", true);
      });

    if (beginButton) {
      beginButton.addEventListener("click", async function () {
        if (beginButton.dataset.busy === "1") return;
        beginButton.dataset.busy = "1";
        beginButton.setAttribute("disabled", "true");
        try {
          var goals = Array.prototype.map.call(
            document.querySelectorAll('input[name="onboarding-goal"]:checked'),
            function (node) {
              return node.value;
            },
          );
          if (!goals.length) {
            toast("Select at least one goal.", true);
            return;
          }

          var selectedCareerPath = careerPathSelect && careerPathSelect.value ? careerPathSelect.value : "product-management";
          var selectedSituation = situationSelect && situationSelect.value ? situationSelect.value : "employed";
          var selectedLinkedIn = linkedinInput && linkedinInput.value ? linkedinInput.value.trim() : "";
          ctx.careerPathId = selectedCareerPath;
          ctx.aiKnowledgeScore = chosenScore;
          ctx.onboardingGoals = goals;
          if (selectedLinkedIn) ctx.linkedinUrl = selectedLinkedIn;
          saveCtx(ctx);

          var session = await ensureSession();
          await postJson("/api/onboarding/career-import", {
            sessionId: session.id,
            careerPathId: selectedCareerPath,
            linkedinUrl: selectedLinkedIn || null,
            resumeFilename: selectedResumeFilename,
          });

          await postJson("/api/onboarding/situation", {
            sessionId: session.id,
            situation: selectedSituation,
            goals: goals,
          });

          toast("Onboarding saved. Continue to assessment.", false);
          window.location.href = "/assessment/?sessionId=" + encodeURIComponent(session.id);
        } catch (err) {
          toast(err instanceof Error ? err.message : "Failed to complete onboarding", true);
        } finally {
          beginButton.dataset.busy = "0";
          beginButton.removeAttribute("disabled");
        }
      });
    }
  }

  if (currentPath === "/assessment") {
    var assessmentCard = document.querySelector(".glass-panel");
    if (assessmentCard) {
      var row = assessmentCard.querySelector(".mb-8 .space-y-4");
      if (row && row.parentElement) {
        var emailWrap = document.createElement("div");
        emailWrap.className = "mt-5";
        ensureEmailButton(emailWrap, "/assessment/");
        row.parentElement.insertBefore(emailWrap, row);
      }
    }

    var continueLink = byText("a", "Continue");
    if (continueLink) {
      continueLink.addEventListener("click", async function (event) {
        event.preventDefault();
        try {
          var session = await ensureSession();
          var start = await postJson("/api/assessment/start", { sessionId: session.id });
          var checked = document.querySelector('input[name="goal"]:checked');
          var selectedValue = 3;
          var selectedGoal = "learn_foundations";
          if (checked) {
            var label = checked.closest("label");
            var text = label ? (label.textContent || "").toLowerCase() : "";
            if (text.indexOf("automate") !== -1) {
              selectedValue = 5;
              selectedGoal = "ship_ai_projects";
            }
            if (text.indexOf("showcase") !== -1 || text.indexOf("job") !== -1) {
              selectedValue = 4;
              selectedGoal = "showcase_for_job";
            }
          }

          await postJson("/api/assessment/submit", {
            assessmentId: start.assessment.id,
            answers: [{ questionId: "primary_goal", value: selectedValue }],
          });

          await postJson("/api/onboarding/situation", {
            sessionId: session.id,
            situation: "employed",
            goals: [selectedGoal],
          });

          toast("Assessment submitted.", false);
          window.location.href = "/dashboard/?welcome=1";
        } catch (err) {
          if (isUnauthenticatedError(err)) {
            redirectToSignIn("/assessment/");
            return;
          }
          toast(err instanceof Error ? err.message : "Assessment failed", true);
        }
      });
    }
  }

  async function boot() {
    try {
      wireThemeToggle();
      await trySyncLandingAuth();

      try {
        await syncAuthContext();
      } catch (err) {
        if (needsAuth()) {
          toast(err instanceof Error ? err.message : "Authentication required", true);
        }
      }

      if (currentPath === "/dashboard") {
        await hydrateDashboardHome();
      }

      if (currentPath === "/dashboard/projects") {
        await hydrateProjectsPage();
      }

      if (currentPath === "/dashboard/chat") {
        await hydrateChatPage();
      }

      if (currentPath === "/dashboard/social") {
        await hydrateSocialPage();
      }

      if (currentPath === "/dashboard/updates") {
        await hydrateUpdatesPage();
      }

      if (currentPath === "/dashboard/profile") {
        await hydrateProfilePage();
      }

      if (currentPath === "/employers/talent") {
        await hydrateEmployerTalentPage();
      }
    } finally {
      if (!hasAppliedAuthCtx && !needsAuth()) {
        applyCtxImmediately();
      }
      document.documentElement.setAttribute("data-runtime-ready", "1");
    }
  }

  void boot();
})();
