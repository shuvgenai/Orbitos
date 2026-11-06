import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { COPY, DEPARTMENTS } from './data';

const tab = (name: string) => screen.getByRole('tab', { name });

describe('the page says what the content spec says', () => {
  it('leads with the headline and the one primary call to action', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(COPY.headline);
    const request = screen.getAllByRole('link', { name: COPY.requestCta });
    expect(request.length).toBeGreaterThan(0);
    for (const link of request) {
      expect(link.getAttribute('href')).toContain('mailto:shuv@orbitumai.com');
    }
  });

  it('carries the subhead, the button note, the three trust points and the footer', () => {
    render(<App />);
    expect(screen.getByText(COPY.subhead)).toBeInTheDocument();
    expect(screen.getByText(COPY.buttonNote)).toBeInTheDocument();
    for (const line of COPY.trust) expect(screen.getByText(line)).toBeInTheDocument();
    expect(screen.getByText(COPY.footerLine)).toBeInTheDocument();
  });

  it('offers no self-signup, because the spec says there is none', () => {
    const { container } = render(<App />);
    expect(container.textContent).not.toMatch(/sign\s*up/i);
  });

  it('spells the brand OrbitCrew, never the spec lowercase form (FD-5)', () => {
    const { container } = render(<App />);
    const text = container.innerHTML;
    expect(text).toContain('OrbitCrew');
    expect(text).not.toContain('Orbitcrew');
  });
});

describe('the two sign-in links', () => {
  it('offers the User and Org Admin sign-ins, and no third', () => {
    const { container } = render(<App />);
    expect(screen.getByRole('link', { name: COPY.signIn })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: COPY.orgAdminSignIn })).toHaveAttribute(
      'href',
      '/org/login',
    );

    // Exactly those two. FD-30: listing two portals reveals that two exist, not which role
    // an account holds -- but the operator sign-in is not named here at all.
    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href') ?? '');
    expect(hrefs.filter((h) => h.includes('login')).toSorted()).toEqual(['/login', '/org/login']);
  });

  it('names the operator console nowhere', () => {
    const { container } = render(<App />);
    const html = container.innerHTML;
    for (const word of ['superadmin', 'Super Admin', 'Operator', 'fleet', 'ORBIT-OS']) {
      expect(html.includes(word), `landing should not name ${word}`).toBe(false);
    }
  });

  it('are both secondary to the request call to action, not competing ones', () => {
    render(<App />);
    // The primary is a filled 48px button; neither sign-in link is.
    for (const name of [COPY.signIn, COPY.orgAdminSignIn]) {
      expect(screen.getByRole('link', { name }).className).not.toContain('bg-ink');
    }
    const hero = screen
      .getAllByRole('link', { name: COPY.requestCta })
      .find((l) => l.className.includes('bg-ink'));
    expect(hero).toBeTruthy();
    expect(hero!.className).toContain('min-h-approve');
  });
});

