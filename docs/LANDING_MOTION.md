# Landing page motion system

The landing page now has visible Three.js content and stronger editorial transitions while retaining the user-selected, undistorted hero photograph.

## Visible experiences

- **Hero foreground:** cursor-responsive, curved 3D silk petals with procedural surface grain, studio reflections and depth layers. Desktop uses five petals; mobile uses three smaller petals in the lower visual area. The photograph itself remains a normal aspect-preserving image.
- **Inline living bloom:** a full-size procedural 36-petal sculpture appears directly on the page after the philosophy section. Its petals unfold on entry, gently float, respond to pointer/touch position, and rotate with scroll progress. A static image remains available without WebGL and in reduced-motion mode.
- **Silk scene:** the existing shader-driven ribbon remains interactive and uses the same studio lighting and render controls.
- **Editorial scroll:** word-by-word philosophy reveal, organic category masks, expanding Petal Edit photograph, layered campaign typography, brand-story image reveal, and a rising wellness composition.
- **Shopping interactions:** spring-based magnetic CTAs, perspective hover on category/product surfaces for fine pointers, and animated product-tab exits/entrances.
- **Orientation:** a slim reading-progress line and a floating pause/resume control after the hero keep the visitor in control.

## Motion and resource controls

Reduced-motion preferences are observed at runtime. Decorative canvases are removed in reduced-motion mode and their static fallbacks are shown. The hero and floating motion controls share one pause state. Frame callbacks read a shared current control value; the Three.js root also receives an explicit demand/continuous render-loop update. This freezes both geometry and shader clocks without resetting the sculpture.

Scenes mount near the viewport, suspend continuous rendering offscreen or in a hidden tab, cap pixel ratio at 1.4, and reduce it to 1 when performance declines. Studio environment lighting is generated locally with Lightformer; it fetches no remote HDR image. Geometry, grain textures, DOM pointer listeners, GSAP contexts and observers are cleaned up on teardown.

Canvas containers are not rotated or scaled with CSS. That avoids transformed-bound feedback through the canvas resize observer on mobile. Rotational depth is handled by the 3D objects; scroll translation stays outside the canvas. Touch devices retain native vertical scrolling and avoid desktop hover effects.

## Source

- `src/components/petal-scene.tsx`: textured petals, inline bloom, silk shader, studio lights, frame control and fallbacks.
- `src/components/home.tsx`: scene visibility, scroll progress, shared motion preference, inline bloom and product-tab transitions.
- `src/components/use-editorial-motion.ts`: GSAP scroll choreography and fine-pointer surface tilt.
- `src/components/landing-interactions.tsx`: reusable spring-based magnetic link.
- `src/app/landing-motion.css`: foreground layering, inline bloom art direction, progress/pause UI and responsive motion styles.
- `e2e/motion.spec.ts`: live-frame changes, frozen paused frames, runtime reduced motion, product-tab transitions and WebGL failure fallback.

The work implements the visual/motion portion of roadmap Phase 4. It does not mark the CMS, production integrations or the entire phase as complete. Cross-device frame-rate and Core Web Vitals certification remain separate launch checks.

## Validation

On 30 October 2026, TypeScript checks and the production build passed. The complete browser suite passed **16/16 tests** against the compiled application on an isolated production QA database. Desktop and mobile checks include shopping flows, live 3D frame changes, frozen paused frames, runtime reduced-motion changes, WebGL failure fallback, animated product-tab selections, keyboard dialogs, no horizontal overflow, and axe serious/critical findings. No uncaught page errors or console errors were observed in the editorial/motion checks. Desktop and mobile visual captures were reviewed.
