import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Image,
  Input,
  InputNumber,
  Popconfirm,
  Skeleton,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  PlusOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type { Product, ProductFormValues } from '../types/product';
import { useProducts } from '../context/ProductContext';
import {
  CertificateStatusBadge,
  ChestnyZnakBadge,
  FrontSeatBadge,
  SGRStatusBadge,
} from '../components/StatusBadge';
import { exportToExcel, importFromExcel } from '../utils/excel';

const { Title, Text } = Typography;

// ─── Placeholder image ────────────────────────────────────────────────────────

const NO_IMAGE =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"%3E%3Crect width="40" height="40" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="55%25" font-size="10" text-anchor="middle" fill="%23bbb"%3EНет%3C/text%3E%3C/svg%3E';

// ─── Inline Editing ───────────────────────────────────────────────────────────

interface EditingState {
  id: string;
  field: string;
  value: string;
}

interface EditableCellProps {
  record: Product;
  field: keyof Product;
  displayNode: React.ReactNode;
  type?: 'text' | 'number';
  editing: EditingState | null;
  onStart: (state: EditingState) => void;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

function EditableCell({
  record,
  field,
  displayNode,
  type = 'text',
  editing,
  onStart,
  onCommit,
  onCancel,
}: EditableCellProps) {
  const isEditing = editing?.id === record.id && editing?.field === field;

  // Track whether a commit has already been triggered in this edit session
  // to prevent the double-fire from onKeyDown(Enter) + onBlur
  const committedRef = useRef(false);
  const prevIsEditingRef = useRef(false);
  // Track current input value via onChange — avoids relying on InputRef internals
  const currentTextRef = useRef('');
  const numValueRef = useRef<number | null>(null);

  if (isEditing && !prevIsEditingRef.current) {
    committedRef.current = false;
    currentTextRef.current = editing?.value ?? '';
  }
  prevIsEditingRef.current = isEditing;

  const handleStart = () => {
    const raw = record[field];
    onStart({ id: record.id, field: String(field), value: raw != null ? String(raw) : '' });
  };

  const handleCommit = (val: string) => {
    if (committedRef.current) return;
    committedRef.current = true;
    onCommit(val);
  };

  const handleCancel = () => {
    committedRef.current = true; // prevent blur from triggering commit
    onCancel();
  };

  if (isEditing) {
    if (type === 'number') {
      const initNum = editing.value !== '' ? Number(editing.value) : undefined;
      numValueRef.current = initNum ?? null;

      return (
        <InputNumber
          autoFocus
          size="small"
          defaultValue={initNum}
          style={{ width: '100%' }}
          onChange={(val) => {
            numValueRef.current = val;
          }}
          onBlur={() =>
            handleCommit(numValueRef.current != null ? String(numValueRef.current) : '')
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter')
              handleCommit(numValueRef.current != null ? String(numValueRef.current) : '');
            if (e.key === 'Escape') {
              e.preventDefault();
              handleCancel();
            }
          }}
        />
      );
    }

    return (
      <Input
        autoFocus
        size="small"
        defaultValue={editing.value}
        onChange={(e) => {
          currentTextRef.current = e.target.value;
        }}
        onBlur={() => handleCommit(currentTextRef.current)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleCommit(currentTextRef.current);
          if (e.key === 'Escape') {
            e.preventDefault();
            handleCancel();
          }
        }}
      />
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className="editable-cell"
      onClick={handleStart}
      onKeyDown={(e) => e.key === 'Enter' && handleStart()}
    >
      {displayNode ?? <span style={{ color: '#bfbfbf' }}>—</span>}
    </div>
  );
}

// ─── Table Columns ────────────────────────────────────────────────────────────

