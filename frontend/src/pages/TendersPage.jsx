function TendersPage({ tenders, addTender, deleteTender }) {
    return (
      <section className="payment-grid">
        <div className="panel">
          <h2>Add Tender</h2>
  
          <form className="payment-form" onSubmit={addTender}>
            <input name="title" placeholder="Tender Title" required />
  
            <select name="status" required>
              <option value="running">Running</option>
              <option value="passed">Passed</option>
              <option value="due soon">Due Soon</option>
            </select>
  
            <input name="due_date" type="date" required />
  
            <textarea name="description" placeholder="Tender Description"></textarea>
  
            <button type="submit">Add Tender</button>
          </form>
        </div>
  
        <div className="panel">
          <h2>Tenders List</h2>
  
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Due Date</th>
                <th>Description</th>
                <th>Action</th>
              </tr>
            </thead>
  
            <tbody>
              {tenders.map((tender) => (
                <tr key={tender.id}>
                  <td>{tender.title}</td>
                  <td>{tender.status}</td>
                  <td>{tender.due_date ? tender.due_date.slice(0, 10) : ""}</td>
                  <td>{tender.description}</td>
                  <td>
                    <button
                      className="delete-btn"
                      onClick={() => deleteTender(tender.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
  
              {tenders.length === 0 && (
                <tr>
                  <td colSpan="5">No tenders added yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    );
  }
  
  export default TendersPage;