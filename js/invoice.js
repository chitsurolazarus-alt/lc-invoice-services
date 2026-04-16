import { db, auth, currencySymbols } from './supabase.js'

const user = await auth.getUser()
if (!user) window.location.href = 'index.html'

const urlParams = new URLSearchParams(window.location.search)
const invoiceId = urlParams.get('id')

let currentInvoice = null, invoiceItems = [], clients = [], profile = null

async function loadInvoice() {
    const { data: clientsData } = await db.getClients(user.id)
    clients = clientsData || []
    const select = document.getElementById('invoiceClientSelect')
    select.innerHTML = '<option value="">Select client...</option>'
    clients.forEach(c => { const opt = document.createElement('option'); opt.value = c.id; opt.textContent = c.name; select.appendChild(opt) })
    
    const { data: p } = await db.getProfile(user.id)
    profile = p
    if (profile) {
        document.getElementById('companyInfo').innerHTML = `<strong style="font-size:1.2rem;">${profile.company_name || 'L.C Invoice Services'}</strong><br>${profile.company_address || ''}<br>${profile.company_phone ? '📞 ' + profile.company_phone : ''}<br>${profile.company_email ? '✉️ ' + profile.company_email : ''}`
        document.getElementById('companyDisplayName').textContent = profile.company_name || 'L.C Invoice Services'
    }
    
    if (!invoiceId) {
        document.getElementById('editIssueDate').value = new Date().toISOString().split('T')[0]
        const nm = new Date(); nm.setMonth(nm.getMonth() + 1)
        document.getElementById('editDueDate').value = nm.toISOString().split('T')[0]
        return
    }
    
    const { data: inv } = await db.getInvoice(invoiceId)
    if (!inv) return
    currentInvoice = inv
    invoiceItems = inv.invoice_items || []
    
    document.getElementById('displayInvoiceNumber').textContent = inv.invoice_number || 'INV-001'
    document.getElementById('invoiceClientSelect').value = inv.client_id || ''
    document.getElementById('editIssueDate').value = inv.issue_date
    document.getElementById('editDueDate').value = inv.due_date
    document.getElementById('taxRateInput').value = inv.tax_rate || 0
    document.getElementById('invoiceNotes').value = inv.notes || ''
    document.getElementById('editCurrency').value = inv.currency || 'ZAR'
    
    updateStatusDisplay(inv.status)
    updateClientDetails()
    updateCurrencySymbols()
    renderItems()
    calculateTotals()
}

function updateStatusDisplay(status) {
    const statusDisplay = document.getElementById('statusDisplay')
    const paidSection = document.getElementById('paidConfirmationSection')
    const markPaidBtn = document.getElementById('markAsPaidBtn')
    
    const statusClasses = { draft: 'status-draft', sent: 'status-sent', paid: 'status-paid', overdue: 'status-overdue' }
    statusDisplay.className = `status-badge ${statusClasses[status] || 'status-draft'}`
    statusDisplay.textContent = status.charAt(0).toUpperCase() + status.slice(1)
    
    if (status === 'paid') {
        paidSection.classList.remove('d-none')
        markPaidBtn.style.display = 'none'
    } else {
        paidSection.classList.add('d-none')
        markPaidBtn.style.display = 'block'
    }
}

function updateCurrencySymbols() {
    const sym = currencySymbols[document.getElementById('editCurrency').value] || 'R'
    document.getElementById('currencySymbol').textContent = sym
    document.getElementById('currencySymbol2').textContent = sym
    document.getElementById('currencySymbol3').textContent = sym
}

function updateClientDetails() {
    const client = clients.find(c => c.id === document.getElementById('invoiceClientSelect').value)
    document.getElementById('clientDetails').innerHTML = client ? `<strong style="font-size:1.1rem;">${client.name}</strong><br>${client.address || ''}<br>${client.city || ''} ${client.state || ''} ${client.zip || ''}<br>${client.country || ''}<br>${client.email ? '✉️ ' + client.email : ''}<br>${client.phone ? '📞 ' + client.phone : ''}` : '<p class="text-muted">Select a client</p>'
}

