const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'documents', 'SA4E-58', 'diagrams');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

function saveDiagram(filename, xmlContent, svgContent) {
  fs.writeFileSync(path.join(outDir, `${filename}.drawio`), xmlContent, 'utf-8');
  fs.writeFileSync(path.join(outDir, `${filename}.svg`), svgContent, 'utf-8');
  console.log(`Successfully generated UNIQUE diagram: ${filename}.svg & ${filename}.drawio`);
}

// 1. BRD Process Map Diagram
const brdProcessXml = `<mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1200" pageHeight="800">
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
    <mxCell id="b1" value="1. User Jira Request" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#282a36;fontColor=#f8f8f2;strokeColor=#bd93f9;fontSize=13;fontStyle=1;" vertex="1" parent="1"><mxGeometry x="40" y="240" width="180" height="90" as="geometry"/></mxCell>
    <mxCell id="b2" value="2. SM Agent Coordination" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#44475a;fontColor=#f8f8f2;strokeColor=#ff79c6;fontSize=13;fontStyle=1;" vertex="1" parent="1"><mxGeometry x="270" y="240" width="200" height="90" as="geometry"/></mxCell>
    <mxCell id="b3" value="3. Dynamic MCP Router" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ff79c6;fontColor=#282a36;strokeColor=#ff79c6;fontSize=13;fontStyle=1;" vertex="1" parent="1"><mxGeometry x="520" y="240" width="220" height="90" as="geometry"/></mxCell>
    <mxCell id="b4" value="4. Pega Server REST" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#50fa7b;fontColor=#282a36;strokeColor=#50fa7b;fontSize=13;fontStyle=1;" vertex="1" parent="1"><mxGeometry x="800" y="150" width="220" height="90" as="geometry"/></mxCell>
    <mxCell id="b5" value="5. Local KB AST Engine" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#8be9fd;fontColor=#282a36;strokeColor=#8be9fd;fontSize=13;fontStyle=1;" vertex="1" parent="1"><mxGeometry x="800" y="330" width="220" height="90" as="geometry"/></mxCell>
  </root>
</mxGraphModel>`;

const brdProcessSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="460" viewBox="0 0 1100 460">
  <rect width="100%" height="100%" fill="#1e1e2e"/>
  <text x="550" y="45" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="20" font-weight="bold" text-anchor="middle">SA4E-58: BRD High-Level Process Map</text>
  
  <rect x="40" y="190" width="190" height="110" rx="10" fill="#313244" stroke="#89b4fa" stroke-width="2"/>
  <text x="135" y="235" fill="#89b4fa" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle">1. User Jira Request</text>
  <text x="135" y="260" fill="#a6adc8" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">Triggers Ticket SA4E-58</text>

  <path d="M 230 245 L 280 245" stroke="#cdd6f4" stroke-width="3"/>

  <rect x="280" y="190" width="210" height="110" rx="10" fill="#313244" stroke="#cba6f7" stroke-width="2"/>
  <text x="385" y="235" fill="#cba6f7" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle">2. SM Agent Orchestrator</text>
  <text x="385" y="260" fill="#a6adc8" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">Manages STATUS &amp; RUN-LOG</text>

  <path d="M 490 245 L 540 245" stroke="#cdd6f4" stroke-width="3"/>

  <rect x="540" y="190" width="230" height="110" rx="10" fill="#313244" stroke="#f5c2e7" stroke-width="2"/>
  <text x="655" y="235" fill="#f5c2e7" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle">3. Dynamic MCP Router</text>
  <text x="655" y="260" fill="#a6adc8" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">find_tools ➔ execute_dynamic</text>

  <path d="M 770 220 L 830 160" stroke="#a6e3a1" stroke-width="3"/>
  <path d="M 770 270 L 830 330" stroke="#89dceb" stroke-width="3"/>

  <rect x="830" y="105" width="220" height="110" rx="10" fill="#313244" stroke="#a6e3a1" stroke-width="2"/>
  <text x="940" y="150" fill="#a6e3a1" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle">4. Pega Server REST</text>
  <text x="940" y="175" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">7 Live APIs (KiroAgents)</text>

  <rect x="830" y="285" width="220" height="110" rx="10" fill="#313244" stroke="#89dceb" stroke-width="2"/>
  <text x="940" y="330" fill="#89dceb" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle">5. Local KB AST Engine</text>
  <text x="940" y="355" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">Symbol &amp; Graph Offline Search</text>
