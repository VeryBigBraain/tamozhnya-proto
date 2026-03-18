import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Checkbox,
  Col,
  Divider,
  Form,
  Image,
  Input,
  InputNumber,
  Row,
  Space,
  Spin,
  Typography,
  Upload,
  message,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined, UploadOutlined } from '@ant-design/icons';
import type { Product, ProductFormValues } from '../types/product';
import { useProducts } from '../context/ProductContext';
import { computeMetadata } from '../services/statusService';

import {
  CertificateStatusBadge,
  ChestnyZnakBadge,
  SGRStatusBadge,
  FrontSeatBadge,
} from '../components/StatusBadge';

const { Title, Text } = Typography;
const { TextArea } = Input;

// ─── Image to Base64 ──────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(String(e.target?.result ?? ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── FormPage ─────────────────────────────────────────────────────────────────

export default function FormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProduct, addProduct, updateProduct } = useProducts();
  const [form] = Form.useForm<ProductFormValues>();
  const [messageApi, contextHolder] = message.useMessage();

  const isEdit = Boolean(id);
  const pageTitle = isEdit ? 'Редактировать товар' : 'Добавить товар';

  // ── Read initial product once (id is stable from route params) ───────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialProduct = useMemo(() => (id ? getProduct(id) ?? null : null), [id]);

  // Image and preview are initialized lazily from the existing product
  const [imageBase64, setImageBase64] = useState<string | undefined>(
    initialProduct?.image ?? undefined,
  );
  const [preview, setPreview] = useState<Product | null>(initialProduct);
  const [previewLoading, setPreviewLoading] = useState(false);
  // Ref для отмены устаревших запросов preview при быстром вводе
  const previewAbortRef = useRef<AbortController | null>(null);

  // ── Set form values on mount (form.setFieldsValue is not React setState) ─────
  useEffect(() => {
    if (id) {
      if (initialProduct) {
        form.setFieldsValue(initialProduct);
      } else {
        void messageApi.error('Товар не найден');
        navigate('/');
      }
    }
  }, [id, initialProduct, form, messageApi, navigate]);

  // ── Live status preview ──────────────────────────────────────────────────────
  const handleValuesChange = (_: Partial<ProductFormValues>, all: ProductFormValues) => {
    const tnvedCode = all.tnvedCode?.trim() ?? '';
    const russianName = all.russianName?.trim() ?? '';

    if (tnvedCode.length >= 4 && russianName) {
      // Отменяем предыдущий запрос, если он ещё не завершился
      previewAbortRef.current?.abort();
      const controller = new AbortController();
      previewAbortRef.current = controller;

      setPreviewLoading(true);

      computeMetadata(all)
        .then((metadata) => {
          if (controller.signal.aborted) return;
          setPreview({
            id: id ?? 'preview',
            ...all,
            image: imageBase64,
            metadata,
          });
        })
        .catch(() => {
          // ошибка уже обработана внутри computeMetadata (мок-фолбэк)
        })
        .finally(() => {
          if (!controller.signal.aborted) setPreviewLoading(false);
        });
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────────
  const handleFinish = async (values: ProductFormValues) => {
    const finalValues: ProductFormValues = { ...values, image: imageBase64 };

    if (isEdit && id) {
      await updateProduct(id, finalValues);
      void messageApi.success('Товар обновлён');
    } else {
      await addProduct(finalValues);
      void messageApi.success('Товар добавлен');
    }

    navigate('/');
  };

  // ── Image Upload ──────────────────────────────────────────────────────────────
  const handleImageUpload = async (file: File) => {
    const base64 = await fileToBase64(file);
    setImageBase64(base64);
    return false; // prevent antd default upload
  };

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      {contextHolder}

      {/* Navigation */}
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
          Назад к таблице
        </Button>
      </Space>

      <Title level={3}>{pageTitle}</Title>

      <Form<ProductFormValues>
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        onValuesChange={handleValuesChange}
        initialValues={{ isFrontSeat: false }}
      >
        {/* ── Section: Basic Info ─────────────────────────────────────────────── */}
        <Card
          title="Основная информация"
          size="small"
          style={{ marginBottom: 16 }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="chineseName"
                label="Китайское наименование"
                rules={[{ required: true, message: 'Обязательное поле' }]}
              >
                <Input placeholder="例如：汽车零件" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="russianTranslation" label="Русский перевод">
                <Input placeholder="Перевод с китайского" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="russianName"
                label="Наименование (для декларации)"
                rules={[{ required: true, message: 'Обязательное поле' }]}
              >
                <Input placeholder="Полное официальное название товара" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="category" label="Категория">
                <Input placeholder="Например: Автозапчасти, Одежда, Косметика..." />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="description" label="Описание">
                <Input placeholder="Краткое описание товара" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="tnvedCode"
                label="Код ТН ВЭД"
                rules={[
                  { required: true, message: 'Обязательное поле' },
                  { len: 10, message: 'Код ТН ВЭД должен содержать 10 цифр' },
                  { pattern: /^\d+$/, message: 'Только цифры' },
                ]}
              >
                <Input placeholder="0000000000" maxLength={10} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="article" label="Артикул">
                <Input placeholder="ART-001" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="model" label="Модель">
                <Input placeholder="X-200" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* ── Section: Quantity & Weight ──────────────────────────────────────── */}
        <Card
          title="Количество и вес"
          size="small"
          style={{ marginBottom: 16 }}
        >
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="places" label="Мест">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="quantity" label="Количество (шт.)">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="grossWeight" label="Вес брутто (кг)">
                <InputNumber min={0} step={0.1} style={{ width: '100%' }} placeholder="0.0" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* ── Section: Marking & Manufacturer ────────────────────────────────── */}
        <Card
          title="Маркировка и производитель"
          size="small"
          style={{ marginBottom: 16 }}
        >
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="marking" label="Маркировка">
                <Input placeholder="EAC, CE, ..." />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="trademark" label="Торговая марка">
                <Input placeholder="Brand Name" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="manufacturer" label="Производитель">
                <Input placeholder="Company Name Co., Ltd." />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* ── Section: Documents ─────────────────────────────────────────────── */}
        <Card
          title="Документы"
          size="small"
          style={{ marginBottom: 16 }}
        >
          <Divider titlePlacement="start" plain style={{ margin: '8px 0' }}>
            Сертификат соответствия (СС)
          </Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="ss" label="Номер СС">
                <Input placeholder="СС-2023-001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ssValidUntil" label="СС действует до">
                <Input placeholder="ГГГГ-ММ-ДД" />
              </Form.Item>
            </Col>
          </Row>

          <Divider titlePlacement="start" plain style={{ margin: '8px 0' }}>
            Декларация соответствия (ДС)
          </Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="ds" label="Номер ДС">
                <Input placeholder="ДС-2023-001" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="dsValidFrom" label="ДС действует с">
                <Input placeholder="ГГГГ-ММ-ДД" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="dsValidUntil" label="ДС действует до">
                <Input placeholder="ГГГГ-ММ-ДД" />
              </Form.Item>
            </Col>
          </Row>

          <Divider titlePlacement="start" plain style={{ margin: '8px 0' }}>
            СГР
          </Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="sgr" label="Номер СГР">
                <Input placeholder="СГР-RU.12345.01" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* ── Section: Image & Notes ──────────────────────────────────────────── */}
        <Card
          title="Фото и примечания"
          size="small"
          style={{ marginBottom: 16 }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Фотография товара">
                <Space direction="vertical">
                  <Upload
                    accept="image/*"
                    showUploadList={false}
                    beforeUpload={(file) => {
                      void handleImageUpload(file);
                      return false;
                    }}
                  >
                    <Button icon={<UploadOutlined />}>Загрузить фото</Button>
                  </Upload>
                  {imageBase64 && (
                    <Image
                      src={imageBase64}
                      alt="preview"
                      width={100}
                      height={100}
                      style={{ objectFit: 'cover', borderRadius: 4 }}
                    />
                  )}
                </Space>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="notes" label="Примечания">
                <TextArea rows={3} placeholder="Дополнительная информация..." />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="isFrontSeat" valuePropName="checked">
            <Checkbox>
              🟢 Груз на переднем сиденье
            </Checkbox>
          </Form.Item>
        </Card>

        {/* ── Status Preview ──────────────────────────────────────────────────── */}
        {(preview || previewLoading) && (
          <Card
            title="Предварительные статусы"
            size="small"
            style={{ marginBottom: 16, background: '#fafafa' }}
          >
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              Сертификат проверяется через ФГИС Росаккредитации (при ошибке — мок по ТНВЭД).
            </Text>
            <Spin spinning={previewLoading} size="small">
              {preview && (
                <Space wrap>
                  <span>Сертификат:</span>
                  <CertificateStatusBadge status={preview.metadata.certificateStatus} />
                  <span style={{ marginLeft: 12 }}>Честный знак:</span>
                  <ChestnyZnakBadge status={preview.metadata.chestnyZnakStatus} />
                  <span style={{ marginLeft: 12 }}>СГР:</span>
                  <SGRStatusBadge status={preview.metadata.sgrStatus} />
                  <FrontSeatBadge isFrontSeat={preview.isFrontSeat} />
                </Space>
              )}
            </Spin>
          </Card>
        )}

        {/* ── Actions ─────────────────────────────────────────────────────────── */}
        <Space>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} size="large">
            {isEdit ? 'Сохранить изменения' : 'Добавить товар'}
          </Button>
          <Button size="large" onClick={() => navigate('/')}>
            Отмена
          </Button>
        </Space>
      </Form>
    </div>
  );
}
