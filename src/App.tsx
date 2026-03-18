import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ConfigProvider, Layout } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import { ProductProvider } from './context/ProductContext';
import TablePage from './pages/TablePage';
import FormPage from './pages/FormPage';

const { Content } = Layout;

export default function App() {
  return (
    <ConfigProvider locale={ruRU}>
      <ProductProvider>
        <BrowserRouter>
          <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
            <Content>
              <Routes>
                <Route path="/" element={<TablePage />} />
                <Route path="/create" element={<FormPage />} />
                <Route path="/edit/:id" element={<FormPage />} />
                {/* Fallback — redirect to table */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Content>
          </Layout>
        </BrowserRouter>
      </ProductProvider>
    </ConfigProvider>
  );
}
