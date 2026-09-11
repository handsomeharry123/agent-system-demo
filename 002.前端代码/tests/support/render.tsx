import type { ReactElement } from 'react';
import { ConfigProvider } from 'antd';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

export const renderWithAppProviders = (ui: ReactElement, initialEntries = ['/']) =>
  render(
    <ConfigProvider>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </ConfigProvider>,
  );