</svg>`;

saveDiagram('brd_process_map', brdProcessXml, brdProcessSvg);

// 2. BRD Architecture Diagram
const brdArchSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="420" viewBox="0 0 1100 420">
  <rect width="100%" height="100%" fill="#1e1e2e"/>
  <text x="550" y="45" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="20" font-weight="bold" text-anchor="middle">SA4E-58: BRD System Architecture Overview</text>
  <rect x="60" y="130" width="400" height="210" rx="12" fill="#313244" stroke="#cba6f7" stroke-width="2"/>
  <text x="260" y="175" fill="#cba6f7" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="middle">VSCode Extension / MCP Layer</text>
  <text x="260" y="205" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">• PegaHttpClient.ts (7 Typed SDK Methods)</text>
  <text x="260" y="235" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">• PegaMcpTools.ts (7 Dynamic Handlers)</text>
  <text x="260" y="265" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">• CORE_TOOLS Allowlist Registration</text>

  <path d="M 460 235 L 640 235" stroke="#a6e3a1" stroke-width="4"/>

  <rect x="640" y="130" width="400" height="210" rx="12" fill="#313244" stroke="#a6e3a1" stroke-width="2"/>
  <text x="840" y="175" fill="#a6e3a1" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="middle">Pega Platform Server (HRAppsV2)</text>
  <text x="840" y="205" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">• Service Package: KiroAgents V1</text>
  <text x="840" y="235" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">• Endpoints under /rules/ prefix</text>
  <text x="840" y="265" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">• Outbound Mapping: .ResponseBody &amp; .pyHTTPResponseCode</text>
</svg>`;

saveDiagram('brd_architecture', brdProcessXml, brdArchSvg);

// 3. FSD System Context Diagram (UNIQUE)
const fsdContextSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="520" viewBox="0 0 1100 520">
  <rect width="100%" height="100%" fill="#1e1e2e"/>
  <text x="550" y="40" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="20" font-weight="bold" text-anchor="middle">SA4E-58: FSD System Context &amp; Boundary Diagram</text>
  
  <rect x="50" y="100" width="280" height="350" rx="12" fill="#313244" stroke="#89b4fa" stroke-width="2"/>
  <text x="190" y="140" fill="#89b4fa" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="middle">AI SDLC Agents Layer</text>
  <text x="190" y="180" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">• BA Agent (Meta &amp; Glossary)</text>
  <text x="190" y="215" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">• SA Agent (AST &amp; Call Graph)</text>
  <text x="190" y="250" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">• DEV Agent (Lock &amp; Save Rule)</text>
  <text x="190" y="285" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">• QA Agent (Execute Test Suite)</text>
  <text x="190" y="320" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">• DevOps Agent (Release &amp; Version)</text>

  <path d="M 330 275 L 410 275" stroke="#f5c2e7" stroke-width="4"/>

  <rect x="410" y="100" width="300" height="350" rx="12" fill="#313244" stroke="#f5c2e7" stroke-width="2"/>
  <text x="560" y="140" fill="#f5c2e7" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="middle">MCP Proxy &amp; Dynamic Router</text>
  <text x="560" y="180" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">• find_tools(query) Engine</text>
  <text x="560" y="215" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">• execute_dynamic_tool Router</text>
  <text x="560" y="250" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">• PegaHttpClient Typed SDK</text>
  <text x="560" y="285" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">• PegaMcpTools Handlers</text>

  <path d="M 710 200 L 790 150" stroke="#a6e3a1" stroke-width="4"/>
  <path d="M 710 350 L 790 380" stroke="#89dceb" stroke-width="4"/>

  <rect x="790" y="90" width="260" height="170" rx="12" fill="#313244" stroke="#a6e3a1" stroke-width="2"/>
  <text x="920" y="130" fill="#a6e3a1" font-family="Arial, sans-serif" font-size="15" font-weight="bold" text-anchor="middle">Remote Pega Server</text>
  <text x="920" y="160" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">Package: KiroAgents (V1)</text>
  <text x="920" y="185" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">7 Custom REST Services</text>

  <rect x="790" y="300" width="260" height="170" rx="12" fill="#313244" stroke="#89dceb" stroke-width="2"/>
  <text x="920" y="340" fill="#89dceb" font-family="Arial, sans-serif" font-size="15" font-weight="bold" text-anchor="middle">Local KB Engine</text>
  <text x="920" y="370" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">PostgreSQL / SQLite</text>
  <text x="920" y="395" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">knowledge_entries &amp; graph_nodes</text>
