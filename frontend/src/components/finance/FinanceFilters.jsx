function FinanceFilters({
    searchTerm,
    setSearchTerm,
    filterType,
    setFilterType,
    filterScope,
    setFilterScope,
    filterTender,
    setFilterTender,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    tenders = [],
  }) {
    return (
      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>Finance Filters</h2>
            <p className="muted-text">
              Search and filter finance records by type, scope, tender and date.
            </p>
          </div>
        </div>
  
        <div className="form-grid">
          <input
            placeholder="Search tender, name, material, notes, amount..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
  
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="all">All Types</option>
            <option value="Income">Income</option>
            <option value="Expense">Expense</option>
          </select>
  
          <select value={filterScope} onChange={(e) => setFilterScope(e.target.value)}>
            <option value="all">All Scopes</option>
            <option value="PERSONAL_TENDER">Personal Tender</option>
            <option value="SUBCONTRACTOR_TENDER">Subcontractor Tender</option>
            <option value="OFFICE">Office</option>
          </select>
  
          <select value={filterTender} onChange={(e) => setFilterTender(e.target.value)}>
            <option value="all">All Tenders</option>
            {tenders.map((tender) => (
              <option key={tender.id} value={tender.id}>
                {tender.title || tender.tender_name || `Tender ${tender.id}`}
              </option>
            ))}
          </select>
  
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
  
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </section>
    );
  }
  
  export default FinanceFilters;