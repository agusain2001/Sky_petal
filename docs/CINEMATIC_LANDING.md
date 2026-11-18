# The Softness Issue — cinematic homepage

The existing Next.js commerce application now has a complete ivory, blush and deep-plum editorial homepage. The original database, cart, account, checkout and Studio implementations are retained.

## Experience

- Self-hosted Cormorant Garamond and DM Sans, centralized palette, editorial compositions and mobile art direction.
- The user's selected lingerie-and-silk hero photograph, displayed with aspect-preserving cover crops and responsive focal positioning. The photograph uses no mesh deformation or zoom; the interactive procedural bloom remains available through its viewer.
- Visible foreground 3D hero petals and an inline, fully procedural 36-petal Three.js bloom with pointer interaction, scroll-controlled unfolding and studio lighting. The original bloom dialog remains accessible too. See `docs/LANDING_MOTION.md` for the expanded motion system.
- Motion heading reveals, section entrances, tab transitions and UI feedback; GSAP ScrollTrigger campaign masks, editorial parallax and botanical movement, with cleanup.
- Seven linked categories, a horizontal touch gallery, the Petal Edit campaign, database-backed product tabs and existing product quick-view/size/colour/bag flows.
- Shader-deformed silk ribbon with pointer perspective, capped pixel ratio, Drei performance adaptation and offscreen/hidden-tab rendering suspension.
- Practical two-step measurement preview and keyboard-accessible fit dialog. The preview does not calculate a size.
- Editorial philosophy, brand story, wellness, newsletter and oversized plum footer. Customer testimonials remain hidden because none have been supplied.
- Sticky compact navigation, editorial Shop dialog, mobile navigation, search, account, wishlist and bag entry points.
- Newsletter validation, required explicit consent and inline success/error feedback. Submissions are stored by the existing local API; an outbound marketing provider remains a merchant integration.
- Reduced-motion support, ambient pause on desktop and mobile, native keyboard focus management and static visual fallbacks.

## Preview

The refresh is served at http://127.0.0.1:4318 because another instance occupied port 4317. Double-click `start-cinematic-preview.cmd` to restart it. This preview uses `data/cinematic-preview` to avoid opening the other instance’s PGlite data directory from a second application process.

The usual application scripts still use port 4317. Do not run two PGlite processes against the same database directory. No existing owner credentials were read or changed.

## Source map

- `src/components/home.tsx`: sections and editorial interactions.
- `src/components/petal-scene.tsx`: dimensional hero, procedural flower, shader ribbon and render fallbacks.
- `src/components/use-editorial-motion.ts`: desktop scroll choreography.
- `src/components/landing-interactions.tsx` and `src/app/landing-motion.css`: magnetic links, inline 3D scene, reading progress and shared pause controls.
- `src/components/chrome.tsx`: navigation, newsletter and footer.
- `src/app/cinematic.css`: responsive editorial design system.
- `docs/CINEMATIC_ASSETS.md`: generated asset paths and complete final prompts.
- `e2e/experience.spec.ts`: editorial interactions and WebGL/responsive checks.

## Verification — 30 October 2026

- `npm.cmd run typecheck`: passed.
- `npm.cmd run build`: passed, including production TypeScript compilation.
- `TEST_BASE_URL=http://127.0.0.1:4319 playwright test`: all 12 tests passed against the compiled production application (1.4 minutes).
- Desktop and mobile Edge/Chromium coverage includes category filters and reload, exact-SKU selection, persistent guest bag, checkout sign-in gate, protected Studio, menus, keyboard dismissal, size-guide preview, newsletter consent and local persistence, live flower and silk rendering, all editorial images, horizontal overflow and ambient pause.
- Reduced-motion scans report no serious or critical axe findings. Runtime preference changes remove the desktop WebGL scene immediately. The editorial tests capture uncaught page errors and console errors and passed without either.
- Generated hero and campaign imagery plus desktop/mobile page and 3D scene screenshots were visually reviewed. Full mobile captures use CSS-pixel scaling to stay below the browser’s compositor texture-height limit.

The temporary production QA server uses its own `data/cinematic-production-qa` directory. The user preview remains on port 4318.

## Launch scope

The current hero uses the user's selected `/images/hero.webp`, the same lingerie-and-silk photograph as the supplied reference. The full 3:2 original is preserved in `public/images/hero.png`; responsive cover crops fit the image without stretching. Desktop framing places the photograph in the right portion of the hero to minimize cropping, while mobile gives the photograph its own lower visual area. The image has no zoom or geometric warping. The bloom viewer and interactive silk section remain available. Desktop (1920/1440 px) and mobile (390 px) screenshots showed no horizontal overflow or browser errors.

This delivery is a local storefront implementation. Live payments, production database/hosting, actual brand product specifications, legal policies and outbound marketing integrations still require merchant setup described in `docs/STATUS.md`. Original generated images are deliberately identified as editorial sample imagery. Cross-device GPU performance, complete manual WCAG conformance and real-world Core Web Vitals have not been certified.
