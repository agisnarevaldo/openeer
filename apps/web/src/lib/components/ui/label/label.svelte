<script lang="ts">
  import { Label as LabelPrimitive } from "bits-ui";
  import type { Snippet } from "svelte";
  import { cn } from "$lib/utils";

  interface Props {
    class?: string;
    children?: Snippet;
    [key: string]: any;
  }

  let { class: className, children, ...restProps }: Props = $props();
</script>

<LabelPrimitive.Root
  class={cn(
    "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 select-none block mb-1.5",
    className
  )}
  {...restProps}
>
  {@render children?.()}
</LabelPrimitive.Root>
