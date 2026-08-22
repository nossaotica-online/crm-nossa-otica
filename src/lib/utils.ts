/**
 * CRM Vittus — Utility Functions
 */

/**
 * Format a date string to Brazilian format (dd/mm/yyyy)
 */
export function formatDateBR(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('pt-BR');
}

/**
 * Format a datetime to Brazilian format
 */
export function formatDateTimeBR(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format currency in BRL
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Format percentage
 */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Get relative time string (e.g., "há 5 minutos")
 */
export function getRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'agora';
  if (diffMins < 60) return `há ${diffMins} min`;
  if (diffHours < 24) return `há ${diffHours}h`;
  if (diffDays < 7) return `há ${diffDays}d`;
  if (diffDays < 30) return `há ${Math.floor(diffDays / 7)} sem`;
  return formatDateBR(dateStr);
}

/**
 * Generate time slots between start and end with given interval
 */
export function generateTimeSlots(
  startTime: string,
  endTime: string,
  intervalMinutes: number
): string[] {
  const slots: string[] = [];
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  let currentMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  while (currentMinutes + intervalMinutes <= endMinutes) {
    const hours = Math.floor(currentMinutes / 60);
    const mins = currentMinutes % 60;
    slots.push(`${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`);
    currentMinutes += intervalMinutes;
  }

  return slots;
}

/**
 * Get initials from name (e.g., "João Silva" → "JS")
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '…';
}

/**
 * Classnames helper — joins class names, filtering falsy values
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Format a local calendar date as YYYY-MM-DD without shifting it through UTC.
 */
export function formatLocalDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get today's local date in YYYY-MM-DD format.
 */
export function getTodayISO(): string {
  return formatLocalDateISO(new Date());
}

/**
 * Check if a date is today
 */
export function isToday(dateStr: string): boolean {
  return dateStr === getTodayISO();
}

/**
 * Add minutes to a time string (HH:MM)
 */
export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const totalMins = h * 60 + m + minutes;
  const newH = Math.floor(totalMins / 60) % 24;
  const newM = totalMins % 60;
  return `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;
}

/**
 * Número digitado no formulário, em português e no teclado do celular.
 *
 * O grau precisa do sinal ("+1,50", "-0,75"), então esses campos usam o teclado
 * normal — e o que chega vem sujo: espaço sobrando, vírgula ou ponto, o "+" que
 * o Number já entende, e o traço longo (− – —) que alguns teclados mandam no
 * lugar do menos. Devolve null para campo vazio e para o que não é número —
 * quem chama decide se isso é "não informado" ou erro para mostrar na tela.
 */
export function parseDecimalInput(value: string): number | null {
  const cleaned = value
    .replace(/\s+/g, '')
    .replace(/[−–—]/g, '-')
    .replace(',', '.');
  if (cleaned === '') return null;
  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
}