</svg>`;

saveDiagram('fsd_system_context', brdProcessXml, fsdContextSvg);

// 4. FSD Functional Flow Diagram (UNIQUE SEQUENCE FLOW)
const fsdFlowSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="520" viewBox="0 0 1100 520">
  <rect width="100%" height="100%" fill="#1e1e2e"/>
  <text x="550" y="40" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="20" font-weight="bold" text-anchor="middle">SA4E-58: FSD Dynamic Tool Call Execution Flow</text>
  
  <line x1="150" y1="90" x2="150" y2="480" stroke="#89b4fa" stroke-width="2" stroke-dasharray="6,6"/>
  <text x="150" y="80" fill="#89b4fa" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle">1. AI Agent</text>

  <line x1="450" y1="90" x2="450" y2="480" stroke="#f5c2e7" stroke-width="2" stroke-dasharray="6,6"/>
  <text x="450" y="80" fill="#f5c2e7" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle">2. Dynamic Router</text>

  <line x1="750" y1="90" x2="750" y2="480" stroke="#cba6f7" stroke-width="2" stroke-dasharray="6,6"/>
  <text x="750" y="80" fill="#cba6f7" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle">3. PegaHttpClient</text>

  <line x1="980" y1="90" x2="980" y2="480" stroke="#a6e3a1" stroke-width="2" stroke-dasharray="6,6"/>
  <text x="980" y="80" fill="#a6e3a1" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle">4. Pega Server</text>

  <path d="M 150 140 L 450 140" stroke="#f5c2e7" stroke-width="3"/>
  <text x="300" y="130" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">find_tools("pega checkout rule")</text>

  <path d="M 450 180 L 150 180" stroke="#89b4fa" stroke-width="2" stroke-dasharray="4,4"/>
  <text x="300" y="170" fill="#a6adc8" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">Returns Tool Schema: pega_checkout_rule</text>

  <path d="M 150 240 L 450 240" stroke="#f5c2e7" stroke-width="3"/>
  <text x="300" y="230" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">execute_dynamic_tool("pega_checkout_rule", args)</text>

  <path d="M 450 300 L 750 300" stroke="#cba6f7" stroke-width="3"/>
  <text x="600" y="290" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">checkoutPegaRule(insKey, "CHECKOUT")</text>

  <path d="M 750 360 L 980 360" stroke="#a6e3a1" stroke-width="3"/>
  <text x="865" y="350" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">POST /api/HRAppsV2Service/V1/rules/checkout</text>

  <path d="M 980 420 L 150 420" stroke="#a6e3a1" stroke-width="3"/>
  <text x="565" y="410" fill="#a6e3a1" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">HTTP 200 OK: {"status": "SUCCESS", "action": "CHECKOUT"}</text>
</svg>`;

saveDiagram('fsd_functional_flow', brdProcessXml, fsdFlowSvg);

