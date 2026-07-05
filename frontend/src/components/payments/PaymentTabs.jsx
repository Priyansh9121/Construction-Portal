function PaymentTabs({
  mainTab,
  activeSections = [],
  sectionTab,
  childTab,
  selectedSection,
  onMainTabClick,
  onSectionClick,
  onChildClick,
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

      {selectedSection?.childOptions?.length > 0 && (
        <div className="tabs child-tabs">
          {selectedSection.childOptions.map((child) => (
            <button
              key={child.key}
              type="button"
              className={childTab === child.key ? "active-tab" : ""}
              onClick={() => onChildClick(child)}
            >
              {child.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

export default PaymentTabs;