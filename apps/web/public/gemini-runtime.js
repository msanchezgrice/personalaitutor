(function () {
  var currentPath = window.location.pathname.replace(/\/+$/, "") || "/";

  function byText(selector, text) {
    return Array.prototype.find.call(document.querySelectorAll(selector), function (el) {
      return (el.textContent || "").trim().indexOf(text) !== -1;
    });
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
    }, 2600);
  }

  async function postJson(url, body) {
    var res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok || !data.ok) {
      var message = data && data.error && data.error.message ? data.error.message : "Request failed";
      throw new Error(message);
    }
    return data;
  }

  async function ensureSession() {
    var data = await postJson("/api/onboarding/start", {
      name: "Alex Chen",
      handleBase: "alex-chen-ai",
      careerPathId: "product-management",
    });
    return data.session;
  }

  async function ensureDashboardUser() {
    var res = await fetch("/api/dashboard/summary");
    if (res.ok) return true;
    await ensureSession();
    return true;
  }

  if (currentPath === "/onboarding") {
    var linkedInBtn = byText("button", "Continue with LinkedIn");
    if (linkedInBtn) {
      linkedInBtn.addEventListener("click", function () {
        window.location.href = "/api/auth/linkedin/start?redirect=1";
      });
    }

    var googleBtn = byText("button", "Continue with Google");
    if (googleBtn) {
      googleBtn.addEventListener("click", function () {
        toast("Google OAuth is not configured in this MVP build.", true);
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
            careerPathId: "product-management",
            resumeFilename: file.name,
          });
          toast("Resume imported and onboarding context created.", false);
        } catch (err) {
          toast(err instanceof Error ? err.message : "Resume import failed", true);
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
          var selectedValue = 4;
          if (checked) {
            var label = checked.closest("label");
            var text = label ? (label.textContent || "").toLowerCase() : "";
            if (text.indexOf("automate") !== -1) selectedValue = 5;
            if (text.indexOf("data") !== -1) selectedValue = 3;
          }
          await postJson("/api/assessment/submit", {
            assessmentId: start.assessment.id,
            answers: [{ questionId: "primary_goal", value: selectedValue }],
          });
          toast("Assessment submitted.", false);
          window.location.href = continueLink.getAttribute("href") || "/onboarding/";
        } catch (err) {
          toast(err instanceof Error ? err.message : "Assessment failed", true);
        }
      });
    }
  }

  if (currentPath === "/dashboard/social") {
    var linkedInPostButton = byText("button", "Post to LinkedIn");
    var convertThreadButton = byText("button", "Convert to Thread");
    var regenerateButton = byText("button", "Regenerate Tone");
    var draftBody = document.querySelector("p.whitespace-pre-wrap");
    var draftState = { linkedin: null, x: null };

    async function generateDrafts() {
      await ensureDashboardUser();
      var result = await postJson("/api/social/drafts/generate", { projectId: null });
      var drafts = result.drafts || [];
      draftState.linkedin = drafts.find(function (d) { return d.platform === "linkedin"; }) || null;
      draftState.x = drafts.find(function (d) { return d.platform === "x"; }) || null;
      if (draftBody && draftState.linkedin) {
        draftBody.textContent = draftState.linkedin.text;
      }
      return draftState;
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
          if (!draftState.linkedin) {
            await generateDrafts();
          }
          if (!draftState.linkedin) throw new Error("LinkedIn draft unavailable");
          var result = await postJson("/api/social/drafts/" + draftState.linkedin.id + "/publish?mode=composer", {});
          toast("Opening LinkedIn composer.", false);
          if (result.composerUrl) {
            window.open(result.composerUrl, "_blank", "noopener,noreferrer");
          }
        } catch (err) {
          toast(err instanceof Error ? err.message : "LinkedIn publish failed", true);
        }
      });
    }

    if (convertThreadButton) {
      convertThreadButton.addEventListener("click", async function () {
        try {
          if (!draftState.x) {
            await generateDrafts();
          }
          if (!draftState.x) throw new Error("X draft unavailable");
          var result = await postJson("/api/social/drafts/" + draftState.x.id + "/publish?mode=composer", {});
          toast("Opening X composer.", false);
          if (result.composerUrl) {
            window.open(result.composerUrl, "_blank", "noopener,noreferrer");
          }
        } catch (err) {
          toast(err instanceof Error ? err.message : "X publish failed", true);
        }
      });
    }
  }

  if (currentPath === "/dashboard/projects") {
    Array.prototype.forEach.call(document.querySelectorAll("button[title='Copy Link']"), function (btn) {
      btn.addEventListener("click", async function () {
        var row = btn.closest("div.flex.items-center.gap-3");
        var link = row ? row.querySelector("a[href]") : null;
        if (!link) return;
        try {
          var href = link.getAttribute("href") || "";
          var absolute = href.startsWith("http") ? href : window.location.origin + href;
          await navigator.clipboard.writeText(absolute);
          toast("Project link copied.", false);
        } catch (err) {
          toast("Clipboard unavailable.", true);
        }
      });
    });
  }

  if (currentPath === "/dashboard/updates") {
    var applyButton = byText("button", "Apply to Project");
    if (applyButton) {
      applyButton.addEventListener("click", async function () {
        try {
          await ensureDashboardUser();
          await postJson("/api/scheduler/news-refresh", {});
          await postJson("/api/scheduler/daily-update", {});
          toast("Update applied and daily digest queued.", false);
        } catch (err) {
          toast(err instanceof Error ? err.message : "Unable to apply update", true);
        }
      });
    }
  }

  if (currentPath === "/employers/talent") {
    fetch("/api/employers/talent")
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var title = document.querySelector("h2.text-xl");
        if (title && data && typeof data.total === "number") {
          title.textContent = data.total + " Candidates Match Criteria";
        }
      })
      .catch(function () {
        return null;
      });
  }
})();
