function TenderMaterialsTab({
    materials,
    materialForm,
    setMaterialForm,
    handleAddMaterial,
    setDeleteTarget,
  }) {
    const previewTotal =
      Number(materialForm.quantity || 0) * Number(materialForm.rate || 0);
  
    return (
      <div className="payment-grid">
        <div className="panel">
          <h2>Add Material</h2>
  
          <form className="payment-form" onSubmit={handleAddMaterial}>
            <select
              value={materialForm.section_name}
              onChange={(e) =>
                setMaterialForm({
                  ...materialForm,
                  section_name: e.target.value,
                })
              }
              required
            >
              <option value="">Select Material Category</option>
              <option value="Steel">Steel</option>
              <option value="Sand">Sand</option>
              <option value="Cement">Cement</option>
              <option value="Kapchi">Kapchi</option>
              <option value="Crushed Stone">Crushed Stone</option>
              <option value="Tiles">Tiles</option>
              <option value="Pipe">Pipe</option>
              <option value="Blocks">Blocks</option>
              <option value="Wood">Wood</option>
              <option value="Other">Other</option>
            </select>
  
            <input
              placeholder="Material name"
              value={materialForm.material_name}
              onChange={(e) =>
                setMaterialForm({
                  ...materialForm,
                  material_name: e.target.value,
                })
              }
              required
            />
  
            <input
              placeholder="Quantity"
              type="number"
              value={materialForm.quantity}
              onChange={(e) =>
                setMaterialForm({
                  ...materialForm,
                  quantity: e.target.value,
                })
              }
            />
  
            <input
              placeholder="Unit"
              value={materialForm.unit}
              onChange={(e) =>
                setMaterialForm({
                  ...materialForm,
                  unit: e.target.value,
                })
              }
            />
  
            <input
              placeholder="Rate"
              type="number"
              value={materialForm.rate}
              onChange={(e) =>
                setMaterialForm({
                  ...materialForm,
                  rate: e.target.value,
                })
              }
            />
  
            <input
              placeholder="Vendor / Supplier Name"
              value={materialForm.vendor_name}
              onChange={(e) =>
                setMaterialForm({
                  ...materialForm,
                  vendor_name: e.target.value,
                })
              }
            />
  
            <p className="form-preview-total">
              Total: ${previewTotal.toFixed(2)}
            </p>
  
            <input
              placeholder="Notes"
              value={materialForm.notes}
              onChange={(e) =>
                setMaterialForm({
                  ...materialForm,
                  notes: e.target.value,
                })
              }
            />
  
            <button type="submit">Add Material</button>
          </form>
        </div>
  
        <div className="panel">
          <h2>Material Data</h2>
  
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Material</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Rate</th>
                  <th>Total</th>
                  <th>Vendor</th>
                  <th>Notes</th>
                  <th>Action</th>
                </tr>
              </thead>
  
              <tbody>
                {materials.map((item) => (
                  <tr key={item.id}>
                    <td>{item.section_name}</td>
                    <td>{item.material_name}</td>
                    <td>{item.quantity}</td>
                    <td>{item.unit}</td>
                    <td>{item.rate}</td>
                    <td>{item.total_amount}</td>
                    <td>{item.vendor_name}</td>
                    <td>{item.notes}</td>
                    <td>
                      <button
                        type="button"
                        className="delete-btn"
                        onClick={() =>
                          setDeleteTarget({
                            type: "material",
                            item,
                          })
                        }
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
  
                {materials.length === 0 && (
                  <tr>
                    <td colSpan="9" className="empty-table-message">
                      No materials added yet.
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
  
  export default TenderMaterialsTab;