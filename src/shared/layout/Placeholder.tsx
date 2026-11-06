import { ScreenState } from '@/shared/ui/ScreenState';

/**
 * A Prompt 1 route shell. Prompt 1 item 9 asks for "placeholder screens for every route";
 * Prompts 2 to 5 fill them.
 *
 * It is not a blank div. PRD 15.8 describes what a shell owes the reader even before it has
 * data -- "A shell says plainly what will fill it and when, in the 15.4 empty-state pattern:
 * what appears here, and the one action or condition that fills it" -- and that is the only
 * part of 15.8's shell requirement that applies to Phase 1 under FD-20.
 */
export function Placeholder({ title, body }: { title: string; body: string }) {
  return <ScreenState kind="empty" title={title} body={body} />;
}
