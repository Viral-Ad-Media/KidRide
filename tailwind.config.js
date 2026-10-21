/** @type {import('tailwindcss').Config} */
// KidRide brand tokens. Components use these semantic names, never raw hex.
export default {
  content: [
    './index.html',
    './*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}',
    './contexts/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
    './utils/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#38BDF8', deep: '#0369A1' }, // Sky, Deep Sky
        ink: '#14213D', // Night Navy
        accent: '#FFB703', // Marigold: anything about the child, stars
        surface: { DEFAULT: '#F6F9FC', 2: '#EAF1F7' }, // Cloud, Mist
        line: '#D5DFE9', // Pebble
        muted: '#5B6478', // Slate
        success: '#1B9E5A', // Leaf
        danger: '#D7263D', // Cherry
        warning: '#E07A00', // Ember
        // Dark mode, for later.
        night: { bg: '#0F1729', card: '#182238', text: '#F3F6FA', deep: '#7DD3FC' }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif']
      },
      // Type scale 12/14/16/18/22/28/36 as named steps. The default xs-5xl keys stay as
      // they are so existing screens keep their layout until they are redesigned.
      fontSize: {
        caption: ['12px', { lineHeight: '1.45' }],
        label: ['14px', { lineHeight: '1.45' }],
        body: ['16px', { lineHeight: '1.45' }],
        lead: ['18px', { lineHeight: '1.45' }],
        title: ['22px', { lineHeight: '1.2' }],
        headline: ['28px', { lineHeight: '1.2' }],
        display: ['36px', { lineHeight: '1.2' }]
      },
      borderRadius: {
        card: '20px',
        input: '14px',
        sheet: '24px',
        control: '12px'
      },
      boxShadow: {
        float: '0 8px 24px rgba(20,33,61,0.12)'
      },
      height: { button: '52px' },
      // The UI uses opacity steps outside Tailwind's default scale (e.g. bg-white/12).
      opacity: {
        12: '0.12', 16: '0.16', 38: '0.38', 45: '0.45', 55: '0.55', 65: '0.65',
        68: '0.68', 72: '0.72', 78: '0.78', 82: '0.82', 85: '0.85', 88: '0.88'
      }
    }
  },
  plugins: []
};
