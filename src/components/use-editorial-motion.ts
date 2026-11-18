"use client";
import { useEffect, type RefObject } from "react";

export function useEditorialMotion(
  root: RefObject<HTMLElement | null>,
  paused: boolean,
) {
  useEffect(() => {
    if (!root.current || paused) return;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    // Scroll choreography is below the hero. Do not download or evaluate GSAP
    // while the browser is loading the first image and hydrating the storefront.
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => !entry.isIntersecting)) return;
        observer.disconnect();
        void Promise.all([import("gsap"), import("gsap/ScrollTrigger")])
          .then(([{ gsap }, { ScrollTrigger }]) => {
            if (cancelled || !root.current) return;
            gsap.registerPlugin(ScrollTrigger);
            const media = gsap.matchMedia();
            media.add("(prefers-reduced-motion: no-preference)", () => {
              const scope = gsap.context(() => {
                gsap.fromTo(
                  ".story-word",
                  { opacity: 0.3, y: 22, rotationX: -35 },
                  {
                    opacity: 1,
                    y: 0,
                    rotationX: 0,
                    stagger: 0.12,
                    ease: "power2.out",
                    scrollTrigger: {
                      trigger: ".feeling-story",
                      start: "top 85%",
                      end: "center 43%",
                      scrub: 0.65,
                    },
                  },
                );
                gsap.utils
                  .toArray<HTMLElement>(".category-window img")
                  .forEach((image, index) => {
                    gsap.fromTo(
                      image,
                      { clipPath: "inset(14% 9% 14% 9% round 70px)" },
                      {
                        clipPath: "inset(0% 0% 0% 0% round 0px)",
                        duration: 1.15,
                        delay: index * 0.09,
                        ease: "power3.out",
                        scrollTrigger: {
                          trigger: image,
                          start: "top 88%",
                          once: true,
                        },
                      },
                    );
                  });
                gsap.fromTo(
                  ".being-image",
                  { clipPath: "inset(10% 7% 10% 7% round 120px)" },
                  {
                    clipPath: "inset(0% 0% 0% 0% round 0px)",
                    ease: "none",
                    scrollTrigger: {
                      trigger: ".being-you",
                      start: "top 90%",
                      end: "top 15%",
                      scrub: 0.9,
                    },
                  },
                );
                gsap.fromTo(
                  ".ritual-arch",
                  { y: 55, rotation: -4 },
                  {
                    y: 0,
                    rotation: 0,
                    ease: "none",
                    scrollTrigger: {
                      trigger: ".ritual-section",
                      start: "top 85%",
                      end: "center 50%",
                      scrub: 0.8,
                    },
                  },
                );
              }, root);
              return () => scope.revert();
            });
            media.add(
              "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
              () => {
                const cleanup: Array<() => void> = [];
                const scope = gsap.context(() => {
                  gsap.utils
                    .toArray<HTMLElement>(
                      ".category-window, .loved-section .product-image",
                    )
                    .forEach((surface) => {
                      gsap.set(surface, {
                        transformPerspective: 1000,
                        transformOrigin: "50% 50%",
                      });
                      const rotateX = gsap.quickTo(surface, "rotationX", {
                        duration: 0.55,
                        ease: "power3.out",
                      });
                      const rotateY = gsap.quickTo(surface, "rotationY", {
                        duration: 0.55,
                        ease: "power3.out",
                      });
                      const move = (event: PointerEvent) => {
                        if (event.pointerType !== "mouse") return;
                        const bounds = surface.getBoundingClientRect();
                        rotateX(
                          (0.5 - (event.clientY - bounds.top) / bounds.height) *
                            7,
                        );
                        rotateY(
                          ((event.clientX - bounds.left) / bounds.width - 0.5) *
                            8,
                        );
                      };
                      const reset = () => {
                        rotateX(0);
                        rotateY(0);
                      };
                      surface.addEventListener("pointermove", move);
                      surface.addEventListener("pointerleave", reset);
                      cleanup.push(() => {
                        surface.removeEventListener("pointermove", move);
                        surface.removeEventListener("pointerleave", reset);
                      });
                    });
                }, root);
                return () => {
                  cleanup.forEach((dispose) => dispose());
                  scope.revert();
                };
              },
            );
            media.add(
              "(min-width: 900px) and (prefers-reduced-motion: no-preference)",
              () => {
                const scope = gsap.context(() => {
                  gsap.fromTo(
                    ".petal-edit-photo",
                    {
                      clipPath:
                        "inset(14% 9% 14% 0% round 150px 0px 0px 150px)",
                      scale: 1.04,
                    },
                    {
                      clipPath: "inset(0% 0% 0% 0% round 0px)",
                      scale: 1,
                      ease: "none",
                      scrollTrigger: {
                        trigger: ".petal-edit",
                        start: "top 90%",
                        end: "top 15%",
                        scrub: 1,
                      },
                    },
                  );
                  gsap.to(".edit-flower", {
                    rotation: 20,
                    y: -65,
                    ease: "none",
                    scrollTrigger: {
                      trigger: ".petal-edit",
                      start: "top bottom",
                      end: "bottom top",
                      scrub: 1.5,
                    },
                  });
                  gsap.fromTo(
                    ".being-image img",
                    { yPercent: -6, scale: 1.14 },
                    {
                      yPercent: 6,
                      ease: "none",
                      scrollTrigger: {
                        trigger: ".being-you",
                        start: "top bottom",
                        end: "bottom top",
                        scrub: 1,
                      },
                    },
                  );
                  gsap.fromTo(
                    ".petal-edit-copy h2",
                    { y: 60, rotation: -3 },
                    {
                      y: -15,
                      rotation: 0,
                      ease: "none",
                      scrollTrigger: {
                        trigger: ".petal-edit",
                        start: "top bottom",
                        end: "bottom top",
                        scrub: 1,
                      },
                    },
                  );
                }, root);
                return () => scope.revert();
              },
            );
            dispose = () => media.revert();
          })
          .catch(() => {
            /* Optional animation must not hide shopping content. */
          });
      },
      { rootMargin: "0px" },
    );
    const section = root.current.querySelector(".bloom-hero");
    if (section) observer.observe(section);
    return () => {
      cancelled = true;
      observer.disconnect();
      dispose?.();
    };
  }, [root, paused]);
}
