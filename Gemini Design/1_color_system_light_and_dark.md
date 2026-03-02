# UI Theme Updates: Light Mode & Refined Dark Mode

## 1. Dark Mode Refresh (Removing Purple/Indigo)
The current dark mode heavily relies on indigo and purple gradients, which we need to replace with a more professional, neutral tech palette (e.g., Slate, Emerald, and Cyan accents).

**CSS Variable Updates (`styles.css`):**
- Replace `--primary-glow: rgba(79, 70, 229, 0.4);` (Indigo) with a neutral or teal glow, e.g., `rgba(16, 185, 129, 0.4);` (Emerald).
- Replace `--secondary-glow: rgba(168, 85, 247, 0.4);` (Purple) with `rgba(6, 182, 212, 0.4);` (Cyan).

**HTML Class Updates across all files:**
- Remove all instances of `bg-gradient-to-br from-indigo-500 to-purple-600` (used heavily in logos and primary buttons). 
- Replace with `bg-emerald-500 text-black` or `bg-white text-black` for a crisper, more modern look.
- Update text highlight colors: change `text-indigo-400` and `text-purple-400` to `text-emerald-400` or `text-gray-300`.

---

## 2. Light Mode Implementation
To implement a full light mode version of the site, introduce the following CSS variables and invert the global backgrounds.

**Global Color Variables to Add:**
```css
:root[data-theme="light"] {
  --bg-dark: #f8fafc; /* Slate 50 */
  --bg-card: rgba(255, 255, 255, 0.8);
  --bg-card-hover: rgba(255, 255, 255, 1);
  --border-color: rgba(0, 0, 0, 0.1);
  --text-main: #0f111a;
  --text-muted: #4b5563; /* Gray 600 */
}
```

**Implementation Strategy for the Coding Agent:**
1. Use CSS custom properties for text and background colors rather than hardcoding Tailwind utility classes like `bg-[#0f111a]` and `text-white`. 
2. Update `.glass` and `.glass-panel` classes to use white semi-transparent backgrounds with light shadows (`box-shadow: 0 4px 30px rgba(0, 0, 0, 0.05)`) when in light mode.
3. Ensure gradients and background glows use soft, pale colors (e.g., very light gray and pale emerald) rather than intensely saturated colors.
4. Add a theme toggle button in the navigation bar to switch between `data-theme="light"` and default dark mode.
