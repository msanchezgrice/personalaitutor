(function () {
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function activateLinks() {
    const path = window.location.pathname.replace(/\/$/, "") || "/";
    qsa("a[href]").forEach((a) => {
      const href = a.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("#")) return;
      const cleanHref = href.replace(/\/$/, "") || "/";
      if (cleanHref === path) a.classList.add("active");
    });
  }

  function initWizard() {
    const wizard = qs("[data-wizard]");
    if (!wizard) return;

    const panes = qsa(".wizard-pane", wizard);
    const steps = qsa(".step", wizard);
    const progress = qs("[data-wizard-progress]", wizard);
    let idx = 0;

    function render() {
      panes.forEach((pane, i) => pane.classList.toggle("active", i === idx));
      steps.forEach((step, i) => step.classList.toggle("active", i === idx));
      if (progress) progress.textContent = `Step ${idx + 1} of ${panes.length}`;
    }

    qsa("[data-next]", wizard).forEach((btn) => {
      btn.addEventListener("click", () => {
        if (idx >= panes.length - 1) return;
        idx += 1;
        render();
      });
    });

    qsa("[data-prev]", wizard).forEach((btn) => {
      btn.addEventListener("click", () => {
        if (idx <= 0) return;
        idx -= 1;
        render();
      });
    });

    const completeBtn = qs("[data-finish]", wizard);
    if (completeBtn) {
      completeBtn.addEventListener("click", () => {
        const done = qs("[data-wizard-done]", wizard);
        if (done) done.classList.remove("hide");
      });
    }

    render();
  }

  function initAssessment() {
    const wrap = qs("[data-assessment]");
    if (!wrap) return;

    const submit = qs("[data-assessment-submit]", wrap);
    const output = qs("[data-assessment-output]", wrap);
    if (!submit || !output) return;

    submit.addEventListener("click", () => {
      const answers = qsa("input[type='radio']:checked", wrap);
      if (!answers.length) {
        output.innerHTML = `<div class="fail-box"><strong>Assessment failed:</strong> No answers submitted. Please complete the quiz before generating your dashboard.</div>`;
        return;
      }

      let score = 0;
      answers.forEach((answer) => {
        score += Number(answer.getAttribute("data-points") || 0);
      });
      const pct = Math.round((score / 20) * 100);
      const level = pct < 40 ? "Foundational" : pct < 70 ? "Applied" : "Advanced";

      output.innerHTML = `
        <div class="success-box">
          <h3>Assessment Result: ${level}</h3>
          <p>Your baseline score is <strong>${pct}%</strong>. Your AI Tutor will create a dashboard focused on your goals and weak spots.</p>
          <p><span class="tag ok">Status: Ready to Generate Dashboard</span></p>
        </div>
      `;
    });
  }

  function initTalentSearch() {
    const root = qs("[data-talent-search]");
    if (!root) return;

    const textInput = qs("[data-filter='query']", root);
    const skillInput = qs("[data-filter='skill']", root);
    const toolInput = qs("[data-filter='tool']", root);
    const cards = qsa("[data-card]", root);
    const count = qs("[data-result-count]", root);

    function apply() {
      const query = (textInput?.value || "").trim().toLowerCase();
      const skill = (skillInput?.value || "").trim().toLowerCase();
      const tool = (toolInput?.value || "").trim().toLowerCase();
      let visible = 0;

      cards.forEach((card) => {
        const hay = [
          card.getAttribute("data-name"),
          card.getAttribute("data-role"),
          card.getAttribute("data-skills"),
          card.getAttribute("data-tools"),
        ]
          .join(" ")
          .toLowerCase();

        const okQuery = !query || hay.includes(query);
        const okSkill = !skill || (card.getAttribute("data-skills") || "").toLowerCase().includes(skill);
        const okTool = !tool || (card.getAttribute("data-tools") || "").toLowerCase().includes(tool);
        const show = okQuery && okSkill && okTool;
        card.classList.toggle("hide", !show);
        if (show) visible += 1;
      });

      if (count) count.textContent = `${visible} candidates`; 
    }

    [textInput, skillInput, toolInput].forEach((el) => {
      if (!el) return;
      el.addEventListener("input", apply);
    });
    apply();
  }

  function initSocialComposer() {
    const root = qs("[data-social]");
    if (!root) return;

    const draftText = qs("[data-draft-text]", root);
    const project = qs("[data-project]", root);
    const audience = qs("[data-audience]", root);
    const platform = qs("[data-platform]", root);
    const ogTitle = qs("[data-og-title]", root);
    const ogDesc = qs("[data-og-desc]", root);
    const ogUrl = qs("[data-og-url]", root);
    const out = qs("[data-social-output]", root);
    const failToken = qs("[data-sim-fail-token]", root);
    const failRate = qs("[data-sim-fail-rate]", root);

    function setOutput(html) {
      if (out) out.innerHTML = html;
    }

    const generateBtn = qs("[data-generate-draft]", root);
    if (generateBtn) {
      generateBtn.addEventListener("click", () => {
        const p = project?.value || "a project";
        const a = audience?.value || "builders";
        const pl = platform?.value || "linkedin";
        const url = ogUrl?.value || "https://aitutor.example/u/alex-chen-ai/projects/customer-support-copilot";
        const title = ogTitle?.value || "Customer Support Copilot";
        const desc = ogDesc?.value || "Shipped with AI Tutor and verified through project evidence.";

        const draft = `Built ${p} this week with my AI Tutor.\n\nWhat I shipped:\n- Working artifact\n- Build log updates\n- Skill evidence mapped to Prompt Engineering + AI Ops\n\nSharing for ${a}.\n\n${url}\n\n#AINative #AIBuild #LearningInPublic`;

        if (draftText) draftText.value = draft;
        setOutput(`<div class="success-box"><strong>Draft generated for ${pl.toUpperCase()}.</strong> OG preview and publish actions are now available.</div>`);

        const preview = qs("[data-og-preview]", root);
        if (preview) {
          preview.innerHTML = `
            <strong>${title}</strong>
            <p style="margin:6px 0;color:var(--ink-soft)">${desc}</p>
            <span class="code">${url}</span>
          `;
        }
      });
    }

    const apiBtn = qs("[data-publish-api]", root);
    if (apiBtn) {
      apiBtn.addEventListener("click", () => {
        if (failToken?.checked) {
          setOutput(`<div class="fail-box"><strong>Publish failed:</strong> OAuth token expired. Reconnect LinkedIn/X before retrying.</div>`);
          return;
        }
        if (failRate?.checked) {
          setOutput(`<div class="fail-box"><strong>Publish failed:</strong> Provider rate limit reached. Retry in 15 minutes.</div>`);
          return;
        }
        setOutput(`<div class="success-box"><strong>Published via API.</strong> Post URL: <span class="code">https://social.example/post/84732</span></div>`);
      });
    }

    const composerBtn = qs("[data-publish-composer]", root);
    if (composerBtn) {
      composerBtn.addEventListener("click", () => {
        const text = encodeURIComponent(draftText?.value || "");
        const urlRaw = ogUrl?.value || "https://aitutor.example";
        const isX = (platform?.value || "linkedin") === "x";
        const composeUrl = isX
          ? `https://twitter.com/intent/tweet?text=${text}`
          : `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(urlRaw)}`;

        const popup = window.open(composeUrl, "_blank", "noopener,noreferrer");
        if (!popup) {
          setOutput(`<div class="fail-box"><strong>Compose failed:</strong> Browser blocked popup. Enable popups and retry.</div>`);
          return;
        }
        setOutput(`<div class="success-box"><strong>Composer opened.</strong> Complete posting natively in the provider window.</div>`);
      });
    }

    const copyBtn = qs("[data-copy-draft]", root);
    if (copyBtn) {
      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(draftText?.value || "");
          setOutput(`<div class="success-box"><strong>Copied.</strong> Draft copied to clipboard.</div>`);
        } catch (err) {
          setOutput(`<div class="fail-box"><strong>Copy failed:</strong> Clipboard permission denied.</div>`);
        }
      });
    }
  }

  function initProfileShare() {
    const root = qs("[data-profile-share]");
    if (!root) return;

    const btn = qs("[data-native-share]", root);
    const status = qs("[data-share-status]", root);
    if (!btn || !status) return;

    btn.addEventListener("click", async () => {
      const payload = {
        title: "Alex Chen | AI-Native Profile",
        text: "Proof-based AI skill profile with projects and build logs.",
        url: window.location.href,
      };

      if (!navigator.share) {
        status.innerHTML = `<div class="fail-box"><strong>Share failed:</strong> Native share API is unavailable on this desktop browser.</div>`;
        return;
      }
      try {
        await navigator.share(payload);
        status.innerHTML = `<div class="success-box"><strong>Shared successfully.</strong></div>`;
      } catch (err) {
        status.innerHTML = `<div class="fail-box"><strong>Share failed:</strong> ${err && err.message ? err.message : "Unknown share error"}</div>`;
      }
    });
  }

  activateLinks();
  initWizard();
  initAssessment();
  initTalentSearch();
  initSocialComposer();
  initProfileShare();
})();
