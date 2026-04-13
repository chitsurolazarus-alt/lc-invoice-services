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
        if (profile.company_logo) {
            document.getElementById('companyLogo').src = profile.company_logo
        }
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
    
    const statusClasses = {
        draft: 'status-draft', sent: 'status-sent', paid: 'status-paid', overdue: 'status-overdue'
    }
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
    if (!confirm('Mark this invoice as paid? This will update the status.')) return
    
    try {
        const currentId = currentInvoice?.id || invoiceId
        await db.updateInvoice(currentId, { status: 'paid' })
        if (currentInvoice) currentInvoice.status = 'paid'
        updateStatusDisplay('paid')
        await saveInvoice()
    } catch (e) { alert('Error: ' + e.message) }
})

document.getElementById('previewInvoiceBtn').addEventListener('click', () => {
    const client = clients.find(c => c.id === document.getElementById('invoiceClientSelect').value)
    const sym = currencySymbols[document.getElementById('editCurrency').value] || 'R'
    let itemsHtml = ''
    invoiceItems.forEach(item => {
        itemsHtml += `<tr><td>${item.description}</td><td style="text-align:center">${item.quantity}</td><td style="text-align:right">${sym}${(item.rate || 0).toFixed(2)}</td><td style="text-align:right">${sym}${((item.quantity || 0) * (item.rate || 0)).toFixed(2)}</td></tr>`
    })
    const subtotal = parseFloat(document.getElementById('subtotalDisplay').textContent) || 0
    const taxRate = parseFloat(document.getElementById('taxRateInput').value) || 0
    const tax = parseFloat(document.getElementById('taxAmountDisplay').textContent) || 0
    const total = parseFloat(document.getElementById('totalDisplay').textContent) || 0
    const status = currentInvoice?.status || 'draft'
    
    const logoUrl = profile?.company_logo || 'images/logo.png'
    
    document.getElementById('previewContent').innerHTML = `
        <div style="font-family:'Inter',sans-serif; max-width:800px; margin:0 auto;" id="invoicePreviewForPdf">
            <div style="display:flex; justify-content:space-between; margin-bottom:30px; padding-bottom:20px; border-bottom:2px solid #e2e8f0;">
                <div>
                    <img src="${logoUrl}" alt="Company Logo" style="max-height:70px; margin-bottom:10px;" id="previewLogo">
                    <h3 style="color:#1e293b; font-weight:700;">${profile?.company_name || 'L.C Invoice Services'}</h3>
                    <p style="color:#475569;">${profile?.company_address || ''}<br>${profile?.company_phone || ''}<br>${profile?.company_email || ''}</p>
                </div>
                <div style="text-align:right;">
                    <h2 style="color:#3b82f6; font-weight:700;">INVOICE</h2>
                    <p style="background:#f1f5f9; padding:12px; border-radius:10px;">
                        <strong>#:</strong> ${document.getElementById('displayInvoiceNumber').textContent}<br>
                        <strong>Date:</strong> ${document.getElementById('editIssueDate').value}<br>
                        <strong>Due:</strong> ${document.getElementById('editDueDate').value}<br>
                        <span class="status-badge status-${status}">${status.toUpperCase()}</span>
                    </p>
                </div>
            </div>
            <div style="margin-bottom:20px;">
                <strong style="color:#1e293b;">Bill To:</strong><br>
                <p style="color:#475569;">${client?.name || 'N/A'}<br>${client?.address || ''}<br>${client?.email || ''}<br>${client?.phone || ''}</p>
            </div>
            <table style="width:100%; border-collapse:collapse; margin:20px 0;">
                <thead><tr style="background:#f8fafc;"><th style="padding:12px; border:1px solid #e2e8f0; text-align:left;">Description</th><th style="padding:12px; border:1px solid #e2e8f0; text-align:center;">Qty</th><th style="padding:12px; border:1px solid #e2e8f0; text-align:right;">Rate</th><th style="padding:12px; border:1px solid #e2e8f0; text-align:right;">Amount</th></tr></thead>
                <tbody>${itemsHtml}</tbody>
                <tfoot>
                    <tr><td colspan="3" style="padding:10px; text-align:right;"><strong>Subtotal:</strong></td><td style="padding:10px; text-align:right;">${sym}${subtotal.toFixed(2)}</td></tr>
                    <tr><td colspan="3" style="padding:10px; text-align:right;"><strong>Tax (${taxRate}%):</strong></td><td style="padding:10px; text-align:right;">${sym}${tax.toFixed(2)}</td></tr>
                    <tr style="background:#f8fafc;"><td colspan="3" style="padding:10px; text-align:right; font-weight:700;">Total:</td><td style="padding:10px; text-align:right; font-weight:700;">${sym}${total.toFixed(2)}</td></tr>
                </tfoot>
            </table>
            ${document.getElementById('invoiceNotes').value ? `<div style="margin-top:20px; padding:15px; background:#f8fafc; border-radius:10px;"><strong>Notes:</strong><br>${document.getElementById('invoiceNotes').value}</div>` : ''}
            <div style="margin-top:30px; text-align:center; color:#94a3b8; font-size:12px;">Thank you for your business! | Created by L.C Digital Solution</div>
        </div>
    `
    
    document.getElementById('previewLogo').onerror = function() {
        this.src = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'70\'%3E%3Crect width=\'100\' height=\'70\' fill=\'%233b82f6\' rx=\'10\'/%3E%3Ctext x=\'50\' y=\'45\' font-size=\'20\' fill=\'white\' text-anchor=\'middle\' font-weight=\'bold\'%3EL.C%3C/text%3E%3C/svg%3E'
    }
    
    new bootstrap.Modal(document.getElementById('previewModal')).show()
})

