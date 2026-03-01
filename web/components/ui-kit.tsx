'use client';

import { AnimatePresence, motion } from 'framer-motion';
import React, { createContext, useContext, useMemo, useState } from 'react';
import styles from './ui-kit.module.css';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

export function UIButton(
    props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant },
) {
    const { className, variant = 'primary', ...rest } = props;
    const variantClass =
        variant === 'danger' ? styles.danger : variant === 'secondary' ? styles.secondary : styles.primary;
    return <button {...rest} className={`${styles.uiButton} ${variantClass}${className ? ` ${className}` : ''}`} />;
}

export function UIInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
    return <input {...props} className={`${styles.uiInput}${props.className ? ` ${props.className}` : ''}`} />;
}

export function UISelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
    return <select {...props} className={`${styles.uiSelect}${props.className ? ` ${props.className}` : ''}`} />;
}

export function UITextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
    return <textarea {...props} className={`${styles.uiTextarea}${props.className ? ` ${props.className}` : ''}`} />;
}

export function UICard({ children, className, ...rest }: React.HTMLAttributes<HTMLElement>) {
    return <section {...rest} className={`${styles.uiCard}${className ? ` ${className}` : ''}`}>{children}</section>;
}

export function UIBadge({ tone = 'info', children }: { tone?: 'info' | 'success' | 'warning' | 'danger'; children: React.ReactNode }) {
    const toneClass =
        tone === 'success'
            ? styles.badgeSuccess
            : tone === 'warning'
                ? styles.badgeWarning
                : tone === 'danger'
                    ? styles.badgeDanger
                    : styles.badgeInfo;

    return <span className={`${styles.uiBadge} ${toneClass}`}>{children}</span>;
}

export function UISkeleton({ height = 16, width = '100%' }: { height?: number; width?: number | string }) {
    return <div className={styles.skeleton} style={{ height, width }} />;
}

export function UIEmptyState({ title, description }: { title: string; description: string }) {
    return (
        <div className={styles.emptyState}>
            <h3 style={{ marginBottom: 8 }}>{title}</h3>
            <p>{description}</p>
        </div>
    );
}

export function UITable({ children }: { children: React.ReactNode }) {
    return (
        <div className={styles.tableWrap}>
            <table className={styles.table}>{children}</table>
        </div>
    );
}

export function UITabs<T extends string>({
    value,
    options,
    onChange,
}: {
    value: T;
    options: Array<{ value: T; label: string }>;
    onChange: (value: T) => void;
}) {
    return (
        <div className={styles.tabs}>
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    className={`${styles.tabButton} ${value === option.value ? styles.tabButtonActive : ''}`}
                    onClick={() => onChange(option.value)}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

export function UIModal({
    open,
    onClose,
    title,
    children,
}: {
    open: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <AnimatePresence>
            {open ? (
                <motion.div
                    className={styles.modalOverlay}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                >
                    <motion.div
                        className={styles.modalCard}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 10, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <h3>{title}</h3>
                            <UIButton variant="secondary" onClick={onClose}>إغلاق</UIButton>
                        </div>
                        {children}
                    </motion.div>
                </motion.div>
            ) : null}
        </AnimatePresence>
    );
}

export function UIDrawer({
    open,
    onClose,
    title,
    children,
}: {
    open: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <AnimatePresence>
            {open ? (
                <>
                    <motion.div
                        className={styles.drawerOverlay}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />
                    <motion.aside
                        className={styles.drawer}
                        initial={{ x: -40, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -30, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                            <h3>{title}</h3>
                            <UIButton variant="secondary" onClick={onClose}>إغلاق</UIButton>
                        </div>
                        {children}
                    </motion.aside>
                </>
            ) : null}
        </AnimatePresence>
    );
}

type ToastItem = { id: number; message: string };

type ToastContextType = {
    push: (message: string) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<ToastItem[]>([]);

    const value = useMemo<ToastContextType>(() => ({
        push: (message: string) => {
            const id = Date.now() + Math.floor(Math.random() * 1000);
            setItems((prev) => [...prev, { id, message }]);
            setTimeout(() => {
                setItems((prev) => prev.filter((item) => item.id !== id));
            }, 3000);
        },
    }), []);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div className={styles.toastStack}>
                <AnimatePresence>
                    {items.map((item) => (
                        <motion.div
                            key={item.id}
                            className={styles.toast}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 8 }}
                            transition={{ duration: 0.18 }}
                        >
                            {item.message}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used inside ToastProvider');
    }
    return context;
}
