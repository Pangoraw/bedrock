/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["graph.html", "./template.tsx"],
  theme: {
    extend: {},
  },
  plugins: [require("@tailwindcss/typography")],
};
