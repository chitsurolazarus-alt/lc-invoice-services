import { db, auth } from './supabase.js'

const user = await auth.getUser()
if (!user) window.location.href = 'index.html'

document.getElementById('userName').textContent = user.user_metadata?.full_name || user.email
document.getElementById('logoutBtn').addEventListener('click', async () => { await auth.signOut(); window.location.href = 'index.html' })

async function loadDashboard() {
    const { data: invoices } = await db.getInvoices(user.id)
    let total = 0, paid = 0, pending = 0, overdue = 0
    invoices?.forEach(inv => {
        const amount = parseFloat(inv.total) || 0
        total++
        if (inv.status === 'paid') paid += amount
        else if (inv.status === 'sent') pending += amount
        else if (inv.status === 'overdue') overdue += amount
    })
    document.getElementById('totalInvoices').textContent = total
    document.getElementById('paidInvoices').textContent = `R${paid.toFixed(2)}`
    document.getElementById('pendingInvoices').textContent = `R${pending.toFixed(2)}`
    document.getElementById('overdueInvoices').textContent = `R${overdue.toFixed(2)}`
    
    const tbody = document.getElementById('invoicesTableBody')
    tbody.innerHTML = ''
    invoices?.forEach(inv => {
        const row = tbody.insertRow()
        const isPaid = inv.status === 'paid'
        row.innerHTML = `
            <td><span style="font-weight:500;">${inv.invoice_number}</span></td>
            <td>${inv.clients?.name || 'N/A'}</td>
            <td>${inv.issue_date}</td>
            <td>${inv.due_date}</td>
            <td style="font-weight:600;">R${parseFloat(inv.total).toFixed(2)}</td>
            <td><span class="badge badge-${inv.status}">${inv.status}</span></td>
            <td>
                <a href="invoice.html?id=${inv.id}" class="btn btn-sm btn-outline-primary me-1"><i class="bi bi-pencil"></i></a>
                ${!isPaid ? `<button class="btn btn-sm btn-paid mark-paid-dash" data-id="${inv.id}"><i class="bi bi-check-lg"></i> Paid</button>` : ''}
            </td>
        `
    })
    document.querySelectorAll('.mark-paid-dash').forEach(b => b.addEventListener('click', async (e) => {
        if (confirm('Mark this invoice as paid?')) {
            await db.updateInvoice(e.currentTarget.dataset.id, { status: 'paid' })
            loadDashboard()
        }
    }))
}

async function loadClients() {
    const { data: clients } = await db.getClients(user.id)
    const select = document.getElementById('invoiceClient')
    select.innerHTML = '<option value="">Select client...</option>'
    clients?.forEach(c => { const opt = document.createElement('option'); opt.value = c.id; opt.textContent = c.name; select.appendChild(opt) })
    const tbody = document.getElementById('clientsTableBody')
    tbody.innerHTML = ''
    clients?.forEach(c => {
        const row = tbody.insertRow()
        row.innerHTML = `<td>${c.name}</td><td>${c.email || '-'}</td><td>${c.phone || '-'}</td><td><button class="btn btn-sm btn-outline-danger delete-client" data-id="${c.id}"><i class="bi bi-trash"></i></button></td>`
    })
    document.querySelectorAll('.delete-client').forEach(b => b.addEventListener('click', async (e) => {
        if (confirm('Delete this client?')) { await db.deleteClient(e.currentTarget.dataset.id); loadClients() }
    }))
}

document.getElementById('quickInvoiceForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    const { data } = await db.createInvoice({
        user_id: user.id, client_id: document.getElementById('invoiceClient').value,
        invoice_number: document.getElementById('invoiceNumber').value,
        issue_date: document.getElementById('invoiceIssueDate').value,
        due_date: document.getElementById('invoiceDueDate').value,
        currency: 'ZAR', status: 'draft', subtotal: 0, tax_rate: 0, tax_amount: 0, total: 0
    })
    window.location.href = `invoice.html?id=${data[0].id}`
})

document.getElementById('showAddClientBtn').addEventListener('click', () => document.getElementById('addClientForm').classList.remove('d-none'))
document.getElementById('hideAddClientBtn').addEventListener('click', () => { document.getElementById('addClientForm').classList.add('d-none'); document.getElementById('clientForm').reset() })

document.getElementById('clientForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    await db.createClient({
        user_id: user.id, name: document.getElementById('clientName').value,
        email: document.getElementById('clientEmail').value, phone: document.getElementById('clientPhone').value,
        address: document.getElementById('clientAddress').value, city: document.getElementById('clientCity').value,
        state: document.getElementById('clientState').value, zip: document.getElementById('clientZip').value,
        country: document.getElementById('clientCountry').value
    })
    document.getElementById('hideAddClientBtn').click()
    loadClients()
})

// SETTINGS FORM WITH LOGO UPLOAD
document.getElementById('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    await db.updateProfile(user.id, {
        company_name: document.getElementById('settingsCompanyName').value,
        company_address: document.getElementById('settingsAddress').value,
        company_phone: document.getElementById('settingsPhone').value,
        company_email: document.getElementById('settingsEmail').value
    })
    alert('Company settings saved successfully! Your logo will now appear on all invoices and PDFs.')
    bootstrap.Modal.getInstance(document.getElementById('settingsModal')).hide()
})

// LOGO UPLOAD WITH PREVIEW
document.getElementById('logoUpload').addEventListener('change', async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    // Validate file size
    if (file.size > 2 * 1024 * 1024) {
        alert('File size must be less than 2MB')
        return
    }
    
    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
        alert('Please upload a valid image file (PNG, JPG, GIF, WEBP)')
        return
    }
    
    // Show loading state
    const preview = document.getElementById('logoPreview')
    preview.style.opacity = '0.5'
    
    // Upload logo
    const { data: publicUrl, error } = await db.uploadLogo(user.id, file)
    
    if (error) {
        alert('Error uploading logo: ' + error.message)
        preview.style.opacity = '1'
        return
    }
    
    // Update preview
    preview.src = publicUrl
    preview.style.opacity = '1'
    
    // Save to profile
    await db.updateProfile(user.id, { company_logo: publicUrl })
    
    // Update navbar logo
    const navLogo = document.getElementById('navLogo')
    if (navLogo) navLogo.src = publicUrl
    
    alert('Logo uploaded successfully! It will appear on all your invoices and PDF documents.')
})

// Load profile settings when modal opens
document.getElementById('settingsModal').addEventListener('show.bs.modal', async () => {
    const { data: p } = await db.getProfile(user.id)
    if (p) {
        document.getElementById('settingsCompanyName').value = p.company_name || ''
        document.getElementById('settingsAddress').value = p.company_address || ''
        document.getElementById('settingsPhone').value = p.company_phone || ''
        document.getElementById('settingsEmail').value = p.company_email || ''
        if (p.company_logo) {
            document.getElementById('logoPreview').src = p.company_logo
            const navLogo = document.getElementById('navLogo')
            if (navLogo) navLogo.src = p.company_logo
        }
    }
})

// Set default dates
const today = new Date().toISOString().split('T')[0]
const nextMonth = new Date(); nextMonth.setMonth(nextMonth.getMonth() + 1)
document.getElementById('invoiceIssueDate').value = today
document.getElementById('invoiceDueDate').value = nextMonth.toISOString().split('T')[0]

loadDashboard()
loadClients()