/**
 * PegaDomExtractor — DOM extraction functions for Pega rendered pages (SA4E-95).
 * Runs inside browser context via page.evaluate(). Pure DOM queries.
 * Extracts sections and field bindings from actual rendered Pega forms.
 */

import type { Page } from "puppeteer-core";
import type { RenderedFieldInfo } from "./PegaBrowserInspector";

/**
 * Extract section names from rendered Pega DOM.
 * Pega sections render as DIVs with class="sectionDivStyle" and attribute node_name.
 */
export async function extractSectionsFromDOM(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const sections = new Set<string>();

    // Primary pattern: div with objclass="Rule-HTML-Section" and node_name
    document.querySelectorAll('div[node_name][objclass="Rule-HTML-Section"]').forEach((el) => {
      const name = el.getAttribute("node_name") || "";
      if (name) sections.add(name);
    });

    // Fallback: data-node-id on sectionDivStyle elements
    document.querySelectorAll("div.sectionDivStyle[data-node-id]").forEach((el) => {
      const name = el.getAttribute("data-node-id") || "";
      if (name) sections.add(name);
    });

    return Array.from(sections).filter((s) => s && s !== "undefined");
  });
}

/**
 * Extract field bindings from rendered form controls.
 * Inspects actual input/select/textarea elements with Pega data-ref attributes.
 */
export async function extractFieldsFromDOM(page: Page): Promise<RenderedFieldInfo[]> {
  return page.evaluate(() => {
    const fields: Array<{
      fieldName: string; inputType: string;
      label?: string; required: boolean; sectionContext?: string;
    }> = [];
    const seen = new Set<string>();

    document.querySelectorAll(
      "input[data-ref], select[data-ref], textarea[data-ref], " +
      "input[name], select[name], textarea[name], [data-ctl]",
    ).forEach((el) => {
      const dataRef = el.getAttribute("data-ref") || "";
      const name = el.getAttribute("name") || "";

      // Resolve field name from Pega binding attributes
      let fieldName = "";
      if (dataRef.startsWith(".")) fieldName = dataRef.substring(1);
      else if (dataRef.includes(".")) fieldName = dataRef;
      else if (name.startsWith(".")) fieldName = name.substring(1);
      else if (name && !name.startsWith("$") && !name.startsWith("pz")) fieldName = name;

      if (!fieldName || seen.has(fieldName)) return;
      seen.add(fieldName);

      const type = el.getAttribute("type") || el.tagName.toLowerCase();
      const id = el.getAttribute("id");
      const labelEl = id ? document.querySelector(`label[for="${id}"]`) : null;
      const label = labelEl?.textContent?.trim()
        || el.getAttribute("aria-label") || el.getAttribute("title") || undefined;
      const required = el.hasAttribute("required") || el.getAttribute("aria-required") === "true";

      // Find parent section for context
      const secParent = el.closest("[data-section-name], [section_name]");
      const sectionContext = secParent?.getAttribute("data-section-name")
        || secParent?.getAttribute("section_name") || undefined;

      fields.push({ fieldName, inputType: type, label, required, sectionContext });
    });

    return fields;
  });
}
