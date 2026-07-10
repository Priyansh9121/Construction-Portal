import { useState } from "react";
import {
  exportSubletBillExcel,
  exportSubletBillPDF,
  exportGovernmentBillExcel,
  exportGovernmentBillPDF,
} from "../../utils/documentExportHelpers";

function DocumentExportButtons({ type = "sublet-bill", data }) {
  const [open, setOpen] = useState(false);

  const isSublet = type === "sublet-bill";
  const label = isSublet ? "Sublet Bill" : "Government Bill";

  const handlePDF = () => {
    if (isSublet) {
      exportSubletBillPDF(data);
    } else {
      exportGovernmentBillPDF(data);
    }

    setOpen(false);
  };

  const handleExcel = () => {
    if (isSublet) {
      exportSubletBillExcel(data);
    } else {
      exportGovernmentBillExcel(data);
    }

    setOpen(false);
  };

  return (
    <div className="export-menu">
      <button
        type="button"
        className="export-menu-button"
        onClick={() => setOpen((current) => !current)}
      >
        Export {label} ▾
      </button>

      {open && (
        <div className="export-menu-dropdown">
          <button type="button" onClick={handlePDF}>
            📄 PDF
          </button>

          <button type="button" onClick={handleExcel}>
            📊 Excel
          </button>
        </div>
      )}
    </div>
  );
}

export default DocumentExportButtons;