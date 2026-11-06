import * as RadixTabs from '@radix-ui/react-tabs';

export function Tabs({
  value,
  onChange,
  tabs,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  tabs: ReadonlyArray<readonly [string, string]>;
  children: React.ReactNode;
}) {
  return (
    <RadixTabs.Root value={value} onValueChange={onChange}>
      <RadixTabs.List className="mb-4 flex gap-2 border-b border-line">
        {tabs.map(([v, label]) => (
          <RadixTabs.Trigger
            key={v}
            value={v}
            className="min-h-touch px-4 text-base data-[state=active]:border-b-2 data-[state=active]:border-ink data-[state=active]:font-medium"
          >
            {label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {children}
    </RadixTabs.Root>
  );
}

export const TabPanel = RadixTabs.Content;
