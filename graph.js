const NODE_R = 6;

const graph = await fetch("graph.json").then((res) => res.json());
const simulation = ForceGraph();

const params = new URLSearchParams(window.location.search);
const noteName = params.get("name");

const highlightNodes = new Set();

let selectedNoteId = null;
let navigatedTo = false;
if (noteName) {
  const selectedNote = graph.nodes.find((node) => node.name === noteName);
  highlightNodes.add(selectedNote);
  selectedNoteId = selectedNote.id;

  for (const link of graph.links) {
    if (link.target === selectedNoteId || link.source === selectedNoteId) {
      const otherId =
        link.target === selectedNoteId ? link.source : link.target;
      highlightNodes.add(graph.nodes.find((node) => node.id === otherId));
    }
  }
}

const container = document.getElementById("graph");
simulation(container)
  .onNodeClick((node) => {
    window.top.location.href = node.url;
  })
  .nodeCanvasObjectMode((node) =>
    highlightNodes.has(node) ? "before" : undefined
  )
  .d3Force("charge", d3.forceManyBody().strength(-5.0))
  .nodeAutoColorBy("tag")
  .nodeVal("connectivity")
  .nodeCanvasObject((node, ctx) => {
    if (!navigatedTo && node.id === selectedNoteId) {
      navigatedTo = true;
      simulation.centerAt(node.x, node.y);
    }
    ctx.beginPath();
    ctx.arc(node.x, node.y, NODE_R * 1.0, 0, 2 * Math.PI, false);
    ctx.fillStyle = node.id === selectedNoteId ? "red" : "orange";
    ctx.fill();
  })
  .graphData(graph);
