/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["graph.html", "./template.tsx"],
  theme: {
    extend: {},
  },
  plugins: [require("@tailwindcss/typography")],
};
