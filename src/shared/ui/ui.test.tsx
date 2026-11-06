import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Banner } from './Banner';
import { Button } from './Button';
import { Chip } from './Chip';
import { Field, Select, Textarea } from './Field';
import { Drawer, Modal } from './Layer';
import { OrgTree } from './OrgTree';
import { Pill, StatusPill } from './Pill';
import { ProgressBar } from './ProgressBar';
import { ScreenState } from './ScreenState';
import { Sparkline } from './Sparkline';
import { StatList } from './StatList';
import { Stepper } from './Stepper';
import { Table } from './Table';
import { TabPanel, Tabs } from './Tabs';
import { ToastProvider, useToast } from './Toast';

/* ----------------------------------------------------------------- the size rules */

describe('Button — PRD 15.2 target sizes', () => {
  it('is at least 44px, and Approve at least 48px', () => {
    render(
      <>
        <Button>Save</Button>
        <Button approve>Approve and start</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('min-h-touch');
    expect(screen.getByRole('button', { name: 'Approve and start' })).toHaveClass('min-h-approve');
  });

  it('is a real button, so the keyboard reaches it', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Press</Button>);
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Press' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalled();
  });

  it('does not fire while disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Continue
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------------------------- Drawer and Modal */

function DrawerHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open editor
      </button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Edit instructions"
        footer={<Button variant="primary">Save changes</Button>}
      >
        <label htmlFor="inside">Instructions</label>
        <input id="inside" />
      </Drawer>
    </>
  );
}

