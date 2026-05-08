import * as React from "react"
import { cn } from "../../lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "destructive"
  size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400 disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-neutral-100 text-neutral-900 shadow hover:bg-neutral-200": variant === "default",
            "border border-neutral-700 bg-transparent hover:bg-neutral-800 text-neutral-100": variant === "outline",
            "hover:bg-neutral-800 hover:text-neutral-50 text-neutral-100": variant === "ghost",
            "bg-red-900 text-neutral-50 hover:bg-red-900/90": variant === "destructive",
            "h-9 px-4 py-2": size === "default",
            "h-8 rounded-md px-3 text-xs": size === "sm",
            "h-10 rounded-md px-8": size === "lg",
            "h-9 w-9": size === "icon",
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
