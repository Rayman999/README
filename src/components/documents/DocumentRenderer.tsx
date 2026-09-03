import * as React from "react";
import type { DocumentBlock, ReadmeDocument } from "@/lib/documents/schema";

const number = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });

function Chart({ block }: { block: Extract<DocumentBlock, { type: "chart" }> }) {
  const max = Math.max(1, ...block.data.map((item) => item.value));
  const points = block.data.map((item, i) => ({
    x: block.data.length === 1 ? 300 : 40 + (i / (block.data.length - 1)) * 520,
    y: 180 - (item.value / max) * 150,
  }));
  return (
    <figure className="rd-chart">
      <figcaption>{block.title}{block.unit && <span className="rd-unit">{block.unit}</span>}</figcaption>
      {block.variant === "bar" ? (
        <div className="rd-bars" aria-hidden="true">
          {block.data.map((item, i) => <div className="rd-bar-row" key={i}>
            <span>{item.label}</span>
            <div className="rd-bar-track"><div className="rd-bar-fill" style={{ width: `${(item.value / max) * 100}%` }} /></div>
            <span>{number.format(item.value)}</span>
          </div>)}
        </div>
      ) : (
        <div aria-hidden="true">
          <svg viewBox="0 0 600 215" className="rd-line-chart">
            {[30, 105, 180].map((y) => <line key={y} x1="40" x2="560" y1={y} y2={y} className="rd-gridline" />)}
            <text x="0" y="34">{number.format(max)}</text><text x="10" y="184">0</text>
            <polyline points={points.map((p) => `${p.x},${p.y}`).join(" ")} className="rd-line" />
            {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4" className="rd-dot"><title>{`${block.data[i].label}: ${block.data[i].value}`}</title></circle>)}
          </svg>
          <p className="rd-chart-range">{block.data[0].label} → {block.data[block.data.length - 1].label}</p>
        </div>
      )}
      <details className="rd-chart-data"><summary>View chart data</summary>
        <div className="rd-table-scroll"><table><caption>{block.title}{block.unit ? ` (${block.unit})` : ""}</caption><thead><tr><th scope="col">Label</th><th scope="col">Value</th></tr></thead><tbody>{block.data.map((item, i) => <tr key={i}><th scope="row">{item.label}</th><td>{item.value}</td></tr>)}</tbody></table></div>
      </details>
    </figure>
  );
}

// --- diagrams -------------------------------------------------------------

const NODE_H = 62, GAP_MAIN = 54, GAP_CROSS = 26, ARROW = 7;

/**
 * Ranks nodes by longest path from a source, so a flow reads in the order it
 * actually happens rather than the order it was declared. Nodes left unranked
 * are part of a cycle; they are appended in declaration order so a diagram with
 * a loop still renders something truthful instead of failing.
 */
function rankNodes(block: Extract<DocumentBlock, { type: "diagram" }>) {
  const rank = new Map(block.nodes.map((node) => [node.id, 0]));
  const pending = new Map(block.nodes.map((node) => [node.id, 0]));
  const edges = block.edges.filter((edge) => edge.from !== edge.to);
  for (const edge of edges) pending.set(edge.to, (pending.get(edge.to) ?? 0) + 1);

  let frontier = block.nodes.filter((node) => pending.get(node.id) === 0).map((node) => node.id);
  const placed = new Set(frontier);
  while (frontier.length) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const edge of edges) {
        if (edge.from !== id) continue;
        rank.set(edge.to, Math.max(rank.get(edge.to) ?? 0, (rank.get(id) ?? 0) + 1));
        pending.set(edge.to, (pending.get(edge.to) ?? 1) - 1);
        if (pending.get(edge.to) === 0 && !placed.has(edge.to)) { placed.add(edge.to); next.push(edge.to); }
      }
    }
    frontier = next;
  }
  let trailing = Math.max(0, ...rank.values());
  for (const node of block.nodes) if (!placed.has(node.id)) rank.set(node.id, ++trailing);
  return rank;
}

