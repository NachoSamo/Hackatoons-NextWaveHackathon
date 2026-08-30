// Scroll reveal para la landing.
//
// Regla de oro (CLAUDE.md #4): si esto falla en vivo, la landing NO puede quedar en blanco.
// Por eso el CSS oculta únicamente dentro de `.reveal-ready`, y esa clase la agrega ESTE
// script. Sin JS, sin IntersectionObserver o con reduced motion, todo se ve de una.
import { useEffect } from "react";

export function useReveal(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const root = document.querySelector<HTMLElement>("[data-reveal-root]");
    if (!root) return;

    const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!nodes.length) return;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof IntersectionObserver === "undefined") return; // se ve todo, sin animar

    root.classList.add("reveal-ready");
    // Lo que ya está en pantalla al cargar entra sin esperar scroll.
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    nodes.forEach((node) => observer.observe(node));

    // Red de seguridad: si a los 4 s NADA se reveló (ni siquiera lo que entró con la página),
    // el observer no está funcionando → se muestra todo. Si algo ya se reveló, el observer
    // anda bien y no se toca nada: las secciones de abajo conservan su animación al scrollear.
    const failsafe = window.setTimeout(() => {
      if (nodes.some((node) => node.classList.contains("is-visible"))) return;
      nodes.forEach((node) => node.classList.add("is-visible"));
    }, 4000);

    return () => {
      observer.disconnect();
      window.clearTimeout(failsafe);
    };
  }, [enabled]);
}
