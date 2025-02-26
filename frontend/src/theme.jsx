import { createTheme } from '@mui/material/styles';
import rtlPlugin from 'stylis-plugin-rtl';
import { prefixer } from 'stylis';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';

// Create RTL theme with blue primary color
const theme = createTheme({
  direction: 'rtl',
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#f50057',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: 'Rubik, Arial, sans-serif',
  },
  components: {
    MuiTextField: {
      styleOverrides: {
        root: {
          '& label': {
            right: 14,
            transformOrigin: 'right',
          },
          '& legend': {
            textAlign: 'right',
          },
        },
      },
    },
  },
});

// Create RTL cache for emotion
export const cacheRtl = createCache({
  key: 'muirtl',
  stylisPlugins: [prefixer, rtlPlugin],
});

export const RTL = (props) => {
  return <CacheProvider value={cacheRtl}>{props.children}</CacheProvider>;
};

export default theme;
