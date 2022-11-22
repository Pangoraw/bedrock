export const generateCss = () =>
  Deno.run({
    cmd: [
      "/home/pberg/.nvm/versions/node/v16.17.0/bin/npx",
      "tailwindcss",
      "--input",
      "index.css",
      "--output",
      "style.css",
    ],
  }).status();
