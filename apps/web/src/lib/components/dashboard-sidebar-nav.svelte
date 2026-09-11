<script lang="ts" module>
  import LayoutDashboardIcon from "@lucide/svelte/icons/layout-dashboard";
  import KeyRoundIcon from "@lucide/svelte/icons/key-round";
  import ScrollTextIcon from "@lucide/svelte/icons/scroll-text";
  import MessageSquareIcon from "@lucide/svelte/icons/message-square";

  export const NAV_ITEMS = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboardIcon },
    { href: "/dashboard/keys", label: "API Keys", icon: KeyRoundIcon },
    { href: "/dashboard/logs", label: "Request Logs", icon: ScrollTextIcon },
    { href: "/dashboard/playground", label: "Playground", icon: MessageSquareIcon },
  ] as const;
</script>

<script lang="ts">
  import { page } from "$app/state";
  import { cn } from "$lib/utils";
</script>

<nav class="space-y-1">
  {#each NAV_ITEMS as item (item.href)}
    {@const Icon = item.icon}
    {@const isActive = page.url.pathname === item.href}
    <a
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      class={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon class="size-4" />
      {item.label}
    </a>
  {/each}
</nav>
