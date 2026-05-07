import { Match, Show, Switch, createMemo } from "solid-js"
import { Tooltip, type TooltipProps } from "@opencode-ai/ui/tooltip"
import { ProgressCircle } from "@opencode-ai/ui/progress-circle"
import { Button } from "@opencode-ai/ui/button"

import { useFile } from "@/context/file"
import { useLayout } from "@/context/layout"
import { useSync } from "@/context/sync"
import { useLanguage } from "@/context/language"
import { useSettings } from "@/context/settings"
import { useProviders } from "@/hooks/use-providers"
import { getSessionContextMetrics } from "@/components/session/session-context-metrics"
import { useSessionLayout } from "@/pages/session/session-layout"
import { createSessionTabs } from "@/pages/session/helpers"

interface SessionContextUsageProps {
  variant?: "button" | "indicator" | "bar"
  placement?: TooltipProps["placement"]
}

function formatCompact(n: number): string {
  if (n < 1_000) return String(n)
  const [value, suffix] = n < 1_000_000 ? [n / 1_000, "k"] : [n / 1_000_000, "M"]
  if (value >= 100) return `${Math.round(value)}${suffix}`
  const decimals = value >= 10 ? 0 : 1
  return `${value.toFixed(decimals).replace(/\.0$/, "")}${suffix}`
}

function openSessionContext(args: {
  view: ReturnType<ReturnType<typeof useLayout>["view"]>
  layout: ReturnType<typeof useLayout>
  tabs: ReturnType<ReturnType<typeof useLayout>["tabs"]>
}) {
  if (!args.view.reviewPanel.opened()) args.view.reviewPanel.open()
  if (args.layout.fileTree.opened() && args.layout.fileTree.tab() !== "all") args.layout.fileTree.setTab("all")
  void args.tabs.open("context")
  args.tabs.setActive("context")
}

export function SessionContextUsage(props: SessionContextUsageProps) {
  const sync = useSync()
  const file = useFile()
  const layout = useLayout()
  const language = useLanguage()
  const settings = useSettings()
  const providers = useProviders()
  const { params, tabs, view } = useSessionLayout()

  const variant = createMemo(() => props.variant ?? "button")
  const tabState = createSessionTabs({
    tabs,
    pathFromTab: file.pathFromTab,
    normalizeTab: (tab) => (tab.startsWith("file://") ? file.tab(tab) : tab),
  })
  const messages = createMemo(() => (params.id ? (sync.data.message[params.id] ?? []) : []))

  const usd = createMemo(
    () =>
      new Intl.NumberFormat(language.intl(), {
        style: "currency",
        currency: "USD",
      }),
  )

  const metrics = createMemo(() => getSessionContextMetrics(messages(), providers.all()))
  const context = createMemo(() => metrics().context)
  const cost = createMemo(() => {
    return usd().format(metrics().totalCost)
  })

  const openContext = () => {
    if (!params.id) return

    if (tabState.activeTab() === "context") {
      tabs().close("context")
      return
    }
    openSessionContext({
      view: view(),
      layout,
      tabs: tabs(),
    })
  }

  const circle = () => (
    <div class="flex items-center justify-center">
      <ProgressCircle
        size={16}
        strokeWidth={2}
        percentage={context()?.usage ?? 0}
        class="[&_[data-slot=progress-circle-progress]]:[stroke:var(--text-base)]"
      />
    </div>
  )

  const barData = createMemo(() => {
    const ctx = context()
    if (!ctx || ctx.total == null) return null
    const pct = ctx.limit ? Math.min(100, Math.max(0, ctx.usage ?? 0)) : null
    const label = ctx.limit ? `${formatCompact(ctx.total)}/${formatCompact(ctx.limit)}` : formatCompact(ctx.total)
    return { pct, label }
  })

  const bar = () => (
    <Show when={barData()}>
      {(data) => (
        <div class="flex items-center gap-2 h-6 px-2 text-12-regular text-text-base">
          <Show when={data().pct != null}>
            <div
              class="relative h-2 w-16 sm:w-24 rounded-full overflow-hidden bg-surface-muted border border-border-base shrink-0"
              role="progressbar"
              aria-valuenow={data().pct!}
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <div class="absolute inset-y-0 left-0 bg-text-base" style={{ width: `${data().pct}%` }} />
            </div>
            <span class="tabular-nums shrink-0">{data().pct}%</span>
          </Show>
          <span class="hidden sm:inline tabular-nums text-text-muted shrink-0">{data().label}</span>
        </div>
      )}
    </Show>
  )

  const tooltipValue = () => (
    <div>
      <Show when={context()}>
        {(ctx) => (
          <>
            <div class="flex items-center gap-2">
              <span class="text-text-invert-strong">{ctx().total.toLocaleString(language.intl())}</span>
              <span class="text-text-invert-base">{language.t("context.usage.tokens")}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-text-invert-strong">{ctx().usage ?? 0}%</span>
              <span class="text-text-invert-base">{language.t("context.usage.usage")}</span>
            </div>
          </>
        )}
      </Show>
      <Show when={metrics().totalCost > 0}>
        <div class="flex items-center gap-2">
          <span class="text-text-invert-strong">{cost()}</span>
          <span class="text-text-invert-base">{language.t("context.usage.cost")}</span>
        </div>
      </Show>
    </div>
  )

  return (
    <Show when={params.id}>
      <Tooltip value={tooltipValue()} placement={props.placement ?? "top"}>
        <Switch>
          <Match when={variant() === "indicator"}>{circle()}</Match>
          <Match when={variant() === "bar" && settings.general.showContextUsageBar()}>
            <Button
              type="button"
              variant="ghost"
              class="p-0 h-6"
              onClick={openContext}
              aria-label={language.t("context.usage.view")}
            >
              {bar()}
            </Button>
          </Match>
          <Match when={variant() === "button"}>
            <Button
              type="button"
              variant="ghost"
              class="size-6"
              onClick={openContext}
              aria-label={language.t("context.usage.view")}
            >
              {circle()}
            </Button>
          </Match>
        </Switch>
      </Tooltip>
    </Show>
  )
}
