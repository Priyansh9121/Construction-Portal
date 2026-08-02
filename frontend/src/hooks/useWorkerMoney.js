import { useCallback } from "react";

import {
  getAllocations,
  createAllocation,
  updateAllocation,
  deleteAllocation,
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  approveExpense,
  rejectExpense,
} from "../services/workerMoneyService";

import { useCollection } from "./useCollection";

export default function useWorkerMoney(user) {
  const allocationState = useCollection(user, {
    fetcher: getAllocations,
    label: "allocations",
  });

  const expenseState = useCollection(user, {
    fetcher: getExpenses,
    label: "expenses",
  });

  const {
    refresh: refreshAllocations,
  } = allocationState;

  const {
    refresh: refreshExpenses,
  } = expenseState;

  const addAllocation = useCallback(
    async (allocation) => {
      const result = await createAllocation(allocation);
      await refreshAllocations();

      return result;
    },
    [refreshAllocations]
  );

  const addExpense = useCallback(
    async (expense) => {
      const result = await createExpense(expense);

      // An expense draws down its allocation, so both registers move.
      await Promise.all([refreshExpenses(), refreshAllocations()]);

      return result;
    },
    [refreshExpenses, refreshAllocations]
  );

  return {
    allocations: allocationState.items,
    expenses: expenseState.items,

    loading: allocationState.loading || expenseState.loading,
    error: allocationState.error || expenseState.error,

    addAllocation,
    addExpense,

    fetchAllocations: refreshAllocations,
    fetchExpenses: refreshExpenses,

    updateAllocation,
    deleteAllocation,

    updateExpense,
    deleteExpense,

    approveExpense,
    rejectExpense,
  };
}