function Diagram({ block }: { block: Extract<DocumentBlock, { type: "diagram" }> }) {
  const down = block.direction !== "right";
  const rank = rankNodes(block);

  // One width for every box, sized to the longest text in this diagram, so
  // labels stay inside their box without the boxes looking ragged. The schema
  // caps label and detail lengths such that the result never exceeds the max.
  const NODE_W = Math.min(320, Math.max(150, Math.round(Math.max(
    ...block.nodes.map((node) => Math.max(node.label.length * 7, (node.detail?.length ?? 0) * 5.6)),
  ) + 28)));

  const rows = new Map<number, string[]>();
  for (const node of block.nodes) {
    const r = rank.get(node.id) ?? 0;
    rows.set(r, [...(rows.get(r) ?? []), node.id]);
  }
  const widest = Math.max(...[...rows.values()].map((row) => row.length));
  const depth = rows.size;

  const box = new Map<string, { x: number; y: number }>();
  for (const [r, row] of rows) {
    const offset = ((widest - row.length) * (down ? NODE_W + GAP_CROSS : NODE_H + GAP_CROSS)) / 2;
    row.forEach((id, i) => {
      const along = r * ((down ? NODE_H : NODE_W) + GAP_MAIN);
      const across = offset + i * ((down ? NODE_W : NODE_H) + GAP_CROSS);
      box.set(id, down ? { x: across, y: along } : { x: along, y: across });
    });
  }

  const width = down ? widest * NODE_W + (widest - 1) * GAP_CROSS : depth * NODE_W + (depth - 1) * GAP_MAIN;
  const height = down ? depth * NODE_H + (depth - 1) * GAP_MAIN : widest * NODE_H + (widest - 1) * GAP_CROSS;

  return (
    <figure className="rd-diagram">
      <figcaption>{block.title}</figcaption>
      <div className="rd-diagram-scroll" tabIndex={0} role="region" aria-label={block.title}>
        <svg viewBox={`-1 -1 ${width + 2} ${height + 2}`} width={width} height={height} className="rd-diagram-svg" aria-hidden="true">
          {block.edges.map((edge, i) => {
            const from = box.get(edge.from), to = box.get(edge.to);
            if (!from || !to || edge.from === edge.to) return null;
            // Orthogonal routing with a single elbow at the midpoint: lines stay
            // on axis, so crossings read as crossings rather than as noise.
            const start = down ? { x: from.x + NODE_W / 2, y: from.y + NODE_H } : { x: from.x + NODE_W, y: from.y + NODE_H / 2 };
            const end = down ? { x: to.x + NODE_W / 2, y: to.y - ARROW } : { x: to.x - ARROW, y: to.y + NODE_H / 2 };
            const mid = down ? (start.y + end.y) / 2 : (start.x + end.x) / 2;
            const path = down
              ? `M ${start.x} ${start.y} L ${start.x} ${mid} L ${end.x} ${mid} L ${end.x} ${end.y}`
              : `M ${start.x} ${start.y} L ${mid} ${start.y} L ${mid} ${end.y} L ${end.x} ${end.y}`;
            const head = down
              ? `${end.x},${end.y + ARROW} ${end.x - 4.5},${end.y} ${end.x + 4.5},${end.y}`
              : `${end.x + ARROW},${end.y} ${end.x},${end.y - 4.5} ${end.x},${end.y + 4.5}`;
            const label = edge.label;
            const lx = down ? (start.x + end.x) / 2 : mid;
            const ly = down ? mid : (start.y + end.y) / 2;
            return (
              <g key={i}>
                <path d={path} className="rd-diagram-edge" />
                <polygon points={head} className="rd-diagram-head" />
                {label && <>
                  <rect x={lx - (label.length * 3.1 + 6)} y={ly - 9} width={label.length * 6.2 + 12} height={18} rx={5} className="rd-diagram-label-bg" />
                  <text x={lx} y={ly + 4} textAnchor="middle" className="rd-diagram-label">{label}</text>
                </>}
              </g>
            );
          })}
          {block.nodes.map((node) => {
            const at = box.get(node.id)!;
            return (
              <g key={node.id} className={`rd-diagram-node rd-role-${node.role}`}>
                <rect x={at.x} y={at.y} width={NODE_W} height={NODE_H} rx={10} />
                <text x={at.x + NODE_W / 2} y={node.detail ? at.y + 27 : at.y + 36} textAnchor="middle" className="rd-diagram-title">{node.label}</text>
                {node.detail && <text x={at.x + NODE_W / 2} y={at.y + 44} textAnchor="middle" className="rd-diagram-detail">{node.detail}</text>}
              </g>
            );
          })}
        </svg>
      </div>
      {/* The diagram is aria-hidden; this is what a screen reader and the
          search index actually get. */}
      <details className="rd-chart-data">
        <summary>Describe this diagram</summary>
        <ol>
          {block.edges.map((edge, i) => {
            const from = block.nodes.find((n) => n.id === edge.from), to = block.nodes.find((n) => n.id === edge.to);
            return <li key={i}>{from?.label ?? edge.from} → {to?.label ?? edge.to}{edge.label ? ` (${edge.label})` : ""}</li>;
          })}
        </ol>
      </details>
    </figure>
  );
}