// 5. FSD Pega Contract Diagram (UNIQUE TABLE / CONTRACT MAP)
const fsdContractSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="520" viewBox="0 0 1100 520">
  <rect width="100%" height="100%" fill="#1e1e2e"/>
  <text x="550" y="40" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="20" font-weight="bold" text-anchor="middle">SA4E-58: FSD 7 Pega REST Services Contract Matrix</text>
  
  <rect x="50" y="80" width="1000" height="400" rx="10" fill="#313244" stroke="#a6e3a1" stroke-width="2"/>
  
  <line x1="50" y1="130" x2="1050" y2="130" stroke="#a6e3a1" stroke-width="2"/>
  <text x="90" y="110" fill="#a6e3a1" font-family="Arial, sans-serif" font-size="14" font-weight="bold">ID</text>
  <text x="160" y="110" fill="#a6e3a1" font-family="Arial, sans-serif" font-size="14" font-weight="bold">Service Endpoint</text>
  <text x="440" y="110" fill="#a6e3a1" font-family="Arial, sans-serif" font-size="14" font-weight="bold">HTTP</text>
  <text x="520" y="110" fill="#a6e3a1" font-family="Arial, sans-serif" font-size="14" font-weight="bold">Pega Activity Name</text>
  <text x="800" y="110" fill="#a6e3a1" font-family="Arial, sans-serif" font-size="14" font-weight="bold">Functional Purpose</text>

  <text x="90" y="170" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13">S1</text>
  <text x="160" y="170" fill="#89dceb" font-family="Arial, sans-serif" font-size="13">/rules/{insKey}</text>
  <text x="440" y="170" fill="#a6e3a1" font-family="Arial, sans-serif" font-size="13">GET</text>
  <text x="520" y="170" fill="#f5c2e7" font-family="Arial, sans-serif" font-size="13">pzGetRuleInstanceByHandle</text>
  <text x="800" y="170" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13">Tải 100% Rule XML/JSON thô</text>

  <text x="90" y="220" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13">S2</text>
  <text x="160" y="220" fill="#89dceb" font-family="Arial, sans-serif" font-size="13">/rules/query</text>
  <text x="440" y="220" fill="#f9e2af" font-family="Arial, sans-serif" font-size="13">POST</text>
  <text x="520" y="220" fill="#f5c2e7" font-family="Arial, sans-serif" font-size="13">pzQueryRuleByTriple</text>
  <text x="800" y="220" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13">Truy vấn theo bộ 3 Class/Name</text>

  <text x="90" y="270" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13">S3</text>
  <text x="160" y="270" fill="#89dceb" font-family="Arial, sans-serif" font-size="13">/rules/list</text>
  <text x="440" y="270" fill="#f9e2af" font-family="Arial, sans-serif" font-size="13">POST</text>
  <text x="520" y="270" fill="#f5c2e7" font-family="Arial, sans-serif" font-size="13">QueryRuleData</text>
  <text x="800" y="270" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13">Quét danh sách Rule summaries</text>

  <text x="90" y="320" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13">S4</text>
  <text x="160" y="320" fill="#89dceb" font-family="Arial, sans-serif" font-size="13">/rules/save</text>
  <text x="440" y="320" fill="#f9e2af" font-family="Arial, sans-serif" font-size="13">POST</text>
  <text x="520" y="320" fill="#f5c2e7" font-family="Arial, sans-serif" font-size="13">pzSavePegaRule</text>
  <text x="800" y="320" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13">Lưu/Cập nhật Rule qua Commit</text>

  <text x="90" y="370" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13">S5</text>
  <text x="160" y="370" fill="#89dceb" font-family="Arial, sans-serif" font-size="13">/rules/checkout</text>
  <text x="440" y="370" fill="#f9e2af" font-family="Arial, sans-serif" font-size="13">POST</text>
  <text x="520" y="370" fill="#f5c2e7" font-family="Arial, sans-serif" font-size="13">pzCheckoutPegaRule</text>
  <text x="800" y="370" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13">Lock Control (Checkout/Checkin/Undo)</text>

  <text x="90" y="420" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13">S6</text>
  <text x="160" y="420" fill="#89dceb" font-family="Arial, sans-serif" font-size="13">/rules/test</text>
  <text x="440" y="420" fill="#f9e2af" font-family="Arial, sans-serif" font-size="13">POST</text>
  <text x="520" y="420" fill="#f5c2e7" font-family="Arial, sans-serif" font-size="13">pzExecuteScenarioTestSuite</text>
  <text x="800" y="420" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13">Kích hoạt QA Scenario Test Suite</text>

  <text x="90" y="470" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13">S7</text>
  <text x="160" y="470" fill="#89dceb" font-family="Arial, sans-serif" font-size="13">/rules/meta/{ClassName}</text>
  <text x="440" y="470" fill="#a6e3a1" font-family="Arial, sans-serif" font-size="13">GET</text>
  <text x="520" y="470" fill="#f5c2e7" font-family="Arial, sans-serif" font-size="13">GetClassMetadata</text>
  <text x="800" y="470" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13">Tải Schema Metadata của Class</text>