function renderItems() {
    const tbody = document.getElementById('itemsTableBody')
    const sym = currencySymbols[document.getElementById('editCurrency').value] || 'R'
    tbody.innerHTML = ''
    invoiceItems.forEach(item => {
        const row = tbody.insertRow()
        row.innerHTML = `
            <td><input type="text" class="form-control form-control-sm" value="${item.description || ''}" data-id="${item.id}" data-field="description" placeholder="Item description"></td>
            <td><input type="number" class="form-control form-control-sm" value="${item.quantity || 1}" data-id="${item.id}" data-field="quantity" step="0.01" min="0"></td>
            <td><div class="input-group input-group-sm"><span class="input-group-text">${sym}</span><input type="number" class="form-control" value="${item.rate || 0}" data-id="${item.id}" data-field="rate" step="0.01" min="0"></div></td>
            <td class="text-end align-middle fw-semibold">${sym}${((item.quantity || 0) * (item.rate || 0)).toFixed(2)}</td>
            <td><button class="btn btn-sm btn-outline-danger" data-id="${item.id}"><i class="bi bi-trash"></i></button></td>
        `
    })
    document.querySelectorAll('#itemsTableBody input').forEach(i => i.addEventListener('change', updateItem))
    document.querySelectorAll('#itemsTableBody .btn-outline-danger').forEach(b => b.addEventListener('click', deleteItem))
}

function calculateTotals() {
    const subtotal = invoiceItems.reduce((s, i) => s + ((i.quantity || 0) * (i.rate || 0)), 0)
    const tax = subtotal * ((parseFloat(document.getElementById('taxRateInput').value) || 0) / 100)
    document.getElementById('subtotalDisplay').textContent = subtotal.toFixed(2)
    document.getElementById('taxAmountDisplay').textContent = tax.toFixed(2)
    document.getElementById('totalDisplay').textContent = (subtotal + tax).toFixed(2)
}

function updateItem(e) {
    const item = invoiceItems.find(i => i.id === e.target.dataset.id)
    if (!item) return
    item[e.target.dataset.field] = e.target.dataset.field === 'description' ? e.target.value : parseFloat(e.target.value) || 0
    calculateTotals()
    renderItems()
}

function deleteItem(e) {
    invoiceItems = invoiceItems.filter(i => i.id !== e.currentTarget.dataset.id)
    renderItems()
    calculateTotals()
}

document.getElementById('addItemBtn').addEventListener('click', () => {
    invoiceItems.push({ id: 'temp_' + Date.now(), description: '', quantity: 1, rate: 0 })
    renderItems()
})

document.getElementById('editCurrency').addEventListener('change', updateCurrencySymbols)
document.getElementById('invoiceClientSelect').addEventListener('change', updateClientDetails)
document.getElementById('taxRateInput').addEventListener('input', calculateTotals)

async function saveInvoice() {
    if (!currentInvoice && !invoiceId) return
    try {
        const invoiceData = {
            client_id: document.getElementById('invoiceClientSelect').value || null,
            issue_date: document.getElementById('editIssueDate').value,
            due_date: document.getElementById('editDueDate').value,
            currency: document.getElementById('editCurrency').value,
            notes: document.getElementById('invoiceNotes').value,
            subtotal: parseFloat(document.getElementById('subtotalDisplay').textContent) || 0,
            tax_rate: parseFloat(document.getElementById('taxRateInput').value) || 0,
            tax_amount: parseFloat(document.getElementById('taxAmountDisplay').textContent) || 0,
            total: parseFloat(document.getElementById('totalDisplay').textContent) || 0
        }
        const currentId = currentInvoice?.id || invoiceId
        if (currentId) await db.updateInvoice(currentId, invoiceData)
    } catch (e) { console.error('Save error:', e) }
}

