/**
 * Service for handling expense-related operations
 *
 * This service has been updated to use standardized API methods from the core API.
 * - getAll -> getExpenses
 * - getById -> getExpenseById
 * - getCategories -> getExpenseCategories
 * - create -> createExpense
 * - update -> updateExpense
 * - delete -> deleteExpense
 */

import { expensesApi, Expense } from "@/core/api";
import { ExpenseCategory } from "@/types";

export interface CreateExpenseRequest {
  date: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
  payment_status: string;
  payment_method?: string;
  invoice_number?: string;
  notes?: string;
}

export interface UpdateExpenseRequest {
  date?: string;
  amount?: number;
  category?: ExpenseCategory;
  description?: string;
  payment_status?: string;
  payment_method?: string;
  invoice_number?: string;
  notes?: string;
}

export async function fetchExpenses(filters?: {
  category?: string;
  start_date?: string;
  end_date?: string;
  payment_status?: string;
}): Promise<Expense[]> {
  try {
    const response = await expensesApi.getExpenses(filters);

    if (response.error) {
      console.error("Error fetching expenses:", response.error);
      throw new Error(response.error.message);
    }

    return response.data || [];
  } catch (err) {
    console.error("Failed to fetch expenses:", err);
    throw err;
  }
}

export async function fetchExpenseById(id: string): Promise<Expense | null> {
  try {
    const response = await expensesApi.getExpenseById(id);

    if (response.error) {
      console.error(`Error fetching expense with ID ${id}:`, response.error);
      throw new Error(response.error.message);
    }

    return response.data || null;
  } catch (err) {
    console.error(`Failed to fetch expense with ID ${id}:`, err);
    throw err;
  }
}

export async function fetchExpenseCategories(): Promise<string[]> {
  try {
    const response = await expensesApi.getExpenseCategories();

    if (response.error) {
      console.error("Error fetching expense categories:", response.error);
      throw new Error(response.error.message);
    }

    return response.data || [];
  } catch (err) {
    console.error("Failed to fetch expense categories:", err);
    throw err;
  }
}

export async function createExpense(
  expense: CreateExpenseRequest
): Promise<Expense> {
  try {
    // Transform the request to match the API's expected structure
    const expenseData: Omit<Expense, "id" | "created_at" | "updated_at"> = {
      category: expense.category,
      amount: expense.amount,
      description: expense.description,
      payment_status: expense.payment_status as "paid" | "pending" | "cancelled",
      payment_date: expense.date,
      receipt_number: expense.invoice_number,
      created_by: "", // This should be set by the API based on the authenticated user
    };

    const response = await expensesApi.createExpense(expenseData);

    if (response.error) {
      console.error("Error creating expense:", response.error);
      throw new Error(response.error.message);
    }

    return response.data!;
  } catch (err) {
    console.error("Failed to create expense:", err);
    throw err;
  }
}

export async function updateExpense(
  id: string,
  expense: UpdateExpenseRequest
): Promise<Expense> {
  try {
    // Transform the request to match the API's expected structure
    const expenseData: Partial<Omit<Expense, "id" | "created_at" | "updated_at">> = {
      ...(expense.category && { category: expense.category }),
      ...(expense.amount && { amount: expense.amount }),
      ...(expense.description && { description: expense.description }),
      ...(expense.payment_status && { 
        payment_status: expense.payment_status as "paid" | "pending" | "cancelled" 
      }),
      ...(expense.date && { payment_date: expense.date }),
      ...(expense.invoice_number && { receipt_number: expense.invoice_number }),
    };

    const response = await expensesApi.updateExpense(id, expenseData);

    if (response.error) {
      console.error(`Error updating expense with ID ${id}:`, response.error);
      throw new Error(response.error.message);
    }

    return response.data!;
  } catch (err) {
    console.error(`Failed to update expense with ID ${id}:`, err);
    throw err;
  }
}

export async function deleteExpense(id: string): Promise<void> {
  try {
    const response = await expensesApi.deleteExpense(id);

    if (response.error) {
      console.error(`Error deleting expense with ID ${id}:`, response.error);
      throw new Error(response.error.message);
    }
  } catch (err) {
    console.error(`Failed to delete expense with ID ${id}:`, err);
    throw err;
  }
} 