function buildColumns(
  onEdit: (id: string) => void,
  onDelete: (id: string) => void,
  editing: EditingState | null,
  onStart: (state: EditingState) => void,
  onCommit: (value: string) => void,
  onCancel: () => void,
  loadingProductIds: Set<string>,
): ColumnsType<Product> {
  const skeletonCell = (
    <Space direction="vertical" size={4} style={{ width: '100%' }}>
      <Skeleton.Input active block size="small" style={{ height: 16, borderRadius: 4 }} />
      <Skeleton.Input active block size="small" style={{ height: 14, borderRadius: 4, opacity: 0.6 }} />
    </Space>
  );
  const withFullTextTooltip = (text: string | undefined, node: React.ReactNode) => {
    const t = (text ?? '').trim();
    if (!t) return node;
    return (
      <Tooltip placement="topLeft" title={t}>
        {node}
      </Tooltip>
    );
  };

  const ec = (
    record: Product,
    field: keyof Product,
    display: React.ReactNode,
    type: 'text' | 'number' = 'text',
  ) => (
    <EditableCell
      record={record}
      field={field}
      displayNode={display}
      type={type}
      editing={editing}
      onStart={onStart}
      onCommit={onCommit}
      onCancel={onCancel}
    />
  );

  return [
    {
      title: 'Фото',
      dataIndex: 'image',
      key: 'image',
      width: 60,
      fixed: 'left',
      render: (img?: string) => (
        <Image
          src={img ?? NO_IMAGE}
          alt="Товар"
          width={40}
          height={40}
          style={{ objectFit: 'cover', borderRadius: 4 }}
          preview={!!img}
        />
      ),
    },
    {
      title: 'Артикул',
      dataIndex: 'article',
      key: 'article',
      width: 120,
      fixed: 'left',
      render: (v: string | undefined, record) =>
        ec(record, 'article', <Text code>{v ?? '—'}</Text>),
    },
    {
      title: 'Китайское наименование',
      dataIndex: 'chineseName',
      key: 'chineseName',
      width: 180,
      ellipsis: true,
      render: (name: string, record) =>
        ec(
          record,
          'chineseName',
          <Tooltip
            placement="topLeft"
            title={
              <div>
                <div style={{ fontWeight: 600 }}>{record.chineseName}</div>
                {record.russianTranslation && (
                  <div style={{ marginTop: 4, color: 'rgba(0,0,0,0.65)' }}>
                    {record.russianTranslation}
                  </div>
                )}
              </div>
            }
          >
            <span>{name}</span>
          </Tooltip>,
        ),
    },
    {
      title: 'Наименование',
      dataIndex: 'russianName',
      key: 'russianName',
      width: 220,
      ellipsis: true,
      render: (v: string, record) =>
        ec(record, 'russianName', withFullTextTooltip(v, <span>{v}</span>)),
    },
    {
      title: 'Категория',
      dataIndex: 'category',
      key: 'category',
      width: 140,
      ellipsis: true,
      render: (v: string | undefined, record) =>
        ec(record, 'category', withFullTextTooltip(v, v ?? '—')),
    },
    {
      title: 'Описание',
      dataIndex: 'description',
      key: 'description',
      width: 200,
      ellipsis: true,
      render: (v: string | undefined, record) =>
        ec(record, 'description', withFullTextTooltip(v, v ?? '—')),
    },
    {
      title: 'Код ТНВЭД',
      dataIndex: 'tnvedCode',
      key: 'tnvedCode',
      width: 130,
      render: (v: string, record) => ec(record, 'tnvedCode', <Text code>{v}</Text>),
    },
    {
      title: 'Модель',
      dataIndex: 'model',
      key: 'model',
      width: 120,
      ellipsis: true,
      render: (v: string | undefined, record) =>
        ec(record, 'model', withFullTextTooltip(v, v ?? '—')),
    },
    {
      title: 'Мест',
      dataIndex: 'places',
      key: 'places',
      width: 80,
      align: 'right',
      render: (v: number | undefined, record) =>
        ec(record, 'places', v ?? '—', 'number'),
    },
    {
      title: 'Кол-во',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 90,
      align: 'right',
      render: (v: number | undefined, record) =>
        ec(record, 'quantity', v ?? '—', 'number'),
    },
    {
      title: 'Вес брутто',
      dataIndex: 'grossWeight',
      key: 'grossWeight',
      width: 110,
      align: 'right',
      render: (v: number | undefined, record) =>
        ec(record, 'grossWeight', v != null ? `${v} кг` : '—', 'number'),
    },
    {
      title: 'Торг. марка',
      dataIndex: 'trademark',
      key: 'trademark',
      width: 130,
      ellipsis: true,
      render: (v: string | undefined, record) =>
        ec(record, 'trademark', withFullTextTooltip(v, v ?? '—')),
    },
    {
      title: 'Производитель',
      dataIndex: 'manufacturer',
      key: 'manufacturer',
      width: 180,
      ellipsis: true,
      render: (v: string | undefined, record) =>
        ec(record, 'manufacturer', withFullTextTooltip(v, v ?? '—')),
    },
    {
      title: 'СС',
      key: 'ss',
      width: 220,
      render: (_: unknown, record: Product) => {
        if (loadingProductIds.has(record.id)) return skeletonCell;
        const hasDoc = !!record.ss;
        return (
          <Space direction="vertical" size={0} style={{ width: '100%' }}>
            {hasDoc && (
              <Space size={4} align="center">
                <CertificateStatusBadge status={record.metadata.certificateStatus} />
                <Tag color="blue" style={{ margin: 0 }}>СС</Tag>
              </Space>
            )}
            {ec(
              record,
              'ss',
              record.ss
                ? withFullTextTooltip(record.ss, <Text code style={{ fontSize: 11 }}>{record.ss}</Text>)
                : <span style={{ color: '#bfbfbf', fontSize: 12 }}>номер не указан</span>,
            )}
            {record.ssValidUntil && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                до {record.ssValidUntil}
              </Text>
            )}
          </Space>
        );
      },
    },
    {
      title: 'ДС',
      key: 'ds',
      width: 220,
      render: (_: unknown, record: Product) => {
        if (loadingProductIds.has(record.id)) return skeletonCell;
        const hasDoc = !!record.ds;

        if (!hasDoc) {
          return ec(
            record,
            'ds',
            <span style={{ color: '#bfbfbf', fontSize: 12 }}>номер не указан</span>,
          );
        }

        return (
          <Space direction="vertical" size={0} style={{ width: '100%' }}>
            <Space size={4} align="center">
              <Tag color="geekblue" style={{ margin: 0 }}>ДС</Tag>
            </Space>
            {ec(
              record,
              'ds',
              withFullTextTooltip(record.ds, <Text code style={{ fontSize: 11 }}>{record.ds}</Text>),
            )}
            {(record.dsValidFrom || record.dsValidUntil) && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {record.dsValidFrom ?? '?'} — {record.dsValidUntil ?? '?'}
              </Text>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Честный знак',
      key: 'chestnyZnakStatus',
      width: 146,
      render: (_: unknown, record: Product) =>
        loadingProductIds.has(record.id) ? (
          <Skeleton.Input active block size="small" style={{ height: 16, borderRadius: 4 }} />
        ) : (
          <ChestnyZnakBadge status={record.metadata.chestnyZnakStatus} />
        ),
    },
    {
      title: 'СГР',
      key: 'sgrStatus',
      width: 136,
      render: (_: unknown, record: Product) =>
        loadingProductIds.has(record.id) ? (
          <Skeleton.Input active block size="small" style={{ height: 16, borderRadius: 4 }} />
        ) : (
          <SGRStatusBadge status={record.metadata.sgrStatus} />
        ),
    },
    {
      title: 'Метки',
      key: 'flags',
      width: 150,
      render: (_: unknown, record: Product) => (
        <Space size={4} wrap>
          <FrontSeatBadge isFrontSeat={record.isFrontSeat} />
        </Space>
      ),
    },
    {
      title: 'Примечания',
      dataIndex: 'notes',
      key: 'notes',
      width: 160,
      ellipsis: true,
      render: (v: string | undefined, record) =>
        ec(record, 'notes', withFullTextTooltip(v, v ?? '—')),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_: unknown, record: Product) => (
        <Space>
          <Tooltip title="Редактировать в форме">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => onEdit(record.id)}
            />
          </Tooltip>
          <Popconfirm
            title="Удалить товар?"
            description="Это действие нельзя отменить."
            okText="Удалить"
            cancelText="Отмена"
            onConfirm={() => onDelete(record.id)}
          >
            <Tooltip title="Удалить">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];
}

// ─── Numeric & Required field sets ───────────────────────────────────────────

const NUMERIC_FIELDS = new Set<string>(['places', 'quantity', 'grossWeight']);
const REQUIRED_FIELDS = new Set<string>(['chineseName', 'russianName', 'tnvedCode']);

// ─── TablePage ────────────────────────────────────────────────────────────────

export default function TablePage() {
  const navigate = useNavigate();
  const { products, loadingProductIds, deleteProduct, replaceProducts, updateProduct } = useProducts();
  const [messageApi, contextHolder] = message.useMessage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Inline editing state
  const [editingCell, setEditingCell] = useState<EditingState | null>(null);

  const startEdit = (state: EditingState) => setEditingCell(state);

  const commitEdit = (value: string) => {
    if (!editingCell) return;
    const { id, field } = editingCell;
    setEditingCell(null);

    // Skip save if required field is being cleared
    if (REQUIRED_FIELDS.has(field) && !value.trim()) return;

    const product = products.find((p) => p.id === id);
    if (!product) return;

    const { id: _id, metadata: _meta, ...formValues } = product;

    let parsed: string | number | boolean | undefined;
    if (NUMERIC_FIELDS.has(field)) {
      const num = value.trim() !== '' ? Number(value) : NaN;
      parsed = !isNaN(num) ? num : undefined;
    } else {
      parsed = value.trim() || undefined;
    }

    updateProduct(id, { ...formValues, [field]: parsed } as ProductFormValues);
  };

  const cancelEdit = () => setEditingCell(null);

  // ── Navigation / CRUD handlers
  const handleEdit = (id: string) => navigate(`/edit/${id}`);

  const handleDelete = (id: string) => {
    deleteProduct(id);
    void messageApi.success('Товар удалён');
  };

  const handleExport = () => {
    exportToExcel(products);
    void messageApi.success('Экспорт выполнен — файл товары.xlsx скачан');
  };

  const handleImport = async (file: File) => {
    try {
      const imported = await importFromExcel(file);
      replaceProducts(imported);
      void messageApi.success(`Импортировано ${imported.length} товаров`);
    } catch {
      void messageApi.error('Ошибка при импорте файла. Проверьте формат.');
    }
    return false;
  };

  const columns = buildColumns(
    handleEdit,
    handleDelete,
    editingCell,
    startEdit,
    commitEdit,
    cancelEdit,
    loadingProductIds,
  );

  return (
    <div style={{ padding: '24px' }}>
      {contextHolder}

      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <Title level={3} style={{ margin: 0 }}>
          📦 Таблица товаров
        </Title>

        <Space wrap>
          {/* Import Excel */}
          <Upload
            accept=".xlsx,.xls"
            showUploadList={false}
            beforeUpload={(file) => {
              void handleImport(file);
              return false;
            }}
          >
            <Button icon={<UploadOutlined />}>Импорт Excel</Button>
          </Upload>

          {/* Export Excel */}
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            Экспорт Excel
          </Button>

          {/* Add Product */}
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/create')}
          >
            Добавить товар
          </Button>
        </Space>
      </div>

      {/* Hidden file input — kept for reference (Upload component above handles it) */}
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} />

      {/* Stats */}
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        Всего товаров: <strong>{products.length}</strong>
        <Text type="secondary" style={{ marginLeft: 16, fontSize: 12 }}>
          · Нажмите на ячейку для редактирования
        </Text>
      </Text>

      {/* Table */}
      <Table<Product>
        rowKey="id"
        columns={columns}
        dataSource={products}
        scroll={{ x: 2200 }}
        size="small"
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `Итого: ${total}`,
        }}
        bordered
      />
    </div>
  );
}