describe('the demo card', () => {
  it('shows all ten departments as tabs, Sales selected first', () => {
    render(<App />);
    expect(screen.getAllByRole('tab')).toHaveLength(10);
    expect(tab('Sales')).toHaveAttribute('aria-selected', 'true');
    for (const d of DEPARTMENTS) expect(tab(d.tab)).toBeInTheDocument();
  });

  it('shows that department three teammates and its one waiting item', () => {
    render(<App />);
    const sales = DEPARTMENTS[0]!;
    expect(screen.getByText(sales.coordinator)).toBeInTheDocument();
    expect(screen.getByText(sales.specialist)).toBeInTheDocument();
    expect(screen.getByText(sales.frontDesk)).toBeInTheDocument();
    expect(screen.getByText(sales.question)).toBeInTheDocument();
    expect(screen.getByText(COPY.needsApproval)).toBeInTheDocument();
  });

  it('switches content when another tab is chosen', async () => {
    render(<App />);
    await userEvent.click(tab('Legal'));
    const legal = DEPARTMENTS.find((d) => d.id === 'legal')!;
    expect(screen.getByText(legal.office)).toBeInTheDocument();
    expect(screen.getByText(legal.question)).toBeInTheDocument();
    expect(screen.queryByText(DEPARTMENTS[0]!.question)).not.toBeInTheDocument();
  });

  it('moves between tabs with the arrow keys', async () => {
    render(<App />);
    tab('Sales').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(tab('Marketing')).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowLeft}');
    expect(tab('Sales')).toHaveAttribute('aria-selected', 'true');
  });

  it('approves, and says what happened', async () => {
    render(<App />);
    const sales = DEPARTMENTS[0]!;
    await userEvent.click(screen.getByRole('button', { name: sales.approveLabel }));
    expect(screen.getByText(sales.approved)).toBeInTheDocument();
    expect(screen.getByText(COPY.approvedTag)).toBeInTheDocument();
  });

  it('holds, and says plainly that nothing was sent', async () => {
    render(<App />);
    const sales = DEPARTMENTS[0]!;
    await userEvent.click(screen.getByRole('button', { name: COPY.hold }));
    expect(screen.getByText(sales.held)).toBeInTheDocument();
    expect(screen.getByText(COPY.heldTag)).toBeInTheDocument();
  });

  it('undoes either choice', async () => {
    render(<App />);
    const sales = DEPARTMENTS[0]!;
    await userEvent.click(screen.getByRole('button', { name: sales.approveLabel }));
    await userEvent.click(screen.getByRole('button', { name: COPY.undo }));
    expect(screen.getByText(sales.question)).toBeInTheDocument();
    expect(screen.getByText(COPY.needsApproval)).toBeInTheDocument();
  });

  it('remembers each department decision separately', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: DEPARTMENTS[0]!.approveLabel }));
    await userEvent.click(tab('Finance'));
    // Finance is untouched, still asking.
    const finance = DEPARTMENTS.find((d) => d.id === 'finance')!;
    expect(screen.getByText(finance.question)).toBeInTheDocument();
    await userEvent.click(tab('Sales'));
    expect(screen.getByText(DEPARTMENTS[0]!.approved)).toBeInTheDocument();
  });

  it('announces the outcome, because the visitor is the one who changed it', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: DEPARTMENTS[0]!.approveLabel }));
    const live = screen.getByText(DEPARTMENTS[0]!.approved);
    expect(live.closest('[aria-live]')).not.toBeNull();
  });

  it('gives the approve action the 48px height (PRD 15.2)', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: DEPARTMENTS[0]!.approveLabel })).toHaveClass(
      'min-h-approve',
    );
  });

  it('carries the status in words, not by colour alone', async () => {
    render(<App />);
    const card = screen.getByRole('region', { name: /a day in one of your offices/i });
    expect(within(card).getByText(COPY.needsApproval)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: DEPARTMENTS[0]!.approveLabel }));
    expect(within(card).getByText(COPY.approvedTag)).toBeInTheDocument();
  });
});

describe('every department has complete copy', () => {
  it.each(DEPARTMENTS.map((d) => [d.tab, d] as const))('%s', (_tab, d) => {
    for (const [key, value] of Object.entries(d)) {
      expect(String(value).length, `${d.tab}.${key}`).toBeGreaterThan(0);
    }
    // The spec's rule for HR and Legal: the wording stays "drafts for you to approve".
    if (d.id === 'hr' || d.id === 'legal') expect(d.frontDesk).toMatch(/^Drafted /);
  });
});

/**
 * axe, structural only. jsdom computes no colours, so `color-contrast` cannot run here and
 * is disabled rather than left to report a false pass. The real-browser pass in both themes
 * is recorded in docs/auth.md's sibling section and in the report.
 */
describe('axe on the root page', () => {
  it('has no serious or critical violations', async () => {
    const { container } = render(<App />);
    const results = await axe.run(container, {
      resultTypes: ['violations'],
      rules: { 'color-contrast': { enabled: false } },
    });
    const bad = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(bad.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  }, 20_000);
});
