import { useState } from "react";
import {
  exportToCSV,
  exportToExcel,
  exportToPDF,
} from "../../utils/exportHelpers";

function ExportButtons({
  filename = "export",
  title = "Export",
  subtitle = "Construction Portal professional report",
  rows = [],
  columns = [],
  summary = {},
  showCSV = false,
}) {
  const [open, setOpen] = useState(false);

  const payload = {
    filename,
    title,
    subtitle,
    rows,
    columns,
    summary,
  };

  const handlePDF = () => {
    exportToPDF(payload);
    setOpen(false);
  };

  const handleExcel = () => {
    exportToExcel(payload);
    setOpen(false);
  };

  const handleCSV = () => {
    const normalisedRows = rows.map((row) => {
      const item = {};

      columns.forEach((column) => {
        item[column.label] = row[column.key] ?? "";
      });

      return item;
    });

    exportToCSV(filename, normalisedRows);
    setOpen(false);
  };

  return (
    <div className="export-menu">
      <button
        type="button"
        className="export-menu-button"
        onClick={() => setOpen((current) => !current)}
      >
        Export ▾
      </button>

      {open && (
        <div className="export-menu-dropdown">
          <button type="button" onClick={handlePDF}>
            📄 Professional PDF
          </button>

          <button type="button" onClick={handleExcel}>
            📊 Professional Excel
          </button>

          {showCSV && (
            <button type="button" onClick={handleCSV}>
              🧾 CSV
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ExportButtons;