document.getElementById('markAsPaidBtn').addEventListener('click', async () => {
    if (!currentInvoice && !invoiceId) { alert('Please save the invoice first'); return }
    if (!confirm('Mark this invoice as paid?')) return
    
    try {
        const currentId = currentInvoice?.id || invoiceId
        await db.updateInvoice(currentId, { status: 'paid' })
        if (currentInvoice) currentInvoice.status = 'paid'
        updateStatusDisplay('paid')
        await saveInvoice()
    } catch (e) { alert('Error: ' + e.message) }
})

// ============================================
// FIXED PDF - NO ENCODING ISSUES, PERFECT ALIGNMENT
// ============================================
async function downloadPDF() {
    try {
        const { jsPDF } = window.jspdf
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
        
        // Use standard fonts only - NO custom fonts that cause encoding issues
        doc.setFont('helvetica', 'normal')
        
        const sym = currencySymbols[document.getElementById('editCurrency').value] || 'R'
        const client = clients.find(c => c.id === document.getElementById('invoiceClientSelect').value)
        const invoiceNumber = document.getElementById('displayInvoiceNumber').textContent
        
        // Clean text - remove any special characters that might cause encoding issues
        const cleanText = (text) => {
            if (!text) return ''
            return String(text).replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII characters
        }
        
        const pageWidth = 210
        const pageHeight = 297
        const margin = 15
        
        // ============================================
        // HEADER BANNER
        // ============================================
        doc.setFillColor(88, 28, 135)
        doc.rect(0, 0, pageWidth, 50, 'F')
        
        doc.setFillColor(236, 72, 153)
        doc.rect(0, 47, pageWidth, 3, 'F')
        
        // Company Name
        doc.setFontSize(26)
        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
        const companyName = profile?.company_name || 'L.C Invoice Services'
        doc.text(companyName, margin, 22)
        
        doc.setFontSize(10)
        doc.setTextColor(226, 232, 240)
        doc.setFont('helvetica', 'normal')
        
        const address = profile?.company_address || ''
        if (address) doc.text(address, margin, 32)
        
        const contactInfo = [profile?.company_phone, profile?.company_email].filter(Boolean).join('  |  ')
        if (contactInfo) doc.text(contactInfo, margin, 39)
        
        // INVOICE Badge
        doc.setFillColor(236, 72, 153)
        doc.roundedRect(pageWidth - margin - 60, 8, 60, 36, 6, 6, 'F')
        
        doc.setFontSize(10)
        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
        doc.text('INVOICE', pageWidth - margin - 30, 20, { align: 'center' })
        
        doc.setFontSize(14)
        doc.text(`#${invoiceNumber}`, pageWidth - margin - 30, 33, { align: 'center' })
        
        // ============================================
        // BILL TO SECTION
        // ============================================
        let yPos = 68
        
        // Section label
        doc.setFillColor(139, 92, 246)
        doc.roundedRect(margin, yPos - 5, 60, 9, 4, 4, 'F')
        doc.setFontSize(10)
        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
        doc.text('BILL TO', margin + 5, yPos + 1)
        
        yPos += 12
        
        // Client Name
        doc.setFontSize(14)
        doc.setTextColor(30, 41, 59)
        doc.setFont('helvetica', 'bold')
        const clientName = client?.name || 'N/A'
        doc.text(clientName, margin, yPos)
        
        yPos += 8
        doc.setFontSize(10)
        doc.setTextColor(71, 85, 105)
        doc.setFont('helvetica', 'normal')
        
        // Client Address - line by line for proper alignment
        if (client?.address) {
            doc.text(client.address, margin, yPos)
            yPos += 5
        }
        
        const cityLine = [client?.city, client?.state, client?.zip].filter(Boolean).join(', ')
        if (cityLine) {
            doc.text(cityLine, margin, yPos)
            yPos += 5
        }
        
        if (client?.country) {
            doc.text(client.country, margin, yPos)
            yPos += 5
        }
        
        if (client?.email) {
            doc.text(`Email: ${client.email}`, margin, yPos)
            yPos += 5
        }
        
        if (client?.phone) {
            doc.text(`Tel: ${client.phone}`, margin, yPos)
            yPos += 5
        }
        
        // ============================================
        // INVOICE DETAILS (Right side)
        // ============================================
        const detailsX = 120
        let detailsY = 65
        
        doc.setFillColor(236, 72, 153)
        doc.roundedRect(detailsX, detailsY - 5, 55, 9, 4, 4, 'F')
        doc.setFontSize(10)
        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
        doc.text('DETAILS', detailsX + 5, detailsY + 1)
        
        detailsY += 14
        doc.setFontSize(10)
        doc.setTextColor(71, 85, 105)
        doc.setFont('helvetica', 'normal')
        
        // Issue Date
        doc.text('Issue Date:', detailsX, detailsY)
        doc.text(document.getElementById('editIssueDate').value, detailsX + 45, detailsY)
        detailsY += 7
        
        // Due Date
        doc.text('Due Date:', detailsX, detailsY)
        doc.text(document.getElementById('editDueDate').value, detailsX + 45, detailsY)
        detailsY += 7
        
        // Currency
        doc.text('Currency:', detailsX, detailsY)
        doc.text(document.getElementById('editCurrency').value, detailsX + 45, detailsY)
        detailsY += 9
        
        // Status Badge
        const status = currentInvoice?.status || 'draft'
        const statusColors = { 
            paid: [16, 185, 129], 
            sent: [245, 158, 11], 
            draft: [100, 116, 139], 
            overdue: [239, 68, 68] 
        }
        const statusColor = statusColors[status] || [100, 116, 139]
        
        doc.setFillColor(statusColor[0], statusColor[1], statusColor[2])
        doc.roundedRect(detailsX, detailsY - 4, 50, 9, 4, 4, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.text(status.toUpperCase(), detailsX + 8, detailsY + 2)
        
        // ============================================
        // ITEMS TABLE
        // ============================================
        yPos = Math.max(yPos + 5, 135)
        
        // Table Header
        doc.setFillColor(88, 28, 135)
        doc.roundedRect(margin - 2, yPos - 5, pageWidth - margin*2 + 4, 12, 4, 4, 'F')
        
        doc.setFontSize(10)
        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
        doc.text('Description', margin + 5, yPos + 3)
        doc.text('Qty', 108, yPos + 3)
        doc.text('Rate', 135, yPos + 3)
        doc.text('Amount', pageWidth - margin - 5, yPos + 3, { align: 'right' })
        
        yPos += 12
        
        // Table Rows
        doc.setFontSize(10)
        doc.setTextColor(51, 65, 85)
        doc.setFont('helvetica', 'normal')
        
        invoiceItems.forEach((item, index) => {
            // Alternating row background
            if (index % 2 === 0) {
                doc.setFillColor(248, 250, 252)
                doc.rect(margin - 2, yPos - 5, pageWidth - margin*2 + 4, 9, 'F')
            }
            
            const desc = item.description || '-'
            const descLines = doc.splitTextToSize(desc, 80)
            doc.text(descLines, margin + 5, yPos)
            
            const lineHeight = Math.max(9, descLines.length * 5)
            const midY = yPos + (lineHeight / 2) - 1
            
            doc.text(String(item.quantity || 0), 108, midY)
            doc.text(`${sym}${(item.rate || 0).toFixed(2)}`, 135, midY)
            doc.text(`${sym}${((item.quantity || 0) * (item.rate || 0)).toFixed(2)}`, pageWidth - margin - 5, midY, { align: 'right' })
            
            yPos += lineHeight
            
            if (yPos > 245) {
                doc.addPage()
                doc.setFillColor(88, 28, 135)
                doc.rect(0, 0, pageWidth, 25, 'F')
                doc.setFillColor(236, 72, 153)
                doc.rect(0, 23, pageWidth, 2, 'F')
                yPos = 40
            }
        })
        
        // ============================================
        // TOTALS SECTION
        // ============================================
        yPos += 5
        
        doc.setDrawColor(200, 200, 200)
        doc.setLineWidth(0.5)
        doc.line(margin, yPos - 2, pageWidth - margin, yPos - 2)
        
        const subtotal = parseFloat(document.getElementById('subtotalDisplay').textContent) || 0
        const taxRate = parseFloat(document.getElementById('taxRateInput').value) || 0
        const tax = parseFloat(document.getElementById('taxAmountDisplay').textContent) || 0
        const total = parseFloat(document.getElementById('totalDisplay').textContent) || 0
        
        const col1X = 120
        const col2X = pageWidth - margin
        
        doc.setFontSize(10)
        doc.setTextColor(71, 85, 105)
        doc.setFont('helvetica', 'normal')
        doc.text('Subtotal:', col1X, yPos)
        doc.text(`${sym}${subtotal.toFixed(2)}`, col2X, yPos, { align: 'right' })
        yPos += 7
        
        doc.text(`Tax (${taxRate}%):`, col1X, yPos)
        doc.text(`${sym}${tax.toFixed(2)}`, col2X, yPos, { align: 'right' })
        yPos += 9
        
        // Total Row
        doc.setFillColor(88, 28, 135)
        doc.roundedRect(col1X - 8, yPos - 5, col2X - col1X + 18, 12, 5, 5, 'F')
        
        doc.setFontSize(13)
        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
        doc.text('TOTAL DUE:', col1X, yPos + 3)
        doc.text(`${sym}${total.toFixed(2)}`, col2X, yPos + 3, { align: 'right' })
        
        yPos += 18
        
        // ============================================
        // NOTES SECTION
        // ============================================
        const notes = document.getElementById('invoiceNotes').value
        if (notes) {
            doc.setFillColor(139, 92, 246)
            doc.roundedRect(margin, yPos - 5, 50, 9, 4, 4, 'F')
            doc.setFontSize(10)
            doc.setTextColor(255, 255, 255)
            doc.setFont('helvetica', 'bold')
            doc.text('NOTES', margin + 5, yPos + 1)
            
            yPos += 10
            doc.setFontSize(9)
            doc.setTextColor(71, 85, 105)
            doc.setFont('helvetica', 'normal')
            const noteLines = doc.splitTextToSize(notes, pageWidth - margin*2)
            doc.text(noteLines, margin, yPos)
            yPos += noteLines.length * 5 + 8
        }
        
        // ============================================
        // FOOTER
        // ============================================
        doc.setDrawColor(236, 72, 153)
        doc.setLineWidth(1.5)
        doc.line(margin, pageHeight - 25, pageWidth - margin, pageHeight - 25)
        
        doc.setFontSize(10)
        doc.setTextColor(139, 92, 246)
        doc.setFont('helvetica', 'bold')
        doc.text('Thank you for your business!', pageWidth/2, pageHeight - 17, { align: 'center' })
        
        doc.setFontSize(8)
        doc.setTextColor(148, 163, 184)
        doc.setFont('helvetica', 'normal')
        doc.text('Created by L.C Digital Solution | www.lcdigitalsolution.co.za', pageWidth/2, pageHeight - 10, { align: 'center' })
        
        // ============================================
        // PAID WATERMARK
        // ============================================
        if (status === 'paid') {
            doc.setFontSize(50)
            doc.setTextColor(16, 185, 129)
            const gState = new doc.GState({ opacity: 0.15 })
            doc.setGState(gState)
            doc.setFont('helvetica', 'bold')
            doc.text('PAID', pageWidth/2, pageHeight/2, { align: 'center', angle: -30 })
            const resetGState = new doc.GState({ opacity: 1 })
            doc.setGState(resetGState)
        }
        
        doc.save(`Invoice_${invoiceNumber}.pdf`)
        await saveInvoice()
    } catch (e) {
        console.error('PDF error:', e)
        alert('PDF generation failed. Please try again.')
    }
}

document.getElementById('downloadPdfBtn').addEventListener('click', downloadPDF)
document.getElementById('downloadPreviewPdfBtn').addEventListener('click', downloadPDF)

// Preview
document.getElementById('previewInvoiceBtn').addEventListener('click', () => {
    const client = clients.find(c => c.id === document.getElementById('invoiceClientSelect').value)
    const sym = currencySymbols[document.getElementById('editCurrency').value] || 'R'
    let itemsHtml = ''
    invoiceItems.forEach(item => {
        itemsHtml += `<tr><td style="padding:12px; border-bottom:1px solid #e9d5ff;">${item.description || '-'}</td><td style="padding:12px; border-bottom:1px solid #e9d5ff; text-align:center;">${item.quantity || 0}</td><td style="padding:12px; border-bottom:1px solid #e9d5ff; text-align:right;">${sym}${(item.rate || 0).toFixed(2)}</td><td style="padding:12px; border-bottom:1px solid #e9d5ff; text-align:right;">${sym}${((item.quantity || 0) * (item.rate || 0)).toFixed(2)}</td></tr>`
    })
    const subtotal = parseFloat(document.getElementById('subtotalDisplay').textContent) || 0
    const taxRate = parseFloat(document.getElementById('taxRateInput').value) || 0
    const tax = parseFloat(document.getElementById('taxAmountDisplay').textContent) || 0
    const total = parseFloat(document.getElementById('totalDisplay').textContent) || 0
    const status = currentInvoice?.status || 'draft'
    
    document.getElementById('previewContent').innerHTML = `
        <div style="font-family:'Segoe UI', Arial, sans-serif; max-width:850px; margin:0 auto; background:white; border-radius:20px; overflow:hidden; box-shadow:0 20px 40px rgba(0,0,0,0.15);">
            <div style="background: linear-gradient(135deg, #581c87 0%, #7e22ce 100%); padding: 30px 35px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h2 style="margin:0; font-weight:700; font-size:28px; color:white;">${profile?.company_name || 'L.C Invoice Services'}</h2>
                        <p style="margin:5px 0 0; color:#e9d5ff; font-size:13px;">${profile?.company_address || ''}</p>
                        <p style="margin:3px 0 0; color:#e9d5ff; font-size:12px;">${profile?.company_phone || ''} ${profile?.company_email ? '| ' + profile.company_email : ''}</p>
                    </div>
                    <div style="background:#ec4899; padding: 15px 25px; border-radius: 16px;">
                        <div style="font-size:11px; color:#fce7f3; letter-spacing:2px;">INVOICE</div>
                        <div style="font-size:26px; font-weight:700; color:white;">#${document.getElementById('displayInvoiceNumber').textContent}</div>
                    </div>
                </div>
            </div>
            <div style="padding: 30px 35px;">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:30px; margin-bottom:30px;">
                    <div>
                        <div style="background:#a855f7; display:inline-block; padding:5px 16px; border-radius:20px; color:white; font-size:11px; font-weight:600; letter-spacing:1px; margin-bottom:12px;">BILL TO</div>
                        <div style="font-weight:700; font-size:18px; color:#1e1b4b; margin-bottom:8px;">${client?.name || 'N/A'}</div>
                        <div style="color:#4c1d95; line-height:1.6; font-size:13px;">
                            ${client?.address ? client.address + '<br>' : ''}
                            ${client?.city || ''} ${client?.state || ''} ${client?.zip || ''}<br>
                            ${client?.country || ''}<br>
                            ${client?.email ? client.email + '<br>' : ''}
                            ${client?.phone || ''}
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <div style="background:#ec4899; display:inline-block; padding:5px 16px; border-radius:20px; color:white; font-size:11px; font-weight:600; letter-spacing:1px; margin-bottom:12px;">DETAILS</div>
                        <div style="background:#fdf4ff; padding:16px 20px; border-radius:16px; display:inline-block; text-align:left; min-width:200px;">
                            <div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span style="color:#6b21a8; font-size:13px;">Issue Date:</span> <span style="font-weight:600; font-size:13px;">${document.getElementById('editIssueDate').value}</span></div>
                            <div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span style="color:#6b21a8; font-size:13px;">Due Date:</span> <span style="font-weight:600; font-size:13px;">${document.getElementById('editDueDate').value}</span></div>
                            <div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span style="color:#6b21a8; font-size:13px;">Currency:</span> <span style="font-weight:600; font-size:13px;">${document.getElementById('editCurrency').value}</span></div>
                            <div style="margin-top:10px;"><span style="background:${status === 'paid' ? '#10b981' : status === 'sent' ? '#f59e0b' : '#64748b'}; color:white; padding:5px 16px; border-radius:20px; font-size:12px; font-weight:600;">${status.toUpperCase()}</span></div>
                        </div>
                    </div>
                </div>
                
                <table style="width:100%; border-collapse:collapse; margin:20px 0;">
                    <thead><tr style="background:#581c87; color:white;"><th style="padding:14px 16px; text-align:left; border-radius:12px 0 0 0; font-size:13px;">Description</th><th style="padding:14px 16px; text-align:center; font-size:13px;">Qty</th><th style="padding:14px 16px; text-align:right; font-size:13px;">Rate</th><th style="padding:14px 16px; text-align:right; border-radius:0 12px 0 0; font-size:13px;">Amount</th></tr></thead>
                    <tbody>${itemsHtml}</tbody>
                </table>
                
                <div style="display:flex; justify-content:flex-end; margin-top:20px;">
                    <div style="width:280px;">
                        <div style="display:flex; justify-content:space-between; padding:8px 0;"><span style="color:#6b21a8;">Subtotal:</span> <span style="font-weight:600;">${sym}${subtotal.toFixed(2)}</span></div>
                        <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #e9d5ff;"><span style="color:#6b21a8;">Tax (${taxRate}%):</span> <span style="font-weight:600;">${sym}${tax.toFixed(2)}</span></div>
                        <div style="display:flex; justify-content:space-between; padding:15px; background:#581c87; color:white; border-radius:12px; margin-top:10px; font-size:18px; font-weight:700;">
                            <span>TOTAL DUE:</span> <span>${sym}${total.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
                
                ${document.getElementById('invoiceNotes').value ? `
                    <div style="margin-top:25px; padding:16px 20px; background:#fdf4ff; border-radius:12px; border-left:4px solid #ec4899;">
                        <strong style="color:#581c87;">Notes:</strong><br>
                        <span style="color:#4c1d95; font-size:13px;">${document.getElementById('invoiceNotes').value}</span>
                    </div>
                ` : ''}
                
                <div style="margin-top:30px; text-align:center; color:#a855f7; font-size:12px; padding-top:20px; border-top:2px dashed #e9d5ff;">
                    Thank you for your business! | Created by L.C Digital Solution
                </div>
            </div>
        </div>
    `
    new bootstrap.Modal(document.getElementById('previewModal')).show()
})

// Print
document.getElementById('printPreviewBtn').addEventListener('click', () => {
    const w = window.open('', '_blank')
    w.document.write(`
        <html><head><title>Invoice</title>
        <style>body{font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5;padding:30px;margin:0;}</style>
        </head><body>${document.getElementById('previewContent').innerHTML}</body></html>
    `)
    w.document.close()
    setTimeout(() => w.print(), 300)
    saveInvoice()
})

document.getElementById('editIssueDate').addEventListener('change', saveInvoice)
document.getElementById('editDueDate').addEventListener('change', saveInvoice)
document.getElementById('invoiceNotes').addEventListener('change', saveInvoice)
document.getElementById('taxRateInput').addEventListener('change', saveInvoice)
document.getElementById('invoiceClientSelect').addEventListener('change', saveInvoice)

loadInvoice()