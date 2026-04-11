/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./public/**/*.html", "./public/assets/js/**/*.js", "./src/**/*.js"],
  theme: {
    extend: {
      colors: {
        canvas: "#f3efe8",
        ink: "#101826",
        slate: "#5d6676",
        mist: "#c7d0db",
        sky: "#14532d",
        teal: "#16211d",
        apricot: "#c46a3c",
        panel: "#fffaf4"
      },
      fontFamily: {
        heading: ['"Sora"', "sans-serif"],
        body: ['"Manrope"', "sans-serif"]
      },
      boxShadow: {
        soft: "0 24px 70px rgba(16, 24, 38, 0.10)",
        glow: "0 18px 48px rgba(20, 83, 45, 0.24)"
      }
    }
  },
  plugins: []
};
