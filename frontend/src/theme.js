import { createTheme } from '@mui/material/styles';

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

export default theme;
