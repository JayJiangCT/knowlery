// Minimal force-directed layout (repulsion + spring edges + centering) for
// the export scope graph. Runs a fixed number of ticks — no graph library
// needed at the 10-100 node scale of §13.3's audited closure range.

export interface GraphNodeInput {
  id: string;
}

export interface GraphEdgeInput {
  from: string;
  to: string;
}

export interface NodePosition {
  x: number;
  y: number;
}

export function computeGraphLayout(
  nodes: GraphNodeInput[],
  edges: GraphEdgeInput[],
  options: { width: number; height: number; iterations?: number },
): Map<string, NodePosition> {
  const { width, height } = options;
  const iterations = options.iterations ?? 220;
  const positions = new Map<string, NodePosition & { vx: number; vy: number }>();
  const angleStep = (2 * Math.PI) / Math.max(nodes.length, 1);

  nodes.forEach((node, index) => {
    positions.set(node.id, {
      x: width / 2 + Math.cos(index * angleStep) * Math.min(width, height) * 0.32,
      y: height / 2 + Math.sin(index * angleStep) * Math.min(width, height) * 0.32,
      vx: 0,
      vy: 0,
    });
  });

  const nodeIds = nodes.map((node) => node.id);
  const springEdges = edges.filter((edge) => positions.has(edge.from) && positions.has(edge.to));
  const edgeTargetLen = 92;
  const repulsion = 1900;
  // Dense closures need stronger centering, otherwise repulsion piles nodes
  // up against the clamped boundary (visible as corner clusters).
  const gravity = nodes.length > 60 ? 0.006 : 0.002;

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const a = positions.get(nodeIds[i])!;
        const b = positions.get(nodeIds[j])!;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distSq = Math.max(dx * dx + dy * dy, 1);
        const dist = Math.sqrt(distSq);
        const force = repulsion / distSq;
        a.vx += (dx / dist) * force;
        a.vy += (dy / dist) * force;
        b.vx -= (dx / dist) * force;
        b.vy -= (dy / dist) * force;
      }
    }

    for (const edge of springEdges) {
      const a = positions.get(edge.from)!;
      const b = positions.get(edge.to)!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const diff = (dist - edgeTargetLen) * 0.02;
      a.vx += (dx / dist) * diff;
      a.vy += (dy / dist) * diff;
      b.vx -= (dx / dist) * diff;
      b.vy -= (dy / dist) * diff;
    }

    positions.forEach((p) => {
      p.vx += (width / 2 - p.x) * gravity;
      p.vy += (height / 2 - p.y) * gravity;
      p.vx *= 0.85;
      p.vy *= 0.85;
      p.x = Math.max(28, Math.min(width - 28, p.x + p.vx));
      p.y = Math.max(24, Math.min(height - 30, p.y + p.vy));
    });
  }

  return new Map(Array.from(positions.entries(), ([id, p]) => [id, { x: p.x, y: p.y }]));
}
