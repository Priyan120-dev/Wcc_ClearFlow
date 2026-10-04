import { Invoice, BankTxn, Match, PayerAlias, Reminder, AuditLogEntry } from '@/lib/types';
import { supabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase/admin';

// In-memory tenant store (fallback when Supabase credentials are not configured in local environment)
interface TenantData {
  invoices: Map<string, Invoice>;
  txns: Map<string, BankTxn>;
  matches: Map<string, Match>;
  aliases: Map<string, PayerAlias>;
  reminders: Map<string, Reminder>;
  auditLogs: AuditLogEntry[];
}

const memoryStore = new Map<string, TenantData>();

function getTenant(userId: string): TenantData {
  if (!memoryStore.has(userId)) {
    memoryStore.set(userId, {
      invoices: new Map(),
      txns: new Map(),
      matches: new Map(),
      aliases: new Map(),
      reminders: new Map(),
      auditLogs: [],
    });
  }
  return memoryStore.get(userId)!;
}

export const db = {
  // Invoices
  async getInvoices(userId: string): Promise<Invoice[]> {
    if (isSupabaseAdminConfigured && supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('invoices')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (!error && data) return data as Invoice[];
    }
    return Array.from(getTenant(userId).invoices.values());
  },

  async saveInvoices(userId: string, invoices: Invoice[]): Promise<void> {
    const tenant = getTenant(userId);
    for (const inv of invoices) {
      tenant.invoices.set(inv.id, { ...inv, user_id: userId });
    }

    if (isSupabaseAdminConfigured && supabaseAdmin) {
      const payload = invoices.map((inv) => ({ ...inv, user_id: userId }));
      await supabaseAdmin.from('invoices').upsert(payload, { onConflict: 'user_id, number' });
    }
  },

  async updateInvoice(userId: string, invoiceId: string, updates: Partial<Invoice>): Promise<Invoice | null> {
    const tenant = getTenant(userId);
    const existing = tenant.invoices.get(invoiceId);
    if (existing) {
      const updated = { ...existing, ...updates };
      tenant.invoices.set(invoiceId, updated);
      if (isSupabaseAdminConfigured && supabaseAdmin) {
        await supabaseAdmin.from('invoices').update(updates).eq('id', invoiceId).eq('user_id', userId);
      }
      return updated;
    }
    return null;
  },

  // Bank Transactions
  async getBankTxns(userId: string): Promise<BankTxn[]> {
    if (isSupabaseAdminConfigured && supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('bank_txns')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });
      if (!error && data) return data as BankTxn[];
    }
    return Array.from(getTenant(userId).txns.values());
  },

  async saveBankTxns(userId: string, txns: BankTxn[]): Promise<void> {
    const tenant = getTenant(userId);
    for (const txn of txns) {
      tenant.txns.set(txn.id, { ...txn, user_id: userId });
    }

    if (isSupabaseAdminConfigured && supabaseAdmin) {
      const payload = txns.map((t) => ({ ...t, user_id: userId }));
      await supabaseAdmin.from('bank_txns').upsert(payload, { onConflict: 'user_id, dedupe_hash' });
    }
  },

  // Matches
  async getMatches(userId: string): Promise<Match[]> {
    if (isSupabaseAdminConfigured && supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('matches')
        .select('*')
        .eq('user_id', userId);
      if (!error && data) return data as Match[];
    }
    return Array.from(getTenant(userId).matches.values());
  },

  async saveMatches(userId: string, matches: Match[]): Promise<void> {
    const tenant = getTenant(userId);
    for (const m of matches) {
      tenant.matches.set(m.id, { ...m, user_id: userId });
    }

    if (isSupabaseAdminConfigured && supabaseAdmin) {
      const payload = matches.map((m) => ({ ...m, user_id: userId }));
      await supabaseAdmin.from('matches').upsert(payload, { onConflict: 'invoice_id, txn_id' });
    }
  },

  async updateMatchStatus(userId: string, matchId: string, status: 'confirmed' | 'rejected'): Promise<Match | null> {
    const tenant = getTenant(userId);
    const existing = tenant.matches.get(matchId);
    if (!existing) return null;

    const updated = { ...existing, status, updated_at: new Date().toISOString() };
    tenant.matches.set(matchId, updated);

    if (isSupabaseAdminConfigured && supabaseAdmin) {
      await supabaseAdmin
        .from('matches')
        .update({ status, updated_at: updated.updated_at })
        .eq('id', matchId)
        .eq('user_id', userId);
    }

    return updated;
  },

  // Payer Aliases
  async getPayerAliases(userId: string): Promise<PayerAlias[]> {
    if (isSupabaseAdminConfigured && supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('payer_aliases')
        .select('*')
        .eq('user_id', userId);
      if (!error && data) return data as PayerAlias[];
    }
    return Array.from(getTenant(userId).aliases.values());
  },

  async savePayerAlias(userId: string, rawAlias: string, customerName: string): Promise<PayerAlias> {
    const tenant = getTenant(userId);
    const id = `alias-${Date.now()}`;
    const aliasObj: PayerAlias = {
      id,
      user_id: userId,
      raw_alias: rawAlias.toUpperCase().trim(),
      customer_name: customerName.trim(),
      created_at: new Date().toISOString(),
    };
    tenant.aliases.set(id, aliasObj);

    if (isSupabaseAdminConfigured && supabaseAdmin) {
      await supabaseAdmin.from('payer_aliases').upsert(aliasObj, { onConflict: 'user_id, raw_alias' });
    }
    return aliasObj;
  },

  // Reminders
  async getReminders(userId: string): Promise<Reminder[]> {
    if (isSupabaseAdminConfigured && supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('reminders')
        .select('*')
        .eq('user_id', userId);
      if (!error && data) return data as Reminder[];
    }
    return Array.from(getTenant(userId).reminders.values());
  },

  async saveReminders(userId: string, reminders: Reminder[]): Promise<void> {
    const tenant = getTenant(userId);
    for (const r of reminders) {
      tenant.reminders.set(r.id, { ...r, user_id: userId });
    }

    if (isSupabaseAdminConfigured && supabaseAdmin) {
      const payload = reminders.map((r) => ({ ...r, user_id: userId }));
      await supabaseAdmin.from('reminders').upsert(payload);
    }
  },

  async updateReminderStatus(userId: string, reminderId: string, status: 'approved' | 'sent'): Promise<Reminder | null> {
    const tenant = getTenant(userId);
    const existing = tenant.reminders.get(reminderId);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updated: Reminder = {
      ...existing,
      status,
      last_reminded_at: status === 'sent' ? now : existing.last_reminded_at,
    };
    tenant.reminders.set(reminderId, updated);

    if (isSupabaseAdminConfigured && supabaseAdmin) {
      await supabaseAdmin
        .from('reminders')
        .update({
          status,
          last_reminded_at: updated.last_reminded_at,
        })
        .eq('id', reminderId)
        .eq('user_id', userId);
    }
    return updated;
  },

  // Audit Log
  async addAuditLog(
    userId: string,
    entry: Omit<AuditLogEntry, 'id' | 'user_id' | 'ts'>
  ): Promise<void> {
    const log: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      user_id: userId,
      ...entry,
      ts: new Date().toISOString(),
    };
    getTenant(userId).auditLogs.unshift(log);

    if (isSupabaseAdminConfigured && supabaseAdmin) {
      await supabaseAdmin.from('audit_log').insert(log);
    }
  },

  async getAuditLogs(userId: string): Promise<AuditLogEntry[]> {
    if (isSupabaseAdminConfigured && supabaseAdmin) {
      const { data } = await supabaseAdmin
        .from('audit_log')
        .select('*')
        .eq('user_id', userId)
        .order('ts', { ascending: false });
      if (data) return data as AuditLogEntry[];
    }
    return getTenant(userId).auditLogs;
  },

  // Delete all my data (Strictly user's own data)
  async purgeUserData(userId: string): Promise<void> {
    memoryStore.delete(userId);

    if (isSupabaseAdminConfigured && supabaseAdmin) {
      await Promise.all([
        supabaseAdmin.from('invoices').delete().eq('user_id', userId),
        supabaseAdmin.from('bank_txns').delete().eq('user_id', userId),
        supabaseAdmin.from('matches').delete().eq('user_id', userId),
        supabaseAdmin.from('payer_aliases').delete().eq('user_id', userId),
        supabaseAdmin.from('reminders').delete().eq('user_id', userId),
        supabaseAdmin.from('audit_log').delete().eq('user_id', userId),
      ]);
    }
  },
};
