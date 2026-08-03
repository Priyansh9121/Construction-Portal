/**
 * File purpose:
 * Loads worker allocations and expenses together, since the two are read
 * as one picture.
 *
 * API endpoints:
 * - /worker-allocations and /worker-expenses, via
 *   services/workerMoneyService.js
 *
 * Connected to:
 * - WorkerMoneyPage.jsx
 * - App.jsx loads this once for the session
 *
 * Important notes:
 * - Office-only. A worker sees their own money through the worker portal.
 * - Allocations are the credit side, expenses the debit side; an expense
 *   belongs to an allocation, so the two must be refreshed together after
 *   any approval or the totals shown will not reconcile.
 */

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
  approveAllocation,
  rejectAllocation,
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

    approveAllocation,
    rejectAllocation,
  };
}