describe('Drawer — focus trap, Escape and focus restore (Prompt 1 item 7)', () => {
  it('is announced as a modal dialog with its title', async () => {
    render(<DrawerHarness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open editor' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByText('Edit instructions')).toBeInTheDocument();
  });

  it('keeps Tab inside it', async () => {
    render(<DrawerHarness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open editor' }));
    const dialog = await screen.findByRole('dialog');
    // Tab around the whole dialog twice; focus must never leave it.
    for (let i = 0; i < 8; i += 1) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it('closes on Escape and gives focus back to what opened it', async () => {
    render(<DrawerHarness />);
    const opener = screen.getByRole('button', { name: 'Open editor' });
    await userEvent.click(opener);
    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
  });

  it('closes on the Close button', async () => {
    render(<DrawerHarness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open editor' }));
    await screen.findByRole('dialog');
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('Modal — a decision is an alertdialog', () => {
  it('uses the alertdialog role when asked', async () => {
    render(
      <Modal open onClose={() => {}} title="Disconnect Slack?" alert>
        <p>Agents that need it will pause.</p>
      </Modal>,
    );
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
  });
});

/* ----------------------------------------------------------------------- Toast */

function ToastHarness() {
  const { notify } = useToast();
  return (
    <button type="button" onClick={() => notify('Scout updated')}>
      Save
    </button>
  );
}

describe('Toast — aria-live (Prompt 1 item 7)', () => {
  it('announces politely without taking focus', async () => {
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    );
    const save = screen.getByRole('button', { name: 'Save' });
    await userEvent.click(save);
    const live = await screen.findByText('Scout updated');
    expect(live.closest('output')).toHaveAttribute('aria-live', 'polite');
    // Focus stays where it was: a toast never steals it.
    expect(save).toHaveFocus();
  });
});

/* --------------------------------------------------------------------- Stepper */

describe('Stepper — aria-current="step" (Prompt 1 item 7)', () => {
  const steps = [
    { n: 1, title: 'Org structure', blurb: 'Who is on the board', done: true, locked: false },
    { n: 2, title: 'Agents', blurb: 'Hire your teammates', done: false, locked: false },
    { n: 3, title: 'Assign', blurb: 'Give every agent an owner', done: false, locked: true },
  ];

  it('marks only the current step', () => {
    render(<Stepper steps={steps} current={2} onGo={() => {}} />);
    const current = screen.getByRole('button', { name: /Agents/ });
    expect(current).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('button', { name: /Org structure/ })).not.toHaveAttribute('aria-current');
  });

  it('disables a locked step and lets an unlocked one through', async () => {
    const onGo = vi.fn();
    render(<Stepper steps={steps} current={2} onGo={onGo} />);
    expect(screen.getByRole('button', { name: /Assign/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /Org structure/ }));
    expect(onGo).toHaveBeenCalledWith(1);
  });
});

/* ------------------------------------------------------------------------ Chip */

describe('Chip — aria-pressed', () => {
  it('reports its state and toggles on Enter', async () => {
    const onToggle = vi.fn();
    render(
      <Chip pressed={false} onToggle={onToggle}>
        Slack
      </Chip>,
    );
    const chip = screen.getByRole('button', { name: 'Slack' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    chip.focus();
    await userEvent.keyboard('{Enter}');
    expect(onToggle).toHaveBeenCalled();
  });

  it('cannot be toggled when disabled — Appendix A.2 unavailable connectors', async () => {
    const onToggle = vi.fn();
    render(
      <Chip pressed={false} onToggle={onToggle} disabled title="Coming soon">
        WhatsApp
      </Chip>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'WhatsApp' }));
    expect(onToggle).not.toHaveBeenCalled();
  });
});

/* ----------------------------------------------------------------------- Field */

describe('Field, Textarea and Select — label, help and error wiring', () => {
  it('links the label, announces the error and marks the control invalid', () => {
    render(
      <Field
        label="Email"
        help="We send the invitation here."
        error="Needs a valid email."
        value="broken"
        onChange={() => {}}
      />,
    );
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Needs a valid email.');
    expect(input).toHaveAccessibleDescription(/We send the invitation here\./);
  });

  it('reports typing through onChange', async () => {
    const onChange = vi.fn();
    render(<Field label="Name" value="" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Name'), 'Maria');
    expect(onChange).toHaveBeenCalled();
  });

  it('exposes a textarea and a select by their labels', async () => {
    const onChange = vi.fn();
    render(
      <>
        <Textarea label="Instructions" value="" onChange={() => {}} />
        <Select
          label="Department"
          value="d1"
          onChange={onChange}
          options={[
            ['d1', 'Sales'],
            ['d2', 'Finance'],
          ]}
        />
      </>,
    );
    expect(screen.getByLabelText('Instructions')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Department'), 'd2');
    expect(onChange).toHaveBeenCalledWith('d2');
  });

  it('makes a read-only textarea read-only — the user cannot edit guardrails', () => {
    render(<Textarea label="Guardrails" value="Never email customers." onChange={() => {}} readOnly />);
    expect(screen.getByLabelText('Guardrails')).toHaveAttribute('readonly');
  });
});

/* ----------------------------------------------------------------------- Table */

type Row = { id: string; name: string; runs: number };
const rows: Row[] = [
  { id: 'a', name: 'Orbi', runs: 4 },
  { id: 'b', name: 'Sales Analyst', runs: 14 },
];

describe('Table — aria-sort, and rows reachable by keyboard', () => {
  it('reports the sorted column and direction', () => {
    render(
      <Table<Row>
        caption="Performance"
        rows={rows}
        rowKey={(r) => r.id}
        sort={{ key: 'runs', dir: -1 }}
        onSort={() => {}}
        columns={[
          { key: 'name', header: 'Agent', sortable: true, render: (r) => r.name },
          { key: 'runs', header: 'Runs', sortable: true, align: 'right', render: (r) => r.runs },
        ]}
      />,
    );
    const headers = screen.getAllByRole('columnheader');
    expect(headers[0]).toHaveAttribute('aria-sort', 'none');
    expect(headers[1]).toHaveAttribute('aria-sort', 'descending');
  });

  it('opens a row with Enter and with Space', async () => {
    const onRowActivate = vi.fn();
    render(
      <Table<Row>
        caption="Performance"
        rows={rows}
        rowKey={(r) => r.id}
        onRowActivate={onRowActivate}
        rowLabel={(r) => `${r.name}, ${r.runs} runs`}
        columns={[{ key: 'name', header: 'Agent', render: (r) => r.name }]}
      />,
    );
    const row = screen.getByRole('button', { name: 'Orbi, 4 runs' });
    row.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onRowActivate).toHaveBeenCalledTimes(2);
  });

  it('sorts when a header is activated', async () => {
    const onSort = vi.fn();
    render(
      <Table<Row>
        caption="Performance"
        rows={rows}
        rowKey={(r) => r.id}
        onSort={onSort}
        columns={[{ key: 'name', header: 'Agent', sortable: true, render: (r) => r.name }]}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Agent' }));
    expect(onSort).toHaveBeenCalledWith('name');
  });
});

/* ------------------------------------------------------------------ OrgTree */

describe('OrgTree — an indented list, every node a real button', () => {
  it('labels each node with its title and subtitle', async () => {
    const onOpen = vi.fn();
    render(
      <OrgTree
        label="Org chart"
        nodes={[
          {
            id: 'orbi',
            title: 'Orbi',
            subtitle: 'Running. Routing 3 new tasks',
            onOpen,
            children: [{ id: 'sa', title: 'Sales Analyst', subtitle: 'Idle' }],
          },
        ]}
      />,
    );
    const node = screen.getByRole('button', { name: 'Orbi. Running. Routing 3 new tasks' });
    await userEvent.click(node);
    expect(onOpen).toHaveBeenCalled();
    expect(screen.getByText('Sales Analyst')).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------- Tabs */

describe('Tabs', () => {
  it('exposes tabs and shows the selected panel', async () => {
    const onChange = vi.fn();
    render(
      <Tabs
        value="team"
        onChange={onChange}
        tabs={[
          ['team', 'Team'],
          ['assign', 'Assignments'],
        ]}
      >
        <TabPanel value="team">Team panel</TabPanel>
        <TabPanel value="assign">Assignments panel</TabPanel>
      </Tabs>,
    );
    expect(screen.getByRole('tab', { name: 'Team' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Team panel')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Assignments' }));
    expect(onChange).toHaveBeenCalledWith('assign');
  });
});

/* ------------------------------------------------- the no-tile and state rules */

describe('StatList — the replacement for KPI tiles (PRD 15.2)', () => {
  it('renders a description list, not a grid of cards', () => {
    const { container } = render(
      <StatList
        label="Summary"
        stats={[
          { label: 'Running now', value: 1, of: 'of 3' },
          { label: 'Spent today', value: '$1.97' },
        ]}
      />,
    );
    expect(container.querySelector('dl')).toBeInTheDocument();
    expect(screen.getByText('Running now')).toBeInTheDocument();
    expect(screen.getByText('of 3')).toBeInTheDocument();
  });
});

describe('ScreenState — PRD 15.4 six states', () => {
  it('loading is skeleton rows and is announced as busy, not a spinner', () => {
    render(<ScreenState kind="loading" rows={2} />);
    const live = screen.getByText('Loading').closest('output');
    expect(live).toHaveAttribute('aria-busy', 'true');
  });

  it('error is a plain sentence with no status code', () => {
    render(<ScreenState kind="error" />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Nothing was changed.');
    expect(alert.textContent).not.toMatch(/\b[45]\d\d\b/);
  });

  it('office paused says what is happening to waiting work', () => {
    render(<ScreenState kind="office-paused" />);
    expect(screen.getByText(/stays waiting/)).toBeInTheDocument();
  });

  it('not yours previews no content', () => {
    render(<ScreenState kind="not-yours" />);
    expect(screen.getByText(/Ask your Org Admin/)).toBeInTheDocument();
  });

  it('already decided says which and what happens now', () => {
    render(<ScreenState kind="decided" />);
    expect(screen.getByText('Already decided')).toBeInTheDocument();
  });

  it('empty names the one action that fills it', () => {
    render(
      <ScreenState
        kind="empty"
        title="No agents assigned yet"
        body="Ask your Org Admin to assign one."
        action={<Button variant="primary">Request an agent</Button>}
      />,
    );
    expect(screen.getByRole('button', { name: 'Request an agent' })).toBeInTheDocument();
  });
});

/* ------------------------------------------------------- the remaining small ones */

describe('Pill, StatusPill, ProgressBar, Sparkline, Banner', () => {
  it('names a status in words, never by colour alone', () => {
    render(<StatusPill status="waiting" />);
    expect(screen.getByText('Waiting for approval')).toBeInTheDocument();
  });

  it('renders a plain pill', () => {
    render(<Pill tone="ok">Connected</Pill>);
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('uses a native progress element with a label', () => {
    render(<ProgressBar value={43} label="Hiring your team" />);
    const bar = screen.getByRole('progressbar', { name: 'Hiring your team' });
    expect(bar).toHaveAttribute('value', '43');
  });

  it('gives the sparkline numbers to a screen reader', () => {
    render(<Sparkline data={[1, 2, 3]} label="Runs" />);
    expect(screen.getByText('Runs: 1, 2, 3')).toBeInTheDocument();
  });

  it('announces a status banner through an output element', () => {
    render(<Banner live="status">Your office is live.</Banner>);
    expect(screen.getByText('Your office is live.').closest('output')).toBeInTheDocument();
  });

  it('announces an error banner as an alert', () => {
    render(<Banner tone="error">Could not create the workspace.</Banner>);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not create the workspace.');
  });
});
