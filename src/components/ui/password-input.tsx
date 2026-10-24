'use client'

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"

export interface PasswordInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  wrapperClassName?: string
}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, wrapperClassName, disabled, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false)
    const innerRef = React.useRef<HTMLInputElement | null>(null)

    // Merge forwarded ref with local ref so we can preserve focus/cursor on toggle
    const setRefs = React.useCallback(
      (node: HTMLInputElement | null) => {
        innerRef.current = node
        if (typeof ref === 'function') {
          ref(node)
        } else if (ref) {
          ;(ref as React.MutableRefObject<HTMLInputElement | null>).current = node
        }
      },
      [ref]
    )

    const toggleVisibility = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()
      e.stopPropagation()
      
      const inputEl = innerRef.current
      const cursorStart = inputEl ? inputEl.selectionStart : null
      const cursorEnd = inputEl ? inputEl.selectionEnd : null

      setShowPassword(prev => !prev)

      // Restore focus and cursor position after re-render
      if (inputEl && document.activeElement === inputEl) {
        requestAnimationFrame(() => {
          inputEl.focus()
          if (cursorStart !== null && cursorEnd !== null) {
            try {
              inputEl.setSelectionRange(cursorStart, cursorEnd)
            } catch {}
          }
        })
      }
    }

    return (
      <div className={cn("relative w-full", wrapperClassName)}>
        <Input
          type={showPassword ? "text" : "password"}
          className={cn("pe-10 text-start", className)}
          ref={setRefs}
          disabled={disabled}
          {...props}
        />
        <button
          type="button"
          onClick={toggleVisibility}
          disabled={disabled}
          aria-label={showPassword ? "إخفاء كلمة المرور / Hide password" : "إظهار كلمة المرور / Show password"}
          title={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
          className="absolute inset-y-0 end-0 pe-3 flex items-center text-muted-foreground hover:text-foreground cursor-pointer focus:outline-none disabled:opacity-50 select-none"
          tabIndex={-1}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    )
  }
)
PasswordInput.displayName = "PasswordInput"

export { PasswordInput }
