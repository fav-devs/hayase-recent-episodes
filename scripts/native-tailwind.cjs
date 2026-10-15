const plugin = require('tailwindcss/plugin');
module.exports = {
  content: ['./src/native-preview/**/*.{svelte,js,ts}'],
  theme: { extend: { colors: Object.fromEntries(['background', 'foreground', 'border', 'input', 'ring', 'muted', 'primary', 'secondary', 'accent'].map(name => [name, {
    DEFAULT: `hsl(from var(--${name}) h s l / <alpha-value>)`, foreground: `hsl(from var(--${name}-foreground) h s l / <alpha-value>)`
  }])) } },
  plugins: [plugin(api => api.addVariant('select', ['&:hover', '&:focus-visible', '&:active']))]
};
