# Copy and Asset Replacements

## 1. Hero Image Replacement
The AI-generated art (`/assets/hero.png`) on the Learner Landing page (`/`) should be replaced with a realistic mock-up of the platform itself.

**Instructions for the Implementing Agent:**
Replace the `<img>` tag in the hero section containing `hero.png` with a scaled-down interactive `<iframe>` pointing directly to the dashboard, creating a perfect, live mockup without needing static AI art.

**Code to inject in `index.html` (Hero Section):**
```html
<div class="relative w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl transform -rotate-y-5 rotate-x-5 perspective-1000 origin-center bg-[#0f111a] border border-gray-200 dark:border-white/20">
    <div class="absolute inset-0 bg-transparent z-10"></div> <!-- Transparent overlay to prevent accidental clicking while scrolling -->
    <iframe src="/dashboard/" class="w-[150%] h-[150%] origin-top-left scale-[0.66] pointer-events-none border-none"></iframe>
</div>
```
*(Ensure you apply similar logic anywhere `hero.png` is referenced.)*

---

## 2. Copy Updates (Removal of "Cryptographically Verified")
The term "cryptographically verified" sounds too Web3-focused for a general audience. It needs to be removed and replaced with terminology focusing on standard platform verification.

**Changes required across `.html` files:**
1. **Learner Landing Page (`/index.html`)**: 
   - Change: *"Cryptographically Verified Proof"* -> *"System-Verified Proof of Work"*
   - Remove any surrounding text explaining cryptographic verification.
2. **Employers Landing Page (`/employers/index.html`)**:
   - Change: *"100% Cryptographically Verified Skill Proofs"* -> *"100% System-Verified Skill Proofs"*
3. **General Dashboard & Profiles**: 
   - Audit all standard files (`/dashboard/`, `/u/alex-chen-ai/`, etc.) and ensure any badges saying *"Cryptographically Verified"* are updated to *"Platform Verified"* or *"AI Tutor Verified"*.
