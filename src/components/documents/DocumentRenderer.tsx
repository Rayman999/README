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

// Text is escaped by React. Authors cannot supply HTML, CSS, scripts, SVG,
// arbitrary attributes, resource URLs, or executable component names.
export function DocumentRenderer({ document }: { document: ReadmeDocument }) {
  return <div className="readme-document">{document.blocks.map((block, i) => {
    switch (block.type) {
      case "heading": return block.level === 2 ? <h2 key={i} id={`doc-section-${i}`}>{block.text}</h2> : <h3 key={i} id={`doc-section-${i}`}>{block.text}</h3>;
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
    }
  })}</div>;
}
