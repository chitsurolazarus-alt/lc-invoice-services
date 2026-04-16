import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://uyhfmzhyvkbxcfwzihun.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5aGZtemh5dmtieGNmd3ppaHVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MDgyNzYsImV4cCI6MjA5MTQ4NDI3Nn0.cVWIavQPWWhPIepV55CBsVJbh1FwtbrvgsmKH8rChjc'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
export const currencySymbols = { ZAR: 'R', USD: '$', EUR: '€', GBP: '£' }

export const db = {
    async getProfile(userId) { const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single(); return { data, error } },
    async updateProfile(userId, updates) { const { data, error } = await supabase.from('profiles').update(updates).eq('id', userId); return { data, error } },
    async uploadLogo(userId, file) {
        const fileExt = file.name.split('.').pop(); const fileName = `${userId}/logo.${fileExt}`
        const { data, error } = await supabase.storage.from('logos').upload(fileName, file, { upsert: true })
        if (error) return { data: null, error }
        const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(fileName)
        return { data: publicUrl, error: null }
    },
    async getClients(userId) { const { data, error } = await supabase.from('clients').select('*').eq('user_id', userId).order('name'); return { data: data || [], error } },
    async createClient(clientData) { const { data, error } = await supabase.from('clients').insert([clientData]).select(); return { data, error } },
    async deleteClient(clientId) { const { error } = await supabase.from('clients').delete().eq('id', clientId); return { error } },
    async getInvoices(userId) { const { data, error } = await supabase.from('invoices').select(`*, clients (name, email)`).eq('user_id', userId).order('created_at', { ascending: false }); return { data: data || [], error } },
    async getInvoice(invoiceId) { const { data, error } = await supabase.from('invoices').select(`*, clients (*), invoice_items (*), profiles!invoices_user_id_fkey (*)`).eq('id', invoiceId).single(); return { data, error } },
    async createInvoice(invoiceData) { const { data, error } = await supabase.from('invoices').insert([invoiceData]).select(); return { data, error } },
    async updateInvoice(invoiceId, updates) { const { data, error } = await supabase.from('invoices').update(updates).eq('id', invoiceId); return { data, error } },
    async createInvoiceItem(itemData) { const { data, error } = await supabase.from('invoice_items').insert([itemData]).select(); return { data, error } },
    async updateInvoiceItem(itemId, updates) { const { data, error } = await supabase.from('invoice_items').update(updates).eq('id', itemId); return { data, error } },
    async deleteInvoiceItem(itemId) { const { error } = await supabase.from('invoice_items').delete().eq('id', itemId); return { error } }
}

export const auth = {
    async signUp(email, password, fullName, companyName = '', currency = 'ZAR') { const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, company_name: companyName, currency } } }); return { data, error } },
    async signIn(email, password) { const { data, error } = await supabase.auth.signInWithPassword({ email, password }); return { data, error } },
    async signOut() { const { error } = await supabase.auth.signOut(); return { error } },
    async getUser() { const { data: { user } } = await supabase.auth.getUser(); return user }
}