import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  calculateSubletBill,
  formatMoney,
} from "../templates/subletBillTemplate";

import {
    BRAND,
    formatExportMoney,
    exportDate,
  } from "../templates/brandedExportTheme";

const headerColor = [15, 23, 42];
const blueBand = [219, 234, 254];
const greenBand = [220, 252, 231];
const yellowBand = [254, 249, 195];
const orangeBand = [255, 237, 213];

const money = formatExportMoney;

function drawPdfHeader(doc, title, meta = {}) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(...BRAND.primary);
  doc.roundedRect(28, 24, pageWidth - 56, 70, 10, 10, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont(undefined, "bold");
  doc.text(title, 44, 52);

  doc.setFontSize(9);
  doc.setFont(undefined, "normal");
  doc.text(BRAND.subtitle, 44, 70);

  doc.setFontSize(8);
  doc.text(`Generated: ${exportDate()}`, pageWidth - 44, 52, {
    align: "right",
  });

  if (meta.packageNo) {
    doc.text(`Package: ${meta.packageNo}`, pageWidth - 44, 68, {
      align: "right",
    });
  }

  return 116;
}

function drawPdfFooter(doc) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setDrawColor(...BRAND.border);
  doc.line(32, pageHeight - 58, pageWidth - 32, pageHeight - 58);

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Generated from Construction Portal", 36, pageHeight - 36);

  doc.setDrawColor(15, 23, 42);
  doc.line(pageWidth - 190, pageHeight - 36, pageWidth - 40, pageHeight - 36);
  doc.text("Authorised Signature", pageWidth - 115, pageHeight - 22, {
    align: "center",
  });
}

function addInfoCards(doc, startY, cards = []) {
  autoTable(doc, {
    startY,
    theme: "plain",
    body: [
      cards.map((card) => ({
        content: `${card.label}\n${card.value || "-"}`,
        styles: {
          fillColor: card.fill || BRAND.lightGray,
          textColor: BRAND.primary,
          fontStyle: "bold",
          halign: "center",
          valign: "middle",
          cellPadding: 8,
          lineColor: BRAND.border,
          lineWidth: 0.5,
        },
      })),
    ],
    styles: {
      fontSize: 9,
      minCellHeight: 42,
    },
  });

  return doc.lastAutoTable.finalY + 14;
}

function addSectionTable(doc, startY, title, rows = [], options = {}) {
  doc.setFontSize(12);
  doc.setTextColor(...BRAND.primary);
  doc.setFont(undefined, "bold");
  doc.text(title, 36, startY);

  autoTable(doc, {
    startY: startY + 10,
    theme: "grid",
    head: [["Description", "Rate", "Amount"]],
    body: rows,
    headStyles: {
      fillColor: options.headColor || BRAND.primary,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 5,
      lineColor: BRAND.border,
      lineWidth: 0.4,
    },
    columnStyles: {
      0: { cellWidth: 310 },
      1: { halign: "center", cellWidth: 70 },
      2: { halign: "right", cellWidth: 120 },
    },
    didParseCell: (hook) => {
      const label = hook.row.raw?.[0] || "";

      if (
        label.includes("TOTAL") ||
        label.includes("Total") ||
        label.includes("Net") ||
        label.includes("Final") ||
        label.includes("TRF") ||
        label.includes("Gross")
      ) {
        hook.cell.styles.fillColor = options.totalColor || BRAND.lightBlue;
        hook.cell.styles.fontStyle = "bold";
      }

      if (label.includes("GST")) {
        hook.cell.styles.fillColor = BRAND.lightGreen;
      }

      if (label.includes("Final") || label.includes("TRF")) {
        hook.cell.styles.fillColor = BRAND.lightYellow;
      }
    },
  });

  return doc.lastAutoTable.finalY + 18;
}

