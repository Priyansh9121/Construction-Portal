export const downloadCSV = (filename, rows) => {
    if (!rows.length) return;
  
    const headers = Object.keys(rows[0]);
  
    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((field) => {
            const value = row[field] ?? "";
            return `"${String(value).replace(/"/g, '""')}"`;
          })
          .join(",")
      ),
    ].join("\n");
  
    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });
  
    const url = URL.createObjectURL(blob);
  
    const link = document.createElement("a");
  
    link.href = url;
    link.download = filename;
  
    document.body.appendChild(link);
  
    link.click();
  
    document.body.removeChild(link);
  
    URL.revokeObjectURL(url);
  };