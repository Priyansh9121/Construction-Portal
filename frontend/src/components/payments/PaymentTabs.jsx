function PaymentTabs({
    mainTab,
    activeSections,
    sectionTab,
    onMainTabClick,
    onSectionClick,
  }) {
    return (
      <>
        <div className="tabs">
          <button
            type="button"
            className={mainTab === "Income" ? "active-tab" : ""}
            onClick={() => onMainTabClick("Income")}
          >
            Income
          </button>
  
          <button
            type="button"
            className={mainTab === "Expense" ? "active-tab" : ""}
            onClick={() => onMainTabClick("Expense")}
          >
            Expense
          </button>
        </div>
  
        <div className="tabs">
          {activeSections.map((section) => (
            <button
              key={section.key}
              type="button"
              className={sectionTab === section.key ? "active-tab" : ""}
              onClick={() => onSectionClick(section)}
            >
              {section.label}
            </button>
          ))}
        </div>
      </>
    );
  }
  
  export default PaymentTabs;