export const calculatePaymentSummary = (payments = []) => {
    const totalIncome = payments
      .filter((payment) => payment.payment_type === "Income")
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  
    const totalExpense = payments
      .filter((payment) => payment.payment_type === "Expense")
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  
    const governmentGstReceived = payments
      .filter((payment) => payment.payment_sub_type === "GOVERNMENT_BILL")
      .reduce((sum, payment) => sum + Number(payment.gst_amount || 0), 0);
  
    const companyCharges = payments
      .filter((payment) => payment.payment_sub_type === "COMPANY_CHARGE")
      .reduce(
        (sum, payment) =>
          sum + Number(payment.gst_amount || payment.amount || 0),
        0
      );
  
    const gstReturned = payments
      .filter((payment) => payment.payment_sub_type === "GST_RETURN")
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  
    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      governmentGstReceived,
      companyCharges,
      gstReturned,
      gstRemaining: governmentGstReceived - gstReturned,
    };
  };