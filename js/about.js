document.addEventListener("DOMContentLoaded", function () {
  const reducedMotionIsOn = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  if (reducedMotionIsOn || !window.gsap) {
    return;
  }

  /* About opening */

  gsap.timeline({ defaults: { ease: "power2.out" } })
    .from(".about-intro-section h1", {
      opacity: 0,
      y: 28,
      duration: 0.7
    })
    .from(".about-intro-section p", {
      opacity: 0,
      y: 20,
      duration: 0.5,
      stagger: 0.12
    }, "-=0.3");

  /* About scroll sections */

  if (!window.ScrollTrigger) {
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  gsap.utils.toArray(
    ".about-debrief-section, .about-final-section, .about-tmdb-note"
  ).forEach(function (section) {
    gsap.from(section, {
      scrollTrigger: {
        trigger: section,
        start: "top 82%",
        once: true
      },
      opacity: 0,
      y: 35,
      duration: 0.65,
      ease: "power2.out"
    });
  });
});