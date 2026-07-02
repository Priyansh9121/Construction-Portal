export const money = (value) =>
    Number(value || 0).toFixed(2);
  
  export const calculateIncome = (payments = []) => {
    return payments
      .filter((p) => p.payment_type === "income")
      .reduce(
        (sum, p) => sum + Number(p.amount || 0),
        0
      );
  };
  
  export const calculateExpense = (payments = []) => {
    return payments
      .filter((p) => p.payment_type === "expense")
      .reduce(
        (sum, p) => sum + Number(p.amount || 0),
        0
      );
  };
  
  export const calculateBalance = (payments = []) => {
    return (
      calculateIncome(payments) -
      calculateExpense(payments)
    );
  };