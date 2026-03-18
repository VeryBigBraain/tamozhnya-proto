import { Tag, Tooltip } from 'antd';
import type { CertificateStatus, SGRStatus } from '../types/product';

// ─── Certificate Status Badge ─────────────────────────────────────────────────

interface CertificateStatusBadgeProps {
  status: CertificateStatus;
}

const CERTIFICATE_CONFIG: Record<
  CertificateStatus,
  { color: string; label: string; tooltip: string }
> = {
  valid: {
    color: 'success',
    label: 'Действителен',
    tooltip: 'Сертификат проверен и действителен (Росаккредитация)',
  },
  expired: {
    color: 'error',
    label: '❌ Истёк',
    tooltip: 'Срок действия сертификата истёк — необходимо обновить',
  },
  revoked: {
    color: 'error',
    label: '❌ Отозван',
    tooltip: 'Сертификат отозван регулятором — груз не допускается к ввозу',
  },
  unknown: {
    color: 'default',
    label: 'Неизвестно',
    tooltip: 'Статус сертификата не определён',
  },
};

export function CertificateStatusBadge({ status }: CertificateStatusBadgeProps) {
  const { color, label, tooltip } = CERTIFICATE_CONFIG[status];
  return (
    <Tooltip title={tooltip}>
      <Tag color={color}>{label}</Tag>
    </Tooltip>
  );
}

// ─── Честный Знак Badge ───────────────────────────────────────────────────────

interface ChestnyZnakBadgeProps {
  status: boolean;
}

export function ChestnyZnakBadge({ status }: ChestnyZnakBadgeProps) {
  if (!status) {
    return (
      <Tooltip title="Маркировка Честный знак не требуется">
        <Tag color="default">Не требуется</Tag>
      </Tooltip>
    );
  }
  return (
    <Tooltip title="Товар подлежит обязательной маркировке системой Честный знак">
      <Tag color="warning">🟡 Честный знак</Tag>
    </Tooltip>
  );
}

// ─── SGR Status Badge ─────────────────────────────────────────────────────────

interface SGRStatusBadgeProps {
  status: SGRStatus;
}

const SGR_CONFIG: Record<SGRStatus, { color: string; label: string; tooltip: string }> = {
  ok: {
    color: 'success',
    label: 'СГР ОК',
    tooltip: 'Свидетельство о государственной регистрации имеется и действует',
  },
  required: {
    color: 'warning',
    label: 'СГР требуется',
    tooltip: 'Для данного товара необходимо Свидетельство о государственной регистрации',
  },
  not_required: {
    color: 'default',
    label: 'СГР не нужен',
    tooltip: 'Для данного товара СГР не требуется',
  },
  unknown: {
    color: 'default',
    label: 'Неизвестно',
    tooltip: 'Статус СГР не определён',
  },
};

export function SGRStatusBadge({ status }: SGRStatusBadgeProps) {
  const { color, label, tooltip } = SGR_CONFIG[status];
  return (
    <Tooltip title={tooltip}>
      <Tag color={color}>{label}</Tag>
    </Tooltip>
  );
}

// ─── Front Seat Badge ─────────────────────────────────────────────────────────

interface FrontSeatBadgeProps {
  isFrontSeat?: boolean;
}

export function FrontSeatBadge({ isFrontSeat }: FrontSeatBadgeProps) {
  if (!isFrontSeat) return null;
  return (
    <Tooltip title="Груз размещён или предназначен для переднего сиденья">
      <Tag color="green">🟢 Перед. сиденье</Tag>
    </Tooltip>
  );
}
