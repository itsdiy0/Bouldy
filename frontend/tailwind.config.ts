import type { Config } from "tailwindcss";
const { heroui } = require("@heroui/theme");

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bouldy-darkest': '#37353E',
        'bouldy-dark': '#44444E', 
        'bouldy-moss': '#715A5A',
        'bouldy-light': '#D3DAD9',
      },
    },
  },
  darkMode: "class",
  plugins: [heroui()],
};

export default config;