import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  BRAND,
  exportDate,
  getCompanySettings,
} from "../templates/brandedExportTheme";

const safeValue = (value) => {
  if (value === null || value === undefined) return "";
  return String(value);
};

const normalizeRows = (rows = [], columns = []) => {
  if (!columns.length) return rows;

  return rows.map((row) => {
    const item = {};

    columns.forEach((column) => {
      item[column.label] = row[column.key] ?? "";
    });

    return item;
  });
};

const normalizeSummary = (summary = {}) => {
  if (Array.isArray(summary)) return summary;

  return Object.entries(summary).map(([label, value]) => ({
    label,
    value,
  }));
};

const fileSafe = (value = "export") =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const exportToCSV = (filename, rows = []) => {
  if (!rows.length) {
    alert("No data to export.");
    return;
  }

  const headers = Object.keys(rows[0]);

  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((key) => `"${safeValue(row[key]).replace(/"/g, '""')}"`)
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${fileSafe(filename)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};

export const exportToExcel = ({
  filename = "export",
  title = "Export",
  subtitle = "Construction Portal professional export",
  rows = [],
  columns = [],
  summary = {},
}) => {
  if (!rows.length) {
    alert("No data to export.");
    return;
  }

  const company = getCompanySettings();
  const normalisedRows = normalizeRows(rows, columns);
  const summaryRows = normalizeSummary(summary);

  const aoa = [
    [company.company_name || BRAND.name],
    [subtitle],
    [`Generated: ${exportDate()}`],
    [],
    ["Report", title],
    ["Company", company.company_name || ""],
    ["ABN / GST", company.abn_gst || ""],
    ["Address", company.address || ""],
    ["Phone", company.phone || ""],
    ["Email", company.email || ""],
    [],
  ];

  if (summaryRows.length) {
    aoa.push(["Summary"]);
    summaryRows.forEach((item) => {
      aoa.push([item.label, item.value]);
    });
    aoa.push([]);
  }

  const headers = Object.keys(normalisedRows[0]);
  aoa.push(headers);

  normalisedRows.forEach((row) => {
    aoa.push(headers.map((header) => row[header]));
  });

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();

  worksheet["!cols"] = headers.map((header) => ({
    wch: Math.max(16, String(header).length + 4),
  }));

  worksheet["!freeze"] = { xSplit: 0, ySplit: aoa.length - normalisedRows.length };

  XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
  XLSX.writeFile(workbook, `${fileSafe(filename)}.xlsx`);
};

export const exportToPDF = ({
  title = "Export",
  filename = "export",
  subtitle = "Construction Portal professional report",
  columns = [],
  rows = [],
  summary = {},
}) => {
  if (!rows.length) {
    alert("No data to export.");
    return;
  }

  const company = getCompanySettings();
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const normalisedRows = normalizeRows(rows, columns);
  const pdfColumns =
    columns.length > 0
      ? columns.map((column) => ({
          key: column.label,
          label: column.label,
        }))
      : Object.keys(normalisedRows[0]).map((key) => ({
          key,
          label: key,
        }));

  const summaryRows = normalizeSummary(summary);

  doc.setFillColor(...BRAND.primary);
  doc.roundedRect(28, 24, pageWidth - 56, 76, 12, 12, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont(undefined, "bold");
  doc.text(company.company_name || BRAND.name, 46, 54);

  doc.setFontSize(9);
  doc.setFont(undefined, "normal");
  doc.text(company.address || BRAND.subtitle, 46, 72);

  doc.text(`Generated: ${exportDate()}`, pageWidth - 46, 54, {
    align: "right",
  });

  doc.text(company.email || subtitle, pageWidth - 46, 72, {
    align: "right",
  });

  doc.setTextColor(...BRAND.text);
  doc.setFontSize(18);
  doc.setFont(undefined, "bold");
  doc.text(title, 34, 132);

  doc.setFontSize(9);
  doc.setFont(undefined, "normal");
  doc.setTextColor(...BRAND.muted);
  doc.text(subtitle, 34, 148);

  let startY = 170;

  if (summaryRows.length) {
    autoTable(doc, {
      startY,
      theme: "grid",
      head: [["Summary", "Value"]],
      body: summaryRows.map((item) => [item.label, item.value]),
      styles: {
        fontSize: 8,
        cellPadding: 7,
        lineColor: BRAND.border,
      },
      headStyles: {
        fillColor: BRAND.secondary,
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: BRAND.light,
      },
      margin: { left: 34, right: 34 },
    });

    startY = doc.lastAutoTable.finalY + 20;
  }

  autoTable(doc, {
    startY,
    theme: "grid",
    head: [pdfColumns.map((column) => column.label)],
    body: normalisedRows.map((row) =>
      pdfColumns.map((column) => row[column.key] ?? "")
    ),
    styles: {
      fontSize: 7,
      cellPadding: 6,
      overflow: "linebreak",
      lineColor: BRAND.border,
    },
    headStyles: {
      fillColor: BRAND.primary,
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: BRAND.light,
    },
    margin: { left: 34, right: 34 },
    didDrawPage: () => {
      doc.setDrawColor(...BRAND.border);
      doc.line(34, pageHeight - 56, pageWidth - 34, pageHeight - 56);

      doc.setFontSize(8);
      doc.setTextColor(...BRAND.muted);
      doc.text("Generated from Construction Portal", 34, pageHeight - 36);
      doc.text("Confidential Business Report", pageWidth / 2, pageHeight - 36, {
        align: "center",
      });

      doc.setTextColor(...BRAND.text);
      doc.line(pageWidth - 190, pageHeight - 34, pageWidth - 40, pageHeight - 34);
      doc.text("Authorised Signature", pageWidth - 115, pageHeight - 20, {
        align: "center",
      });
    },
  });

  doc.save(`${fileSafe(filename)}.pdf`);
};