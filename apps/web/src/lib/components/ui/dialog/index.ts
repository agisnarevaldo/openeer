import { Dialog as DialogPrimitive } from "bits-ui";

export const Root = DialogPrimitive.Root;
export const Trigger = DialogPrimitive.Trigger;
export const Close = DialogPrimitive.Close;

export { default as Content } from "./dialog-content.svelte";
export { default as Overlay } from "./dialog-overlay.svelte";
export { default as Title } from "./dialog-title.svelte";
export { default as Description } from "./dialog-description.svelte";
