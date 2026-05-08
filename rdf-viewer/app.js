const LABEL_PRED  = "http://www.w3.org/2000/01/rdf-schema#label";
const FOAF_NAME   = "http://xmlns.com/foaf/0.1/name";
const TYPE_PRED   = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const SUBCLASS    = "http://www.w3.org/2000/01/rdf-schema#subClassOf";
const LABEL_PREDS = new Set([LABEL_PRED, FOAF_NAME]);

let cy = null;

function shortName(uri) {
    if (!uri) return "";
    const hash = uri.lastIndexOf("#");
    const slash = uri.lastIndexOf("/");
    return uri.slice(Math.max(hash, slash) + 1) || uri;
}

function showError(msg) {
    document.getElementById("detail-content").innerHTML =
        `<p style="color:#f87171;font-weight:600">Error</p><p style="color:#cbd5e1;margin-top:6px;word-break:break-word">${msg}</p>`;
}

function parseAndRender(content) {
    if (typeof N3 === "undefined") {
        showError("N3.js failed to load. Check your internet connection.");
        return;
    }
    if (typeof cytoscape === "undefined") {
        showError("Cytoscape.js failed to load. Check your internet connection.");
        return;
    }

    const parser = new N3.Parser({ format: "Turtle" });
    const quads = [];

    parser.parse(content, (err, quad) => {
        if (err) {
            showError("Parse error: " + err.message);
            return;
        }
        if (quad) {
            quads.push(quad);
            return;
        }

        // quad === null signals parsing is complete
        if (quads.length === 0) {
            showError("No triples found. Make sure the file is valid Turtle (.ttl) format.");
            return;
        }

        const labels = {};
        quads.forEach(q => {
            if (LABEL_PREDS.has(q.predicate.value) && q.object.termType === "Literal") {
                labels[q.subject.value] = q.object.value;
            }
        });

        const nodeSet = new Set();
        const edges = [];

        quads.forEach(q => {
            const s = q.subject.value;
            const p = q.predicate.value;
            const o = q.object.value;

            if (q.subject.termType === "BlankNode" || q.object.termType === "BlankNode") return;
            if (LABEL_PREDS.has(p)) return;
            if (q.object.termType === "Literal") return;

            nodeSet.add(s);
            nodeSet.add(o);
            edges.push({ s, p, o });
        });

        const nodes = [...nodeSet].map(uri => ({
            data: { id: uri, label: labels[uri] || shortName(uri), uri }
        }));

        const edgeEls = edges.map((e, i) => ({
            data: { id: `e${i}`, source: e.s, target: e.o, label: shortName(e.p), predicate: e.p }
        }));

        document.getElementById("stats").textContent =
            `${nodes.length} nodes · ${edgeEls.length} edges · ${quads.length} triples`;
        document.getElementById("empty-state").style.display = "none";

        if (cy) cy.destroy();

        cy = cytoscape({
            container: document.getElementById("cy"),
            elements: { nodes, edges: edgeEls },
            style: [
                {
                    selector: "node",
                    style: {
                        "background-color": "#7c3aed",
                        "label": "data(label)",
                        "color": "#e2e8f0",
                        "text-valign": "center",
                        "text-halign": "center",
                        "font-size": "11px",
                        "width": "label",
                        "height": "label",
                        "padding": "10px",
                        "shape": "round-rectangle",
                        "text-wrap": "wrap",
                        "text-max-width": "120px"
                    }
                },
                {
                    selector: "node:selected",
                    style: { "background-color": "#a78bfa", "border-width": 2, "border-color": "#fff" }
                },
                {
                    selector: "edge",
                    style: {
                        "width": 1.5,
                        "line-color": "#334155",
                        "target-arrow-color": "#334155",
                        "target-arrow-shape": "triangle",
                        "curve-style": "bezier",
                        "label": "data(label)",
                        "font-size": "9px",
                        "color": "#64748b",
                        "text-background-color": "#0f1117",
                        "text-background-opacity": 1,
                        "text-background-padding": "2px"
                    }
                },
                {
                    selector: "edge:selected",
                    style: { "line-color": "#7c3aed", "target-arrow-color": "#7c3aed" }
                }
            ],
            layout: { name: "breadthfirst", animate: true, directed: false, padding: 30, spacingFactor: 1.4 }
        });

        cy.on("tap", "node", evt => showDetail("node", evt.target.data()));
        cy.on("tap", "edge", evt => showDetail("edge", evt.target.data()));
        cy.on("tap", evt => { if (evt.target === cy) clearDetail(); });
    });
}

function showDetail(type, data) {
    const el = document.getElementById("detail-content");
    if (type === "node") {
        el.innerHTML = `
            <p><span class="label">Label:</span><br><span class="value">${data.label}</span></p>
            <p><span class="label">URI:</span><br><span class="value">${data.uri}</span></p>
        `;
    } else {
        el.innerHTML = `
            <p><span class="label">Predicate:</span><br><span class="value">${data.label}</span></p>
            <p><span class="label">Full URI:</span><br><span class="value">${data.predicate}</span></p>
            <p><span class="label">From:</span><br><span class="value">${shortName(data.source)}</span></p>
            <p><span class="label">To:</span><br><span class="value">${shortName(data.target)}</span></p>
        `;
    }
}

function clearDetail() {
    document.getElementById("detail-content").innerHTML =
        "<p style='color:#334155'>Click a node or edge to inspect it.</p>";
}

function loadFile(file) {
    document.getElementById("filename").textContent = file.name;
    const reader = new FileReader();
    reader.onload = e => parseAndRender(e.target.result);
    reader.readAsText(file);
}

document.addEventListener("DOMContentLoaded", () => {
    clearDetail();

    document.getElementById("file-input").addEventListener("change", e => {
        if (e.target.files[0]) loadFile(e.target.files[0]);
    });

    // Drag and drop
    const overlay = document.getElementById("drop-overlay");
    document.addEventListener("dragover", e => { e.preventDefault(); overlay.classList.add("active"); });
    document.addEventListener("dragleave", e => { if (!e.relatedTarget) overlay.classList.remove("active"); });
    document.addEventListener("drop", e => {
        e.preventDefault();
        overlay.classList.remove("active");
        if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
    });
});
