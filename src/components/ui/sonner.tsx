"use client"

import { useEffect, useState } from "react"
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

// El tema de la app es una clase `dark` en <html> (ver ThemeToggle), no
// next-themes: se observa esa clase para que los toasts acompañen.
function useTemaHtml(): "light" | "dark" {
  const [tema, setTema] = useState<"light" | "dark">("light")
  useEffect(() => {
    const root = document.documentElement
    const leer = () => setTema(root.classList.contains("dark") ? "dark" : "light")
    leer()
    const obs = new MutationObserver(leer)
    obs.observe(root, { attributes: true, attributeFilter: ["class"] })
    return () => obs.disconnect()
  }, [])
  return tema
}

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useTemaHtml()

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
