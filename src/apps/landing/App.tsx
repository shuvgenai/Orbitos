import { COPY } from './data';
import { DemoCard } from './DemoCard';

/**
 * The root page, per orbitcrew-landing-page-content.md section 2 -- approved content,
 * reproduced verbatim except for the brand casing (FD-5; errata L-1 to L-8).
 *
 * TWO sign-in entries, on the founder's instruction of 2026-11-06 (FD-30), reversing the
 * earlier single-link decision: a team member and an Org Admin need different destinations,
 * and listing two portals is not the oracle Prompt 1.5 guards against -- it reveals that two
 * portals exist, not which role an account holds. The generic failure message and
 * refuse-never-redirect are untouched by it.
 *
 * Both are subordinate to "Request your office", which stays the page's one primary action.
 * There is no "Sign up": the spec is explicit that there is no public self-signup.
 *
 * THE OPERATOR SIGN-IN IS NOT HERE, in markup, comment or bundle. Operators know their URL.
 *
 * LAYOUT, after the founder's report of content being clipped (FD-30):
 *   - The page scrolls vertically. The spec's "one screen, no scrolling" is OVERRIDDEN,
 *     because a fixed single screen is what forced content outside the viewport. Content
 *     decides the height; the viewport does not clip it. The fit check is gone.
 *   - Zero horizontal overflow at any width, which needs `min-w-0` on both grid children:
 *     a grid item defaults to `min-width: auto`, so its widest unbreakable child -- here the
 *     ten-chip row -- pushed the track wider than the viewport instead of wrapping.
 *   - Two columns at 860px and up, stacked below it, hero first.
 */
export function App() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <header className="border-b border-line">
        {/* flex-wrap, so the actions drop to a second line rather than off the right edge */}
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <p className="text-base font-semibold">{COPY.brand}</p>
          <nav aria-label="Sign in" className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <a
              href="/login"
              className="flex min-h-touch items-center rounded-button px-2 text-base underline-offset-4 hover:underline"
            >
              {COPY.signIn}
            </a>
            <a
              href="/org/login"
              className="flex min-h-touch items-center rounded-button px-2 text-base underline-offset-4 hover:underline"
            >
              {COPY.orgAdminSignIn}
            </a>
            {/* The spec hides this on phones; the hero button carries it there. */}
            <a
              href={COPY.mailto}
              className="hidden min-h-touch items-center rounded-button border border-line px-4 text-base hover:bg-paper sm:flex"
            >
              {COPY.requestCta}
            </a>
          </nav>
        </div>
      </header>

      <main
        id="main"
        className="mx-auto grid w-full max-w-6xl flex-1 content-start gap-8 px-4 py-8 sm:px-6 shell:grid-cols-2 shell:content-center shell:gap-10"
      >
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl shell:text-4xl">
            {COPY.headline}
          </h1>
          <p className="mt-4 text-base text-muted">{COPY.subhead}</p>

          <div className="mt-6">
            <a
              href={COPY.mailto}
              className="inline-flex min-h-approve items-center justify-center rounded-button border border-ink bg-ink px-5 text-base font-medium text-paper hover:bg-ink/90"
            >
              {COPY.requestCta}
            </a>
            <p className="mt-2 text-base text-muted">{COPY.buttonNote}</p>
          </div>

          {/* Three lines under the button. A plain list, per PRD 15.2. */}
          <ul className="mt-6">
            {COPY.trust.map((line) => (
              <li key={line} className="border-b border-line py-2 text-base last:border-b-0">
                {line}
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-0">
          <DemoCard />
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto w-full max-w-6xl px-4 py-3 text-base text-muted sm:px-6">
          <p>{COPY.footerLine}</p>
          <a
            href={`mailto:${COPY.footerEmail}`}
            className="inline-flex min-h-touch items-center underline-offset-4 hover:underline"
          >
            {COPY.footerEmail}
          </a>
        </div>
      </footer>
    </div>
  );
}
