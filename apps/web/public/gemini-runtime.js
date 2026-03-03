(function () {
  var currentPath = window.location.pathname.replace(/\/+$/, "") || "/";
  var CTX_KEY = "ai_tutor_user_ctx_v1";

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
    if (existing && existing.userId) return existing;

    var created = {
      userId: uuidv4(),
      name: "New Learner",
      handle: null,
      sessionId: null,
      projectId: null,
      careerPathId: "product-management",
    };
    saveCtx(created);
    return created;
  }

  var ctx = ensureCtx();

  function applyCtxImmediately() {
    if (!ctx || !ctx.name) return;
    var sidebarProfileLink = document.querySelector("aside a[href='/dashboard/profile/'], aside a[href='/dashboard/profile']");
    if (sidebarProfileLink) {
      var nameEl = sidebarProfileLink.querySelector(".font-medium");
      var roleEl = sidebarProfileLink.querySelector(".text-xs");
      if (nameEl) nameEl.textContent = ctx.name;
      if (roleEl && ctx.headline) roleEl.textContent = ctx.headline;
    }
    if (ctx.handle) {
      Array.prototype.forEach.call(
        document.querySelectorAll("a[href='/u/alex-chen-ai/'], a[href='/u/test-user-0001/'], a[href='/u/alex-chen-ai'], a[href='/u/test-user-0001']"),
        function (node) {
          node.setAttribute("href", "/u/" + ctx.handle + "/");
        },
      );
    }
  }

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

  function requestHeaders(json) {
    var headers = {
      "x-user-id": ctx.userId,
      "cache-control": "no-store",
    };
    if (json) headers["content-type"] = "application/json";
    return headers;
  }

  function pathWithUserId(path) {
    var delimiter = path.indexOf("?") === -1 ? "?" : "&";
    return path + delimiter + "userId=" + encodeURIComponent(ctx.userId);
  }

  async function postJson(url, body) {
    var res = await fetch(url, {
      method: "POST",
      headers: requestHeaders(true),
      body: JSON.stringify(body || {}),
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
    saveCtx(ctx);

    var sidebarProfileLink = document.querySelector("aside a[href='/dashboard/profile/'], aside a[href='/dashboard/profile']");
    if (sidebarProfileLink) {
      var nameEl = sidebarProfileLink.querySelector(".font-medium");
      var roleEl = sidebarProfileLink.querySelector(".text-xs");
      setText(nameEl, user.name);
      setText(roleEl, headlineForUser(user));
      var avatar = sidebarProfileLink.querySelector("img");
      if (avatar) avatar.setAttribute("alt", user.name);
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
  }

  async function ensureSession() {
    if (ctx.sessionId) return { id: ctx.sessionId, userId: ctx.userId };

    var baseHandle = ctx.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "learner";

    var data = await postJson("/api/onboarding/start", {
      userId: ctx.userId,
      name: ctx.name,
      handleBase: baseHandle,
      careerPathId: ctx.careerPathId || "product-management",
    });

    ctx.sessionId = data.session.id;
    if (data.user && data.user.handle) ctx.handle = data.user.handle;
    if (data.user && data.user.name) ctx.name = data.user.name;
    saveCtx(ctx);

    return data.session;
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
    wrapper.className = isUser
      ? "flex items-start justify-end gap-4 max-w-4xl ml-auto"
      : "flex items-start gap-4 max-w-4xl";

    if (isUser) {
      wrapper.innerHTML =
        '<div class="bg-indigo-600 text-white p-5 rounded-2xl rounded-tr-sm text-sm shadow-[0_5px_15px_rgba(79,70,229,0.2)]"></div>' +
        '<img src="/assets/avatar.png" class="w-8 h-8 rounded-full object-cover border border-white/20 flex-shrink-0 mt-1" alt="Learner">';
      wrapper.querySelector("div").innerHTML = html;
    } else {
      wrapper.innerHTML =
        '<div class="w-8 h-8 rounded-full bg-gradient-to-b from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-1 shadow-[0_0_10px_rgba(79,70,229,0.3)]"><i class="fa-solid fa-robot text-white text-[10px]"></i></div>' +
        '<div class="glass p-5 rounded-2xl rounded-tl-sm text-sm border-indigo-500/20 bg-indigo-500/5"></div>';
      wrapper.querySelector("div.glass").innerHTML = html;
    }

    return wrapper;
  }

  async function hydrateChatPage() {
    var summary = await getDashboardSummary();
    updateSharedUserUi(summary);
    var project = await ensurePrimaryProject(summary);

    var subtitle = document.querySelector("header .text-xs.text-gray-400");
    if (subtitle && project) {
      subtitle.textContent = project.title + " • Active Build";
    }

    var history = document.querySelector("main .flex-1.overflow-y-auto");
    var textarea = document.querySelector("textarea");
    var sendBtn = Array.prototype.find.call(document.querySelectorAll("button"), function (btn) {
      return btn.querySelector(".fa-paper-plane");
    });

    if (!history || !textarea || !sendBtn || !project) return;

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
        var result = await postJson("/api/projects/" + encodeURIComponent(project.id) + "/chat", {
          message: text,
        });

        var replyText = result.reply || "AI Tutor: I logged this step in your project build log.";
        var aiBubble = createBubble("<p></p>", false);
        setText(aiBubble.querySelector("p"), replyText);
        history.appendChild(aiBubble);
        history.scrollTop = history.scrollHeight;
      } catch (err) {
        var errorBubble = createBubble("<p></p>", false);
        setText(errorBubble.querySelector("p"), "AI Tutor failed to respond: " + (err && err.message ? err.message : "Unknown error"));
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

    var linkedInPostButton = byText("button", "Post to LinkedIn");
    var convertThreadButton = byText("button", "Convert to Thread");
    var regenerateButton = byText("button", "Regenerate Tone");
    var draftBody = document.querySelector("p.whitespace-pre-wrap");
    var authorName = Array.prototype.find.call(document.querySelectorAll(".font-bold.text-sm.text-gray-100"), function () {
      return true;
    });
    var authorRole = Array.prototype.find.call(document.querySelectorAll(".text-\\[10px\\].text-gray-400"), function (el) {
      return (el.textContent || "").indexOf("Product Manager") !== -1 || (el.textContent || "").indexOf("AI Builder") !== -1;
    });

    if (authorName) setText(authorName, summary.user.name);
    if (authorRole) setText(authorRole, summary.user.headline || "AI Builder");

    var draftState = { linkedin: null, x: null };

    async function generateDrafts() {
      var result = await postJson("/api/social/drafts/generate", {
        userId: ctx.userId,
        projectId: primaryProject ? primaryProject.id : null,
      });
      var drafts = result.drafts || [];
      draftState.linkedin = drafts.find(function (entry) {
        return entry.platform === "linkedin";
      }) || null;
      draftState.x = drafts.find(function (entry) {
        return entry.platform === "x";
      }) || null;

      if (draftBody && draftState.linkedin) {
        draftBody.textContent = draftState.linkedin.text;
      }

      return draftState;
    }

    try {
      await generateDrafts();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to generate drafts", true);
    }

    if (regenerateButton) {
      regenerateButton.addEventListener("click", async function () {
        try {
          await generateDrafts();
          toast("Draft regenerated.", false);
        } catch (err) {
          toast(err instanceof Error ? err.message : "Draft generation failed", true);
        }
      });
    }

    if (linkedInPostButton) {
      linkedInPostButton.addEventListener("click", async function () {
        try {
          if (!draftState.linkedin) await generateDrafts();
          if (!draftState.linkedin) throw new Error("LinkedIn draft unavailable");

          try {
            var apiPublish = await postJson("/api/social/drafts/" + draftState.linkedin.id + "/publish?mode=api", {});
            if (apiPublish.publishedUrl) {
              window.open(apiPublish.publishedUrl, "_blank", "noopener,noreferrer");
              toast("Published via LinkedIn OAuth.", false);
              return;
            }
          } catch (err) {
            var code = err && err.details ? err.details.failureCode : null;
            if (code === "OAUTH_NOT_CONNECTED") {
              window.location.href = pathWithUserId("/api/auth/linkedin/start?redirect=1");
              return;
            }
          }

          var composer = await postJson("/api/social/drafts/" + draftState.linkedin.id + "/publish?mode=composer", {});
          if (composer.composerUrl) {
            window.open(composer.composerUrl, "_blank", "noopener,noreferrer");
          }
          toast("Opening LinkedIn composer.", false);
        } catch (err) {
          toast(err instanceof Error ? err.message : "LinkedIn publish failed", true);
        }
      });
    }

    if (convertThreadButton) {
      convertThreadButton.addEventListener("click", async function () {
        try {
          if (!draftState.x) await generateDrafts();
          if (!draftState.x) throw new Error("X draft unavailable");

          try {
            var apiPublish = await postJson("/api/social/drafts/" + draftState.x.id + "/publish?mode=api", {});
            if (apiPublish.publishedUrl) {
              window.open(apiPublish.publishedUrl, "_blank", "noopener,noreferrer");
              toast("Published via X OAuth.", false);
              return;
            }
          } catch (err) {
            var code = err && err.details ? err.details.failureCode : null;
            if (code === "OAUTH_NOT_CONNECTED") {
              window.location.href = pathWithUserId("/api/auth/x/start?redirect=1");
              return;
            }
          }

          var composer = await postJson("/api/social/drafts/" + draftState.x.id + "/publish?mode=composer", {});
          if (composer.composerUrl) {
            window.open(composer.composerUrl, "_blank", "noopener,noreferrer");
          }
          toast("Opening X composer.", false);
        } catch (err) {
          toast(err instanceof Error ? err.message : "X publish failed", true);
        }
      });
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

    var inputs = document.querySelectorAll("form input[type='text']");
    var nameInput = inputs[0] || null;
    var roleInput = inputs[1] || null;
    var bioInput = document.querySelector("form textarea");
    var linkedInInput = inputs[2] || null;

    if (nameInput) nameInput.value = summary.user.name || "";
    if (roleInput) roleInput.value = summary.user.headline || "";
    if (bioInput) bioInput.value = summary.user.bio || "";
    if (linkedInInput) linkedInInput.value = (summary.user.socialLinks && summary.user.socialLinks.linkedin) || "";

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
          var payload = {
            name: nameInput ? nameInput.value.trim() : summary.user.name,
            headline: roleInput ? roleInput.value.trim() : summary.user.headline,
            bio: bioInput ? bioInput.value.trim() : summary.user.bio,
            socialLinks: {
              linkedin: linkedInInput && linkedInInput.value ? linkedInInput.value.trim() : undefined,
            },
          };

          var response = await fetch("/api/profile", {
            method: "PATCH",
            headers: requestHeaders(true),
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
            saveCtx(ctx);
            if (publicBtn) setHref(publicBtn, "/u/" + data.profile.handle + "/");
          }

          toast("Profile saved.", false);
        } catch (err) {
          toast(err instanceof Error ? err.message : "Profile save failed", true);
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
      '<img src="/assets/avatar.png" class="w-16 h-16 rounded-full object-cover border border-white/20" alt="' +
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
    var selectedStatus = "verified";

    var skillSection = Array.prototype.find.call(document.querySelectorAll("aside .mb-6"), function (node) {
      return (node.textContent || "").indexOf("Filter by Skill") !== -1;
    });

    async function loadRows() {
      var params = new URLSearchParams();
      if (selectedSkill) params.set("skill", selectedSkill);
      if (selectedStatus) params.set("status", selectedStatus);
      if (search && search.value.trim()) params.set("q", search.value.trim());

      var data = await getJson("/api/employers/talent" + (params.toString() ? "?" + params.toString() : ""));
      var rows = data.rows || [];
      var facets = data.facets || {};

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
            checkbox.checked = index === 0;
            if (index === 0) selectedSkill = skill;
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

  if (currentPath === "/onboarding") {
    var linkedInBtn = byText("button", "Continue with LinkedIn");
    if (linkedInBtn) {
      linkedInBtn.addEventListener("click", async function () {
        try {
          await ensureSession();
          window.location.href = pathWithUserId("/api/auth/linkedin/start?redirect=1");
        } catch (err) {
          toast(err instanceof Error ? err.message : "Unable to start LinkedIn OAuth", true);
        }
      });
    }

    var googleBtn = byText("button", "Continue with Google");
    if (googleBtn) {
      googleBtn.addEventListener("click", async function () {
        try {
          await ensureSession();
          window.location.href = pathWithUserId("/api/auth/google/start?redirect=1");
        } catch (err) {
          toast(err instanceof Error ? err.message : "Unable to start Google OAuth", true);
        }
      });
    }

    var uploadLabel = byText("p", "Upload Resume (PDF)");
    var uploadCard = uploadLabel ? uploadLabel.closest("div.border-2") : null;
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
        try {
          var session = await ensureSession();
          await postJson("/api/onboarding/career-import", {
            sessionId: session.id,
            careerPathId: ctx.careerPathId || "product-management",
            resumeFilename: file.name,
          });
          toast("Resume imported and onboarding context created.", false);
        } catch (err) {
          toast(err instanceof Error ? err.message : "Resume import failed", true);
        }
      });
    }

    var shortcut = Array.prototype.find.call(document.querySelectorAll("a"), function (node) {
      return (node.textContent || "").indexOf("Go directly to Dashboard") !== -1;
    });
    if (shortcut) {
      shortcut.addEventListener("click", async function (event) {
        event.preventDefault();
        try {
          await ensureSession();
          window.location.href = "/dashboard/";
        } catch (err) {
          toast(err instanceof Error ? err.message : "Unable to open dashboard", true);
        }
      });
    }
  }

  if (currentPath === "/assessment") {
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
          window.location.href = continueLink.getAttribute("href") || "/onboarding/";
        } catch (err) {
          toast(err instanceof Error ? err.message : "Assessment failed", true);
        }
      });
    }
  }

  if (currentPath === "/dashboard") {
    void hydrateDashboardHome();
  }

  if (currentPath === "/dashboard/projects") {
    void hydrateProjectsPage();
  }

  if (currentPath === "/dashboard/chat") {
    void hydrateChatPage();
  }

  if (currentPath === "/dashboard/social") {
    void hydrateSocialPage();
  }

  if (currentPath === "/dashboard/updates") {
    void hydrateUpdatesPage();
  }

  if (currentPath === "/dashboard/profile") {
    void hydrateProfilePage();
  }

  if (currentPath === "/employers/talent") {
    void hydrateEmployerTalentPage();
  }
})();
