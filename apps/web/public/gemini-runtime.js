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
  var isTalentListPath = currentPath === "/employers/talent";
  var isTalentDetailPath = currentPath.indexOf("/employers/talent/") === 0 && !isTalentListPath;
  var DASHBOARD_SUMMARY_CACHE_PREFIX = "ai_tutor_dashboard_summary_v2:";
  var DASHBOARD_SNAPSHOT_CACHE_PREFIX = "ai_tutor_dashboard_snapshot_v2:";
  var AUTH_SESSION_CACHE_PREFIX = "ai_tutor_auth_session_v1:";
  var SOCIAL_DRAFTS_CACHE_PREFIX = "ai_tutor_social_drafts_v1:";
  var CHAT_HISTORY_CACHE_PREFIX = "ai_tutor_chat_history_v1:";
  var ATTRIBUTION_STORAGE_KEY = "ai_tutor_attribution_v1";
  var SIGNUP_VARIANT_KEY = "ai_tutor_exp_signup_variant_v1";
  var ENABLE_DASHBOARD_SNAPSHOT_CACHE = false;
  var HOME_NEWS_CACHE_PREFIX = "ai_tutor_home_news_v1:";
  var HOME_NEWS_WARM_PROMISES = {};
  var SUMMARY_CACHE_TTL_MS = 120000;
  var AUTH_SESSION_CACHE_TTL_MS = 45000;
  var SNAPSHOT_CACHE_TTL_MS = 1800000;
  var CHAT_HISTORY_CACHE_TTL_MS = 604800000;
  var SIGN_UP_INTENT_KEY = "ai_tutor_clerk_signup_intent_v1";
  var PENDING_ONBOARDING_SESSION_KEY = "ai_tutor_pending_onboarding_session_v1";
  var ONBOARDING_ASSESSMENT_FUNNEL = "onboarding_assessment";

  if (isTalentDetailPath) {
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.style.colorScheme = "light";
    document.documentElement.style.backgroundColor = "#f8fafc";
    var staticThemeToggle = document.getElementById("theme-toggle");
    if (staticThemeToggle) {
      var toggleWrap = staticThemeToggle.closest(".fixed");
      if (toggleWrap) {
        toggleWrap.remove();
      } else {
        staticThemeToggle.remove();
      }
    }
    document.documentElement.setAttribute("data-runtime-ready", "1");
    return;
  }

  function normalizedPath(pathname) {
    return (pathname || "/").replace(/\/+$/, "") || "/";
  }

  function localDayKey(timestamp) {
    var date = new Date(Number(timestamp || Date.now()));
    if (Number.isNaN(date.getTime())) date = new Date();
    var year = String(date.getFullYear());
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function payloadIsFreshForToday(payload) {
    if (!payload || typeof payload !== "object") return false;
    var today = localDayKey();
    if (typeof payload.dayKey === "string") return payload.dayKey === today;
    if (payload.ts) return localDayKey(payload.ts) === today;
    return false;
  }

  function readSessionObject(key) {
    try {
      var raw = window.sessionStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function writeSessionObject(key, value) {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      return null;
    }
  }

  function removeSessionObject(key) {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      return null;
    }
  }

  function readLocalObject(key) {
    try {
      var raw = window.localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function writeLocalObject(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      return null;
    }
  }

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
  var restoredDashboardSnapshot = false;
  var lastPosthogIdentifiedUserId = null;
  var routeHydrateInFlight = null;
  var lastHydratedPath = null;

  if (typeof window !== "undefined") {
    window.__AITUTOR_LAST_HYDRATED_PATH = null;
  }

  function posthogClient() {
    if (!window || !window.posthog) return null;
    if (typeof window.posthog.capture !== "function") return null;
    return window.posthog;
  }

  function baseAnalyticsProps(properties) {
    var attribution = readAttributionEnvelope();
    var last = attribution && attribution.last ? attribution.last : {};
    var source = typeof last.utmSource === "string" ? last.utmSource.toLowerCase() : "";
    var base = {
      app: "web",
      path: currentPath,
      utm_source: last.utmSource || null,
      utm_medium: last.utmMedium || null,
      utm_campaign: last.utmCampaign || null,
      utm_content: last.utmContent || null,
      paid_source:
        source.indexOf("linkedin") !== -1
          ? "linkedin"
          : source === "x" || source.indexOf("twitter") !== -1
            ? "x"
            : source.indexOf("facebook") !== -1 || source.indexOf("meta") !== -1 || source.indexOf("instagram") !== -1
              ? "facebook"
              : "unknown",
    };
    if (ctx && ctx.userId) base.user_id = ctx.userId;
    if (ctx && ctx.sessionId) base.session_id = ctx.sessionId;
    if (ctx && ctx.handle) base.handle = ctx.handle;
    return Object.assign(base, properties || {});
  }

  function captureEvent(eventName, properties) {
    var posthog = posthogClient();
    if (!posthog || !eventName) return;
    try {
      posthog.capture(eventName, baseAnalyticsProps(properties));
    } catch {
      return null;
    }
  }

  function trackFunnelStep(step, properties) {
    if (!step) return;
    captureEvent("onboarding_assessment_funnel_step", Object.assign({
      funnel: ONBOARDING_ASSESSMENT_FUNNEL,
      step: step,
    }, properties || {}));
  }

  function identifyPosthogUser() {
    if (!ctx || !ctx.userId) return;
    var posthog = posthogClient();
    if (!posthog || typeof posthog.identify !== "function") return;

    var distinctId = String(ctx.userId);

    var personProps = {};
    if (ctx.email) personProps.email = ctx.email;
    if (ctx.name) personProps.name = ctx.name;
    if (ctx.handle) personProps.handle = ctx.handle;
    if (ctx.careerPathId) personProps.career_path_id = ctx.careerPathId;

    try {
      if (lastPosthogIdentifiedUserId === distinctId) {
        if (typeof posthog.setPersonProperties === "function" && Object.keys(personProps).length) {
          posthog.setPersonProperties(personProps);
        }
        return;
      }

      posthog.identify(distinctId, personProps);
      lastPosthogIdentifiedUserId = distinctId;
    } catch {
      return null;
    }
  }

  function markSignUpIntent() {
    writeSessionObject(SIGN_UP_INTENT_KEY, {
      startedAt: Date.now(),
      referrer: document && document.referrer ? document.referrer : null,
    });
  }

  function readSignUpIntent() {
    return readSessionObject(SIGN_UP_INTENT_KEY);
  }

  function clearSignUpIntent() {
    removeSessionObject(SIGN_UP_INTENT_KEY);
  }

  function readPendingOnboardingSessionId() {
    var fromUrl = null;
    try {
      var params = new URLSearchParams(window.location.search || "");
      var urlSession = params.get("onboardingSessionId");
      if (urlSession) fromUrl = urlSession;
    } catch {
      fromUrl = null;
    }
    if (fromUrl) return fromUrl;

    var pending = readSessionObject(PENDING_ONBOARDING_SESSION_KEY);
    if (!pending || typeof pending !== "object") return null;
    if (typeof pending.sessionId !== "string" || !pending.sessionId.trim()) return null;
    return pending.sessionId.trim();
  }

  function clearPendingOnboardingSession() {
    removeSessionObject(PENDING_ONBOARDING_SESSION_KEY);
  }

  function readAttributionEnvelope() {
    try {
      var raw = window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function trafficSourceFromAttribution() {
    var envelope = readAttributionEnvelope();
    var source = envelope && envelope.last && typeof envelope.last.utmSource === "string"
      ? envelope.last.utmSource.toLowerCase()
      : "";
    if (!source) return "unknown";
    if (source.indexOf("linkedin") !== -1) return "linkedin";
    if (source === "x" || source.indexOf("twitter") !== -1) return "x";
    if (source.indexOf("facebook") !== -1 || source.indexOf("meta") !== -1 || source.indexOf("instagram") !== -1) {
      return "facebook";
    }
    return source;
  }

  function getOrAssignSignupVariant() {
    try {
      var existing = window.localStorage.getItem(SIGNUP_VARIANT_KEY);
      if (existing === "control" || existing === "social_first") return existing;
      var assigned = Math.random() < 0.5 ? "control" : "social_first";
      window.localStorage.setItem(SIGNUP_VARIANT_KEY, assigned);
      return assigned;
    } catch {
      return "control";
    }
  }

  function applyAcquisitionLandingVariant() {
    if (currentPath !== "/") return;

    var source = trafficSourceFromAttribution();
    var variant = getOrAssignSignupVariant();

    var heroSubtext = document.querySelector("section.container p.text-xl.text-gray-400");
    if (heroSubtext && source === "linkedin") {
      heroSubtext.textContent = "Build AI execution proof that hiring managers can verify in minutes.";
    } else if (heroSubtext && source === "x") {
      heroSubtext.textContent = "Ship practical AI workflows fast and show public proof of what you built.";
    } else if (heroSubtext && source === "facebook") {
      heroSubtext.textContent = "Turn AI anxiety into a clear career plan, project by project.";
    }

    var cta = document.querySelector("a.btn.btn-primary.animate-pulse-glow");
    if (cta) {
      if (source === "linkedin") {
        cta.textContent = variant === "social_first" ? "Start with LinkedIn" : "Create Account";
      } else if (source === "x") {
        cta.textContent = variant === "social_first" ? "Start with X Login" : "Create Account";
      } else if (source === "facebook") {
        cta.textContent = variant === "social_first" ? "Start with Facebook Login" : "Create Account";
      }
    }

    captureEvent("acquisition_variant_applied", {
      source: source,
      variant: variant,
      page: "landing",
    });
  }

  function maybeTrackAuthEntryEvents() {
    if (currentPath === "/sign-up") {
      markSignUpIntent();
      captureEvent("clerk_sign_up_started", { auth_provider: "clerk" });
      captureEvent("clerk_sign_up_viewed", { auth_provider: "clerk" });
      captureEvent("auth_clerk_sign_up_viewed", { auth_provider: "clerk" });
      trackFunnelStep("clerk_sign_up_viewed", { auth_provider: "clerk" });
      return;
    }

    if (currentPath === "/sign-in") {
      captureEvent("auth_clerk_sign_in_viewed", { auth_provider: "clerk" });
    }
  }

  function maybeTrackSignUpCompletion(source) {
    if (!ctx || !ctx.userId) return;
    if (currentPath !== "/onboarding") return;
    var intent = readSignUpIntent();
    if (!intent || !intent.startedAt) return;

    captureEvent("clerk_sign_up_completed", {
      auth_provider: "clerk",
      source: source || "runtime",
      signup_started_at: intent.startedAt,
    });
    captureEvent("auth_clerk_sign_up_completed", {
      auth_provider: "clerk",
      source: source || "runtime",
      signup_started_at: intent.startedAt,
    });
    trackFunnelStep("clerk_sign_up_completed", {
      auth_provider: "clerk",
      source: source || "runtime",
    });
    clearSignUpIntent();
  }

  function maybeTrackDashboardWelcomeStep() {
    if (!isDashboardPath) return;
    var params = new URLSearchParams(window.location.search || "");
    if (params.get("welcome") !== "1") return;
    captureEvent("dashboard_welcome_viewed", {
      source: "assessment_redirect",
      situation: ctx && ctx.situation ? ctx.situation : null,
      career_path_id: ctx && ctx.careerPathId ? ctx.careerPathId : null,
    });
    trackFunnelStep("dashboard_welcome_viewed", {
      source: "assessment_redirect",
      situation: ctx && ctx.situation ? ctx.situation : null,
      career_path_id: ctx && ctx.careerPathId ? ctx.careerPathId : null,
    });
  }

  function cacheScope(explicitUserId) {
    var userId = explicitUserId || (ctx && ctx.userId ? ctx.userId : null);
    if (!userId) return null;
    return String(userId);
  }

  function authSessionCacheKey() {
    var scope = cacheScope();
    if (!scope) return null;
    return AUTH_SESSION_CACHE_PREFIX + scope;
  }

  function readAuthSessionCache() {
    var key = authSessionCacheKey();
    if (!key) return null;
    var payload = readSessionObject(key);
    if (!payload || !payload.ts || !payload.data) return null;
    if (Date.now() - Number(payload.ts) > AUTH_SESSION_CACHE_TTL_MS) return null;
    return payload.data;
  }

  function writeAuthSessionCache(data) {
    var key = authSessionCacheKey();
    if (!key || !data) return;
    writeSessionObject(key, { ts: Date.now(), data: data });
  }

  function isNarrowViewport() {
    if (!window || typeof window.matchMedia !== "function") {
      return window.innerWidth <= 1024;
    }
    return window.matchMedia("(max-width: 1024px)").matches;
  }

  function dashboardSummaryCacheKey() {
    var scope = cacheScope();
    if (!scope) return null;
    return DASHBOARD_SUMMARY_CACHE_PREFIX + scope;
  }

  function readDashboardSummaryCache() {
    var key = dashboardSummaryCacheKey();
    if (!key) return null;
    var payload = readSessionObject(key);
    if (!payload || !payload.summary || !payload.ts) return null;
    if (Date.now() - Number(payload.ts) > SUMMARY_CACHE_TTL_MS) return null;
    return payload.summary;
  }

  function writeDashboardSummaryCache(summary) {
    var key = dashboardSummaryCacheKey();
    if (!key || !summary) return;
    writeSessionObject(key, { ts: Date.now(), summary: summary });
  }

  function dashboardSnapshotCacheKey(pathname) {
    var scope = cacheScope();
    if (!scope) return null;
    return DASHBOARD_SNAPSHOT_CACHE_PREFIX + scope + ":" + normalizedPath(pathname);
  }

  function socialDraftCacheKey(projectId) {
    var scope = cacheScope();
    if (!scope) return null;
    return SOCIAL_DRAFTS_CACHE_PREFIX + scope + ":" + String(projectId || "none") + ":" + localDayKey();
  }

  function readSocialDraftCache(projectId) {
    var key = socialDraftCacheKey(projectId);
    if (!key) return null;
    var payload = readSessionObject(key) || readLocalObject(key);
    if (!payload || !payload.drafts) return null;
    if (!payloadIsFreshForToday(payload)) return null;
    return payload.drafts;
  }

  function writeSocialDraftCache(projectId, drafts) {
    var key = socialDraftCacheKey(projectId);
    if (!key || !drafts) return;
    var payload = {
      ts: Date.now(),
      dayKey: localDayKey(),
      drafts: drafts,
    };
    writeSessionObject(key, payload);
    writeLocalObject(key, payload);
  }

  function chatHistoryCacheKey(projectId) {
    var scope = cacheScope();
    if (!scope) return null;
    return CHAT_HISTORY_CACHE_PREFIX + scope + ":" + String(projectId || "none");
  }

  function readChatHistoryCache(projectId) {
    var key = chatHistoryCacheKey(projectId);
    if (!key) return null;
    var payload = readSessionObject(key) || readLocalObject(key);
    if (!payload || !payload.ts || !Array.isArray(payload.messages)) return null;
    if (Date.now() - Number(payload.ts) > CHAT_HISTORY_CACHE_TTL_MS) return null;
    return payload.messages;
  }

  function writeChatHistoryCache(projectId, messages) {
    var key = chatHistoryCacheKey(projectId);
    if (!key || !Array.isArray(messages)) return;
    var payload = { ts: Date.now(), messages: messages };
    writeSessionObject(key, payload);
    writeLocalObject(key, payload);
  }

  function homeNewsCacheKey(userId) {
    var scope = cacheScope(userId);
    if (!scope) return null;
    return HOME_NEWS_CACHE_PREFIX + scope + ":" + localDayKey();
  }

  function readHomeNewsCache(userId) {
    var key = homeNewsCacheKey(userId);
    if (!key) return null;
    var payload = readSessionObject(key) || readLocalObject(key);
    if (!payload || !Array.isArray(payload.insights)) return null;
    if (!payloadIsFreshForToday(payload)) return null;
    return payload;
  }

  function writeHomeNewsCache(payload, userId) {
    var key = homeNewsCacheKey(userId);
    if (!key || !payload || !Array.isArray(payload.insights)) return;
    var normalized = {
      ts: Date.now(),
      dayKey: localDayKey(),
      insights: payload.insights,
      source: payload.source || null,
      focusSummary: payload.focusSummary || null,
    };
    writeSessionObject(key, normalized);
    writeLocalObject(key, normalized);
  }

  function maybeWarmHomeNews(userId) {
    var scope = cacheScope(userId);
    if (!scope) return;
    if (readHomeNewsCache(userId)) return;
    if (HOME_NEWS_WARM_PROMISES[scope]) return;
    HOME_NEWS_WARM_PROMISES[scope] = postJson("/api/news/recommendations", { maxStories: 6 })
      .then(function (fresh) {
        var insights = Array.isArray(fresh && fresh.insights) ? fresh.insights : [];
        if (!insights.length) return;
        writeHomeNewsCache({
          insights: insights,
          source: fresh && fresh.source ? fresh.source : null,
          focusSummary: fresh && fresh.focusSummary ? fresh.focusSummary : null,
        }, userId);
      })
      .catch(function () {
        return null;
      })
      .finally(function () {
        delete HOME_NEWS_WARM_PROMISES[scope];
      });
  }

  function persistDashboardSnapshot(pathname) {
    if (!ENABLE_DASHBOARD_SNAPSHOT_CACHE) return;
    if (!isDashboardPath) return;
    if (isNarrowViewport()) return;
    var key = dashboardSnapshotCacheKey(pathname || currentPath);
    if (!key) return;
    var aside = document.querySelector("aside");
    var main = document.querySelector("main");
    if (!aside || !main) return;
    writeSessionObject(key, {
      ts: Date.now(),
      path: normalizedPath(pathname || currentPath),
      theme: document.documentElement.getAttribute("data-theme") || "light",
      asideClass: aside.className || "",
      mainClass: main.className || "",
      asideHtml: aside.innerHTML || "",
      mainHtml: main.innerHTML || "",
    });
    captureEvent("dashboard_snapshot_persisted", { path: normalizedPath(pathname || currentPath) });
  }

  function showDashboardSkeletons() {
    return;
  }

  function clearDashboardSkeletons() {
    if (!isDashboardPath) return;
    Array.prototype.forEach.call(document.querySelectorAll(".runtime-skeleton"), function (node) {
      node.classList.remove("runtime-skeleton");
    });
  }

  function restoreDashboardSnapshot() {
    if (!ENABLE_DASHBOARD_SNAPSHOT_CACHE) return false;
    if (!isDashboardPath) return false;
    if (isNarrowViewport()) return false;
    var key = dashboardSnapshotCacheKey(currentPath);
    if (!key) return false;
    var payload = readSessionObject(key);
    if (!payload || !payload.ts || !payload.asideHtml || !payload.mainHtml) return false;
    if (Date.now() - Number(payload.ts) > SNAPSHOT_CACHE_TTL_MS) return false;
    var aside = document.querySelector("aside");
    var main = document.querySelector("main");
    if (!aside || !main) return false;
    if (typeof payload.asideClass === "string" && payload.asideClass) aside.className = payload.asideClass;
    if (typeof payload.mainClass === "string" && payload.mainClass) main.className = payload.mainClass;
    aside.innerHTML = payload.asideHtml;
    main.innerHTML = payload.mainHtml;
    enforceLightTheme();
    document.documentElement.setAttribute("data-runtime-ready", "1");
    captureEvent("dashboard_snapshot_restored", { path: currentPath });
    return true;
  }

  function wireDashboardSnapshotPersistence() {
    if (!ENABLE_DASHBOARD_SNAPSHOT_CACHE) return;
    if (!isDashboardPath) return;
    if (isNarrowViewport()) return;
    if (document.documentElement.getAttribute("data-snapshot-cache-wired") === "1") return;
    document.documentElement.setAttribute("data-snapshot-cache-wired", "1");

    document.addEventListener("click", function (event) {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      var target = event.target;
      if (!target || !target.closest) return;
      var link = target.closest("a[href]");
      if (!link) return;
      if (link.getAttribute("target") === "_blank") return;
      var href = link.getAttribute("href");
      if (!href || href.indexOf("javascript:") === 0) return;
      try {
        var url = new URL(href, window.location.origin);
        var nextPath = normalizedPath(url.pathname);
        if (nextPath === currentPath) return;
        if (nextPath === "/dashboard" || nextPath.indexOf("/dashboard/") === 0) {
          persistDashboardSnapshot(currentPath);
        }
      } catch {
        return;
      }
    }, true);

    window.addEventListener("pagehide", function () {
      persistDashboardSnapshot(currentPath);
    });
  }

  restoredDashboardSnapshot = restoreDashboardSnapshot();
  wireDashboardSnapshotPersistence();
  showDashboardSkeletons();

  function applyCtxImmediately() {
    if (!isDashboardPath) return;
    var sidebarProfileLink = document.querySelector("[data-sidebar-profile='1']") ||
      document.querySelector("aside a[href='/dashboard/profile/'], aside a[href='/dashboard/profile']");
    if (sidebarProfileLink && ctx && ctx.name) {
      var nameEl = sidebarProfileLink.querySelector("[data-sidebar-profile-name='1']") || sidebarProfileLink.querySelector(".font-medium");
      var roleEl = sidebarProfileLink.querySelector("[data-sidebar-profile-role='1']") || sidebarProfileLink.querySelector(".text-xs");
      if (nameEl) nameEl.textContent = ctx.name;
      if (roleEl && ctx.headline) roleEl.textContent = ctx.headline;
      var sidebarAvatar = sidebarProfileLink.querySelector("img");
      if (sidebarAvatar && ctx.avatarUrl) {
        var safeSidebarAvatar = sanitizeImageUrl(ctx.avatarUrl);
        if (safeSidebarAvatar) sidebarAvatar.setAttribute("src", safeSidebarAvatar);
        sidebarAvatar.setAttribute("alt", ctx.name);
      }
    }
    if (ctx && ctx.handle) {
      Array.prototype.forEach.call(
        document.querySelectorAll("[data-public-profile-link='1'], a[href='/u/alex-chen-ai/'], a[href='/u/test-user-0001/'], a[href='/u/alex-chen-ai'], a[href='/u/test-user-0001']"),
        function (node) {
          node.setAttribute("href", "/u/" + ctx.handle + "/");
          node.removeAttribute("aria-disabled");
          node.classList.remove("opacity-50", "pointer-events-none");
        },
      );
    }
    if (currentPath === "/dashboard/profile" && ctx && ctx.name) {
      var topIdentity = document.querySelector("main .flex.items-center.gap-6");
      if (topIdentity) {
        var identityName = topIdentity.querySelector("h3");
        if (identityName) identityName.textContent = ctx.name;
        if (ctx.email) {
          var identityEmail = Array.prototype.find.call(topIdentity.querySelectorAll("p"), function (node) {
            return (node.textContent || "").indexOf("@") !== -1;
          });
          if (identityEmail) identityEmail.textContent = ctx.email;
        }
      }
      if (ctx.avatarUrl) {
        var safeAvatar = sanitizeImageUrl(ctx.avatarUrl);
        if (safeAvatar) {
          Array.prototype.forEach.call(document.querySelectorAll("main .flex.items-center.gap-6 img, img[src='/assets/avatar.png']"), function (img) {
            img.setAttribute("src", safeAvatar);
            img.setAttribute("alt", ctx.name);
          });
        }
      }
    }
    var sidebarNameNode = document.querySelector("aside a[href='/dashboard/profile/'] .font-medium, aside a[href='/dashboard/profile'] .font-medium");
    var displayName = sidebarNameNode ? (sidebarNameNode.textContent || "").trim() : "";
    if (!displayName && ctx && ctx.name) displayName = ctx.name || "";
    if (displayName) {
      var greetingNode = document.querySelector("[data-dashboard-greeting='1']") ||
        Array.prototype.find.call(document.querySelectorAll("header h1"), function (el) {
          var text = (el.textContent || "").toLowerCase();
          return text.indexOf("good morning") !== -1 || text.indexOf("good afternoon") !== -1 || text.indexOf("good evening") !== -1;
        });
      if (greetingNode) {
        var firstName = displayName.split(" ")[0] || displayName;
        greetingNode.textContent = greetingForLocalTime() + ", " + firstName + " 👋";
      }
    }
    updateSidebarLevelCard();
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
        if (typeof node.innerHTML === "string") {
          node.innerHTML = node.innerHTML.replace(/Social Hooks/g, "Social Drafts");
          node.innerHTML = node.innerHTML.replace(/Social Media/g, "Social Drafts");
        }
      },
    );

    Array.prototype.forEach.call(
      document.querySelectorAll("a[href='/dashboard/updates/'], a[href='/dashboard/updates']"),
      function (node) {
        if (typeof node.innerHTML === "string") {
          node.innerHTML = node.innerHTML.replace(/Updates/g, "Activity");
          node.innerHTML = node.innerHTML.replace(/fa-solid fa-bell/g, "fa-solid fa-clock-rotate-left");
        }
      },
    );

    Array.prototype.forEach.call(
      document.querySelectorAll(
        "a[href='/dashboard/updates/'], a[href='/dashboard/updates'], a[href='/dashboard/activity/'], a[href='/dashboard/activity']",
      ),
      function (node) {
        Array.prototype.forEach.call(node.querySelectorAll("span"), function (child) {
          var text = (child.textContent || "").trim();
          var className = typeof child.className === "string" ? child.className : "";
          if (!text) {
            if (className.indexOf("bg-red-500") !== -1) child.remove();
            return;
          }
          if (/^[0-9]+$/.test(text) && (className.indexOf("bg-red-500") !== -1 || className.indexOf("text-[10px]") !== -1)) {
            child.remove();
          }
        });
      },
    );

    if (!isDashboardPath) return;
    var nav = document.querySelector("aside nav");
    if (!nav) return;
    var existingAiNews = nav.querySelector("a[href='/dashboard/ai-news/'], a[href='/dashboard/ai-news']");

    if (!existingAiNews) {
      var socialNode = nav.querySelector("a[href='/dashboard/social/'], a[href='/dashboard/social']");
      var aiNewsNode = document.createElement("a");
      aiNewsNode.setAttribute("href", "/dashboard/ai-news/");
      aiNewsNode.className =
        "flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition group";
      aiNewsNode.innerHTML =
        '<i class="fa-solid fa-newspaper w-5 text-center group-hover:text-sky-400 transition-colors"></i> AI News';
      if (socialNode && socialNode.nextSibling) {
        nav.insertBefore(aiNewsNode, socialNode.nextSibling);
      } else {
        nav.appendChild(aiNewsNode);
      }
      existingAiNews = aiNewsNode;
    }

    if (existingAiNews) {
      var aiNewsIcon = existingAiNews.querySelector("i");
      var isAiNewsActive = currentPath === "/dashboard/ai-news";
      if (isAiNewsActive) {
        existingAiNews.className =
          "flex items-center gap-3 px-4 py-2.5 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30";
        if (aiNewsIcon) {
          aiNewsIcon.className = "fa-solid fa-newspaper w-5 text-center font-bold drop-shadow-[0_0_8px_rgba(56,189,248,0.55)]";
        }
      } else {
        existingAiNews.className =
          "flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition group";
        if (aiNewsIcon) {
          aiNewsIcon.className = "fa-solid fa-newspaper w-5 text-center group-hover:text-sky-400 transition-colors";
        }
      }
      if (typeof existingAiNews.textContent === "string" && existingAiNews.textContent.indexOf("AI News") === -1) {
        existingAiNews.appendChild(document.createTextNode(" AI News"));
      }
    }
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

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function sanitizeImageUrl(value) {
    var raw = typeof value === "string" ? value.trim() : "";
    if (!raw) return "";
    if (raw.indexOf("/") === 0) return raw;
    if (raw.indexOf("data:image/") === 0) return raw;
    try {
      var parsed = new URL(raw, window.location.origin);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.toString();
      }
      return "";
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

  function renderDashboardHydrationError(err) {
    if (!isDashboardPath) return;
    var main = document.querySelector("[data-dashboard-route='1']") || document.querySelector("main");
    if (!main) return;
    var message = err && err.message ? String(err.message) : "Unknown dashboard runtime error";
    main.innerHTML =
      '<div class="p-6 md:p-10 max-w-3xl mx-auto w-full">' +
      '<section class="glass p-6 rounded-2xl border border-red-300 bg-red-50 text-red-700">' +
      '<h2 class="font-[Outfit] text-lg font-semibold mb-2">Dashboard module failed to load</h2>' +
      '<p class="text-sm mb-2">' + escapeHtml(message) + "</p>" +
      '<p class="text-xs text-red-600">Reload this page. If it persists, open the Activity tab after refresh to inspect recent errors.</p>' +
      "</section>" +
      "</div>";
  }

  function isUnauthenticatedError(err) {
    if (!err) return false;
    if (err.code === "UNAUTHENTICATED") return true;
    if (typeof err.message === "string" && err.message.toLowerCase().indexOf("sign in required") !== -1) return true;
    return false;
  }

  async function performSignOut() {
    captureEvent("auth_sign_out_clicked", { auth_provider: "clerk" });
    var posthog = posthogClient();
    if (posthog && typeof posthog.reset === "function") {
      try {
        posthog.reset();
        lastPosthogIdentifiedUserId = null;
      } catch {
        // keep sign-out flow moving even if analytics reset fails
      }
    }
    try {
      if (window.Clerk && typeof window.Clerk.signOut === "function") {
        await window.Clerk.signOut({ redirectUrl: "/" });
        captureEvent("auth_sign_out_completed", { auth_provider: "clerk", method: "clerk_client" });
        return;
      }
    } catch {
      // fall through to sign-out route
    }
    captureEvent("auth_sign_out_fallback_redirect", { auth_provider: "clerk", method: "home_redirect" });
    try {
      window.location.href = "/";
      return;
    } catch {
      captureEvent("auth_sign_out_failed", { auth_provider: "clerk", reason: "redirect_failed" });
      toast("Sign-out unavailable right now. Please retry.", true);
    }
  }

  function ensureGlobalSignOutControl(isSignedIn) {
    var existing = document.getElementById("global-sign-out");
    if (existing) existing.remove();
    return;
  }

  function redirectToSignIn(path) {
    window.location.href = "/sign-in?redirect_url=" + encodeURIComponent(path || "/dashboard/");
  }

  function requestHeaders(json) {
    var headers = {
      "cache-control": "no-store",
    };
    if (json) headers["content-type"] = "application/json";
    return headers;
  }

  var authRequiredPaths = [
    "/dashboard",
    "/dashboard/chat",
    "/dashboard/projects",
    "/dashboard/social",
    "/dashboard/ai-news",
    "/dashboard/updates",
    "/dashboard/profile",
  ];

  function needsAuth() {
    return Array.isArray(authRequiredPaths) && authRequiredPaths.indexOf(currentPath) !== -1;
  }

  function enforceLightTheme() {
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.style.colorScheme = "light";
    document.documentElement.style.backgroundColor = "#f8fafc";
  }

  function wireThemeToggle() {
    enforceLightTheme();
    var toggle = document.getElementById("theme-toggle");
    if (toggle) {
      toggle.remove();
    }
  }

  async function syncAuthContext() {
    if (!needsAuth()) return null;
    var applyAuthData = function (data, source) {
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
      if (data.summary) {
        writeDashboardSummaryCache(data.summary);
      }
      saveCtx(ctx);
      identifyPosthogUser();
      maybeTrackSignUpCompletion("sync_auth_context");
      captureEvent("auth_session_synced", {
        scope: "required_path",
        has_summary: Boolean(data.summary),
        source: source || "network",
      });
      hasAppliedAuthCtx = true;
      applyCtxImmediately();
      return data;
    };

    var cached = readAuthSessionCache();
    if (cached) {
      applyAuthData(cached, "session_cache");
      return cached;
    }

    var fresh = await getJson("/api/auth/session");
    if (!fresh || !fresh.auth) return null;
    writeAuthSessionCache(fresh);
    return applyAuthData(fresh, "network");
  }

  async function maybeClaimOnboardingSession() {
    if (!ctx || !ctx.userId) return;
    var sessionToClaim = readPendingOnboardingSessionId();
    if (!sessionToClaim) return;

    try {
      var result = await postJson("/api/onboarding/claim", { sessionId: sessionToClaim });
      if (result && result.session) {
        ctx.sessionId = result.session.id || ctx.sessionId;
        if (result.session.careerPathId) ctx.careerPathId = result.session.careerPathId;
        if (result.session.situation) ctx.situation = result.session.situation;
        if (Array.isArray(result.session.goals)) ctx.onboardingGoals = result.session.goals;
      }
      if (result && result.user) {
        if (result.user.id) ctx.userId = result.user.id;
        if (result.user.handle) ctx.handle = result.user.handle;
        if (result.user.name) ctx.name = result.user.name;
        if (result.user.avatarUrl) ctx.avatarUrl = result.user.avatarUrl;
      }
      saveCtx(ctx);

      try {
        var summaryPayload = await getJson("/api/dashboard/summary");
        if (summaryPayload && summaryPayload.summary) {
          writeDashboardSummaryCache(summaryPayload.summary);
        }
      } catch {
        // Non-blocking refresh.
      }

      clearPendingOnboardingSession();
      captureEvent("onboarding_session_claimed", {
        session_id: sessionToClaim,
        migrated: Boolean(result && result.migrated),
      });
      trackFunnelStep("onboarding_session_claimed", {
        session_id: sessionToClaim,
        migrated: Boolean(result && result.migrated),
      });

      try {
        var params = new URLSearchParams(window.location.search || "");
        if (params.has("onboardingSessionId")) {
          params.delete("onboardingSessionId");
          var nextSearch = params.toString();
          var next = window.location.pathname + (nextSearch ? "?" + nextSearch : "");
          window.history.replaceState({}, "", next);
        }
      } catch {
        return;
      }
    } catch (err) {
      captureEvent("onboarding_session_claim_failed", {
        session_id: sessionToClaim,
        reason: err && err.message ? err.message : "unknown_error",
      });
    }
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
        identifyPosthogUser();
        maybeTrackSignUpCompletion("landing_auth");
        applyLandingAuthUi(data.summary);
        ensureGlobalSignOutControl(true);
        captureEvent("auth_session_synced", { scope: "landing", signed_in: true });
      } else {
        ctx.userId = null;
        ctx.handle = null;
        ctx.sessionId = null;
        ctx.projectId = null;
        ctx.avatarUrl = null;
        ctx.email = null;
        saveCtx(ctx);
        lastPosthogIdentifiedUserId = null;
        applyLandingAuthUi(null);
        ensureGlobalSignOutControl(false);
        captureEvent("auth_session_synced", { scope: "landing", signed_in: false });
      }
    } catch {
      ctx.userId = null;
      ctx.handle = null;
      ctx.sessionId = null;
      ctx.projectId = null;
      ctx.avatarUrl = null;
      ctx.email = null;
      saveCtx(ctx);
      lastPosthogIdentifiedUserId = null;
      applyLandingAuthUi(null);
      ensureGlobalSignOutControl(false);
      captureEvent("auth_session_sync_failed", { scope: "landing" });
    }
  }

  async function syncOptionalAuthUi() {
    if (needsAuth() || currentPath === "/") return;
    try {
      var data = await getJson("/api/auth/session");
      if (data && data.auth) {
        if (data.auth.userId) ctx.userId = data.auth.userId;
        if (data.auth.name) ctx.name = data.auth.name;
        if (data.auth.avatarUrl) ctx.avatarUrl = data.auth.avatarUrl;
        if (data.auth.email) ctx.email = data.auth.email;
        if (data.summary && data.summary.user && data.summary.user.handle) ctx.handle = data.summary.user.handle;
        saveCtx(ctx);
        identifyPosthogUser();
        maybeTrackSignUpCompletion("optional_auth");
        ensureGlobalSignOutControl(true);
        captureEvent("auth_session_synced", { scope: "optional", signed_in: true });
        return;
      }
    } catch {
      // not signed in
    }
    lastPosthogIdentifiedUserId = null;
    ensureGlobalSignOutControl(false);
    captureEvent("auth_session_synced", { scope: "optional", signed_in: false });
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

  function salutationForHour(hour) {
    if (hour >= 5 && hour < 12) return "Good Morning";
    if (hour >= 12 && hour < 18) return "Good Afternoon";
    return "Good Evening";
  }

  function greetingForLocalTime() {
    var now = new Date();
    return salutationForHour(now.getHours());
  }

  function computeLearnerLevel(user) {
    if (!user || !Array.isArray(user.skills) || !user.skills.length) return 1;
    var verified = user.skills.filter(function (skill) {
      return skill && skill.status === "verified";
    }).length;
    return Math.max(1, Math.min(3, verified + 1));
  }

  function updateSidebarLevelCard(summary) {
    if (!isDashboardPath) return;
    var level = 1;
    if (summary && summary.user) {
      level = computeLearnerLevel(summary.user);
    }
    var levelLabel = "Level " + level;
    var subtitle = level === 1 ? "Starter Builder" : level === 2 ? "Active Builder" : "Verified Builder";
    var progressWidth = level === 1 ? "20%" : level === 2 ? "60%" : "100%";
    var progressText = level >= 3 ? "Max level reached" : "Keep shipping to reach Level " + (level + 1);

    var levelNode = document.querySelector("[data-sidebar-level-label='1']") ||
      Array.prototype.find.call(document.querySelectorAll("aside *"), function (node) {
        var text = (node.textContent || "").trim();
        return /^level\s+\d+$/i.test(text);
      });

    if (levelNode) {
      levelNode.textContent = levelLabel;
      var card = levelNode.closest("[data-sidebar-level-card='1']") || levelNode.closest("div.bg-gradient-to-br");
      if (card) {
        var bodyText = card.querySelector("[data-sidebar-level-subtitle='1']") || card.querySelector("p.text-xs.text-gray-400");
        if (bodyText) bodyText.textContent = subtitle;
        var progressBar = card.querySelector("[data-sidebar-level-progress='1']") || card.querySelector("div.bg-gradient-to-r");
        if (progressBar) progressBar.style.width = progressWidth;
        var progressLabel = card.querySelector("[data-sidebar-level-progress-text='1']") || card.querySelector("p.text-[10px].text-gray-500");
        if (progressLabel) progressLabel.textContent = progressText;
      }
    }
  }

  function updateSharedUserUi(summary) {
    if (!summary || !summary.user) return;
    var user = summary.user;
    var resolvedName = user.name;
    if (ctx && typeof ctx.name === "string" && ctx.name.trim()) {
      resolvedName = ctx.name.trim();
    }
    if (user.id) ctx.userId = user.id;
    ctx.handle = user.handle;
    ctx.name = resolvedName;
    ctx.headline = headlineForUser(user);
    if (user.avatarUrl) ctx.avatarUrl = user.avatarUrl;
    saveCtx(ctx);
    maybeWarmHomeNews(user.id ? String(user.id) : ctx.userId);

    var sidebarProfileLink = document.querySelector("[data-sidebar-profile='1']") ||
      document.querySelector("aside a[href='/dashboard/profile/'], aside a[href='/dashboard/profile']");
    if (sidebarProfileLink) {
      var nameEl = sidebarProfileLink.querySelector("[data-sidebar-profile-name='1']") || sidebarProfileLink.querySelector(".font-medium");
      var roleEl = sidebarProfileLink.querySelector("[data-sidebar-profile-role='1']") || sidebarProfileLink.querySelector(".text-xs");
      setText(nameEl, resolvedName);
      setText(roleEl, headlineForUser(user));
      var avatar = sidebarProfileLink.querySelector("img");
      if (avatar) {
        avatar.setAttribute("alt", resolvedName);
        if (ctx.avatarUrl) {
          var safeAvatar = sanitizeImageUrl(ctx.avatarUrl);
          if (safeAvatar) avatar.setAttribute("src", safeAvatar);
        }
      }
    }

    var publicProfileLinks = document.querySelectorAll("[data-public-profile-link='1'], a[href='/u/alex-chen-ai/'], a[href='/u/test-user-0001/'], a[href='/u/alex-chen-ai'], a[href='/u/test-user-0001']");
    Array.prototype.forEach.call(publicProfileLinks, function (link) {
      setHref(link, "/u/" + user.handle + "/");
      link.removeAttribute("aria-disabled");
      link.classList.remove("opacity-50", "pointer-events-none");
    });

    var greeting = document.querySelector("[data-dashboard-greeting='1']") ||
      Array.prototype.find.call(document.querySelectorAll("header h1"), function (el) {
        var text = (el.textContent || "").toLowerCase();
        return text.indexOf("good morning") !== -1 || text.indexOf("good afternoon") !== -1 || text.indexOf("good evening") !== -1;
      });

    if (greeting) {
      var firstName = resolvedName.split(" ")[0] || resolvedName;
      greeting.textContent = greetingForLocalTime() + ", " + firstName + " 👋";
    }

    if (ctx.avatarUrl && isDashboardPath) {
      Array.prototype.forEach.call(
        document.querySelectorAll("aside img[src='/assets/avatar.png'], aside a[href='/dashboard/profile'] img[src='/assets/avatar.png'], aside a[href='/dashboard/profile/'] img[src='/assets/avatar.png']"),
        function (node) {
          var safeAvatarValue = sanitizeImageUrl(ctx.avatarUrl);
          if (safeAvatarValue) node.setAttribute("src", safeAvatarValue);
          if (!node.getAttribute("alt")) node.setAttribute("alt", resolvedName);
        },
      );
    }

    if (isDashboardPath) {
      renameSocialNavLabels();
      updateSidebarLevelCard(summary);
      var staleSidebarSignOut = document.getElementById("dashboard-sidebar-settings");
      if (staleSidebarSignOut) staleSidebarSignOut.remove();
      var aside = document.querySelector("aside");
      if (aside) {
        Array.prototype.forEach.call(aside.querySelectorAll("a,button"), function (node) {
          var text = (node.textContent || "").trim().toLowerCase();
          if (text === "sign out" || text === "log out") {
            node.remove();
          }
        });
      }
      ensureMobileDashboardNav();
    }
  }

  function ensureDashboardSettingsMenu() {
    return;
  }

  function ensureMobileDashboardNav() {
    if (!isDashboardPath) return;
    var shell = document.querySelector("[data-gemini-shell='1']");
    if (!shell) return;
    var aside = shell.querySelector(":scope > aside");
    var main = shell.querySelector(":scope > main");
    if (!aside || !main) return;

    var header = main.querySelector(":scope > header");
    if (!header) return;

    if (!isNarrowViewport()) {
      document.documentElement.setAttribute("data-mobile-nav", "closed");
      var desktopOverlay = document.querySelector(".dashboard-mobile-nav-overlay");
      if (desktopOverlay) desktopOverlay.remove();
      var desktopToggle = document.getElementById("dashboard-mobile-nav-toggle") || header.querySelector("[data-mobile-nav-toggle='1']");
      if (desktopToggle) desktopToggle.remove();
      return;
    }

    var existingOverlay = document.querySelector(".dashboard-mobile-nav-overlay");
    if (!existingOverlay) {
      var overlay = document.createElement("button");
      overlay.type = "button";
      overlay.className = "dashboard-mobile-nav-overlay";
      overlay.setAttribute("aria-label", "Close menu");
      overlay.setAttribute("data-mobile-nav-overlay", "1");
      overlay.addEventListener("click", function () {
        document.documentElement.setAttribute("data-mobile-nav", "closed");
      });
      document.body.appendChild(overlay);
    }

    var toggleButton = document.getElementById("dashboard-mobile-nav-toggle");
    if (!toggleButton) {
      toggleButton = header.querySelector("[data-mobile-nav-toggle='1']");
    }
    if (!toggleButton) {
      toggleButton = document.createElement("button");
      toggleButton.id = "dashboard-mobile-nav-toggle";
      toggleButton.type = "button";
      toggleButton.setAttribute("data-mobile-nav-toggle", "1");
      toggleButton.setAttribute("aria-label", "Open menu");
      toggleButton.className = "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-gray-200";
      toggleButton.innerHTML = '<i class="fa-solid fa-bars text-sm"></i>';
    }

    if (toggleButton.parentElement !== header) {
      header.insertBefore(toggleButton, header.firstChild);
    }

    var closeMobileMenu = function () {
      document.documentElement.setAttribute("data-mobile-nav", "closed");
    };

    if (toggleButton.getAttribute("data-mobile-nav-wired") !== "1") {
      toggleButton.setAttribute("data-mobile-nav-wired", "1");
      toggleButton.addEventListener("click", function () {
        var isOpen = document.documentElement.getAttribute("data-mobile-nav") === "open";
        document.documentElement.setAttribute("data-mobile-nav", isOpen ? "closed" : "open");
        captureEvent("dashboard_mobile_nav_toggled", { is_open: !isOpen });
      });
    }

    var settingsMenu = document.getElementById("dashboard-settings-menu");
    if (settingsMenu) {
      var rightControls = header.querySelector(".flex.items-center.gap-4") || header.querySelector(".flex.items-center.gap-2");
      if (rightControls && settingsMenu.parentElement !== rightControls) {
        rightControls.appendChild(settingsMenu);
      }
    }

    Array.prototype.forEach.call(aside.querySelectorAll("a[href]"), function (node) {
      if (node.getAttribute("data-mobile-nav-bound") === "1") return;
      node.setAttribute("data-mobile-nav-bound", "1");
      node.addEventListener("click", function () {
        closeMobileMenu();
      });
    });

    if (!isNarrowViewport()) {
      document.documentElement.setAttribute("data-mobile-nav", "closed");
    } else if (!document.documentElement.getAttribute("data-mobile-nav")) {
      document.documentElement.setAttribute("data-mobile-nav", "closed");
    }

    if (document.documentElement.getAttribute("data-mobile-nav-resize-wired") !== "1") {
      document.documentElement.setAttribute("data-mobile-nav-resize-wired", "1");
      window.addEventListener("resize", function () {
        if (!isDashboardPath) return;
        ensureMobileDashboardNav();
      });
    }
  }

  async function ensureSession() {
    if (ctx.sessionId && ctx.sessionToken) {
      return {
        id: ctx.sessionId,
        userId: ctx.userId,
        token: ctx.sessionToken,
        onboardingOptions: ctx.onboardingOptions || [],
      };
    }
    if (ctx.sessionId && !ctx.sessionToken) {
      ctx.sessionId = null;
      saveCtx(ctx);
    }

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
      acquisition: readAttributionEnvelope() || undefined,
    });
    if (!data || !data.session || !data.session.id || !data.sessionToken) {
      throw new Error("Unable to initialize onboarding session");
    }

    ctx.sessionId = data.session.id;
    ctx.sessionToken = data.sessionToken;
    if (data.user && data.user.id) ctx.userId = data.user.id;
    if (data.user && data.user.handle) ctx.handle = data.user.handle;
    if (data.user && data.user.name) ctx.name = data.user.name;
    if (data.user && data.user.avatarUrl) ctx.avatarUrl = data.user.avatarUrl;
    if (Array.isArray(data.onboardingOptions)) ctx.onboardingOptions = data.onboardingOptions;
    saveCtx(ctx);
    identifyPosthogUser();
    captureEvent("onboarding_session_initialized", {
      session_id: data.session.id,
      career_path_id: ctx.careerPathId || "product-management",
      source: "onboarding_start",
    });
    trackFunnelStep("onboarding_session_initialized", {
      session_id: data.session.id,
      career_path_id: ctx.careerPathId || "product-management",
      source: "onboarding_start",
    });

    return {
      id: data.session.id,
      userId: data.session.userId || ctx.userId,
      token: data.sessionToken,
      onboardingOptions: Array.isArray(data.onboardingOptions) ? data.onboardingOptions : [],
    };
  }

  async function getDashboardSummary() {
    function topProjectForPrewarm(summary) {
      if (!summary || !Array.isArray(summary.projects) || !summary.projects.length) return null;
      return summary.projects.find(function (project) {
        return project && (project.state === "building" || project.state === "planned" || project.state === "idea");
      }) || summary.projects[0] || null;
    }

    function prewarmDashboardDailyData(summary) {
      if (!isDashboardPath || !summary) return;
      var prewarmProject = topProjectForPrewarm(summary);
      var prewarmProjectId = prewarmProject && prewarmProject.id ? prewarmProject.id : null;
      var summaryUserId = summary && summary.user && summary.user.id ? String(summary.user.id) : null;

      if (summaryUserId && (!ctx.userId || ctx.userId !== summaryUserId)) {
        ctx.userId = summaryUserId;
        saveCtx(ctx);
      }

      if (!readHomeNewsCache(summaryUserId)) {
        void postJson("/api/news/recommendations", { maxStories: 6 })
          .then(function (newsResult) {
            writeHomeNewsCache({
              insights: Array.isArray(newsResult && newsResult.insights) ? newsResult.insights : [],
              source: newsResult && newsResult.source ? newsResult.source : null,
              focusSummary: newsResult && newsResult.focusSummary ? newsResult.focusSummary : null,
            }, summaryUserId);
            captureEvent("dashboard_news_prewarmed", { source: "background" });
          })
          .catch(function (error) {
            captureEvent("dashboard_news_prewarm_failed", {
              reason: error && error.message ? error.message : "unknown_error",
            });
          });
      }

      if (!readSocialDraftCache(prewarmProjectId)) {
        void postJson("/api/social/drafts/ideas", { projectId: prewarmProjectId || null })
          .then(function (ideasResult) {
            var ideas = ideasResult && ideasResult.ideas ? ideasResult.ideas : null;
            if (!ideas) return;
            writeSocialDraftCache(prewarmProjectId, {
              linkedin: typeof ideas.linkedin === "string" ? ideas.linkedin : "",
              x: typeof ideas.x === "string" ? ideas.x : "",
              contextLabel: typeof ideas.contextLabel === "string" ? ideas.contextLabel : "",
              source: ideasResult && ideasResult.source ? ideasResult.source : "profile_context",
            });
            captureEvent("dashboard_social_prewarmed", { source: "background", has_project: Boolean(prewarmProjectId) });
          })
          .catch(function (error) {
            captureEvent("dashboard_social_prewarm_failed", {
              reason: error && error.message ? error.message : "unknown_error",
            });
          });
      }
    }

    var cached = readDashboardSummaryCache();
    if (cached) {
      captureEvent("dashboard_summary_cache_hit", { source: "session_storage" });
      prewarmDashboardDailyData(cached);
      return cached;
    }

    try {
      var response = await getJson("/api/dashboard/summary");
      if (response && response.summary) {
        writeDashboardSummaryCache(response.summary);
        captureEvent("dashboard_summary_loaded", { source: "network" });
        prewarmDashboardDailyData(response.summary);
      }
      return response.summary;
    } catch (err) {
      if (!isUnauthenticatedError(err)) {
        throw err;
      }
      await ensureSession();
      var retry = await getJson("/api/dashboard/summary");
      if (retry && retry.summary) {
        writeDashboardSummaryCache(retry.summary);
        captureEvent("dashboard_summary_loaded", { source: "network_after_session" });
        prewarmDashboardDailyData(retry.summary);
      }
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

    var recommendation = summary && Array.isArray(summary.moduleRecommendations) && summary.moduleRecommendations.length
      ? summary.moduleRecommendations[0]
      : null;
    var title = recommendation && recommendation.title
      ? recommendation.title + " Starter Build"
      : "Starter AI Build";
    var description = recommendation && recommendation.title
      ? "Starter project generated from your " + recommendation.title + " path to begin collecting proof artifacts."
      : "Starter project generated from your onboarding path to begin collecting proof artifacts.";

    var created = await postJson("/api/projects", {
      title: title,
      description: description,
      userId: ctx.userId,
      slug: "starter-build",
    });
    ctx.projectId = created.project.id;
    saveCtx(ctx);
    return created.project;
  }

  async function hydrateDashboardHome() {
    captureEvent("dashboard_tab_viewed", { tab: "home" });
    var summary = await getDashboardSummary();
    var summaryUserId = summary && summary.user && summary.user.id ? String(summary.user.id) : null;
    updateSharedUserUi(summary);
    var topRecommendation = Array.isArray(summary.moduleRecommendations) && summary.moduleRecommendations.length
      ? summary.moduleRecommendations[0]
      : null;

    var projects = summary.projects || [];
    var activeProject = projects.find(function (project) {
      return project.state === "building" || project.state === "planned" || project.state === "idea";
    }) || projects[0] || null;

    var completed = projects.find(function (project) {
      return project.state === "built" || project.state === "showcased";
    }) || projects[1] || null;

    var activeCard = activeProject;
    if (!activeCard && topRecommendation) {
      activeCard = {
        id: null,
        title: topRecommendation.title,
        description: topRecommendation.summary,
        buildLog: [],
      };
    }
    if (!activeCard) {
      activeCard = {
        id: null,
        title: "Introduction to LLMs",
        description: "Start this module to build LLM fundamentals and ship your first practical artifact.",
        buildLog: [],
      };
    }

    function normalizeInlineText(value) {
      return String(value || "")
        .replace(/\s+/g, " ")
        .trim();
    }

    function summarizeText(value, maxChars) {
      var cleaned = normalizeInlineText(value);
      if (!cleaned) return "";
      if (!maxChars || cleaned.length <= maxChars) return cleaned;
      return cleaned.slice(0, Math.max(0, maxChars - 3)).trim() + "...";
    }

    function latestEventMessage(events) {
      if (!Array.isArray(events) || !events.length) return "";
      var bestMessage = "";
      var bestTs = -Infinity;
      events.forEach(function (event) {
        var message = normalizeInlineText(event && event.message);
        if (!message) return;
        var parsed = Date.parse(event && event.createdAt ? String(event.createdAt) : "");
        var ts = Number.isFinite(parsed) ? parsed : 0;
        if (ts >= bestTs) {
          bestTs = ts;
          bestMessage = message;
        }
      });
      return bestMessage;
    }

    function latestBuildLogMessage(project) {
      if (!project || !Array.isArray(project.buildLog)) return "";
      for (var index = project.buildLog.length - 1; index >= 0; index -= 1) {
        var entry = project.buildLog[index];
        var message = normalizeInlineText(entry && entry.message);
        if (!message) continue;
        return message;
      }
      return "";
    }

    function latestChatCacheMessage(projectId) {
      if (!projectId) return "";
      var cachedHistory = readChatHistoryCache(projectId);
      if (!Array.isArray(cachedHistory) || !cachedHistory.length) return "";
      for (var index = cachedHistory.length - 1; index >= 0; index -= 1) {
        var item = cachedHistory[index] || {};
        var text = normalizeInlineText(item.text);
        if (!text) continue;
        return text;
      }
      return "";
    }

    var todayUpdateText = summarizeText(
      (summary.dailyUpdate && summary.dailyUpdate.summary) ||
      latestEventMessage(summary.latestEvents) ||
      "You are set up for focused progress today. Pick one concrete task and ship it.",
      180,
    );

    var continuationText = summarizeText(
      latestBuildLogMessage(activeProject) ||
      latestChatCacheMessage(activeProject && activeProject.id ? activeProject.id : ctx.projectId) ||
      "Share your latest blocker and I will help you take the next verified step.",
      200,
    );

    var tutorBanner = document.querySelector("div.glass-panel.p-6.rounded-2xl.mb-8");
    if (tutorBanner) {
      var bannerTitle = tutorBanner.querySelector("h3");
      var bannerBody = tutorBanner.querySelector("p.text-sm.text-gray-400");
      var bannerCta = tutorBanner.querySelector("a.btn");
      if (bannerTitle) {
        bannerTitle.innerHTML = '<span class="text-emerald-400">Today&apos;s update:</span> ' + escapeHtml(todayUpdateText);
      }
      if (bannerBody) {
        bannerBody.textContent = "Continue where we left off: " + continuationText;
      }
      if (bannerCta) {
        bannerCta.textContent = "Continue where we left off";
        setHref(bannerCta, "/dashboard/chat/");
      }
    }

    var cards = document.querySelectorAll("section .grid.sm\\:grid-cols-2 > a");
    if (cards[0] && activeCard) {
      var title = cards[0].querySelector("h3");
      var desc = cards[0].querySelector("p.text-xs");
      setText(title, activeCard.title || "Introduction to LLMs");
      setText(desc, activeCard.description || "Start this module to build LLM fundamentals and ship your first practical artifact.");
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
    } else if (skillStack && Array.isArray(summary.moduleRecommendations) && summary.moduleRecommendations.length) {
      var addTargetSkill = Array.prototype.find.call(skillStack.children, function (child) {
        return (child.textContent || "").indexOf("Add Target Skill") !== -1;
      });
      skillStack.innerHTML = "";
      summary.moduleRecommendations.slice(0, 3).forEach(function (track, index) {
        var fallback = document.createElement("div");
        fallback.className = index === 0
          ? "flex border border-emerald-500/30 bg-emerald-500/10 rounded-full items-center px-3 py-1.5"
          : "flex border border-white/10 bg-white/5 rounded-full items-center px-3 py-1.5";
        var pct = index === 0 ? "20%" : index === 1 ? "10%" : "5%";
        fallback.innerHTML = '<span class="text-xs ' + (index === 0 ? "text-emerald-400" : "text-gray-300") + '"></span>';
        setText(fallback.querySelector("span"), track.title + " (" + pct + ")");
        skillStack.appendChild(fallback);
      });
      if (addTargetSkill) skillStack.appendChild(addTargetSkill);
    }

    var socialQuote = document.querySelector("section p.text-sm.text-gray-300.mb-4.italic");
    var socialSection = socialQuote ? socialQuote.closest("section") : null;
    var socialCta = socialSection ? socialSection.querySelector("a[href='/dashboard/social/'], a[href='/dashboard/social']") : null;
    if (socialCta) {
      setHref(socialCta, "/dashboard/social/");
      socialCta.textContent = "Open Social Drafts";
    }

    function applySocialQuote(tweetText) {
      if (!socialQuote) return;
      var normalized = summarizeText(tweetText, 200);
      if (!normalized) return;
      socialQuote.textContent = '"' + normalized + '"';
    }

    async function loadHomeTweetDraft(projectId) {
      var ideasResult = await postJson("/api/social/drafts/ideas", { projectId: projectId || null });
      var ideas = ideasResult && ideasResult.ideas ? ideasResult.ideas : null;
      var tweetIdea = ideas && typeof ideas.x === "string" ? ideas.x : "";
      if (!normalizeInlineText(tweetIdea)) {
        throw new Error("Tweet draft not returned");
      }
      writeSocialDraftCache(projectId, {
        linkedin: ideas && typeof ideas.linkedin === "string" ? ideas.linkedin : "",
        x: tweetIdea,
        contextLabel: ideas && typeof ideas.contextLabel === "string" ? ideas.contextLabel : "",
        source: ideasResult && ideasResult.source ? ideasResult.source : "profile_context",
      });
      applySocialQuote(tweetIdea);
    }

    if (socialQuote) {
      var socialProjectId = activeProject && activeProject.id ? activeProject.id : null;
      var cachedDrafts = readSocialDraftCache(socialProjectId);
      var cachedTweet = cachedDrafts && typeof cachedDrafts.x === "string" ? cachedDrafts.x : "";
      if (normalizeInlineText(cachedTweet)) {
        applySocialQuote(cachedTweet);
      } else {
        applySocialQuote("Generating today's tweet draft from your latest project context.");
        void loadHomeTweetDraft(socialProjectId).catch(function () {
          applySocialQuote("Social drafts are unavailable right now. Open Social Drafts to regenerate.");
        });
      }
    }

    var updatesSection = document.querySelector("[data-home-ai-news='1']") || Array.prototype.find.call(document.querySelectorAll("section"), function (section) {
      var text = (section.textContent || "").toLowerCase();
      return text.indexOf("ai updates") !== -1 || text.indexOf("view inbox") !== -1 || text.indexOf("ai news") !== -1;
    });
    if (updatesSection) {
      var updatesTitle = updatesSection.querySelector("h2");
      if (updatesTitle) {
        updatesTitle.innerHTML = '<i class="fa-solid fa-newspaper text-sky-400"></i> AI News';
      }

      var updatesLink = updatesSection.querySelector("a[href='/dashboard/updates/'], a[href='/dashboard/updates']");
      if (updatesLink) {
        setHref(updatesLink, "/dashboard/ai-news/");
        updatesLink.textContent = "View all";
      }

      var updatesList = updatesSection.querySelector(".space-y-3");
      if (updatesList) {
        function normalizeHomeNews(insights) {
          var rows = Array.isArray(insights) ? insights.slice(0, 3) : [];
          return rows
            .map(function (insight) {
              return {
                title: normalizeInlineText(insight && insight.title ? insight.title : ""),
                summary: normalizeInlineText(insight && insight.summary ? insight.summary : ""),
                source: normalizeInlineText(insight && insight.source ? insight.source : "AI News"),
              };
            })
            .filter(function (story) {
              return Boolean(story.title);
            })
            .slice(0, 3);
        }

        function renderHomeNews(insights, unavailableReason) {
          var rows = normalizeHomeNews(insights);
          var isLoading = unavailableReason && unavailableReason.toLowerCase().indexOf("generating") !== -1;
          while (rows.length < 3) {
            rows.push({
              title: isLoading ? "Generating AI News" : "AI News unavailable",
              summary: unavailableReason || "News generation is currently unavailable. Open AI News to retry.",
              source: isLoading ? "Loading" : "Error",
            });
          }
          updatesList.innerHTML = rows
            .map(function (story) {
              return (
                '<a href="/dashboard/ai-news/" class="block glass p-4 rounded-xl border border-sky-500/20 bg-sky-500/5 hover:bg-white/5 transition flex gap-3">' +
                '<div class="w-8 h-8 rounded shrink-0 bg-sky-500/20 flex items-center justify-center text-sky-400">' +
                '<i class="fa-solid fa-newspaper text-xs"></i></div>' +
                "<div>" +
                '<h4 class="font-medium text-white text-sm mb-0.5">' + escapeHtml(story.title) + "</h4>" +
                '<p class="text-xs text-gray-400 line-clamp-2">' + escapeHtml(story.summary || "Open AI News to review the full recommendation.") + "</p>" +
                '<p class="text-[10px] text-sky-300 mt-1">' + escapeHtml(story.source) + "</p>" +
                "</div></a>"
              );
            })
            .join("");
        }

        async function refreshHomeNews() {
          var fresh = await postJson("/api/news/recommendations", { maxStories: 3 });
          var insights = Array.isArray(fresh && fresh.insights) ? fresh.insights : [];
          if (!insights.length) {
            throw new Error("No news insights returned");
          }
          writeHomeNewsCache({
            insights: insights,
            source: fresh && fresh.source ? fresh.source : null,
            focusSummary: fresh && fresh.focusSummary ? fresh.focusSummary : null,
          }, summaryUserId);
          renderHomeNews(insights);
        }

        var cachedNews = readHomeNewsCache(summaryUserId);
        if (cachedNews && Array.isArray(cachedNews.insights) && cachedNews.insights.length) {
          renderHomeNews(cachedNews.insights);
        } else {
          renderHomeNews([], "Generating today's AI news briefing. Open AI News for live status.");
          void refreshHomeNews().catch(function (err) {
            renderHomeNews([], err && err.message ? String(err.message) : "Unable to load AI News.");
          });
        }
      }
    }

    Array.prototype.forEach.call(document.querySelectorAll("header a, header button"), function (node) {
      var label = (node.textContent || "").trim().toLowerCase();
      if (label.indexOf("view talent board") !== -1) {
        node.remove();
      }
    });
  }

  async function hydrateProjectsPage() {
    captureEvent("dashboard_tab_viewed", { tab: "projects" });
    var summary = await getDashboardSummary();
    updateSharedUserUi(summary);

    var newProjectButton = document.querySelector("header a.btn.btn-primary");
    if (newProjectButton && isNarrowViewport()) {
      newProjectButton.innerHTML = '<i class="fa-solid fa-plus mr-1"></i> New Project';
    }

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

  function createBubble(text, isUser) {
    var wrapper = document.createElement("div");
    var theme = document.documentElement.getAttribute("data-theme") || "light";
    wrapper.className = isUser
      ? "flex items-start justify-end gap-4 max-w-4xl ml-auto"
      : "flex items-start gap-4 max-w-4xl";

    if (isUser) {
      var userAvatar = sanitizeImageUrl(ctx.avatarUrl) || "/assets/avatar.png";
      var bubble = document.createElement("div");
      bubble.className = "chat-user-bubble bg-emerald-600 text-white p-5 rounded-2xl rounded-tr-sm text-sm shadow-[0_5px_15px_rgba(16,185,129,0.2)]";
      var message = document.createElement("p");
      message.textContent = String(text || "");
      bubble.appendChild(message);
      var avatar = document.createElement("img");
      avatar.setAttribute("src", userAvatar);
      avatar.setAttribute("alt", String(ctx.name || "Learner"));
      avatar.className = "w-8 h-8 rounded-full object-cover border border-white/20 flex-shrink-0 mt-1";
      wrapper.appendChild(bubble);
      wrapper.appendChild(avatar);
      if (theme === "light") {
        bubble.classList.add("chat-user-bubble-light");
      }
    } else {
      var iconWrap = document.createElement("div");
      iconWrap.className =
        "w-8 h-8 rounded-full bg-gradient-to-b from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 mt-1 shadow-[0_0_10px_rgba(16,185,129,0.3)]";
      iconWrap.innerHTML = '<i class="fa-solid fa-robot text-white text-[10px]"></i>';
      var aiBubble = document.createElement("div");
      aiBubble.className = "chat-ai-bubble glass p-5 rounded-2xl rounded-tl-sm text-sm border-emerald-500/20 bg-emerald-500/5";
      var aiText = document.createElement("p");
      aiText.textContent = String(text || "");
      aiBubble.appendChild(aiText);
      wrapper.appendChild(iconWrap);
      wrapper.appendChild(aiBubble);
      if (theme === "light") {
        aiBubble.classList.add("chat-ai-bubble-light");
      }
    }

    return wrapper;
  }

  async function hydrateChatPage() {
    captureEvent("dashboard_tab_viewed", { tab: "chat" });
    var history = document.querySelector("main .flex-1.overflow-y-auto");
    var textarea = document.querySelector("textarea");
    var sendBtn = Array.prototype.find.call(document.querySelectorAll("button"), function (btn) {
      return btn.querySelector(".fa-paper-plane");
    });

    if (!history || !textarea || !sendBtn) return;

    history.innerHTML = "";
    history.appendChild(createBubble("Loading your latest session context...", false));

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

    var sending = false;
    var chatHistoryState = [];
    var cacheProjectId = null;

    function persistChatHistory() {
      if (!cacheProjectId) return;
      writeChatHistoryCache(cacheProjectId, chatHistoryState.slice(-80));
    }

    function appendAndPersist(role, text) {
      chatHistoryState.push({
        role: role,
        text: String(text || ""),
        ts: Date.now(),
      });
      if (chatHistoryState.length > 80) {
        chatHistoryState = chatHistoryState.slice(-80);
      }
      persistChatHistory();
    }

    function renderMessage(role, text) {
      var bubble = createBubble(text, role === "user");
      history.appendChild(bubble);
      history.scrollTop = history.scrollHeight;
    }

    history.innerHTML = "";
    var project = null;
    try {
      project = await projectPromise;
    } catch {
      project = null;
    }

    cacheProjectId = (project && project.id) || ctx.projectId || "none";
    var cachedMessages = readChatHistoryCache(cacheProjectId);

    if (Array.isArray(cachedMessages) && cachedMessages.length) {
      chatHistoryState = cachedMessages.slice(-80).map(function (entry) {
        return {
          role: entry && entry.role === "user" ? "user" : "assistant",
          text: String(entry && entry.text ? entry.text : ""),
          ts: entry && entry.ts ? Number(entry.ts) : Date.now(),
        };
      });
      chatHistoryState.forEach(function (entry) {
        renderMessage(entry.role, entry.text);
      });
    } else {
      var introText = "I’m your AI Tutor. Share your current blocker and I’ll give concrete next steps plus a verification check.";
      if (project && project.title) {
        introText = "I’m your AI Tutor. Let’s continue " +
          project.title +
          ". Share your current blocker and I’ll give concrete next steps plus a verification check.";
      }
      renderMessage("assistant", introText);
      appendAndPersist("assistant", introText);
    }

    async function sendMessage() {
      if (sending) return;
      var text = (textarea.value || "").trim();
      if (!text) return;
      sending = true;

      renderMessage("user", text);
      appendAndPersist("user", text);
      textarea.value = "";
      captureEvent("chat_message_sent", { message_length: text.length });

      try {
        var project = await projectPromise;
        if (!project || !project.id) {
          throw new Error("Project context unavailable");
        }
        var result = await postJson("/api/projects/" + encodeURIComponent(project.id) + "/chat", {
          message: text,
        });

        var replyText = result.reply || "My AI Skill Tutor: I logged this step in your project build log.";
        renderMessage("assistant", replyText);
        appendAndPersist("assistant", replyText);
        captureEvent("chat_message_received", { reply_length: replyText.length });
      } catch (err) {
        var errorText = "My AI Skill Tutor failed to respond: " + (err && err.message ? err.message : "Unknown error");
        renderMessage("assistant", errorText);
        appendAndPersist("assistant", errorText);
        captureEvent("chat_message_failed", { reason: err && err.message ? err.message : "unknown_error" });
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
    captureEvent("dashboard_tab_viewed", { tab: "social" });

    renameSocialNavLabels();

    var socialHeading = document.querySelector("header h1");
    if (socialHeading) {
      socialHeading.innerHTML = '<i class="fa-solid fa-share-nodes text-[#0077b5]"></i> Social Drafts';
    }
    var socialSubheading = document.querySelector("header p.text-xs.text-gray-400");
    if (socialSubheading) {
      socialSubheading.textContent = "Daily first-person LinkedIn + Tweet drafts generated from your active project context.";
    }
    if (typeof document.title === "string") {
      document.title = document.title.replace(/Social Hooks/g, "Social Drafts");
      document.title = document.title.replace(/Social Media/g, "Social Drafts");
    }

    var contentWrap = document.querySelector(
      "main .p-10.max-w-4xl.mx-auto.w-full.pb-24.space-y-8, main .p-6.md\\:p-10.max-w-5xl.mx-auto.w-full.pb-24",
    );
    if (!contentWrap) return;

    contentWrap.innerHTML =
      '<section class="glass p-6 md:p-8 rounded-2xl border border-white/10 bg-white/5 runtime-social-shell">' +
      '<div class="h-5 w-40 rounded bg-white/10 runtime-skeleton mb-4"></div>' +
      '<div class="grid gap-4 md:grid-cols-2">' +
      '<div class="rounded-xl border border-white/10 p-4"><div class="h-40 rounded-lg bg-white/10 runtime-skeleton"></div></div>' +
      '<div class="rounded-xl border border-white/10 p-4"><div class="h-40 rounded-lg bg-white/10 runtime-skeleton"></div></div>' +
      "</div>" +
      "</section>";

    var summary = await getDashboardSummary();
    updateSharedUserUi(summary);
    var primaryProject = null;
    try {
      primaryProject = await ensurePrimaryProject(summary);
    } catch {
      primaryProject = null;
    }

    contentWrap.innerHTML =
      '<section class="glass p-6 md:p-8 rounded-2xl border border-white/10 bg-white/5">' +
      '<div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">' +
      '<div><h2 class="text-lg font-[Outfit] font-semibold text-slate-900">Social Drafts</h2>' +
      '<p class="text-xs text-slate-600">Edit and share native drafts for LinkedIn and X/Twitter.</p>' +
      '<p class="text-[11px] text-slate-500 mt-1">Voice: <span data-social-author="1"></span></p></div>' +
      '<button type="button" data-social-refresh="1" class="btn btn-secondary text-sm whitespace-nowrap"><i class="fa-solid fa-rotate-right mr-2"></i>Refresh Ideas</button>' +
      "</div>" +
      '<div class="grid gap-4 md:grid-cols-2">' +
      '<article class="rounded-xl border border-[#0a66c2]/30 bg-[#eef5ff] p-4 runtime-social-card runtime-social-card-linkedin">' +
      '<div class="flex items-center justify-between mb-3"><span class="text-[11px] uppercase tracking-wider text-[#0a66c2] font-semibold">LinkedIn</span><span class="text-[10px] text-slate-600">Native share</span></div>' +
      '<textarea data-social-input="linkedin" class="runtime-social-draft-input w-full min-h-[180px] rounded-lg border border-slate-300 bg-white p-3 text-[13px] text-slate-900 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/40" readonly></textarea>' +
      '<div class="flex items-center gap-2 mt-3">' +
      '<button type="button" data-social-edit="linkedin" class="btn btn-secondary text-xs"><i class="fa-solid fa-pen mr-2"></i>Edit</button>' +
      '<button type="button" data-social-share="linkedin" class="btn bg-[#0a66c2] text-white hover:bg-[#095592] text-xs"><i class="fa-brands fa-linkedin-in mr-2"></i>Share</button>' +
      "</div></article>" +
      '<article class="rounded-xl border border-slate-300 bg-slate-50 p-4 runtime-social-card runtime-social-card-x">' +
      '<div class="flex items-center justify-between mb-3"><span class="text-[11px] uppercase tracking-wider text-slate-900 font-semibold">Tweet</span><span class="text-[10px] text-slate-600">Native composer</span></div>' +
      '<textarea data-social-input="x" class="runtime-social-draft-input w-full min-h-[180px] rounded-lg border border-slate-300 bg-white p-3 text-[13px] text-slate-900 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-slate-400" readonly></textarea>' +
      '<div class="flex items-center gap-2 mt-3">' +
      '<button type="button" data-social-edit="x" class="btn btn-secondary text-xs"><i class="fa-solid fa-pen mr-2"></i>Edit</button>' +
      '<button type="button" data-social-share="x" class="btn bg-white text-[#111827] hover:bg-gray-200 text-xs"><i class="fa-brands fa-x-twitter mr-2"></i>Tweet</button>' +
      "</div></article>" +
      "</div>" +
      '<div class="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">' +
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

    function enforceFirstPerson(text) {
      var result = String(text || "");
      var name = String((summary && summary.user && summary.user.name) || "").trim();
      if (name) {
        var escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        result = result.replace(new RegExp("\\b" + escaped + "\\b", "gi"), "I");
      }
      result = result
        .replace(/\b(?:he|she|they)\s+(am|is|was|has|have|started|built|launched|created|completed|learned|uses|used|shipped|ship|write|writes|share|shares)\b/gi, "I $1")
        .replace(/\byou\s+(are|were|have|had|built|launched|created|completed|learned|use|used|share|shared)\b/gi, "I $1")
        .replace(/\byour\b/gi, "my")
        .replace(/\bhis\b/gi, "my")
        .replace(/\bher\b/gi, "my")
        .replace(/\btheir\b/gi, "my")
        .replace(/\bthem\b/gi, "me");
      if (!/\b(i|i'm|i've|my|me|mine)\b/i.test(result)) {
        result = "I'm sharing this update: " + result;
      }
      return result;
    }

    function normalizeDraftText(value) {
      return enforceFirstPerson(String(value || "")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim());
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
      var ideaStart = performance.now();
      var ideasResult = await postJson("/api/social/drafts/ideas", {
        projectId: primaryProject ? primaryProject.id : null,
      });
      var ideas = ideasResult.ideas || {};
      draftState.linkedin = normalizeDraftText(ideas.linkedin || "");
      draftState.x = normalizeDraftText(ideas.x || "");
      draftState.contextLabel = normalizeDraftText(ideas.contextLabel || draftState.contextLabel || "Fresh ideas");
      if (!draftState.linkedin || !draftState.x) {
        throw new Error("Social idea generator returned an empty response.");
      }
      updateDraftInputs();
      if (sourceNode) {
        sourceNode.textContent = ideasResult.source === "llm" ? "Personalized with user memory" : "Generated from profile context";
      }
      if (showToastOnSuccess) {
        toast("Fresh social ideas ready.", false);
      }
      writeSocialDraftCache(primaryProject ? primaryProject.id : null, {
        linkedin: draftState.linkedin,
        x: draftState.x,
        contextLabel: draftState.contextLabel,
        source: ideasResult.source === "llm" ? "llm" : "profile_context",
      });
      captureEvent("social_ideas_loaded", {
        source: ideasResult.source === "llm" ? "llm" : "profile_context",
        duration_ms: Math.round(performance.now() - ideaStart),
      });
    }

    if (linkedInEditButton) {
      linkedInEditButton.addEventListener("click", function () {
        var editing = linkedInEditButton.getAttribute("data-editing") === "1";
        if (editing) {
          draftState.linkedin = readDraft("linkedin");
          setEditMode("linkedin", false);
          captureEvent("social_draft_edited", { platform: "linkedin", draft_length: draftState.linkedin.length });
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
          captureEvent("social_draft_edited", { platform: "x", draft_length: draftState.x.length });
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
        captureEvent("social_share_clicked", { platform: "linkedin", mode: "native_composer" });
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
        captureEvent("social_share_clicked", { platform: "x", mode: "native_composer" });
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
          captureEvent("social_refresh_clicked", { project_id: primaryProject ? primaryProject.id : null });
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
    var cachedDrafts = readSocialDraftCache(primaryProject ? primaryProject.id : null);
    if (cachedDrafts) {
      draftState.linkedin = normalizeDraftText(cachedDrafts.linkedin || "");
      draftState.x = normalizeDraftText(cachedDrafts.x || "");
      draftState.contextLabel = normalizeDraftText(cachedDrafts.contextLabel || draftState.contextLabel || "Fresh ideas");
      updateDraftInputs();
      if (sourceNode) sourceNode.textContent = cachedDrafts.source === "llm" ? "Cached personalized ideas" : "Cached draft ideas";
      captureEvent("social_ideas_cache_hit", { source: cachedDrafts.source || "cached" });
    } else {
      try {
        await loadIdeas(false);
      } catch (err) {
        draftState.linkedin = "";
        draftState.x = "";
        draftState.contextLabel = "Unavailable";
        updateDraftInputs();
        if (contextNode) contextNode.textContent = "Context: unavailable";
        if (sourceNode) sourceNode.textContent = "Generator unavailable (no fallback)";
        captureEvent("social_ideas_failed", { reason: err && err.message ? err.message : "unknown_error" });
        toast(err instanceof Error ? err.message : "Unable to generate social ideas", true);
      }
    }

    var params = new URLSearchParams(window.location.search);
    var oauth = params.get("oauth");
    if (oauth === "linkedin_connected") toast("LinkedIn connected.", false);
    if (oauth === "x_connected") toast("X connected.", false);
    if (oauth === "linkedin_denied" || oauth === "x_denied") toast("OAuth connection was denied.", true);
    captureEvent("social_page_hydrated", { has_project: Boolean(primaryProject) });
  }

  async function hydrateUpdatesPage() {
    captureEvent("dashboard_tab_viewed", { tab: "activity" });
    var summary = await getDashboardSummary();
    updateSharedUserUi(summary);
    var contentWrap = document.querySelector("main .p-10.max-w-4xl.mx-auto.w-full.pb-24.space-y-4");
    if (!contentWrap) return;

    var updates = Array.isArray(summary.latestEvents) ? summary.latestEvents.slice(0, 10) : [];
    var dailyUpdate = summary.dailyUpdate || null;

    function relativeTimeLabel(input) {
      if (!input) return "Just now";
      var ts = Date.parse(String(input));
      if (!Number.isFinite(ts)) return "Just now";
      var deltaSeconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
      if (deltaSeconds < 60) return "Just now";
      if (deltaSeconds < 3600) return Math.floor(deltaSeconds / 60) + " min ago";
      if (deltaSeconds < 86400) return Math.floor(deltaSeconds / 3600) + " hr ago";
      return Math.floor(deltaSeconds / 86400) + " day ago";
    }

    function eventClasses(type) {
      var lowered = String(type || "").toLowerCase();
      if (lowered.indexOf("failed") !== -1 || lowered.indexOf("error") !== -1) {
        return {
          card: "border-red-300 bg-red-50",
          icon: "bg-red-100 text-red-600",
          iconName: "fa-triangle-exclamation",
        };
      }
      if (lowered.indexOf("queued") !== -1 || lowered.indexOf("running") !== -1) {
        return {
          card: "border-amber-300 bg-amber-50",
          icon: "bg-amber-100 text-amber-600",
          iconName: "fa-hourglass-half",
        };
      }
      return {
        card: "border-emerald-300 bg-emerald-50",
        icon: "bg-emerald-100 text-emerald-600",
        iconName: "fa-circle-check",
      };
    }

    var eventsHtml = updates
      .map(function (event) {
        var tone = eventClasses(event.type);
        var message = escapeHtml(event.message || "Tutor update");
        var kind = escapeHtml(String(event.type || "job.update").replace(/\./g, " "));
        return (
          '<article class="glass p-5 rounded-xl border ' + tone.card + ' flex gap-4">' +
          '<div class="w-10 h-10 rounded shrink-0 ' + tone.icon + ' flex items-center justify-center mt-1">' +
          '<i class="fa-solid ' + tone.iconName + '"></i></div>' +
          '<div class="min-w-0 flex-1">' +
          '<div class="flex items-center justify-between gap-3 mb-1">' +
          '<h4 class="font-medium text-slate-900 text-base truncate">' + message + "</h4>" +
          '<span class="text-[10px] text-slate-500 whitespace-nowrap">' + relativeTimeLabel(event.createdAt) + "</span>" +
          "</div>" +
          '<p class="text-xs text-slate-600 uppercase tracking-wide">Event: ' + kind + "</p>" +
          "</div></article>"
        );
      })
      .join("");

    var dailyHtml = "";
    if (dailyUpdate) {
      var summaryText = escapeHtml(dailyUpdate.summary || "Daily update ready.");
      var tasks = Array.isArray(dailyUpdate.upcomingTasks) ? dailyUpdate.upcomingTasks : [];
      dailyHtml =
        '<section class="glass p-5 rounded-xl border border-sky-300 bg-sky-50">' +
        '<div class="flex items-center justify-between gap-3 mb-3">' +
        '<h3 class="font-[Outfit] text-base text-slate-900 flex items-center gap-2"><i class="fa-solid fa-envelope text-sky-600"></i>Latest Daily Update</h3>' +
        '<span class="text-[10px] text-slate-500">' + relativeTimeLabel(dailyUpdate.createdAt) + "</span>" +
        "</div>" +
        '<p class="text-sm text-slate-700 mb-3">' + summaryText + "</p>" +
        (tasks.length
          ? '<ul class="list-disc list-inside text-sm text-slate-700 space-y-1">' +
            tasks
              .slice(0, 4)
              .map(function (task) {
                return "<li>" + escapeHtml(task) + "</li>";
              })
              .join("") +
            "</ul>"
          : "") +
        "</section>";
    }

    contentWrap.innerHTML =
      '<div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">' +
      '<h2 class="text-lg font-[Outfit] font-semibold text-slate-900">Activity</h2>' +
      '<button type="button" data-updates-refresh="1" class="btn btn-secondary text-xs"><i class="fa-solid fa-rotate-right mr-2"></i>Refresh Activity + Daily Update</button>' +
      "</div>" +
      (dailyHtml || "") +
      (eventsHtml || '<div class="glass p-5 rounded-xl border border-slate-300 bg-slate-50 text-slate-700">No live events yet. Trigger a tutor action to populate this feed.</div>');

    var refreshButton = contentWrap.querySelector("button[data-updates-refresh='1']");
    if (refreshButton) {
      refreshButton.addEventListener("click", async function () {
        var original = refreshButton.innerHTML;
        refreshButton.setAttribute("disabled", "true");
        refreshButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>Refreshing';
        try {
          await postJson("/api/scheduler/daily-update", {});
          toast("Activity refreshed.", false);
          await hydrateUpdatesPage();
        } catch (err) {
          toast(err instanceof Error ? err.message : "Unable to refresh activity", true);
        } finally {
          refreshButton.removeAttribute("disabled");
          refreshButton.innerHTML = original;
        }
      });
    }
  }

  async function hydrateAiNewsPage() {
    captureEvent("dashboard_tab_viewed", { tab: "ai_news" });
    var contentWrap = document.querySelector("main .p-10.max-w-4xl.mx-auto.w-full.pb-24.space-y-4");
    if (!contentWrap) return;

    function renderLoading(message) {
      contentWrap.innerHTML =
        '<section class="glass p-6 rounded-xl border border-sky-300 bg-sky-50 runtime-loading-panel">' +
        '<div class="flex items-center gap-3 text-sky-900 mb-2">' +
        '<span class="runtime-loader-spinner"></span>' +
        '<span class="font-semibold">Preparing today&apos;s AI news briefing</span>' +
        "</div>" +
        '<p class="text-sm text-slate-700">' + escapeHtml(message || "Fetching and caching personalized stories for this session.") + "</p>" +
        "</section>";
    }

    renderLoading("Fetching and caching personalized stories for this session.");

    var summary = await getDashboardSummary();
    var summaryUserId = summary && summary.user && summary.user.id ? String(summary.user.id) : null;
    updateSharedUserUi(summary);

    function storyTone(category) {
      var value = String(category || "").toLowerCase();
      if (value === "capabilities") return { accent: "sky", label: "Capabilities" };
      if (value === "tools") return { accent: "violet", label: "Tools" };
      if (value === "job_displacement") return { accent: "rose", label: "Job Impact" };
      if (value === "policy") return { accent: "amber", label: "Policy" };
      return { accent: "emerald", label: "Workflow" };
    }

    function renderNews(result) {
      var insights = Array.isArray(result && result.insights) ? result.insights : [];
      var focusSummary = result && result.focusSummary ? escapeHtml(result.focusSummary) : "Stories tailored to your goals and active projects.";
      var source = result && result.source ? escapeHtml(String(result.source)) : "personalized";
      var cards = insights
        .map(function (insight) {
          var tone = storyTone(insight && insight.category);
          var title = escapeHtml(insight && insight.title ? insight.title : "AI Story");
          var summaryText = escapeHtml(insight && insight.summary ? insight.summary : "");
          var why = escapeHtml(insight && insight.whyRelevant ? insight.whyRelevant : "");
          var action = escapeHtml(insight && insight.recommendedAction ? insight.recommendedAction : "");
          var score = Number(insight && insight.relevanceScore);
          var scoreLabel = Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) + "%" : "--";
          var impact = escapeHtml(insight && insight.impact ? String(insight.impact).toUpperCase() : "MED");
          var url = escapeHtml(insight && insight.url ? insight.url : "#");
          var sourceLabel = escapeHtml(insight && insight.source ? String(insight.source) : "Source");
          return (
            '<article class="glass p-5 rounded-xl border border-' +
            tone.accent +
            '-300 bg-' +
            tone.accent +
            '-50/90">' +
            '<div class="flex items-center justify-between gap-3 mb-2">' +
            '<div class="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-' +
            tone.accent +
            '-700"><i class="fa-solid fa-newspaper"></i>' +
            tone.label +
            "</div>" +
            '<div class="text-xs text-slate-600">Impact: ' +
            impact +
            " · Relevance: " +
            scoreLabel +
            "</div>" +
            "</div>" +
            '<h3 class="text-base font-semibold text-slate-900 mb-2">' +
            title +
            "</h3>" +
            '<p class="text-sm text-slate-700 mb-3">' +
            summaryText +
            "</p>" +
            (why
              ? '<p class="text-xs text-slate-700 mb-2"><strong class="font-semibold">Why relevant:</strong> ' + why + "</p>"
              : "") +
            (action
              ? '<p class="text-xs text-slate-700 mb-3"><strong class="font-semibold">Action:</strong> ' + action + "</p>"
              : "") +
            '<div class="flex items-center justify-between gap-3 text-xs">' +
            '<span class="text-slate-500">' + sourceLabel + "</span>" +
            '<a href="' +
            url +
            '" target="_blank" rel="noreferrer" class="text-sky-700 hover:text-sky-900 font-semibold">Open Story →</a>' +
            "</div>" +
            "</article>"
          );
        })
        .join("");

      contentWrap.innerHTML =
        '<div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">' +
        '<div><h2 class="text-lg font-[Outfit] font-semibold text-slate-900">AI News</h2>' +
        '<p class="text-xs text-slate-600 mt-1">' +
        focusSummary +
        " · Source: " +
        source +
        "</p></div>" +
        '<button type="button" data-ai-news-refresh="1" class="btn btn-secondary text-xs"><i class="fa-solid fa-rotate-right mr-2"></i>Refresh AI News</button>' +
        "</div>" +
        (cards || '<div class="glass p-5 rounded-xl border border-slate-300 bg-slate-50 text-slate-700">No stories available yet. Refresh to pull personalized recommendations.</div>');

      var refreshButton = contentWrap.querySelector("button[data-ai-news-refresh='1']");
      if (refreshButton) {
        refreshButton.addEventListener("click", async function () {
          var original = refreshButton.innerHTML;
          refreshButton.setAttribute("disabled", "true");
          refreshButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>Refreshing';
          try {
            var refreshed = await postJson("/api/news/recommendations", { maxStories: 6 });
            writeHomeNewsCache({
              insights: Array.isArray(refreshed && refreshed.insights) ? refreshed.insights : [],
              source: refreshed && refreshed.source ? refreshed.source : null,
              focusSummary: refreshed && refreshed.focusSummary ? refreshed.focusSummary : null,
            }, summaryUserId);
            renderNews(refreshed);
            toast("AI news refreshed.", false);
          } catch (err) {
            toast(err instanceof Error ? err.message : "Unable to refresh AI news", true);
          } finally {
            refreshButton.removeAttribute("disabled");
            refreshButton.innerHTML = original;
          }
        });
      }
    }

    var cachedNews = readHomeNewsCache(summaryUserId);
    if (cachedNews && Array.isArray(cachedNews.insights) && cachedNews.insights.length) {
      renderNews(cachedNews);
      return;
    }

    try {
      var initial = await postJson("/api/news/recommendations", { maxStories: 6 });
      writeHomeNewsCache({
        insights: Array.isArray(initial && initial.insights) ? initial.insights : [],
        source: initial && initial.source ? initial.source : null,
        focusSummary: initial && initial.focusSummary ? initial.focusSummary : null,
      }, summaryUserId);
      renderNews(initial);
    } catch (err) {
      contentWrap.innerHTML =
        '<div class="glass p-5 rounded-xl border border-red-300 bg-red-50 text-red-700">' +
        escapeHtml(err instanceof Error ? err.message : "Unable to load AI news") +
        "</div>";
    }
  }

  async function hydrateProfilePage() {
    captureEvent("dashboard_tab_viewed", { tab: "profile" });
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
    var identityHeader = profileForm ? profileForm.parentElement && profileForm.parentElement.querySelector(".flex.items-center.gap-6") : null;
    if (identityHeader) {
      var topName = identityHeader.querySelector("h3");
      if (topName && summary.user.name) {
        topName.textContent = summary.user.name;
      }
      var emailNode = Array.prototype.find.call(identityHeader.querySelectorAll("p"), function (node) {
        return (node.textContent || "").indexOf("@") !== -1;
      });
      var preferredEmail = ctx.email || (summary.user && summary.user.email) || "";
      if (emailNode && preferredEmail) {
        emailNode.textContent = preferredEmail;
      }
    }
    var currentAvatarUrl = ctx.avatarUrl || summary.user.avatarUrl || "";
    function normalizeAvatarValue(input) {
      var raw = typeof input === "string" ? input.trim() : "";
      if (!raw) return undefined;
      if (raw.indexOf("data:image/") === 0) return raw;
      return normalizeUrl(raw);
    }

    function applyAvatarToUi(nextUrl) {
      if (!nextUrl) return;
      Array.prototype.forEach.call(document.querySelectorAll("img[src='/assets/avatar.png'], img[data-role='profile-avatar'], main .flex.items-center.gap-6 img, img[alt='Alex Chen']"), function (img) {
        img.setAttribute("src", nextUrl);
        img.setAttribute("data-role", "profile-avatar");
      });
      if (avatarUrlInput) {
        if (nextUrl.indexOf("data:image/") === 0) {
          avatarUrlInput.value = "";
          avatarUrlInput.placeholder = "Uploaded image saved.";
        } else {
          avatarUrlInput.value = nextUrl;
        }
      }
    }

    async function saveAvatar(nextUrl) {
      var res = await fetch("/api/profile", {
        method: "PATCH",
        headers: requestHeaders(true),
        cache: "no-store",
        credentials: "same-origin",
        body: JSON.stringify({ avatarUrl: nextUrl }),
      });
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok || !data.ok) {
        throw new Error(data && data.error && data.error.message ? data.error.message : "Avatar update failed");
      }
      ctx.avatarUrl = nextUrl;
      currentAvatarUrl = nextUrl;
      saveCtx(ctx);
      applyAvatarToUi(nextUrl);
    }
    if (avatarUrlInput) {
      if (currentAvatarUrl.indexOf("data:image/") === 0) {
        avatarUrlInput.value = "";
        avatarUrlInput.placeholder = "Uploaded image saved.";
      } else {
        avatarUrlInput.value = currentAvatarUrl;
      }
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
          var normalizedAvatar = avatarUrlInput && avatarUrlInput.value ? normalizeAvatarValue(avatarUrlInput.value) : undefined;
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
            applyAvatarToUi(currentAvatarUrl);
          }

          captureEvent("profile_saved", {
            has_linkedin: Boolean(payload.socialLinks && payload.socialLinks.linkedin),
            has_avatar: Boolean(currentAvatarUrl),
          });
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
        if (document.getElementById("avatar-crop-modal")) return;

        var fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "image/*";
        fileInput.style.display = "none";
        document.body.appendChild(fileInput);

        fileInput.addEventListener("change", function () {
          var file = fileInput.files && fileInput.files[0];
          if (!file) {
            fileInput.remove();
            return;
          }

          if (!file.type || file.type.indexOf("image/") !== 0) {
            toast("Please choose an image file.", true);
            fileInput.remove();
            return;
          }

          var objectUrl = URL.createObjectURL(file);
          var backdrop = document.createElement("div");
          backdrop.className = "avatar-crop-backdrop";
          backdrop.id = "avatar-crop-backdrop";

          var modal = document.createElement("div");
          modal.className = "avatar-crop-modal";
          modal.id = "avatar-crop-modal";
          modal.innerHTML =
            '<div class="avatar-crop-header">' +
            '<h3 class="font-[Outfit] text-lg font-semibold">Crop profile image</h3>' +
            '<button type="button" class="btn btn-secondary" data-avatar-close="1">Cancel</button>' +
            "</div>" +
            '<div class="avatar-crop-stage" data-avatar-stage="1">' +
            '<img data-avatar-image="1" alt="Avatar crop preview">' +
            "</div>" +
            '<div class="avatar-crop-controls">' +
            '<label class="text-xs text-gray-500 uppercase tracking-wider">Zoom</label>' +
            '<input type="range" min="1" max="3" step="0.01" value="1.1" data-avatar-zoom="1">' +
            "</div>" +
            '<div class="avatar-crop-actions">' +
            '<button type="button" class="btn btn-secondary" data-avatar-use-url="1">Use URL</button>' +
            '<button type="button" class="btn btn-primary" data-avatar-save="1">Save Avatar</button>' +
            "</div>";

          document.body.appendChild(backdrop);
          document.body.appendChild(modal);

          var stage = modal.querySelector("[data-avatar-stage='1']");
          var image = modal.querySelector("[data-avatar-image='1']");
          var closeBtn = modal.querySelector("[data-avatar-close='1']");
          var saveBtn = modal.querySelector("[data-avatar-save='1']");
          var urlBtn = modal.querySelector("[data-avatar-use-url='1']");
          var zoomInput = modal.querySelector("[data-avatar-zoom='1']");
          if (!stage || !image || !closeBtn || !saveBtn || !zoomInput || !urlBtn) {
            backdrop.remove();
            modal.remove();
            fileInput.remove();
            URL.revokeObjectURL(objectUrl);
            return;
          }

          var dragStartX = 0;
          var dragStartY = 0;
          var startOffsetX = 0;
          var startOffsetY = 0;
          var dragging = false;
          var offsetX = 0;
          var offsetY = 0;
          var zoom = 1.1;
          var naturalW = 0;
          var naturalH = 0;

          function closeModal() {
            backdrop.remove();
            modal.remove();
            fileInput.remove();
            URL.revokeObjectURL(objectUrl);
          }

          function drawPreview() {
            if (!naturalW || !naturalH) return;
            var stageRect = stage.getBoundingClientRect();
            var baseScale = Math.max(stageRect.width / naturalW, stageRect.height / naturalH);
            var finalScale = baseScale * zoom;
            var drawW = naturalW * finalScale;
            var drawH = naturalH * finalScale;
            var maxX = Math.max(0, (drawW - stageRect.width) / 2);
            var maxY = Math.max(0, (drawH - stageRect.height) / 2);
            if (offsetX > maxX) offsetX = maxX;
            if (offsetX < -maxX) offsetX = -maxX;
            if (offsetY > maxY) offsetY = maxY;
            if (offsetY < -maxY) offsetY = -maxY;
            image.style.width = drawW + "px";
            image.style.height = drawH + "px";
            image.style.transform = "translate(calc(-50% + " + offsetX + "px), calc(-50% + " + offsetY + "px))";
          }

          image.addEventListener("load", function () {
            naturalW = image.naturalWidth || 1;
            naturalH = image.naturalHeight || 1;
            drawPreview();
          });
          image.setAttribute("src", objectUrl);

          zoomInput.addEventListener("input", function () {
            zoom = Number(zoomInput.value || "1.1");
            drawPreview();
          });

          stage.addEventListener("pointerdown", function (event) {
            dragging = true;
            dragStartX = event.clientX;
            dragStartY = event.clientY;
            startOffsetX = offsetX;
            startOffsetY = offsetY;
            stage.setPointerCapture(event.pointerId);
          });

          stage.addEventListener("pointermove", function (event) {
            if (!dragging) return;
            offsetX = startOffsetX + (event.clientX - dragStartX);
            offsetY = startOffsetY + (event.clientY - dragStartY);
            drawPreview();
          });

          stage.addEventListener("pointerup", function (event) {
            dragging = false;
            stage.releasePointerCapture(event.pointerId);
          });

          closeBtn.addEventListener("click", function () {
            closeModal();
          });

          backdrop.addEventListener("click", function () {
            closeModal();
          });

          urlBtn.addEventListener("click", async function () {
            var typed = window.prompt("Paste avatar image URL", currentAvatarUrl || "");
            if (typed === null) return;
            var normalized = normalizeAvatarValue(typed);
            if (!normalized) {
              toast("Avatar URL is invalid.", true);
              return;
            }
            try {
              await saveAvatar(normalized);
              closeModal();
              captureEvent("profile_avatar_updated", { source: "url" });
              toast("Avatar updated.", false);
            } catch (err) {
              toast(err instanceof Error ? err.message : "Avatar update failed", true);
            }
          });

          saveBtn.addEventListener("click", async function () {
            if (!naturalW || !naturalH) return;
            saveBtn.setAttribute("disabled", "true");
            try {
              var outputSize = 512;
              var canvas = document.createElement("canvas");
              canvas.width = outputSize;
              canvas.height = outputSize;
              var ctx2d = canvas.getContext("2d");
              if (!ctx2d) throw new Error("Canvas unavailable");

              var baseScale = Math.max(outputSize / naturalW, outputSize / naturalH);
              var finalScale = baseScale * zoom;
              var drawW = naturalW * finalScale;
              var drawH = naturalH * finalScale;
              var drawX = (outputSize - drawW) / 2 + offsetX;
              var drawY = (outputSize - drawH) / 2 + offsetY;

              ctx2d.fillStyle = "#e2e8f0";
              ctx2d.fillRect(0, 0, outputSize, outputSize);
              ctx2d.drawImage(image, drawX, drawY, drawW, drawH);

              var dataUrl = canvas.toDataURL("image/jpeg", 0.9);
              await saveAvatar(dataUrl);
              closeModal();
              captureEvent("profile_avatar_updated", { source: "upload_crop" });
              toast("Avatar updated.", false);
            } catch (err) {
              saveBtn.removeAttribute("disabled");
              toast(err instanceof Error ? err.message : "Avatar update failed", true);
            }
          });
        });

        fileInput.click();
      });
    }
  }

  function buildTalentCardElement(candidate) {
    var skills = (candidate.topSkills || []).slice(0, 2);
    var tools = (candidate.topTools || []).slice(0, 3);
    var projectCount = Math.max(1, Math.round((candidate.evidenceScore || 45) / 30));
    var candidateHandle = encodeURIComponent(String(candidate.handle || ""));
    var candidateName = String(candidate.name || "Candidate");
    var candidateRole = String(candidate.role || "AI Builder");
    var candidateAvatar = sanitizeImageUrl(candidate.avatarUrl) || "/assets/avatar.png";
    var card = document.createElement("a");
    card.setAttribute("href", "/employers/talent/" + candidateHandle + "/");
    card.className = "glass p-6 rounded-2xl hover:bg-white/5 transition border border-white/10 hover:border-emerald-500/40 group relative cursor-pointer";

    var top = document.createElement("div");
    top.className = "flex justify-between items-start mb-4";
    var avatar = document.createElement("img");
    avatar.setAttribute("src", candidateAvatar);
    avatar.setAttribute("width", "64");
    avatar.setAttribute("height", "64");
    avatar.setAttribute("alt", candidateName);
    avatar.className = "w-16 h-16 rounded-full object-cover border border-white/20";
    avatar.style.width = "64px";
    avatar.style.height = "64px";
    avatar.style.objectFit = "cover";
    avatar.setAttribute("loading", "lazy");
    avatar.setAttribute("decoding", "async");
    top.appendChild(avatar);

    var verified = document.createElement("div");
    verified.className = "bg-emerald-500/20 text-emerald-400 w-8 h-8 rounded-full flex items-center justify-center border border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.3)]";
    verified.setAttribute("title", "Verified Human Builder");
    verified.innerHTML = '<i class="fa-solid fa-check text-sm font-bold"></i>';
    top.appendChild(verified);
    card.appendChild(top);

    var nameNode = document.createElement("h3");
    nameNode.className = "text-lg font-medium text-white group-hover:text-emerald-400 transition mb-1";
    nameNode.textContent = candidateName;
    card.appendChild(nameNode);

    var roleNode = document.createElement("p");
    roleNode.className = "text-gray-400 text-sm mb-4";
    roleNode.textContent = candidateRole;
    card.appendChild(roleNode);

    var details = document.createElement("div");
    details.className = "space-y-2 mb-6";
    var projectRow = document.createElement("div");
    projectRow.className = "flex items-center gap-2 text-xs";
    projectRow.innerHTML =
      '<i class="fa-solid fa-diagram-project text-gray-500 w-4"></i>' +
      '<span class="text-gray-300">' + projectCount + " Verified Projects built</span>";
    var toolsRow = document.createElement("div");
    toolsRow.className = "flex items-center gap-2 text-xs";
    toolsRow.innerHTML = '<i class="fa-solid fa-code text-gray-500 w-4"></i>';
    var toolsText = document.createElement("span");
    toolsText.className = "text-gray-300";
    toolsText.textContent = tools.join(", ");
    toolsRow.appendChild(toolsText);
    details.appendChild(projectRow);
    details.appendChild(toolsRow);
    card.appendChild(details);

    var chips = document.createElement("div");
    chips.className = "flex flex-wrap gap-2 mt-auto border-t border-white/10 pt-4";
    skills.forEach(function (skill) {
      var chip = document.createElement("span");
      chip.className = "text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded px-2 py-0.5";
      chip.textContent = String(skill);
      chips.appendChild(chip);
    });
    card.appendChild(chips);
    return card;
  }

  async function hydrateEmployerTalentPage() {
    captureEvent("employer_talent_viewed", { source: "page_load" });
    var header = document.querySelector("h2.text-xl.font-\\[Outfit\\].text-white");
    var grid = document.querySelector(".grid.md\\:grid-cols-2.lg\\:grid-cols-3.gap-6");
    var search = document.querySelector("header input[type='text']");

    if (!grid) return;

    var selectedSkill = null;
    var selectedStatus = "";
    var allRows = null;
    var facetsData = null;

    var skillSection = Array.prototype.find.call(document.querySelectorAll("aside .mb-6"), function (node) {
      return (node.textContent || "").indexOf("Filter by Skill") !== -1;
    });

    async function ensureTalentData() {
      if (allRows && facetsData) return;
      if (!grid.dataset.initialized) {
        grid.dataset.initialized = "1";
        grid.innerHTML =
          '<div class="glass p-6 rounded-2xl border border-white/10 text-gray-400">Loading talent profiles...</div>';
      }
      var baseData = await getJson("/api/employers/talent");
      allRows = baseData.rows || [];
      facetsData = baseData.facets || {};
    }

    function filteredRows() {
      var rows = (allRows || []).slice();
      var query = search && search.value ? search.value.trim().toLowerCase() : "";
      if (selectedSkill) {
        rows = rows.filter(function (candidate) {
          return Array.isArray(candidate.topSkills) && candidate.topSkills.indexOf(selectedSkill) !== -1;
        });
      }
      if (selectedStatus) {
        rows = rows.filter(function (candidate) {
          return candidate.status === selectedStatus;
        });
      }
      if (query) {
        rows = rows.filter(function (candidate) {
          var haystack = (
            String(candidate.handle || "") +
            " " +
            String(candidate.name || "") +
            " " +
            String(candidate.role || "") +
            " " +
            ((candidate.topSkills || []).join(" ")) +
            " " +
            ((candidate.topTools || []).join(" "))
          ).toLowerCase();
          return haystack.indexOf(query) !== -1;
        });
      }

      var isDefaultView = !selectedSkill && !selectedStatus && !query;
      if (isDefaultView) {
        rows = rows.slice(0, 20);
      }
      return rows;
    }

    async function loadRows() {
      await ensureTalentData();
      var rows = filteredRows();

      if (header) {
        header.textContent = rows.length + " Candidates Match Criteria";
      }
      captureEvent("employer_talent_loaded", {
        result_count: rows.length,
        has_search: Boolean(search && search.value.trim()),
        selected_skill: selectedSkill || "",
        selected_status: selectedStatus || "",
      });

      if (skillSection && facetsData.skills && facetsData.skills.length) {
        var list = skillSection.querySelector(".space-y-2");
        if (list && !list.dataset.hydrated) {
          list.dataset.hydrated = "1";
          list.innerHTML = "";
          facetsData.skills.slice(0, 8).forEach(function (skill, index) {
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
              captureEvent("employer_filter_changed", { filter_type: "skill", skill: selectedSkill || "" });
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
        var card = buildTalentCardElement(candidate);
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
        captureEvent("employer_filter_changed", { filter_type: "status", status: selectedStatus || "all" });
        void loadRows();
      });
    });

    if (search) {
      var timeout = null;
      search.addEventListener("input", function () {
        window.clearTimeout(timeout);
        timeout = window.setTimeout(function () {
          captureEvent("employer_filter_changed", { filter_type: "search", query_length: search.value.trim().length });
          void loadRows();
        }, 220);
      });
    }

    await loadRows();
  }

  if (currentPath === "/onboarding" && !document.getElementById("onboarding-react-root")) {
    var selectedResumeFilename = null;
    var uploadLabel = byText("p", "Upload Resume (PDF)");
    var uploadCard = uploadLabel ? uploadLabel.closest("div.border-2") : null;
    var careerPathSelect = document.getElementById("onboarding-career-path");
    var linkedinInput = document.getElementById("onboarding-linkedin-url");
    var situationSelect = document.getElementById("onboarding-situation");
    var beginButton = document.getElementById("onboarding-start-assessment");
    var scoreButtons = document.querySelectorAll("button.onboarding-score");
    var chosenScore = Number((ctx && ctx.aiKnowledgeScore) || 3);
    var signUpIntent = readSignUpIntent();

    captureEvent("onboarding_viewed", {
      entry_point: signUpIntent ? "clerk_sign_up" : "direct",
      has_existing_session: Boolean(ctx.sessionId),
      career_path_id: ctx.careerPathId || "product-management",
    });
    trackFunnelStep("onboarding_viewed", {
      entry_point: signUpIntent ? "clerk_sign_up" : "direct",
      has_existing_session: Boolean(ctx.sessionId),
      career_path_id: ctx.careerPathId || "product-management",
    });

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
        captureEvent("onboarding_ai_knowledge_selected", { ai_knowledge_score: chosenScore });
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
        var dot = file.name.lastIndexOf(".");
        var extension = dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : "unknown";
        captureEvent("onboarding_resume_selected", { resume_attached: true, resume_extension: extension });
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
          captureEvent("onboarding_start_assessment_clicked", {
            selected_goals_count: goals.length,
            selected_goals: goals,
            career_path_id: selectedCareerPath,
          });
          trackFunnelStep("onboarding_start_assessment_clicked", {
            selected_goals_count: goals.length,
            selected_goals: goals,
            career_path_id: selectedCareerPath,
          });

          var selectedSituation = situationSelect && situationSelect.value ? situationSelect.value : "employed";
          var selectedLinkedIn = linkedinInput && linkedinInput.value ? linkedinInput.value.trim() : "";
          ctx.careerPathId = selectedCareerPath;
          ctx.situation = selectedSituation;
          ctx.aiKnowledgeScore = chosenScore;
          ctx.onboardingGoals = goals;
          if (selectedLinkedIn) ctx.linkedinUrl = selectedLinkedIn;
          saveCtx(ctx);

          var session = await ensureSession();
          await postJson("/api/onboarding/career-import", {
            sessionId: session.id,
            sessionToken: session.token,
            careerPathId: selectedCareerPath,
            linkedinUrl: selectedLinkedIn || null,
            resumeFilename: selectedResumeFilename,
          });
          captureEvent("onboarding_career_import_completed", {
            session_id: session.id,
            career_path_id: selectedCareerPath,
            has_linkedin_url: Boolean(selectedLinkedIn),
            resume_attached: Boolean(selectedResumeFilename),
            ai_knowledge_score: chosenScore,
          });
          trackFunnelStep("onboarding_career_import_completed", {
            session_id: session.id,
            career_path_id: selectedCareerPath,
            has_linkedin_url: Boolean(selectedLinkedIn),
            resume_attached: Boolean(selectedResumeFilename),
            resume_extension: selectedResumeFilename && selectedResumeFilename.indexOf(".") >= 0
              ? selectedResumeFilename.split(".").pop().toLowerCase()
              : null,
            ai_knowledge_score: chosenScore,
          });

          await postJson("/api/onboarding/situation", {
            sessionId: session.id,
            sessionToken: session.token,
            situation: selectedSituation,
            goals: goals,
          });
          captureEvent("onboarding_situation_completed", {
            session_id: session.id,
            situation: selectedSituation,
            selected_goals_count: goals.length,
            selected_goals: goals,
          });
          trackFunnelStep("onboarding_situation_completed", {
            session_id: session.id,
            situation: selectedSituation,
            selected_goals_count: goals.length,
            selected_goals: goals,
            career_path_id: selectedCareerPath,
          });
          captureEvent("onboarding_completed", {
            session_id: session.id,
            situation: selectedSituation,
            selected_goals_count: goals.length,
            selected_goals: goals,
            career_path_id: selectedCareerPath,
          });
          captureEvent("onboarding_assessment_redirected", { session_id: session.id });
          trackFunnelStep("onboarding_completed", {
            session_id: session.id,
            situation: selectedSituation,
            selected_goals_count: goals.length,
            selected_goals: goals,
            career_path_id: selectedCareerPath,
          });

          toast("Onboarding saved. Continue to assessment.", false);
          window.location.href = "/assessment/?sessionId=" + encodeURIComponent(session.id);
        } catch (err) {
          captureEvent("onboarding_submission_failed", {
            reason: err && err.message ? err.message : "unknown_error",
          });
          toast(err instanceof Error ? err.message : "Failed to complete onboarding", true);
        } finally {
          beginButton.dataset.busy = "0";
          beginButton.removeAttribute("disabled");
        }
      });
    }
  }

  if (currentPath === "/assessment") {
    captureEvent("assessment_viewed", {
      has_existing_session: Boolean(ctx.sessionId),
      entry_point: ctx && ctx.sessionId ? "onboarding" : "direct",
      career_path_id: ctx && ctx.careerPathId ? ctx.careerPathId : "product-management",
    });
    trackFunnelStep("assessment_viewed", {
      has_existing_session: Boolean(ctx.sessionId),
      entry_point: ctx && ctx.sessionId ? "onboarding" : "direct",
      career_path_id: ctx && ctx.careerPathId ? ctx.careerPathId : "product-management",
    });

    var assessmentCard = document.querySelector(".glass-panel");

    var continueLink = assessmentCard
      ? assessmentCard.querySelector(".flex.justify-between.items-center.pt-6 a.btn.btn-primary, .flex.justify-between.items-center.pt-6 a[href*='/onboarding']")
      : null;
    if (!continueLink) {
      continueLink = Array.prototype.find.call(document.querySelectorAll(".glass-panel a.btn.btn-primary"), function (node) {
        return ((node.textContent || "").toLowerCase().indexOf("continue") !== -1);
      });
    }
    if (continueLink) {
      continueLink.addEventListener("click", async function (event) {
        event.preventDefault();
        captureEvent("assessment_continue_clicked", {
          source: "assessment_page",
          career_path_id: ctx && ctx.careerPathId ? ctx.careerPathId : "product-management",
        });
        trackFunnelStep("assessment_continue_clicked", {
          source: "assessment_page",
          career_path_id: ctx && ctx.careerPathId ? ctx.careerPathId : "product-management",
        });
        try {
          var session = await ensureSession();
          var start = await postJson("/api/assessment/start", {
            sessionId: session.id,
            sessionToken: session.token,
          });
          captureEvent("assessment_started", {
            session_id: session.id,
            assessment_id: start.assessment.id,
            career_path_id: ctx && ctx.careerPathId ? ctx.careerPathId : "product-management",
          });
          trackFunnelStep("assessment_started", {
            session_id: session.id,
            assessment_id: start.assessment.id,
            career_path_id: ctx && ctx.careerPathId ? ctx.careerPathId : "product-management",
          });
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
          captureEvent("assessment_submitted", {
            session_id: session.id,
            assessment_id: start.assessment.id,
            primary_goal: selectedGoal,
            primary_goal_value: selectedValue,
            career_path_id: ctx && ctx.careerPathId ? ctx.careerPathId : "product-management",
          });
          trackFunnelStep("assessment_submitted", {
            session_id: session.id,
            assessment_id: start.assessment.id,
            primary_goal: selectedGoal,
            primary_goal_value: selectedValue,
            career_path_id: ctx && ctx.careerPathId ? ctx.careerPathId : "product-management",
          });

          var validGoalSet = {
            build_business: true,
            upskill_current_job: true,
            showcase_for_job: true,
            ship_ai_projects: true,
            learn_foundations: true,
          };
          var selectedGoals = Array.isArray(ctx.onboardingGoals)
            ? ctx.onboardingGoals.filter(function (entry) { return Boolean(validGoalSet[entry]); })
            : [];
          if (!selectedGoals.length) {
            selectedGoals = [selectedGoal];
          }
          var selectedSituation = typeof ctx.situation === "string" ? ctx.situation : "employed";

          await postJson("/api/onboarding/situation", {
            sessionId: session.id,
            sessionToken: session.token,
            situation: selectedSituation,
            goals: selectedGoals,
          });
          captureEvent("assessment_completed", {
            session_id: session.id,
            assessment_id: start.assessment.id,
            situation: selectedSituation,
            selected_goals_count: selectedGoals.length,
            selected_goals: selectedGoals,
            primary_goal: selectedGoal,
            primary_goal_value: selectedValue,
            career_path_id: ctx && ctx.careerPathId ? ctx.careerPathId : "product-management",
          });
          trackFunnelStep("assessment_completed", {
            session_id: session.id,
            assessment_id: start.assessment.id,
            selected_goals_count: selectedGoals.length,
            selected_goals: selectedGoals,
            situation: selectedSituation,
            primary_goal: selectedGoal,
            primary_goal_value: selectedValue,
            career_path_id: ctx && ctx.careerPathId ? ctx.careerPathId : "product-management",
          });
          captureEvent("assessment_dashboard_redirected", {
            session_id: session.id,
            assessment_id: start.assessment.id,
            situation: selectedSituation,
            career_path_id: ctx && ctx.careerPathId ? ctx.careerPathId : "product-management",
          });
          trackFunnelStep("assessment_dashboard_redirected", {
            session_id: session.id,
            assessment_id: start.assessment.id,
            situation: selectedSituation,
            career_path_id: ctx && ctx.careerPathId ? ctx.careerPathId : "product-management",
          });

          toast("Assessment submitted.", false);
          window.location.href = "/dashboard/?welcome=1";
        } catch (err) {
          if (isUnauthenticatedError(err)) {
            captureEvent("assessment_failed_auth_required", {
              reason: err && err.message ? err.message : "auth_required",
            });
            redirectToSignIn("/assessment/");
            return;
          }
          captureEvent("assessment_failed", {
            reason: err && err.message ? err.message : "unknown_error",
          });
          toast(err instanceof Error ? err.message : "Assessment failed", true);
        }
      });
    }
  }

  async function hydrateCurrentPath() {
    captureEvent("app_route_hydrate_started", { path: currentPath });
    if (currentPath === "/dashboard") {
      await hydrateDashboardHome();
      captureEvent("app_route_hydrate_completed", { path: currentPath });
      return;
    }

    if (currentPath === "/dashboard/projects") {
      await hydrateProjectsPage();
      captureEvent("app_route_hydrate_completed", { path: currentPath });
      return;
    }

    if (currentPath === "/dashboard/chat") {
      await hydrateChatPage();
      captureEvent("app_route_hydrate_completed", { path: currentPath });
      return;
    }

    if (currentPath === "/dashboard/social") {
      await hydrateSocialPage();
      captureEvent("app_route_hydrate_completed", { path: currentPath });
      return;
    }

    if (currentPath === "/dashboard/ai-news") {
      await hydrateAiNewsPage();
      captureEvent("app_route_hydrate_completed", { path: currentPath });
      return;
    }

    if (currentPath === "/dashboard/updates") {
      await hydrateUpdatesPage();
      captureEvent("app_route_hydrate_completed", { path: currentPath });
      return;
    }

    if (currentPath === "/dashboard/profile") {
      await hydrateProfilePage();
      captureEvent("app_route_hydrate_completed", { path: currentPath });
      return;
    }

    if (currentPath === "/employers/talent") {
      await hydrateEmployerTalentPage();
      captureEvent("app_route_hydrate_completed", { path: currentPath });
    }
  }

  function syncPathAttributes() {
    currentPath = normalizedPath(window.location.pathname);
    if (document && document.documentElement) {
      document.documentElement.setAttribute("data-path", currentPath);
    }
    if (document && document.body) {
      document.body.setAttribute("data-path", currentPath);
    }
  }

  function markRouteHydrated(pathname) {
    lastHydratedPath = normalizedPath(pathname || currentPath);
    if (typeof window !== "undefined") {
      window.__AITUTOR_LAST_HYDRATED_PATH = lastHydratedPath;
    }
  }

  function routeHydrate() {
    syncPathAttributes();
    if (routeHydrateInFlight) return routeHydrateInFlight;
    if (lastHydratedPath === currentPath && document.documentElement.getAttribute("data-runtime-ready") === "1") {
      return Promise.resolve();
    }

    routeHydrateInFlight = (async function () {
      wireThemeToggle();
      if (isDashboardPath) {
        document.documentElement.setAttribute("data-mobile-nav", "closed");
      }
      try {
        if (needsAuth()) {
          await syncAuthContext();
        }
      } catch (err) {
        if (isDashboardPath) {
          renderDashboardHydrationError(err);
          markRouteHydrated(currentPath);
          return;
        }
        throw err;
      }
      try {
        await hydrateCurrentPath();
      } catch (err) {
        captureEvent("app_route_hydrate_failed", {
          path: currentPath,
          reason: err && err.message ? err.message : "unknown_error",
        });
        if (isDashboardPath) {
          renderDashboardHydrationError(err);
          markRouteHydrated(currentPath);
          return;
        }
        throw err;
      }
      clearDashboardSkeletons();
      persistDashboardSnapshot(currentPath);
      document.documentElement.setAttribute("data-runtime-ready", "1");
      markRouteHydrated(currentPath);
    })().finally(function () {
      routeHydrateInFlight = null;
    });

    return routeHydrateInFlight;
  }

  window.__AITUTOR_ROUTE_HYDRATE = routeHydrate;

  async function boot() {
    captureEvent("app_boot_started", { path: currentPath });
    markRouteHydrated(currentPath);
    var holdRevealUntilHydrated = false;
    try {
      applyAcquisitionLandingVariant();
      maybeTrackAuthEntryEvents();
      wireThemeToggle();
      if (!holdRevealUntilHydrated) {
        document.documentElement.setAttribute("data-runtime-ready", "1");
      }
      await trySyncLandingAuth();
      await syncOptionalAuthUi();

      if (!holdRevealUntilHydrated && isDashboardPath && !restoredDashboardSnapshot) {
        // Reveal immediately with skeletons, then progressively hydrate.
        document.documentElement.setAttribute("data-runtime-ready", "1");
      } else if (!holdRevealUntilHydrated && restoredDashboardSnapshot) {
        document.documentElement.setAttribute("data-runtime-ready", "1");
      }

      try {
        await syncAuthContext();
      } catch (err) {
        if (needsAuth()) {
          toast(err instanceof Error ? err.message : "Authentication required", true);
        }
      }

      try {
        await maybeClaimOnboardingSession();
      } catch {
        // Non-blocking; dashboard can continue loading.
      }

      maybeTrackDashboardWelcomeStep();
      ensureMobileDashboardNav();
      try {
        await hydrateCurrentPath();
      } catch (err) {
        captureEvent("app_route_hydrate_failed", {
          path: currentPath,
          reason: err && err.message ? err.message : "unknown_error",
        });
        if (isDashboardPath) {
          renderDashboardHydrationError(err);
        } else {
          throw err;
        }
      }
      captureEvent("app_boot_completed", { path: currentPath });
    } finally {
      if (!hasAppliedAuthCtx && !needsAuth()) {
        applyCtxImmediately();
      }
      clearDashboardSkeletons();
      persistDashboardSnapshot(currentPath);
      document.documentElement.setAttribute("data-runtime-ready", "1");
      markRouteHydrated(currentPath);
    }
  }

  void boot();
})();
