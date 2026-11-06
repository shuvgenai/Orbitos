import { useState } from 'react';
import { Button } from '@/shared/ui/Button';

/**
 * The invitation, as a link the operator can hand over by whatever means they already have.
 *
 * **NO EMAIL IS SENT, AND THIS SCREEN DOES NOT SAY ONE WAS.** There is no mail service in
 * this stack, inventing one is out of scope, and a toast reading "email sent" would be the
 * single most misleading thing on the operator console. FD-32 records the send as owed; the
 * subject and body are already written, at `shared/src/invite-email.ts`, in exactly the
 * shape `MailerPort.send` takes.
 *
 * The copy below says so in the operator's own words rather than in a code comment, because
 * the person who needs to know is the one reading the screen.
 */
export function InviteLink({ url, email }: { url: string; email: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // A denied clipboard permission is not a failure worth a banner: the link is on screen
      // and selectable, which is the fallback.
      setCopied(false);
    }
  };

  return (
    <section
      aria-label="Invitation link"
      className="mt-6 rounded-button border border-line bg-paper p-4"
    >
      <h2 className="text-base font-medium">Invitation for {email}</h2>
      <p className="mt-1 text-base text-muted">
        Nothing has been emailed. No mail service is connected yet, so send this link to them
        yourself. It works once and expires in 7 days.
      </p>
      <p className="mt-3 break-all rounded-button border border-line bg-canvas px-3 py-2 font-mono text-base">
        {url}
      </p>
      <div className="mt-3 flex items-center gap-3">
        <Button onClick={() => void copy()}>Copy invite link</Button>
        <output aria-live="polite" className="text-base text-muted">
          {copied ? 'Copied.' : ''}
        </output>
      </div>
    </section>
  );
}
