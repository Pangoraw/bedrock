import hljs from "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/es/highlight.min.js";

import go from "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/es/languages/go.min.js";
import python from "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/es/languages/python.min.js";
import julia from "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/es/languages/julia.min.js";
import bash from "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/es/languages/bash.min.js";
import sql from "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/es/languages/sql.min.js";
import latex from "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/es/languages/latex.min.js";
import c from "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/es/languages/c.min.js";

hljs.registerLanguage("go", go);
hljs.registerLanguage("python", python);
hljs.registerLanguage("julia", julia);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("latex", latex);
hljs.registerLanguage("c", c);

const isLanguageAvailable = (language: string): boolean => {
  return !!hljs.getLanguage(language);
};

export const highlightCode = (source: string, language?: string): string => {
  if (language && isLanguageAvailable(language)) {
    try {
      return hljs.highlight(source, { language }).value;
    } catch (_) {}
  }

  return "";
};
