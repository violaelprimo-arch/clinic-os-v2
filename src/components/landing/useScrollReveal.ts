'use client'

import { useEffect } from 'react'

export function useScrollReveal(enabled: boolean = true) {
  useEffect(() => {
    function revealAll() {
      document.querySelectorAll('.landing-reveal, .landing-reveal-scale').forEach((el) => {
        el.classList.add('is-revealed')
      })
    }

    if (!enabled) {
      revealAll()
      return
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      revealAll()
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed')
            observer.unobserve(entry.target)
          }
        })
      },
      {
        threshold: 0.04,
        rootMargin: '50px 0px 50px 0px',
      }
    )

    function processElements() {
      const elements = document.querySelectorAll('.landing-reveal:not(.is-revealed), .landing-reveal-scale:not(.is-revealed)')
      elements.forEach((el) => {
        const rect = el.getBoundingClientRect()
        // If already anywhere within or above the viewport, reveal immediately
        if (rect.top < window.innerHeight + 50) {
          el.classList.add('is-revealed')
        } else {
          observer.observe(el)
        }
      })
    }

    // Initial check
    processElements()

    // Watch for dynamically added elements or tab switches
    const mutationObserver = new MutationObserver(() => {
      processElements()
    })

    mutationObserver.observe(document.body, { childList: true, subtree: true })

    // Also trigger on scroll to catch fast jumps
    window.addEventListener('scroll', processElements, { passive: true })

    return () => {
      observer.disconnect()
      mutationObserver.disconnect()
      window.removeEventListener('scroll', processElements)
    }
  }, [enabled])
}