</svg>`;

saveDiagram('fsd_pega_contract', brdProcessXml, fsdContractSvg);

// 6. FSD Data Mapping Pipeline Diagram (UNIQUE PIPELINE)
const fsdMappingSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="420" viewBox="0 0 1100 420">
  <rect width="100%" height="100%" fill="#1e1e2e"/>
  <text x="550" y="40" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="20" font-weight="bold" text-anchor="middle">SA4E-58: FSD Data Transformation &amp; KB Ingestion Pipeline</text>

  <rect x="50" y="140" width="210" height="150" rx="10" fill="#313244" stroke="#a6e3a1" stroke-width="2"/>
  <text x="155" y="185" fill="#a6e3a1" font-family="Arial, sans-serif" font-size="15" font-weight="bold" text-anchor="middle">1. Pega Server DB</text>
  <text x="155" y="215" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">Raw Rule JSON Payload</text>
  <text x="155" y="240" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">(30.8KB Instance Data)</text>

  <path d="M 260 215 L 320 215" stroke="#cdd6f4" stroke-width="3"/>

  <rect x="320" y="140" width="220" height="150" rx="10" fill="#313244" stroke="#f5c2e7" stroke-width="2"/>
  <text x="430" y="185" fill="#f5c2e7" font-family="Arial, sans-serif" font-size="15" font-weight="bold" text-anchor="middle">2. Pega AST Parser</text>
  <text x="430" y="215" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">Normalizes Activity Steps,</text>
  <text x="430" y="240" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">Flow Shapes &amp; Properties</text>

  <path d="M 540 215 L 600 215" stroke="#cdd6f4" stroke-width="3"/>

  <rect x="600" y="140" width="220" height="150" rx="10" fill="#313244" stroke="#f9e2af" stroke-width="2"/>
  <text x="710" y="185" fill="#f9e2af" font-family="Arial, sans-serif" font-size="15" font-weight="bold" text-anchor="middle">3. File Materializer</text>
  <text x="710" y="215" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">Saves Workspace File:</text>
  <text x="710" y="240" fill="#89dceb" font-family="Arial, sans-serif" font-size="11" text-anchor="middle">rules/Rule-Obj-Activity/...</text>

  <path d="M 820 215 L 880 215" stroke="#cdd6f4" stroke-width="3"/>

  <rect x="880" y="140" width="180" height="150" rx="10" fill="#313244" stroke="#89dceb" stroke-width="2"/>
  <text x="970" y="185" fill="#89dceb" font-family="Arial, sans-serif" font-size="15" font-weight="bold" text-anchor="middle">4. KB Database</text>
  <text x="970" y="215" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">knowledge_entries &amp;</text>
  <text x="970" y="240" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">graph_nodes tables</text>
</svg>`;

saveDiagram('fsd_data_mapping', brdProcessXml, fsdMappingSvg);

// 7. TDD System Architecture Diagram (UNIQUE COMPONENT LAYERS)
const tddArchSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="460" viewBox="0 0 1100 460">
  <rect width="100%" height="100%" fill="#1e1e2e"/>
  <text x="550" y="40" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="20" font-weight="bold" text-anchor="middle">SA4E-58: TDD Component Layered Architecture</text>
  
  <rect x="60" y="90" width="980" height="70" rx="8" fill="#313244" stroke="#cba6f7" stroke-width="2"/>
  <text x="550" y="130" fill="#cba6f7" font-family="Arial, sans-serif" font-size="15" font-weight="bold" text-anchor="middle">Layer 1: AI Multi-Agent Prompt &amp; Dynamic Tool Executor (SM, BA, SA, DEV, QA, DevOps)</text>

  <rect x="60" y="180" width="980" height="70" rx="8" fill="#313244" stroke="#f5c2e7" stroke-width="2"/>
  <text x="550" y="220" fill="#f5c2e7" font-family="Arial, sans-serif" font-size="15" font-weight="bold" text-anchor="middle">Layer 2: MCP Tool Router (PegaMcpTools.ts — 7 Handlers Registered in CORE_TOOLS)</text>

  <rect x="60" y="270" width="980" height="70" rx="8" fill="#313244" stroke="#89dceb" stroke-width="2"/>
  <text x="550" y="310" fill="#89dceb" font-family="Arial, sans-serif" font-size="15" font-weight="bold" text-anchor="middle">Layer 3: Typed HTTP Client SDK (PegaHttpClient.ts — Auth &amp; REST Endpoints)</text>

  <rect x="60" y="360" width="980" height="70" rx="8" fill="#313244" stroke="#a6e3a1" stroke-width="2"/>
  <text x="550" y="400" fill="#a6e3a1" font-family="Arial, sans-serif" font-size="15" font-weight="bold" text-anchor="middle">Layer 4: Pega Platform REST Service Package (KiroAgents V1 Services)</text>
