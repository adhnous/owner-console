import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState<boolean>(false)

  React.useEffect(() => {
    // Early return for server-side rendering
    if (typeof window === "undefined" || typeof matchMedia === "undefined") {
      return
    }

    try {
      const mediaQuery = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`
      const mediaQueryList = window.matchMedia(mediaQuery)
      
      const handleChange = (event: MediaQueryListEvent) => {
        setIsMobile(event.matches)
      }

      // Set initial value
      setIsMobile(mediaQueryList.matches)

      // Modern browsers
      if (mediaQueryList.addEventListener) {
        mediaQueryList.addEventListener("change", handleChange)
        return () => {
          mediaQueryList.removeEventListener("change", handleChange)
        }
      } 
      // Legacy browsers
      else if (mediaQueryList.addListener) {
        mediaQueryList.addListener(handleChange)
        return () => {
          mediaQueryList.removeListener(handleChange)
        }
      }
    } catch (error) {
      console.error("Error setting up mobile detection:", error)
      // Fallback to window resize as last resort
      const handleResize = () => {
        setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
      }
      
      handleResize() // Set initial value
      window.addEventListener("resize", handleResize)
      return () => {
        window.removeEventListener("resize", handleResize)
      }
    }
  }, [])

  return isMobile
}