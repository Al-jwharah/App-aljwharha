/**
 * Aljwharah — Canonical Status Enums (single source of truth)
 */

export enum OrderStatus {
    RESERVED = 'RESERVED',
    PENDING_PAYMENT = 'PENDING_PAYMENT',
    PAID = 'PAID',
    FULFILLED = 'FULFILLED',
    CANCELLED = 'CANCELLED',
    EXPIRED = 'EXPIRED',
    REFUNDED = 'REFUNDED',
}

export enum PaymentStatus {
    PENDING = 'PENDING',
    PAID = 'PAID',
    FAILED = 'FAILED',
}

const TERMINAL_ORDER = new Set([
    OrderStatus.PAID,
    OrderStatus.FULFILLED,
    OrderStatus.CANCELLED,
    OrderStatus.EXPIRED,
    OrderStatus.REFUNDED,
]);

const RETRYABLE_ORDER = new Set([
    OrderStatus.RESERVED,
    OrderStatus.PENDING_PAYMENT,
]);

export function isTerminalOrderStatus(status: string): boolean {
    return TERMINAL_ORDER.has(status as OrderStatus);
}

export function isRetryableOrderStatus(status: string): boolean {
    return RETRYABLE_ORDER.has(status as OrderStatus);
}

export function canRetryPayment(status: string, reservedUntil: string | Date | null, now: Date = new Date()): boolean {
    if (!isRetryableOrderStatus(status)) return false;
    if (!reservedUntil) return false;
    return new Date(reservedUntil) > now;
}