// PDF DOWNLOAD - WITH THICK BORDER AND PROPER ALIGNMENT
async function downloadPDF() {
    try {
        const { jsPDF } = window.jspdf
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
        const sym = currencySymbols[document.getElementById('editCurrency').value] || 'R'
        const client = clients.find(c => c.id === document.getElementById('invoiceClientSelect').value)
        const invoiceNumber = document.getElementById('displayInvoiceNumber').textContent
        
        const pageWidth = 210
        const pageHeight = 297
        const margin = 12
        const borderWidth = 3
        
        // ============================================
        // THICK OUTER BORDER
        // ============================================
        doc.setLineWidth(borderWidth)
        doc.setDrawColor(59, 130, 246) // Blue border
        doc.rect(margin/2, margin/2, pageWidth - margin, pageHeight - margin)
        
        // Inner thin border
        doc.setLineWidth(0.5)
        doc.setDrawColor(200, 200, 200)
        doc.rect(margin, margin, pageWidth - margin*2, pageHeight - margin*2)
        
        // ============================================
        // LOGO
        // ============================================
        const logoUrl = profile?.company_logo || 'images/logo.png'
        
        const addLogoToPDF = () => {
            return new Promise((resolve) => {
                const img = new Image()
                img.crossOrigin = 'Anonymous'
                img.onload = function() {
                    const canvas = document.createElement('canvas')
                    canvas.width = img.width
                    canvas.height = img.height
                    const ctx = canvas.getContext('2d')
                    ctx.drawImage(img, 0, 0)
                    const logoData = canvas.toDataURL('image/png')
                    
                    const logoWidth = 35
                    const logoHeight = (img.height / img.width) * logoWidth
                    doc.addImage(logoData, 'PNG', margin + 5, margin + 8, logoWidth, logoHeight)
                    resolve()
                }
                img.onerror = function() {
                    doc.setFillColor(59, 130, 246)
                    doc.roundedRect(margin + 5, margin + 8, 35, 15, 3, 3, 'F')
                    doc.setFontSize(11)
                    doc.setTextColor(255, 255, 255)
                    doc.text('L.C', margin + 22.5, margin + 18, { align: 'center' })
                    resolve()
                }
                img.src = logoUrl
            })
        }
        
        await addLogoToPDF()
        
        // ============================================
        // HEADER - INVOICE TITLE
        // ============================================
        doc.setFontSize(26)
        doc.setTextColor(59, 130, 246)
        doc.text('INVOICE', pageWidth - margin - 5, margin + 15, { align: 'right' })
        
        doc.setFontSize(11)
        doc.setTextColor(71, 85, 105)
        doc.text(`Invoice #: ${invoiceNumber}`, pageWidth - margin - 5, margin + 25, { align: 'right' })
        doc.text(`Date: ${document.getElementById('editIssueDate').value}`, pageWidth - margin - 5, margin + 32, { align: 'right' })
        doc.text(`Due Date: ${document.getElementById('editDueDate').value}`, pageWidth - margin - 5, margin + 39, { align: 'right' })
        doc.text(`Status: ${(currentInvoice?.status || 'draft').toUpperCase()}`, pageWidth - margin - 5, margin + 46, { align: 'right' })
        
        // ============================================
        // COMPANY INFO
        // ============================================
        doc.setFontSize(16)
        doc.setTextColor(30, 41, 59)
        doc.text(profile?.company_name || 'L.C Invoice Services', margin + 45, margin + 15)
        
        doc.setFontSize(10)
        doc.setTextColor(71, 85, 105)
        let companyY = margin + 23
        if (profile?.company_address) {
            doc.text(profile.company_address, margin + 45, companyY)
            companyY += 6
        }
        if (profile?.company_phone) {
            doc.text(`Tel: ${profile.company_phone}`, margin + 45, companyY)
            companyY += 6
        }
        if (profile?.company_email) {
            doc.text(`Email: ${profile.company_email}`, margin + 45, companyY)
        }
        
        // ============================================
        // SEPARATOR LINE
        // ============================================
        doc.setLineWidth(0.5)
        doc.setDrawColor(226, 232, 240)
        doc.line(margin + 5, margin + 55, pageWidth - margin - 5, margin + 55)
        
        // ============================================
        // BILL TO SECTION
        // ============================================
        let yPos = margin + 68
        
        doc.setFontSize(12)
        doc.setTextColor(30, 41, 59)
        doc.text('Bill To:', margin + 5, yPos)
        
        yPos += 7
        doc.setFontSize(11)
        doc.setTextColor(71, 85, 105)
        doc.text(client?.name || 'N/A', margin + 5, yPos)
        yPos += 6
        
        if (client?.address) {
            doc.text(client.address, margin + 5, yPos)
            yPos += 6
        }
        
        const cityStateZip = [client?.city, client?.state, client?.zip].filter(Boolean).join(', ')
        if (cityStateZip) {
            doc.text(cityStateZip, margin + 5, yPos)
            yPos += 6
        }
        
        if (client?.country) {
            doc.text(client.country, margin + 5, yPos)
            yPos += 6
        }
        
        if (client?.email) {
            doc.text(`Email: ${client.email}`, margin + 5, yPos)
            yPos += 6
        }
        
        if (client?.phone) {
            doc.text(`Tel: ${client.phone}`, margin + 5, yPos)
            yPos += 6
        }
        
        // ============================================
        // ITEMS TABLE HEADER
        // ============================================
        yPos = Math.max(yPos + 5, 110)
        
        doc.setFillColor(248, 250, 252)
        doc.rect(margin + 5, yPos - 5, pageWidth - margin*2 - 10, 10, 'F')
        
        doc.setFontSize(10)
        doc.setTextColor(30, 41, 59)
        doc.text('Description', margin + 8, yPos)
        doc.text('Qty', 115, yPos)
        doc.text('Rate', 140, yPos)
        doc.text('Amount', pageWidth - margin - 8, yPos, { align: 'right' })
        
        yPos += 2
        doc.setLineWidth(0.3)
        doc.setDrawColor(226, 232, 240)
        doc.line(margin + 5, yPos, pageWidth - margin - 5, yPos)
        yPos += 8
        
        // ============================================
        // ITEMS
        // ============================================
        doc.setFontSize(10)
        doc.setTextColor(51, 65, 85)
        
        invoiceItems.forEach(item => {
            const descLines = doc.splitTextToSize(item.description || '', 90)
            doc.text(descLines, margin + 8, yPos)
            
            const lineHeight = descLines.length * 5
            const qtyY = yPos + (lineHeight / 2)
            
            doc.text(String(item.quantity || 0), 115, qtyY)
            doc.text(`${sym}${(item.rate || 0).toFixed(2)}`, 140, qtyY)
            doc.text(`${sym}${((item.quantity || 0) * (item.rate || 0)).toFixed(2)}`, pageWidth - margin - 8, qtyY, { align: 'right' })
            
            yPos += Math.max(8, lineHeight)
            
            if (yPos > 240) {
                doc.addPage()
                // Redraw borders on new page
                doc.setLineWidth(borderWidth)
                doc.setDrawColor(59, 130, 246)
                doc.rect(margin/2, margin/2, pageWidth - margin, pageHeight - margin)
                doc.setLineWidth(0.5)
                doc.setDrawColor(200, 200, 200)
                doc.rect(margin, margin, pageWidth - margin*2, pageHeight - margin*2)
                yPos = margin + 15
            }
        })
        
        // ============================================
        // TOTALS SECTION
        // ============================================
        yPos += 3
        doc.setLineWidth(0.5)
        doc.setDrawColor(226, 232, 240)
        doc.line(margin + 5, yPos, pageWidth - margin - 5, yPos)
        yPos += 8
        
        const subtotal = parseFloat(document.getElementById('subtotalDisplay').textContent) || 0
        const taxRate = parseFloat(document.getElementById('taxRateInput').value) || 0
        const tax = parseFloat(document.getElementById('taxAmountDisplay').textContent) || 0
        const total = parseFloat(document.getElementById('totalDisplay').textContent) || 0
        
        const col1X = 120
        const col2X = pageWidth - margin - 8
        
        doc.setFontSize(10)
        doc.setTextColor(71, 85, 105)
        doc.text('Subtotal:', col1X, yPos)
        doc.text(`${sym}${subtotal.toFixed(2)}`, col2X, yPos, { align: 'right' })
        yPos += 7
        
        doc.text(`Tax (${taxRate}%):`, col1X, yPos)
        doc.text(`${sym}${tax.toFixed(2)}`, col2X, yPos, { align: 'right' })
        yPos += 7
        
        doc.setLineWidth(0.5)
        doc.line(col1X - 5, yPos - 2, col2X, yPos - 2)
        yPos += 5
        
        doc.setFontSize(13)
        doc.setTextColor(30, 41, 59)
        doc.text('Total Due:', col1X, yPos)
        doc.text(`${sym}${total.toFixed(2)}`, col2X, yPos, { align: 'right' })
        
        // ============================================
        // NOTES
        // ============================================
        const notes = document.getElementById('invoiceNotes').value
        if (notes) {
            yPos += 15
            doc.setFontSize(10)
            doc.setTextColor(30, 41, 59)
            doc.text('Notes:', margin + 5, yPos)
            yPos += 6
            doc.setFontSize(9)
            doc.setTextColor(71, 85, 105)
            const noteLines = doc.splitTextToSize(notes, 170)
            doc.text(noteLines, margin + 5, yPos)
        }
        
        // ============================================
        // FOOTER
        // ============================================
        doc.setFontSize(9)
        doc.setTextColor(148, 163, 184)
        doc.text('Thank you for your business!', pageWidth/2, pageHeight - margin - 15, { align: 'center' })
        doc.text('Created by L.C Digital Solution | www.lcdigitalsolution.co.za', pageWidth/2, pageHeight - margin - 8, { align: 'center' })
        
        // ============================================
        // PAYMENT STATUS STAMP (if paid)
        // ============================================
        if (currentInvoice?.status === 'paid') {
            doc.setFontSize(40)
            doc.setTextColor(16, 185, 129)
            doc.setGState(new doc.GState({ opacity: 0.3 }))
            doc.text('PAID', pageWidth/2, pageHeight/2, { align: 'center', angle: -45 })
            doc.setGState(new doc.GState({ opacity: 1 }))
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

// PRINT
document.getElementById('printPreviewBtn').addEventListener('click', () => {
    const w = window.open('', '_blank')
    w.document.write(`
        <html>
            <head>
                <title>Invoice</title>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
                <style>
                    body { 
                        font-family: 'Inter', sans-serif; 
                        padding: 30px;
                        margin: 0;
                    }
                    .invoice-container {
                        border: 4px solid #3b82f6;
                        padding: 30px;
                        max-width: 800px;
                        margin: 0 auto;
                        position: relative;
                    }
                    .inner-border {
                        border: 1px solid #cbd5e1;
                        padding: 20px;
                    }
                    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    th, td { padding: 12px; border: 1px solid #e2e8f0; }
                    th { background: #f8fafc; text-align: left; }
                    .status-badge { padding: 6px 12px; border-radius: 8px; font-weight: 600; display: inline-block; }
                    .status-paid { background: #d1fae5; color: #065f46; }
                    .status-draft { background: #e2e8f0; color: #475569; }
                    .status-sent { background: #fef3c7; color: #b45309; }
                    .status-overdue { background: #fee2e2; color: #991b1b; }
                    .footer { margin-top: 30px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 15px; }
                    .paid-stamp {
                        position: absolute;
                        top: 40%;
                        left: 30%;
                        font-size: 60px;
                        font-weight: 700;
                        color: #10b981;
                        opacity: 0.2;
                        transform: rotate(-45deg);
                        border: 5px solid #10b981;
                        padding: 10px 30px;
                        border-radius: 15px;
                    }
                </style>
            </head>
            <body>
                <div class="invoice-container">
                    <div class="inner-border">
                        ${document.getElementById('previewContent').innerHTML}
                        ${currentInvoice?.status === 'paid' ? '<div class="paid-stamp">PAID</div>' : ''}
                    </div>
                </div>
            </body>
        </html>
    `)
    w.document.close()
    setTimeout(() => w.print(), 300)
    saveInvoice()
})

// Auto-save
document.getElementById('editIssueDate').addEventListener('change', saveInvoice)
document.getElementById('editDueDate').addEventListener('change', saveInvoice)
document.getElementById('invoiceNotes').addEventListener('change', saveInvoice)
document.getElementById('taxRateInput').addEventListener('change', saveInvoice)
document.getElementById('invoiceClientSelect').addEventListener('change', saveInvoice)

loadInvoice()