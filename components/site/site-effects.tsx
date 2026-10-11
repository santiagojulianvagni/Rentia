'use client';

import { useEffect } from 'react';

// Motion and small interactions for the public site, attached to the
// server-rendered markup. Everything stays readable without JavaScript and
// with prefers-reduced-motion (the CSS shows the final state).
export default function SiteEffects() {
  useEffect(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cleanups: Array<() => void> = [];
    const listen = (target: EventTarget, type: string, handler: EventListener, options?: AddEventListenerOptions) => {
      target.addEventListener(type, handler, options);
      cleanups.push(() => target.removeEventListener(type, handler, options));
    };
    const all = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) => [...root.querySelectorAll<T>(selector)];

    // Scroll progress, nav background and the steps line.
    const progress = document.getElementById('progress');
    const nav = document.getElementById('nav');
    const steps = document.querySelector<HTMLElement>('[data-steps]');
    const stepsLine = steps?.querySelector<HTMLElement>('.stepsLine i');
    const onScroll = () => {
      const root = document.documentElement;
      const max = root.scrollHeight - root.clientHeight;
      progress?.style.setProperty('transform', `scaleX(${max > 0 ? root.scrollTop / max : 0})`);
      nav?.classList.toggle('scrolled', root.scrollTop > 10);
      if (steps && stepsLine) {
        const box = steps.getBoundingClientRect();
        const value = Math.max(0, Math.min(1, (innerHeight * .8 - box.top) / (box.height + innerHeight * .2)));
        stepsLine.style.setProperty('--p', String(value));
      }
    };
    listen(window, 'scroll', onScroll, { passive: true });
    onScroll();

    // Hero entrance. A timer, not requestAnimationFrame: background tabs pause rAF.
    const ready = window.setTimeout(() => all('.hero').forEach(hero => hero.classList.add('ready')), 60);
    cleanups.push(() => window.clearTimeout(ready));

    // Spotlight that follows the pointer in the hero.
    all('.hero').forEach(hero => listen(hero, 'pointermove', event => {
      const pointer = event as PointerEvent, box = hero.getBoundingClientRect();
      hero.style.setProperty('--mx', `${pointer.clientX - box.left}px`);
      hero.style.setProperty('--my', `${pointer.clientY - box.top}px`);
    }));

    if (!reduce) {
      all('[data-tilt]').forEach(element => {
        listen(element, 'pointermove', event => {
          const pointer = event as PointerEvent, box = element.getBoundingClientRect();
          const x = (pointer.clientX - box.left) / box.width - .5, y = (pointer.clientY - box.top) / box.height - .5;
          element.style.transform = `rotateY(${x * 8}deg) rotateX(${-y * 8}deg)`;
        });
        listen(element, 'pointerleave', () => { element.style.transform = ''; });
      });
      all('[data-magnetic]').forEach(element => {
        listen(element, 'pointermove', event => {
          const pointer = event as PointerEvent, box = element.getBoundingClientRect();
          element.style.transform = `translate(${(pointer.clientX - box.left - box.width / 2) * .18}px,${(pointer.clientY - box.top - box.height / 2) * .28}px)`;
        });
        listen(element, 'pointerleave', () => { element.style.transform = ''; });
      });
    }

    // Reveal on scroll, count-up numbers and scenes that animate when seen.
    const countUp = (root: Element) => all('[data-count]', root).forEach(counter => {
      if (counter.dataset.done) return;
      counter.dataset.done = '1';
      const target = Number(counter.dataset.count), prefix = counter.dataset.prefix || '', suffix = counter.dataset.suffix || '';
      const start = performance.now(), duration = reduce ? 0 : 1600;
      const tick = (now: number) => {
        const progressValue = duration ? Math.min(1, (now - start) / duration) : 1;
        counter.textContent = prefix + Math.round(target * (1 - Math.pow(1 - progressValue, 3))).toLocaleString('es-AR') + suffix;
        if (progressValue < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const reveal = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');
      countUp(entry.target);
      reveal.unobserve(entry.target);
    }), { threshold: .18, rootMargin: '0px 0px -6% 0px' });
    all('[data-reveal]').forEach(element => reveal.observe(element));
    cleanups.push(() => reveal.disconnect());

    const autoScenes = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.querySelector('.scene')?.classList.add('on');
      autoScenes.unobserve(entry.target);
    }), { threshold: .3 });
    all('[data-autoscene]').forEach(element => autoScenes.observe(element));
    cleanups.push(() => autoScenes.disconnect());

    // Product tour: the sticky stage shows the scene of the chapter in view.
    const chapters = all('[data-chapter]');
    const stageScenes = all('[data-stage] .scene');
    const tabs = all('[data-go]');
    const show = (id: string) => {
      stageScenes.forEach(scene => scene.classList.toggle('on', scene.dataset.id === id));
      tabs.forEach(tab => tab.classList.toggle('on', tab.dataset.go === id));
      chapters.forEach(chapter => chapter.classList.toggle('active', chapter.dataset.chapter === id));
    };
    const tour = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) show((entry.target as HTMLElement).dataset.chapter || '0');
    }), { rootMargin: '-45% 0px -45% 0px' });
    chapters.forEach(chapter => tour.observe(chapter));
    cleanups.push(() => tour.disconnect());
    tabs.forEach(tab => listen(tab, 'click', () => {
      const chapter = chapters.find(item => item.dataset.chapter === tab.dataset.go);
      if (chapter) window.scrollTo({ top: chapter.getBoundingClientRect().top + scrollY - innerHeight * .3, behavior: reduce ? 'auto' : 'smooth' });
    }));

    // Glossary cards flip; FAQ keeps one answer open.
    all('.term').forEach(term => listen(term, 'click', () => term.classList.toggle('flip')));
    all('.qa > button').forEach(button => listen(button, 'click', () => {
      const item = button.parentElement!, open = !item.classList.contains('open');
      all('.qa', item.parentElement!).forEach(other => {
        other.classList.remove('open');
        other.querySelector('button')?.setAttribute('aria-expanded', 'false');
      });
      item.classList.toggle('open', open);
      button.setAttribute('aria-expanded', String(open));
    }));

    return () => cleanups.forEach(cleanup => cleanup());
  }, []);
  return null;
}
