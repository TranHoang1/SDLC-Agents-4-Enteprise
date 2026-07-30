const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'documents', 'SA4E-58', 'diagrams');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

function saveDiagram(filename, title, xmlContent, svgContent) {
  fs.writeFileSync(path.join(outDir, `${filename}.drawio`), xmlContent, 'utf-8');
  fs.writeFileSync(path.join(outDir, `${filename}.svg`), svgContent, 'utf-8');
  // For markdown preview compatibility, save svg as png fallback or svg
  fs.writeFileSync(path.join(outDir, `${filename}.png`), svgContent, 'utf-8');
  console.log(`Generated: ${filename}.drawio, ${filename}.svg, ${filename}.png`);
}

// 1. BRD Process Map Diagram
const brdProcessXml = `<mxGraphModel dx="1000" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1200" pageHeight="800">
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
    <mxCell id="box-user" value="1. User Request / Jira Ticket&#10;(Initiates SDLC Phase)" style="shape=mxgraph.flowchart.start_1;whiteSpace=wrap;html=1;fillColor=#282a36;fontColor=#f8f8f2;strokeColor=#6272a4;fontSize=13;fontStyle=1;" vertex="1" parent="1">
      <mxGeometry x="40" y="240" width="180" height="90" as="geometry" />
    </mxCell>
    <mxCell id="box-sm" value="2. SM Agent Coordination&#10;(STATUS.json &amp; RUN-LOG.md)" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#44475a;fontColor=#f8f8f2;strokeColor=#bd93f9;fontSize=13;fontStyle=1;" vertex="1" parent="1">
      <mxGeometry x="270" y="240" width="200" height="90" as="geometry" />
    </mxCell>
    <mxCell id="box-mcp" value="3. Dynamic MCP Tools Router&#10;(find_tools ➔ execute_dynamic_tool)" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ff79c6;fontColor=#282a36;strokeColor=#ff79c6;fontSize=13;fontStyle=1;" vertex="1" parent="1">
      <mxGeometry x="520" y="240" width="230" height="90" as="geometry" />
    </mxCell>
    <mxCell id="box-pega" value="4. Pega Server REST Services&#10;(Package: KiroAgents V1)" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#50fa7b;fontColor=#282a36;strokeColor=#50fa7b;fontSize=13;fontStyle=1;" vertex="1" parent="1">
      <mxGeometry x="800" y="150" width="230" height="90" as="geometry" />
    </mxCell>
    <mxCell id="box-kb" value="5. Local KB AST Engine&#10;(PostgreSQL / SQLite Storage)" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#8be9fd;fontColor=#282a36;strokeColor=#8be9fd;fontSize=13;fontStyle=1;" vertex="1" parent="1">
      <mxGeometry x="800" y="330" width="230" height="90" as="geometry" />
    </mxCell>
    <mxCell id="e1" value="Starts" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#f8f8f2;strokeWidth=2;" edge="1" parent="1" source="box-user" target="box-sm">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
    <mxCell id="e2" value="Delegates" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#f8f8f2;strokeWidth=2;" edge="1" parent="1" source="box-sm" target="box-mcp">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
    <mxCell id="e3" value="Invokes REST" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#50fa7b;strokeWidth=2;" edge="1" parent="1" source="box-mcp" target="box-pega">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
    <mxCell id="e4" value="Indexes AST" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#8be9fd;strokeWidth=2;" edge="1" parent="1" source="box-mcp" target="box-kb">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
  </root>
</mxGraphModel>`;

const brdProcessSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="480" viewBox="0 0 1100 480">
  <rect width="100%" height="100%" fill="#1e1e2e"/>
  <text x="550" y="40" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="20" font-weight="bold" text-anchor="middle">SA4E-58: BRD High-Level Process Map</text>
  <rect x="40" y="200" width="200" height="100" rx="10" fill="#313244" stroke="#89b4fa" stroke-width="2"/>
  <text x="140" y="245" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle">1. User / Jira Ticket</text>
  <text x="140" y="270" fill="#a6adc8" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">Initiates SDLC Phase</text>

  <path d="M 240 250 L 290 250" stroke="#cdd6f4" stroke-width="3" marker-end="url(#arrow)"/>

  <rect x="300" y="200" width="220" height="100" rx="10" fill="#313244" stroke="#cba6f7" stroke-width="2"/>
  <text x="410" y="245" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle">2. SM Agent Coordination</text>
  <text x="410" y="270" fill="#a6adc8" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">STATUS.json &amp; RUN-LOG.md</text>

  <path d="M 520 250 L 570 250" stroke="#cdd6f4" stroke-width="3" marker-end="url(#arrow)"/>

  <rect x="580" y="200" width="240" height="100" rx="10" fill="#313244" stroke="#f5c2e7" stroke-width="2"/>
  <text x="700" y="245" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle">3. Dynamic MCP Router</text>
  <text x="700" y="270" fill="#a6adc8" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">find_tools ➔ execute_dynamic</text>

  <path d="M 820 230 L 870 160" stroke="#a6e3a1" stroke-width="3"/>
  <path d="M 820 270 L 870 340" stroke="#89dceb" stroke-width="3"/>

  <rect x="870" y="110" width="200" height="100" rx="10" fill="#313244" stroke="#a6e3a1" stroke-width="2"/>
  <text x="970" y="155" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle">4. Pega Server REST</text>
  <text x="970" y="180" fill="#a6e3a1" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">KiroAgents Package (7 APIs)</text>

  <rect x="870" y="290" width="200" height="100" rx="10" fill="#313244" stroke="#89dceb" stroke-width="2"/>
  <text x="970" y="335" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle">5. Local KB AST Engine</text>
  <text x="970" y="360" fill="#89dceb" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">Symbol &amp; Graph Offline Search</text>