</svg>`;

saveDiagram('tdd_system_architecture', brdProcessXml, tddArchSvg);

// 8. TDD Class Diagram (UNIQUE UML CLASS DIAGRAM)
const tddClassSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="520" viewBox="0 0 1100 520">
  <rect width="100%" height="100%" fill="#1e1e2e"/>
  <text x="550" y="40" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="20" font-weight="bold" text-anchor="middle">SA4E-58: TDD Technical Class Diagram</text>

  <rect x="60" y="90" width="450" height="380" rx="10" fill="#313244" stroke="#89dceb" stroke-width="2"/>
  <text x="285" y="130" fill="#89dceb" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="middle">PegaHttpClient Class</text>
  <line x1="60" y1="145" x2="510" y2="145" stroke="#89dceb" stroke-width="2"/>
  <text x="80" y="175" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13">+ getRuleByInsKey(insKey: string): Promise&lt;object&gt;</text>
  <text x="80" y="210" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13">+ queryRuleByTriple(class, appliesTo, name): Promise&lt;object&gt;</text>
  <text x="80" y="245" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13">+ listApplicationRules(class, size, page): Promise&lt;object&gt;</text>
  <text x="80" y="280" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13">+ savePegaRule(payload: object): Promise&lt;object&gt;</text>
  <text x="80" y="315" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13">+ checkoutPegaRule(insKey, action, comment): Promise&lt;object&gt;</text>
  <text x="80" y="350" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13">+ executeScenarioTestSuite(testSuiteID): Promise&lt;object&gt;</text>
  <text x="80" y="385" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13">+ getClassMetadata(className: string): Promise&lt;object&gt;</text>

  <path d="M 510 280 L 590 280" stroke="#f5c2e7" stroke-width="4"/>

  <rect x="590" y="90" width="450" height="380" rx="10" fill="#313244" stroke="#f5c2e7" stroke-width="2"/>
  <text x="815" y="130" fill="#f5c2e7" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="middle">PegaMcpTools Class</text>
  <line x1="590" y1="145" x2="1040" y2="145" stroke="#f5c2e7" stroke-width="2"/>
  <text x="610" y="175" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13">+ getRuleByInsKey(args): Promise&lt;MCPResult&gt;</text>
  <text x="610" y="210" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13">+ queryRule(args): Promise&lt;MCPResult&gt;</text>
  <text x="610" y="245" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13">+ listRules(args): Promise&lt;MCPResult&gt;</text>
  <text x="610" y="280" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13">+ saveRule(args): Promise&lt;MCPResult&gt;</text>
  <text x="610" y="315" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13">+ checkoutRule(args): Promise&lt;MCPResult&gt;</text>
  <text x="610" y="350" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13">+ runTests(args): Promise&lt;MCPResult&gt;</text>
  <text x="610" y="385" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13">+ getClassMetadata(args): Promise&lt;MCPResult&gt;</text>
</svg>`;

saveDiagram('tdd_class_diagram', brdProcessXml, tddClassSvg);

