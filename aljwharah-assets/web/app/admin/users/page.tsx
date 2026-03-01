'use client';

import { useEffect, useState } from 'react';
import { apiFetch, parseApiError } from '../../../lib/api';
import { getAccessToken } from '../../../lib/auth';
import { UIButton, UICard, UIInput, UISelect, UITable, useToast } from '../../../components/ui-kit';

type UserItem = {
    id: string;
    email?: string;
    name?: string;
    role: 'USER' | 'ADMIN' | 'AGENT' | 'SUPERADMIN';
    created_at: string;
};

export default function AdminUsersPage() {
    const { push } = useToast();
    const [users, setUsers] = useState<UserItem[]>([]);
    const [q, setQ] = useState('');

    const load = async () => {
        const token = getAccessToken();
        if (!token) return;
        try {
            const res = await apiFetch<{ items: UserItem[] }>(`/owner/users?page=1&pageSize=200&q=${encodeURIComponent(q)}`, {}, token);
            setUsers(res.items || []);
        } catch (err) {
            push(parseApiError(err));
        }
    };

    useEffect(() => {
        load();
    }, [q]);

    return (
        <UICard>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
                <UIInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالمستخدم" />
                <UIButton type="button" onClick={load}>تحديث</UIButton>
            </div>
            <UITable>
                <thead>
                    <tr>
                        <th>المستخدم</th>
                        <th>الدور</th>
                        <th>التسجيل</th>
                        <th>إجراء</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map((user) => (
                        <tr key={user.id}>
                            <td>
                                <div style={{ display: 'grid', gap: 4 }}>
                                    <strong>{user.name || '—'}</strong>
                                    <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{user.email || user.id}</span>
                                </div>
                            </td>
                            <td>{user.role}</td>
                            <td>{new Date(user.created_at).toLocaleDateString('ar-SA')}</td>
                            <td>
                                <RoleAction user={user} onDone={load} />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </UITable>
        </UICard>
    );
}

function RoleAction({ user, onDone }: { user: UserItem; onDone: () => void }) {
    const { push } = useToast();
    const [role, setRole] = useState<UserItem['role']>(user.role);
    const [reason, setReason] = useState('');

    return (
        <div style={{ display: 'grid', gap: 6 }}>
            <UISelect value={role} onChange={(e) => setRole(e.target.value as UserItem['role'])}>
                <option value="USER">USER</option>
                <option value="AGENT">AGENT</option>
                <option value="ADMIN">ADMIN</option>
                <option value="SUPERADMIN">SUPERADMIN</option>
            </UISelect>
            <UIInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب" />
            <UIButton
                type="button"
                variant="secondary"
                onClick={async () => {
                    if (!reason.trim()) {
                        push('سبب التعديل مطلوب');
                        return;
                    }
                    const token = getAccessToken();
                    if (!token) return;
                    try {
                        await apiFetch(`/owner/users/${user.id}/role`, {
                            method: 'PATCH',
                            body: JSON.stringify({ role, reason }),
                        }, token);
                        push('تم تحديث الدور');
                        onDone();
                    } catch (err) {
                        push(parseApiError(err));
                    }
                }}
            >
                حفظ
            </UIButton>
        </div>
    );
}
