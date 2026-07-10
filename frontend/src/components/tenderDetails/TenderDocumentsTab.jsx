function TenderDocumentsTab({
  documents = [],
  documentForm,
  setDocumentForm,
  setSelectedFile,
  handleAddDocument,
  setDeleteTarget,
}) {
  const getFileLabel = (url = "") => {
    const lower = url.toLowerCase();

    if (lower.includes(".pdf")) return "PDF";
    if (lower.includes(".doc")) return "Word";
    if (lower.includes(".jpg") || lower.includes(".jpeg")) return "JPG";
    if (lower.includes(".png")) return "PNG";

    return "File";
  };

  const documentTypeCounts = documents.reduce((acc, item) => {
    const type = item.document_type || getFileLabel(item.file_url);
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <section className="summary-cards">
        <div className="card">
          <p>Total Documents</p>
          <h2>{documents.length}</h2>
        </div>

        <div className="card">
          <p>PDF Files</p>
          <h2>{documentTypeCounts.PDF || 0}</h2>
        </div>

        <div className="card">
          <p>Word Files</p>
          <h2>{documentTypeCounts.Word || 0}</h2>
        </div>

        <div className="card">
          <p>Images</p>
          <h2>
            {(documentTypeCounts.JPG || 0) + (documentTypeCounts.PNG || 0)}
          </h2>
        </div>
      </section>

      <div className="payment-grid">
        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>Add Document</h2>
              <p className="muted-text">
                Upload tender drawings, bills, approvals, photos, contracts and
                related files.
              </p>
            </div>
          </div>

          <form className="payment-form" onSubmit={handleAddDocument}>
            <input
              placeholder="Document name"
              value={documentForm.document_name}
              onChange={(e) =>
                setDocumentForm({
                  ...documentForm,
                  document_name: e.target.value,
                })
              }
              required
            />

            <select
              value={documentForm.document_type}
              onChange={(e) =>
                setDocumentForm({
                  ...documentForm,
                  document_type: e.target.value,
                })
              }
            >
              <option>PDF</option>
              <option>Word</option>
              <option>JPG</option>
              <option>PNG</option>
              <option>Drawing</option>
              <option>Bill</option>
              <option>Agreement</option>
              <option>Approval</option>
              <option>Other</option>
            </select>

            <input
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={(e) => setSelectedFile(e.target.files[0])}
            />

            <input
              placeholder="Optional file URL"
              value={documentForm.file_url}
              onChange={(e) =>
                setDocumentForm({
                  ...documentForm,
                  file_url: e.target.value,
                })
              }
            />

            <button type="submit">Add Document</button>
          </form>
        </div>

        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>Document Type Summary</h2>
              <p className="muted-text">
                File type breakdown for this tender.
              </p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Document Type</th>
                <th>Count</th>
              </tr>
            </thead>

            <tbody>
              {Object.entries(documentTypeCounts).map(([type, count]) => (
                <tr key={type}>
                  <td>{type}</td>
                  <td className="number-cell">{count}</td>
                </tr>
              ))}

              {Object.entries(documentTypeCounts).length === 0 && (
                <tr>
                  <td colSpan="2" className="empty-table-message">
                    No documents uploaded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>Documents Register</h2>
            <p className="muted-text">
              All documents attached to this tender.
            </p>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>File</th>
                <th>Preview</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {documents.map((doc) => {
                const type = doc.document_type || getFileLabel(doc.file_url);

                return (
                  <tr key={doc.id}>
                    <td>{doc.document_name || "-"}</td>
                    <td>
                      <span className="badge blue">{type}</span>
                    </td>
                    <td>
                      {doc.file_url ? (
                        <a href={doc.file_url} target="_blank" rel="noreferrer">
                          Open File
                        </a>
                      ) : (
                        "No file"
                      )}
                    </td>
                    <td>
                      {doc.file_url &&
                      /\.(jpg|jpeg|png|webp)$/i.test(doc.file_url) ? (
                        <img
                          src={doc.file_url}
                          alt={doc.document_name || "Document"}
                          className="worker-photo-thumb"
                        />
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="delete-btn"
                        onClick={() =>
                          setDeleteTarget({
                            type: "document",
                            item: doc,
                          })
                        }
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}

              {documents.length === 0 && (
                <tr>
                  <td colSpan="5" className="empty-table-message">
                    No documents added yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export default TenderDocumentsTab;