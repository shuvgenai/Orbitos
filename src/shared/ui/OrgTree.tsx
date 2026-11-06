export type TreeNode = {
  id: string;
  title: string;
  subtitle?: string;
  onOpen?: () => void;
  children?: TreeNode[];
};

/**
 * An indented list at every width, with a real button per node.
 *
 * PRD 15.6 and 15.8: "rendered as an indented list at every width ... No drag-and-drop
 * canvas: 15.2 requires plain lists." The prototype's curved SVG connectors and its
 * drag-and-drop canvas are both parked (docs/backlog.md B-2, FD-19).
 */
export function OrgTree({ nodes, label }: { nodes: TreeNode[]; label: string }) {
  return (
    <div className="rounded-button border border-line bg-paper p-4">
      <ul aria-label={label} className="space-y-1">
        {nodes.map((n) => (
          <Node key={n.id} node={n} depth={0} />
        ))}
      </ul>
    </div>
  );
}

function Node({ node, depth }: { node: TreeNode; depth: number }) {
  const inner = (
    <>
      <span className="text-base font-medium">{node.title}</span>
      {node.subtitle ? <span className="block text-base text-muted">{node.subtitle}</span> : null}
    </>
  );
  const label = node.subtitle ? `${node.title}. ${node.subtitle}` : node.title;
  return (
    <li style={{ paddingLeft: depth * 20 }}>
      {node.onOpen ? (
        <button
          type="button"
          onClick={node.onOpen}
          aria-label={label}
          className="min-h-touch w-full rounded-button border border-line px-3 py-2 text-left hover:bg-canvas"
        >
          {inner}
        </button>
      ) : (
        <div className="min-h-touch rounded-button border border-line px-3 py-2">{inner}</div>
      )}
      {node.children?.length ? (
        <ul className="mt-1 space-y-1 border-l border-line">
          {node.children.map((c) => (
            <Node key={c.id} node={c} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
