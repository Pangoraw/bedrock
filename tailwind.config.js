/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./template.tsx"],
  theme: {
    extend: {},
  },
  plugins: [require("@tailwindcss/typography")],
};
