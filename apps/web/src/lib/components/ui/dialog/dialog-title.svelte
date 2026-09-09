<script lang="ts">
  import { Dialog as DialogPrimitive } from "bits-ui";
  import type { Snippet } from "svelte";
  import { cn } from "$lib/utils";

  interface Props extends DialogPrimitive.TitleProps {
    children?: Snippet;
  }

  let { class: className, children, ...restProps }: Props = $props();
</script>

<DialogPrimitive.Title
  class={cn("text-lg font-semibold tracking-tight", className)}
  {...restProps}
>
  {@render children?.()}
</DialogPrimitive.Title>