function createWorkbookSheet(rows, sheetName = "Report") {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  worksheet["!cols"] = [
    { wch: 42 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  return workbook;
}

export function exportSubletBillPDF(data = {}) {
    const c = calculateSubletBill(data);
  
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4",
    });
  
    let y = drawPdfHeader(doc, "Sublet Bill Statement", {
      packageNo: data.packageNo,
    });
  
    y = addInfoCards(doc, y, [
      {
        label: "Package / Tender",
        value: data.packageNo || "-",
        fill: BRAND.lightBlue,
      },
      {
        label: "Bill Date",
        value: data.billDate || exportDate(),
        fill: BRAND.lightGray,
      },
      {
        label: "Subcontractor",
        value: data.subcontractorName || "-",
        fill: BRAND.lightGreen,
      },
      {
        label: "Site",
        value: data.siteName || "-",
        fill: BRAND.lightOrange,
      },
    ]);
  
    y = addSectionTable(
      doc,
      y,
      "Department Bill Calculation",
      [
        ["Work Contract Charges For Original Work", "", money(c.originalWorkAmount)],
        ["Add CGST", "9%", money(c.cgst9)],
        ["Add SGST", "9%", money(c.sgst9)],
        ["Gross Total", "", money(c.grossTotal)],
        ["TDS By Department", "2%", money(c.tds2)],
        ["TDS On GST", "2%", money(c.tdsOnGst2)],
        ["Workman Welfare Tax", "1%", money(c.welfareTax1)],
        ["Extension Time Limit", "", money(c.extTimeLimit)],
        ["Withheld", "", money(c.withheld)],
        ["Total Department Deduction", "", money(c.totalDepartmentDeduction)],
        ["Security Deposit Fully Refundable", "5%", money(c.securityDeposit)],
        ["Net Cheque Amount From Department", "", money(c.netChequeFromDepartment)],
        ["Bill Writing Charge", "0.5%", money(c.billWritingCharge)],
        ["Agency Charge", `${Number(c.agencyPercent * 100).toFixed(2)}%`, money(c.agencyCharge)],
      ],
      {
        headColor: BRAND.primary,
        totalColor: BRAND.lightBlue,
      }
    );
  
    y = addSectionTable(
      doc,
      y,
      "Sublet Bill Calculation",
      [
        ["Total Sublet Bill Taxable Value", "", money(c.subletTaxableValue)],
        ["Add GST", "18%", money(c.subletGst18)],
        ["Sublet Bill Total", "", money(c.subletTotal)],
        ["Security Deposit Fully Refundable", "5%", money(c.subletSecurityDeposit)],
        ["Withheld Amount", "", money(c.subletWithheld)],
        ["Insurance", "1%", money(c.insurance1)],
        ["Cost Of Bill Fine", "", money(c.costOfBillFine)],
        ["TDS", "2%", money(c.tdsByShivdas2)],
        ["Total Sublet Deduction", "", money(c.totalSubletDeduction)],
        ["Net Payable Sublet", "", money(c.netPayableSublet)],
        ["GST Hold", "18%", money(c.gstHold18)],
        ["Loan / Advance", "", money(c.loanAmount)],
        ["Final TRF Payment", "", money(c.trfPayment)],
      ],
      {
        headColor: BRAND.secondary,
        totalColor: BRAND.lightOrange,
      }
    );
  
    drawPdfFooter(doc);
  
    doc.save(`${data.packageNo || "sublet-bill"}.pdf`);
  }

