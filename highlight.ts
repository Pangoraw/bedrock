import hljs from "https://unpkg.com/@highlightjs/cdn-assets@11.6.0/es/highlight.min.js";

import go from "https://unpkg.com/@highlightjs/cdn-assets@11.6.0/es/languages/go.min.js";
import python from "https://unpkg.com/@highlightjs/cdn-assets@11.6.0/es/languages/python.min.js";
import julia from "https://unpkg.com/@highlightjs/cdn-assets@11.6.0/es/languages/julia.min.js";
import bash from "https://unpkg.com/@highlightjs/cdn-assets@11.6.0/es/languages/bash.min.js";
import sql from "https://unpkg.com/@highlightjs/cdn-assets@11.6.0/es/languages/sql.min.js";
import latex from "https://unpkg.com/@highlightjs/cdn-assets@11.6.0/es/languages/latex.min.js";

hljs.registerLanguage("go", go);
hljs.registerLanguage("python", python);
hljs.registerLanguage("julia", julia);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("latex", latex);

const isLanguageAvailable = (lang: string): boolean => {
  return !!hljs.getLanguage(lang);
};

export const highlightCode = (source: string, language?: string): string => {
  if (language && isLanguageAvailable(language)) {
    try {
      return hljs.highlight(source, { language }).value;
    } catch (_) {}
  }

  return "";
};