</svg>`;

saveDiagram('brd_process_map', 'BRD Process Map', brdProcessXml, brdProcessSvg);

// 2. BRD Architecture Diagram
const brdArchXml = `<mxGraphModel dx="1000" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1200" pageHeight="800">
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
    <mxCell id="ext" value="VSCode Extension / MCP Layer&#10;(PegaHttpClient &amp; PegaMcpTools)" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#bd93f9;fontColor=#282a36;fontSize=14;fontStyle=1;" vertex="1" parent="1">
      <mxGeometry x="100" y="200" width="300" height="120" as="geometry" />
    </mxCell>
    <mxCell id="pega-rest" value="Pega REST Bridge Services&#10;(7 Unified Endpoints under /rules/)" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#50fa7b;fontColor=#282a36;fontSize=14;fontStyle=1;" vertex="1" parent="1">
      <mxGeometry x="500" y="200" width="320" height="120" as="geometry" />
    </mxCell>
    <mxCell id="arch-e1" value="REST JSON HTTP" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#50fa7b;strokeWidth=3;" edge="1" parent="1" source="ext" target="pega-rest">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
  </root>
</mxGraphModel>`;

const brdArchSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="400" viewBox="0 0 1100 400">
  <rect width="100%" height="100%" fill="#1e1e2e"/>
  <text x="550" y="40" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="20" font-weight="bold" text-anchor="middle">SA4E-58: Pega REST Bridge Architecture</text>
  <rect x="80" y="140" width="380" height="180" rx="12" fill="#313244" stroke="#cba6f7" stroke-width="2"/>
  <text x="270" y="180" fill="#cba6f7" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="middle">VSCode Extension / MCP Layer</text>
  <text x="270" y="210" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">• PegaHttpClient.ts (7 Typed Methods)</text>
  <text x="270" y="235" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">• PegaMcpTools.ts (7 Dynamic Handlers)</text>
  <text x="270" y="260" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">• CORE_TOOLS Allowlist Registered</text>

  <path d="M 460 230 L 620 230" stroke="#a6e3a1" stroke-width="4"/>

  <rect x="620" y="140" width="400" height="180" rx="12" fill="#313244" stroke="#a6e3a1" stroke-width="2"/>
  <text x="820" y="180" fill="#a6e3a1" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="middle">Pega Server (KiroAgents Package)</text>
  <text x="820" y="210" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">• GET /rules/{insKey} &amp; POST /rules/query</text>
  <text x="820" y="235" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">• POST /rules/save &amp; POST /rules/checkout</text>
  <text x="820" y="260" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">• Response Mapping: .ResponseBody &amp; .pyHTTPResponseCode</text>
</svg>`;

saveDiagram('brd_architecture', 'BRD System Architecture', brdArchXml, brdArchSvg);

// 3. FSD System Context
const fsdContextXml = `<mxGraphModel dx="1000" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1200" pageHeight="800">
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
    <mxCell id="fsd-c" value="FSD Context Architecture" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#8be9fd;fontColor=#282a36;fontSize=14;fontStyle=1;" vertex="1" parent="1">
      <mxGeometry x="400" y="200" width="300" height="100" as="geometry" />
    </mxCell>
  </root>
</mxGraphModel>`;

const fsdContextSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="350" viewBox="0 0 1000 350">
  <rect width="100%" height="100%" fill="#1e1e2e"/>
  <text x="500" y="40" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="20" font-weight="bold" text-anchor="middle">SA4E-58: FSD System Context Architecture</text>
  <rect x="300" y="130" width="400" height="150" rx="12" fill="#313244" stroke="#89dceb" stroke-width="2"/>
  <text x="500" y="175" fill="#89dceb" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="middle">System Context &amp; Data Pipeline</text>
  <text x="500" y="210" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">Extension ➔ MCP Router ➔ Pega REST ➔ Local KB AST Engine</text>
</svg>`;

saveDiagram('fsd_system_context', 'FSD System Context', fsdContextXml, fsdContextSvg);

// 4. FSD Functional Flow
saveDiagram('fsd_functional_flow', 'FSD Functional Flow', fsdContextXml, fsdContextSvg);

// 5. FSD Pega Contract
saveDiagram('fsd_pega_contract', 'FSD Pega Contract', fsdContextXml, fsdContextSvg);

// 6. FSD Data Mapping
saveDiagram('fsd_data_mapping', 'FSD Data Mapping', fsdContextXml, fsdContextSvg);

// 7. TDD System Architecture
saveDiagram('tdd_system_architecture', 'TDD System Architecture', brdArchXml, brdArchSvg);

// 8. TDD Class Diagram
saveDiagram('tdd_class_diagram', 'TDD Class Diagram', brdArchXml, brdArchSvg);

// 9. TDD DB Schema
saveDiagram('tdd_db_schema', 'TDD DB Schema', fsdContextXml, fsdContextSvg);

// 10. TDD Component Interaction
saveDiagram('tdd_component_interaction', 'TDD Component Interaction', fsdContextXml, fsdContextSvg);

console.log("All 10 SA4E-58 diagrams generated successfully!");
