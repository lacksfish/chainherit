import forge from 'node-forge'
import { jsPDF } from "jspdf"
import autoTable from 'jspdf-autotable'

export function sha512(str) {
  const md = forge.md.sha512.create();
  md.update(str, 'utf8');
  return md.digest().toHex();
}

export function createInheritancePdf(inheritance, validityDate, signedTx) {
  // Create a new jsPDF instance
  const doc = new jsPDF()

  // Set up the header and footer
  const header = (data) => {
    // doc.setFillColor(4, 177, 183) // Cyan color
    // doc.rect(0, 0, 210, 40, 'F') // Draw a rectangle
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(12)
    doc.text("Chainherit Inheritance Transaction", 10, 22)

    try {
      doc.addImage('logo.png', 'PNG', 180, 10, 15, 18)
    } catch (e) {
      doc.addImage(logoImg, 'PNG', 180, 10, 15, 18)
    }

  }

  const footer = (pageNum) => {
    doc.setFillColor(4, 177, 183)
    doc.rect(0, 280, 210, 18, 'F')

    doc.setFontSize(10)
    const centerX = 105; // Half of A4 width (210mm)
    const footerText = "Created by Chainherit"
    const footerTextWidth = doc.getTextWidth(footerText)
    doc.text(footerText, centerX - (footerTextWidth / 2), 292)

    const pageText = `Page ${pageNum}`
    const pageTextWidth = doc.getTextWidth(pageText)
    doc.text(pageText, 210 - pageTextWidth - 10, 292)
  }

  // Add the header and footer
  header()
  footer(1)

  // Define the table content
  const tableContent = [
    {
      title: "Created at",
      value: (new Date()).toLocaleDateString('en-US', {
        day: 'numeric', month: 'long', year: 'numeric'
      })
    },
    {
      title: "Valid on",
      value: validityDate.toLocaleDateString('en-US', {
        day: 'numeric', month: 'long', year: 'numeric'
      })
    },
    {
      title: "Total value of inheritance",
      value: (inheritance.totalInputAmount / 1e8).toFixed(8) + " BTC"
    },
    {
      title: "Total payout to recipients",
      value: (inheritance.totalOutputAmount / 1e8).toFixed(8) + " BTC"
    },
    {
      title: "Network fee",
      value: ((inheritance.totalInputAmount - inheritance.totalOutputAmount) / 1e8).toFixed(8) + " BTC"
    },
    {
      title: "Transaction size",
      value: inheritance.txSize + " bytes"
    },
    {
      title: "Transaction fee rate",
      value: ((inheritance.totalInputAmount - inheritance.totalOutputAmount) / inheritance.txSize).toFixed(1) + " sat/vB"
    }
  ]

  doc.autoTable({
    body: tableContent.map(item => [item.title, item.value]),
    theme: 'plain',
    didDrawCell: data => {
      // Check if this is a cell in the body
      if (data.row.raw) {
        data.doc.setTextColor(0, 0, 0)
      }
    },
    margin: { top: 0 }, // Adjust the margin to position your table
    startY: 30 // This positions the table below the header. Adjust as needed.
  })

  const pageWidth = doc.internal.pageSize.getWidth()

  let textStartY = doc.lastAutoTable.finalY + 10
  doc.setFontSize(10)
  const infoText = "The following signed transaction can be published on the Bitcoin network, if the transaction still represents the current wallet state and if the validity day is met."
  const infoTextLines = doc.splitTextToSize(infoText, pageWidth - 10)
  doc.text(infoTextLines, 10, textStartY)

  textStartY = doc.lastAutoTable.finalY + 20
  doc.setFillColor(4, 177, 183)
  doc.rect(10, textStartY, pageWidth - 20, 1, 'F')
  textStartY = doc.lastAutoTable.finalY + 30

  // Add the transaction hex string to the body
  doc.setFont('Courier')
  let lines = doc.splitTextToSize(signedTx, pageWidth - 20) // 20 for margins
  doc.setFontSize(10)

  let linesPerPageFirstPage = 41
  let linesPerPageFurtherPages = 64
  let lineCount = 0
  let page = 1

  for (let i = 0; i < lines.length; i++) {
    if ((page == 1 && lineCount === linesPerPageFirstPage) || (page > 1 && lineCount === linesPerPageFurtherPages)) {
      doc.addPage()
      page++
      footer(page)
      lineCount = 0
      textStartY = 20
    }
    doc.text(lines[i], 10, textStartY + (lineCount * 4)) // Adjust the position as needed
    lineCount++
  }

  // Save the PDF
  let dateStr = `${validityDate.getFullYear()}-${validityDate.getMonth() + 1}-${validityDate.getDate()}`
  doc.save(`inheritance-transaction-chainherit-${dateStr}.pdf`)
}