// Smooth scrolling utility with momentum and easing

export interface ScrollOptions {
  duration?: number
  easing?: (t: number) => number
  offset?: number
}

// Easing functions
export const easingFunctions = {
  linear: (t: number) => t,
  easeInOut: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeOut: (t: number) => 1 - Math.pow(1 - t, 3),
  easeIn: (t: number) => t * t * t,
  bounce: (t: number) => {
    if (t < 1 / 2.75) {
      return 7.5625 * t * t
    } else if (t < 2 / 2.75) {
      return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75
    } else if (t < 2.5 / 2.75) {
      return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375
    } else {
      return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375
    }
  }
}

export class SmoothScroller {
  private animationId: number | null = null
  private isScrolling = false

  scrollTo(
    container: HTMLElement,
    targetPosition: number,
    options: ScrollOptions = {}
  ): Promise<void> {
    return new Promise((resolve) => {
      const {
        duration = 800,
        easing = easingFunctions.easeInOut,
        offset = 0
      } = options

      if (this.animationId) {
        cancelAnimationFrame(this.animationId)
      }

      this.isScrolling = true
      const startPosition = container.scrollTop
      const distance = targetPosition - startPosition - offset
      const startTime = performance.now()

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)
        
        const easedProgress = easing(progress)
        const currentPosition = startPosition + distance * easedProgress
        
        container.scrollTop = currentPosition

        if (progress < 1) {
          this.animationId = requestAnimationFrame(animate)
        } else {
          this.isScrolling = false
          this.animationId = null
          resolve()
        }
      }

      this.animationId = requestAnimationFrame(animate)
    })
  }

  scrollToElement(
    container: HTMLElement,
    element: HTMLElement,
    options: ScrollOptions = {}
  ): Promise<void> {
    const containerRect = container.getBoundingClientRect()
    const elementRect = element.getBoundingClientRect()
    const relativeTop = elementRect.top - containerRect.top
    const targetPosition = container.scrollTop + relativeTop
    
    return this.scrollTo(container, targetPosition, options)
  }

  scrollToBottom(
    container: HTMLElement,
    options: ScrollOptions = {}
  ): Promise<void> {
    const targetPosition = container.scrollHeight - container.clientHeight
    return this.scrollTo(container, targetPosition, options)
  }

  cancel(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
    this.isScrolling = false
  }

  get isActive(): boolean {
    return this.isScrolling
  }
}

// Debounce function for scroll events
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout)
    }
    
    timeout = setTimeout(() => {
      func(...args)
    }, wait)
  }
}

// Throttle function for scroll events
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

// Check if element is in viewport
export function isInViewport(element: HTMLElement, container: HTMLElement): boolean {
  const elementRect = element.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  
  return (
    elementRect.top >= containerRect.top &&
    elementRect.left >= containerRect.left &&
    elementRect.bottom <= containerRect.bottom &&
    elementRect.right <= containerRect.right
  )
}

// Get scroll position relative to container
export function getScrollPosition(container: HTMLElement): {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
  scrollPercentage: number
  isAtTop: boolean
  isAtBottom: boolean
} {
  const scrollTop = container.scrollTop
  const scrollHeight = container.scrollHeight
  const clientHeight = container.clientHeight
  const scrollPercentage = (scrollTop / (scrollHeight - clientHeight)) * 100
  
  return {
    scrollTop,
    scrollHeight,
    clientHeight,
    scrollPercentage,
    isAtTop: scrollTop <= 5,
    isAtBottom: scrollTop + clientHeight >= scrollHeight - 5
  }
}

// Smooth scroll hook with momentum
export function useSmoothScroll() {
  const scroller = new SmoothScroller()
  
  return {
    scrollTo: scroller.scrollTo.bind(scroller),
    scrollToElement: scroller.scrollToElement.bind(scroller),
    scrollToBottom: scroller.scrollToBottom.bind(scroller),
    cancel: scroller.cancel.bind(scroller),
    isScrolling: scroller.isActive
  }
}