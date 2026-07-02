function TenderDocumentsTab({
    documents,
    documentForm,
    setDocumentForm,
    setSelectedFile,
    handleAddDocument,
    setDeleteTarget,
  }) {
    return (
      <div className="payment-grid">
        <div className="panel">
          <h2>Add Document</h2>
  
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
          <h2>Documents List</h2>
  
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>File</th>
                  <th>Action</th>
                </tr>
              </thead>
  
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td>{doc.document_name}</td>
                    <td>{doc.document_type}</td>
                    <td>
                      {doc.file_url ? (
                        <a href={doc.file_url} target="_blank" rel="noreferrer">
                          Open
                        </a>
                      ) : (
                        "No file"
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
                ))}
  
                {documents.length === 0 && (
                  <tr>
                    <td colSpan="4" className="empty-table-message">
                      No documents added yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }
  
  export default TenderDocumentsTab;