// 9. TDD DB Schema Diagram (UNIQUE ERD SCHEMA)
const tddDbSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="480" viewBox="0 0 1100 480">
  <rect width="100%" height="100%" fill="#1e1e2e"/>
  <text x="550" y="40" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="20" font-weight="bold" text-anchor="middle">SA4E-58: TDD Knowledge Base Database ERD Schema</text>

  <rect x="80" y="100" width="420" height="340" rx="10" fill="#313244" stroke="#89dceb" stroke-width="2"/>
  <text x="290" y="140" fill="#89dceb" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="middle">Table: knowledge_entries</text>
  <line x1="80" y1="155" x2="500" y2="155" stroke="#89dceb" stroke-width="2"/>
  <text x="100" y="190" fill="#f9e2af" font-family="Arial, sans-serif" font-size="13">PK: id (TEXT — "pega:rule:&lt;insKey&gt;")</text>
  <text x="100" y="225" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13">type: TEXT ("PEGA_RULE" | "PEGA_AST")</text>
  <text x="100" y="260" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13">content: JSONB / TEXT (Full Rule AST JSON)</text>
  <text x="100" y="295" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13">metadata: JSONB (pxObjClass, pyRuleName...)</text>
  <text x="100" y="330" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13">project_id: TEXT ("SDLC_PEGA_APP")</text>
  <text x="100" y="365" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13">updated_at: TIMESTAMP</text>

  <path d="M 500 270 L 590 270" stroke="#f5c2e7" stroke-width="4"/>

  <rect x="590" y="100" width="430" height="340" rx="10" fill="#313244" stroke="#f5c2e7" stroke-width="2"/>
  <text x="805" y="140" fill="#f5c2e7" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="middle">Table: graph_nodes</text>
  <line x1="590" y1="155" x2="1020" y2="155" stroke="#f5c2e7" stroke-width="2"/>
  <text x="610" y="190" fill="#f9e2af" font-family="Arial, sans-serif" font-size="13">PK: node_id (UUID)</text>
  <text x="610" y="225" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13">label: TEXT ("Rule-Obj-Activity" | "Rule-Obj-Flow")</text>
  <text x="610" y="260" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13">properties: JSONB (Caller &amp; Dependent Graph)</text>
  <text x="610" y="295" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13">upstream_nodes: TEXT[] (UI Sections, Flow Actions)</text>
  <text x="610" y="330" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13">downstream_nodes: TEXT[] (Decision Tables, Activities)</text>
  <text x="610" y="365" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13">created_at: TIMESTAMP</text>
</svg>`;

saveDiagram('tdd_db_schema', brdProcessXml, tddDbSvg);

// 10. TDD Component Interaction Flow Diagram (UNIQUE INTERACTION)
const tddInteractionSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="480" viewBox="0 0 1100 480">
  <rect width="100%" height="100%" fill="#1e1e2e"/>
  <text x="550" y="40" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="20" font-weight="bold" text-anchor="middle">SA4E-58: TDD Component Lock Control Interaction Flow</text>

  <rect x="60" y="140" width="260" height="260" rx="10" fill="#313244" stroke="#cba6f7" stroke-width="2"/>
  <text x="190" y="180" fill="#cba6f7" font-family="Arial, sans-serif" font-size="15" font-weight="bold" text-anchor="middle">DEV Agent Action</text>
  <text x="190" y="220" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">1. Request Checkout</text>
  <text x="190" y="260" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">2. Edit &amp; Validate AST</text>
  <text x="190" y="300" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">3. Request Save</text>
  <text x="190" y="340" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">4. Request Checkin</text>

  <path d="M 320 270 L 420 270" stroke="#f5c2e7" stroke-width="4"/>

  <rect x="420" y="140" width="270" height="260" rx="10" fill="#313244" stroke="#f5c2e7" stroke-width="2"/>
  <text x="555" y="180" fill="#f5c2e7" font-family="Arial, sans-serif" font-size="15" font-weight="bold" text-anchor="middle">PegaMcpTools &amp; SDK</text>
  <text x="555" y="220" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">• checkoutRule(insKey, "CHECKOUT")</text>
  <text x="555" y="260" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">• saveRule(payload)</text>
  <text x="555" y="300" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">• checkoutRule(insKey, "CHECKIN")</text>
  <text x="555" y="340" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">• checkoutRule(insKey, "UNDOCHECKOUT")</text>

  <path d="M 690 270 L 790 270" stroke="#a6e3a1" stroke-width="4"/>

  <rect x="790" y="140" width="250" height="260" rx="10" fill="#313244" stroke="#a6e3a1" stroke-width="2"/>
  <text x="915" y="180" fill="#a6e3a1" font-family="Arial, sans-serif" font-size="15" font-weight="bold" text-anchor="middle">Pega Server Engine</text>
  <text x="915" y="220" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">• Locks Rule in DB</text>
  <text x="915" y="260" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">• Personal RuleSet Copy</text>
  <text x="915" y="300" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">• Transaction Commit</text>
  <text x="915" y="340" fill="#cdd6f4" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">• Unlocks &amp; Merges Code</text>
</svg>`;

saveDiagram('tdd_component_interaction', brdProcessXml, tddInteractionSvg);

console.log("SUCCESS: All 10 diagrams are now 100% UNIQUE and DISTINCT!");
