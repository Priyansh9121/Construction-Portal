import { formatCurrency } from "../../utils/currency";
function TenderMaterialsTab({
  materials = [],
  materialForm,
  setMaterialForm,
  handleAddMaterial,
  setDeleteTarget,
}) {
  const money = formatCurrency;

  const previewTotal =
    Number(materialForm.quantity || 0) * Number(materialForm.rate || 0);

  const materialTotal = materials.reduce(
    (sum, item) =>
      sum +
      Number(
        item.total_amount ||
          Number(item.quantity || 0) * Number(item.rate || 0) ||
          0
      ),
    0
  );

  const totalQuantity = materials.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );

  const uniqueVendors = new Set(
    materials.map((item) => item.vendor_name).filter(Boolean)
  ).size;

  const categoryTotals = materials.reduce((acc, item) => {
    const category = item.section_name || "Other";
    const amount =
      Number(item.total_amount) ||
      Number(item.quantity || 0) * Number(item.rate || 0);

    acc[category] = (acc[category] || 0) + amount;
    return acc;
  }, {});

  const topCategories = Object.entries(categoryTotals)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return (
    <>
      <section className="summary-cards">
        <div className="card">
          <p>Total Material Cost</p>
          <h2>{money(materialTotal)}</h2>
        </div>

        <div className="card">
          <p>Total Items</p>
          <h2>{materials.length}</h2>
        </div>

        <div className="card">
          <p>Total Quantity</p>
          <h2>{totalQuantity.toLocaleString()}</h2>
        </div>

        <div className="card">
          <p>Vendors</p>
          <h2>{uniqueVendors}</h2>
        </div>

        <div className="card highlight-warning">
          <p>Current Entry Preview</p>
          <h2>{money(previewTotal)}</h2>
        </div>
      </section>

      <div className="payment-grid">
        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>Add Material</h2>
              <p className="muted-text">
                Track site/tender material, quantity, rate, supplier and notes.
              </p>
            </div>
          </div>

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
              <option value="Labour Material">Labour Material</option>
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

            <div className="form-grid">
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
                placeholder="Vendor / Supplier"
                value={materialForm.vendor_name}
                onChange={(e) =>
                  setMaterialForm({
                    ...materialForm,
                    vendor_name: e.target.value,
                  })
                }
              />
            </div>

            <p className="form-preview-total">
              Preview Total: {money(previewTotal)}
            </p>

            <textarea
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
          <div className="section-title-row">
            <div>
              <h2>Material Category Summary</h2>
              <p className="muted-text">
                Highest material cost categories for this tender.
              </p>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Total Cost</th>
                  <th>% of Material Cost</th>
                </tr>
              </thead>

              <tbody>
                {topCategories.map((item) => (
                  <tr key={item.category}>
                    <td>{item.category}</td>
                    <td className="amount-cell">{money(item.amount)}</td>
                    <td className="amount-cell">
                      {materialTotal > 0
                        ? `${((item.amount / materialTotal) * 100).toFixed(2)}%`
                        : "0.00%"}
                    </td>
                  </tr>
                ))}

                {topCategories.length === 0 && (
                  <tr>
                    <td colSpan="3" className="empty-table-message">
                      No category summary available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>Material Register</h2>
            <p className="muted-text">
              Complete material list with quantity, rate, total and supplier.
            </p>
          </div>
        </div>

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
              {materials.map((item) => {
                const itemTotal =
                  Number(item.total_amount) ||
                  Number(item.quantity || 0) * Number(item.rate || 0);

                return (
                  <tr key={item.id}>
                    <td>{item.section_name || "-"}</td>
                    <td>{item.material_name || "-"}</td>
                    <td>{item.quantity || 0}</td>
                    <td>{item.unit || "-"}</td>
                    <td>{money(item.rate)}</td>
                    <td className="amount-cell">{money(itemTotal)}</td>
                    <td>{item.vendor_name || "-"}</td>
                    <td>{item.notes || "-"}</td>
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
                );
              })}

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
      </section>
    </>
  );
}

export default TenderMaterialsTab;