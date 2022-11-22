export const generateCss = () =>
  Deno.run({
    cmd: [
      "npx",
      "tailwindcss",
      "--input",
      "index.css",
      "--output",
      "style.css",
    ],
  }).status();