export function exportSubletBillExcel(data) {
  const c = calculateSubletBill(data);

  const rows = [
    ["SUBLET BILL STATEMENT"],
    [],
    ["Package / Tender", data.packageNo || ""],
    ["Date", data.billDate || ""],
    ["Subcontractor", data.subcontractorName || ""],
    ["Site", data.siteName || ""],
    [],
    ["Department Bill Calculation", "Rate", "Amount"],
    ["Work Contract Charges for Original Work", "", c.originalWorkAmount],
    ["Add CGST", "9%", c.cgst9],
    ["Add SGST", "9%", c.sgst9],
    ["Gross Total", "", c.grossTotal],
    ["TDS by Department", "2%", c.tds2],
    ["TDS on GST", "2%", c.tdsOnGst2],
    ["Workman Welfare Tax", "1%", c.welfareTax1],
    ["Extension Time Limit", "", c.extTimeLimit],
    ["Withheld", "", c.withheld],
    ["Total Department Deduction", "", c.totalDepartmentDeduction],
    ["Security Deposit Fully Refundable", "5%", c.securityDeposit],
    ["Net Cheque Amount From Department", "", c.netChequeFromDepartment],
    ["Bill Writing Charge", "0.5%", c.billWritingCharge],
    ["Agency Charge", `${Number(c.agencyPercent * 100).toFixed(2)}%`, c.agencyCharge],
    [],
    ["Sublet Bill Calculation", "Rate", "Amount"],
    ["Total Sublet Bill Taxable Value", "", c.subletTaxableValue],
    ["Add GST", "18%", c.subletGst18],
    ["Sublet Bill Total", "", c.subletTotal],
    ["Security Deposit Fully Refundable", "5%", c.subletSecurityDeposit],
    ["Withheld Amount", "", c.subletWithheld],
    ["Insurance", "1%", c.insurance1],
    ["Cost of Bill Fine", "", c.costOfBillFine],
    ["TDS", "2%", c.tdsByShivdas2],
    ["Total Sublet Deduction", "", c.totalSubletDeduction],
    ["Net Payable Sublet", "", c.netPayableSublet],
    ["GST Hold", "18%", c.gstHold18],
    ["Loan / Advance", "", c.loanAmount],
    ["Final TRF Payment", "", c.trfPayment],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  worksheet["!cols"] = [
    { wch: 42 },
    { wch: 14 },
    { wch: 18 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sublet Bill");

  XLSX.writeFile(workbook, `${data.packageNo || "sublet-bill"}.xlsx`);
}

export function exportGovernmentBillPDF(data = {}) {
    const taxableAmount = Number(data.taxableAmount || 0);
    const cgst = taxableAmount * 0.09;
    const sgst = taxableAmount * 0.09;
    const gstTotal = cgst + sgst;
    const grossTotal = taxableAmount + gstTotal;
  
    const tds = taxableAmount * 0.02;
    const welfareTax = taxableAmount * 0.01;
    const securityDeposit = grossTotal * 0.05;
    const withheld = Number(data.withheld || 0);
  
    const totalDeduction = tds + welfareTax + securityDeposit + withheld;
    const netPayable = grossTotal - totalDeduction;
  
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4",
    });
  
    const pageWidth = doc.internal.pageSize.getWidth();
  
    doc.setFillColor(...headerColor);
    doc.rect(32, 28, pageWidth - 64, 48, "F");
  
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont(undefined, "bold");
    doc.text("GOVERNMENT BILL STATEMENT", pageWidth / 2, 56, {
      align: "center",
    });
  
    doc.setTextColor(0, 0, 0);
  
    autoTable(doc, {
      startY: 90,
      theme: "grid",
      head: [["Tender", "Date", "Department", "Site"]],
      body: [[
        data.tenderName || "-",
        data.billDate || "-",
        data.departmentName || "Government Department",
        data.siteName || "-",
      ]],
      headStyles: { fillColor: headerColor },
      styles: { fontSize: 9 },
    });
  
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 16,
      theme: "grid",
      head: [["Government Bill Calculation", "Rate", "Amount"]],
      body: [
        ["Taxable Work Amount", "", formatMoney(taxableAmount)],
        ["CGST", "9%", formatMoney(cgst)],
        ["SGST", "9%", formatMoney(sgst)],
        ["GST Total", "18%", formatMoney(gstTotal)],
        ["Gross Bill Total", "", formatMoney(grossTotal)],
        ["TDS", "2%", formatMoney(tds)],
        ["Workman Welfare Tax", "1%", formatMoney(welfareTax)],
        ["Security Deposit", "5%", formatMoney(securityDeposit)],
        ["Withheld", "", formatMoney(withheld)],
        ["Total Deduction", "", formatMoney(totalDeduction)],
        ["Net Payable / Cheque Amount", "", formatMoney(netPayable)],
      ],
      headStyles: { fillColor: headerColor },
      styles: { fontSize: 8, cellPadding: 5 },
      didParseCell: (hook) => {
        const label = hook.row.raw?.[0] || "";
  
        if (
          label.includes("Gross") ||
          label.includes("Total Deduction") ||
          label.includes("Net Payable")
        ) {
          hook.cell.styles.fillColor = blueBand;
          hook.cell.styles.fontStyle = "bold";
        }
      },
    });
  
    const footerY = doc.lastAutoTable.finalY + 34;
  
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text("Generated from Construction Portal", 40, footerY);
  
    doc.setDrawColor(0);
    doc.line(pageWidth - 190, footerY + 28, pageWidth - 40, footerY + 28);
    doc.text("Authorised Signature", pageWidth - 115, footerY + 44, {
      align: "center",
    });
  
    doc.save(`${data.tenderName || "government-bill"}.pdf`);
  }
  
  export function exportGovernmentBillExcel(data = {}) {
    const taxableAmount = Number(data.taxableAmount || 0);
    const cgst = taxableAmount * 0.09;
    const sgst = taxableAmount * 0.09;
    const gstTotal = cgst + sgst;
    const grossTotal = taxableAmount + gstTotal;
  
    const tds = taxableAmount * 0.02;
    const welfareTax = taxableAmount * 0.01;
    const securityDeposit = grossTotal * 0.05;
    const withheld = Number(data.withheld || 0);
  
    const totalDeduction = tds + welfareTax + securityDeposit + withheld;
    const netPayable = grossTotal - totalDeduction;
  
    const rows = [
      ["GOVERNMENT BILL STATEMENT"],
      [],
      ["Tender", data.tenderName || ""],
      ["Date", data.billDate || ""],
      ["Department", data.departmentName || "Government Department"],
      ["Site", data.siteName || ""],
      [],
      ["Government Bill Calculation", "Rate", "Amount"],
      ["Taxable Work Amount", "", taxableAmount],
      ["CGST", "9%", cgst],
      ["SGST", "9%", sgst],
      ["GST Total", "18%", gstTotal],
      ["Gross Bill Total", "", grossTotal],
      ["TDS", "2%", tds],
      ["Workman Welfare Tax", "1%", welfareTax],
      ["Security Deposit", "5%", securityDeposit],
      ["Withheld", "", withheld],
      ["Total Deduction", "", totalDeduction],
      ["Net Payable / Cheque Amount", "", netPayable],
    ];
  
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
  
    worksheet["!cols"] = [{ wch: 36 }, { wch: 14 }, { wch: 18 }];
  
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Government Bill");
  
    XLSX.writeFile(workbook, `${data.tenderName || "government-bill"}.xlsx`);
  }