// Text is escaped by React. Authors cannot supply HTML, CSS, scripts, SVG,
// arbitrary attributes, resource URLs, or executable component names.
export function DocumentRenderer({ document }: { document: ReadmeDocument }) {
  return <div className="readme-document">{document.blocks.map((block, i) => {
    switch (block.type) {
      case "heading": {
        // Every section gets a copyable address. Documentation is quoted and
        // linked into conversations constantly, and a heading you cannot point
        // at forces people to describe where to scroll instead.
        const id = `doc-section-${i}`;
        const anchor = <a href={`#${id}`} className="rd-anchor" aria-label={`Link to ${block.text}`}>#</a>;
        return block.level === 2
          ? <h2 key={i} id={id}>{block.text}{anchor}</h2>
          : <h3 key={i} id={id}>{block.text}{anchor}</h3>;
      }
      case "paragraph": return <p key={i} className="rd-text">{block.text}</p>;
      case "list": return block.ordered ? <ol key={i}>{block.items.map((item, j) => <li key={j}>{item}</li>)}</ol> : <ul key={i}>{block.items.map((item, j) => <li key={j}>{item}</li>)}</ul>;
      case "callout": return <aside key={i} className={`rd-callout rd-tone-${block.tone}`}><span className="rd-eyebrow">{block.tone}</span><h3>{block.title}</h3><p className="rd-text">{block.text}</p></aside>;
      case "code": return <figure key={i} className="rd-code"><figcaption>{block.language || "Code"}</figcaption><pre><code>{block.code}</code></pre></figure>;
      case "table": return <div key={i} className="rd-table-scroll" tabIndex={0} role="region" aria-label={block.title}><table><caption>{block.title}</caption><thead><tr>{block.columns.map((column, j) => <th key={j} scope="col">{column}</th>)}</tr></thead><tbody>{block.rows.map((row, j) => <tr key={j}>{row.map((value, k) => <td key={k}>{value}</td>)}</tr>)}</tbody></table></div>;
      case "cards": return <div key={i} className="rd-cards">{block.items.map((item, j) => <section key={j} className="rd-card"><h3>{item.title}</h3><p className="rd-text">{item.text}</p></section>)}</div>;
      case "metrics": return <dl key={i} className="rd-metrics">{block.items.map((item, j) => <div key={j}><dt>{item.label}</dt><dd>{item.value}</dd>{item.detail && <dd className="rd-metric-detail">{item.detail}</dd>}</div>)}</dl>;
      case "timeline": return <ol key={i} className="rd-timeline">{block.items.map((item, j) => <li key={j}><h3>{item.title}</h3><p className="rd-text">{item.text}</p></li>)}</ol>;
      case "details": return <details key={i} className="rd-details"><summary>{block.title}</summary><p className="rd-text">{block.text}</p></details>;
      case "chart": return <Chart key={i} block={block} />;
      case "diagram": return <Diagram key={i} block={block} />;
    }
  })}</div>;
}
