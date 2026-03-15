"use client"

import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useOnClickOutside } from "usehooks-ts"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface Tab {
  title: string
  icon: LucideIcon
  badge?: React.ReactNode
  type?: never
}

interface Separator {
  type: "separator"
  title?: never
  icon?: never
  badge?: never
}

type TabItem = Tab | Separator

interface ExpandableTabsProps {
  tabs: TabItem[]
  className?: string
  activeColor?: string
  selected?: number | null
  onChange?: (index: number | null) => void
}

const buttonVariants = {
  initial: {
    gap: 0,
    paddingLeft: ".5rem",
    paddingRight: ".5rem",
  },
  animate: (isSelected: boolean) => ({
    gap: isSelected ? ".5rem" : 0,
    paddingLeft: isSelected ? "1rem" : ".5rem",
    paddingRight: isSelected ? "1rem" : ".5rem",
  }),
}

const spanVariants = {
  initial: { width: 0, opacity: 0 },
  animate: { width: "auto", opacity: 1 },
  exit: { width: 0, opacity: 0 },
}

const transition = { delay: 0.1, type: "spring" as const, bounce: 0, duration: 0.6 }

export function ExpandableTabs({
  tabs,
  className,
  activeColor = "text-primary",
  selected: selectedProp,
  onChange,
}: ExpandableTabsProps) {
  const [selectedInternal, setSelectedInternal] = React.useState<number | null>(null)
  const selected = selectedProp !== undefined ? selectedProp : selectedInternal
  const outsideClickRef = React.useRef<HTMLDivElement>(null!)

  useOnClickOutside(outsideClickRef, () => {
    if (selectedProp === undefined) {
      setSelectedInternal(null)
      onChange?.(null)
    }
  })

  const handleSelect = (index: number) => {
    if (selectedProp === undefined) setSelectedInternal(index)
    onChange?.(index)
  }

  const TabSeparator = () => (
    <div className="mx-1 h-[24px] w-[1.2px] bg-gray-200" aria-hidden="true" />
  )

  return (
    <div
      ref={outsideClickRef}
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white p-1 shadow-sm",
        className
      )}
    >
      {tabs.map((tab, index) => {
        if (tab.type === "separator") {
          return <TabSeparator key={`separator-${index}`} />
        }

        const Icon = tab.icon
        const isSelected = selected === index
        return (
          <motion.button
            key={tab.title}
            variants={buttonVariants}
            initial={false}
            animate="animate"
            custom={isSelected}
            onClick={() => handleSelect(index)}
            transition={transition}
            className={cn(
              "relative flex items-center rounded-xl px-4 py-2 text-sm font-medium transition-colors duration-300",
              isSelected
                ? cn("bg-gray-100", activeColor)
                : "text-gray-400 hover:bg-gray-50 hover:text-gray-700"
            )}
          >
            <Icon size={18} />
            {tab.badge && !isSelected && (
              <span className="ml-1">{tab.badge}</span>
            )}
            <AnimatePresence initial={false}>
              {isSelected && (
                <motion.span
                  variants={spanVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={transition}
                  className="overflow-hidden whitespace-nowrap"
                >
                  {tab.title}
                  {tab.badge && <span className="ml-1.5">{tab.badge}</span>}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        )
      })}
    </div>
  )
}
