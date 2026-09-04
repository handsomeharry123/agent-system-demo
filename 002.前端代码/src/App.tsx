import { ConfigProvider } from 'antd';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { DemoScenarioProvider } from './hooks/useDemoScenario';
import { DemoSettingsProvider } from './hooks/useDemoSettings';
import { ThemeProvider, useTheme } from './hooks/useTheme';
import { getTheme } from './theme/themeConfig';
import router from './router';

function ThemedApp() {
  const { themeKey } = useTheme();
  return (
    <ConfigProvider theme={getTheme(themeKey)}>
      <AuthProvider>
        <DemoSettingsProvider>
          <DemoScenarioProvider>
            <RouterProvider router={router} />
          </DemoScenarioProvider>
        </DemoSettingsProvider>
      </AuthProvider>
    </ConfigProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  );
}

export default App;
