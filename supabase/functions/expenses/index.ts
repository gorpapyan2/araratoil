import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';

// ---- START INLINED CODE FROM SHARED MODULES ----

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// Shared types
type PaymentStatus = "pending" | "completed" | "failed" | "refunded";
type PaymentMethod = "cash" | "card" | "bank_transfer" | "mobile_payment";
type ExpenseCategory = "utilities" | "rent" | "salaries" | "maintenance" | "supplies" | "taxes" | "insurance" | "other";

interface Expense {
  id: string;
  date: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
  payment_status: PaymentStatus;
  payment_method?: PaymentMethod;
  invoice_number?: string;
  notes?: string;
  employee_id: string;
  created_at?: string;
}

// Database utilities
const createServiceClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase URL or service role key environment variables');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
};

const createAnonClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') as string;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase URL or anon key environment variables');
  }
  
  return createClient(supabaseUrl, supabaseAnonKey);
};

const handleError = (error: unknown): { error: string; details?: unknown } => {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return {
      error: String(error.message),
      details: error
    };
  }
  
  return {
    error: 'An unknown error occurred',
    details: error
  };
};

const getUserFromRequest = async (request: Request) => {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.replace('Bearer ', '');
  const supabase = createAnonClient();
  
  const { data, error } = await supabase.auth.getUser(token);
  
  if (error || !data.user) {
    return null;
  }
  
  return data.user;
};

// API utilities
function createJsonResponse<T>(data: { data?: T; error?: string }, status = 200): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    }
  );
}

function successResponse<T>(data: T, status = 200): Response {
  return createJsonResponse({ data }, status);
}

function errorResponse(error: unknown, status = 400): Response {
  const errorData = handleError(error);
  return createJsonResponse(errorData, status);
}

async function parseRequestBody<T>(request: Request): Promise<T> {
  try {
    const contentType = request.headers.get('content-type');
    
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Content-Type must be application/json');
    }
    
    return await request.json() as T;
  } catch (error) {
    throw new Error(`Failed to parse request body: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function getUrlParams(request: Request): URLSearchParams {
  const url = new URL(request.url);
  return url.searchParams;
}

function methodNotAllowed(): Response {
  return errorResponse({ message: 'Method not allowed' }, 405);
}

function unauthorized(): Response {
  return errorResponse({ message: 'Unauthorized' }, 401);
}

function notFound(resource = 'Resource'): Response {
  return errorResponse({ message: `${resource} not found` }, 404);
}

// ---- END INLINED CODE FROM SHARED MODULES ----

// Types for better type safety
interface ExpenseWithRelations extends Expense {
  employee: {
    id: string;
    name: string;
  };
}

interface ExpenseFilters {
  category?: ExpenseCategory;
  startDate?: string;
  endDate?: string;
  paymentStatus?: PaymentStatus;
}

interface ExpenseValidation {
  isValid: boolean;
  message?: string;
  status?: number;
}

interface TransactionData {
  amount: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  employee_id: string;
  entity_id: string;
  entity_type: 'expense';
  description: string;
  updated_at: string;
}

console.info('Expenses Edge Function started');

// Handle expenses operations
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Robust path parsing
  const url = new URL(req.url);
  const pathParts = url.pathname.replace(/^\/functions\/v1\//, '').split('/');
  const mainRoute = pathParts[0];
  const subRoute = pathParts[1] || '';

  if (mainRoute !== 'expenses') {
    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Example: /expenses/summary
  if (subRoute === 'summary') {
    if (req.method === 'GET') {
      // Replace with actual logic
      return new Response(JSON.stringify({ summary: {} }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Authentication check
  const user = await getUserFromRequest(req);
  if (!user) {
    return unauthorized();
  }

  try {
    // Route handling
    if (req.method === 'GET') {
      if (subRoute === '' || subRoute === '/') {
        const params = getUrlParams(req);
        const filters: ExpenseFilters = {
          category: params.get('category') as ExpenseCategory || undefined,
          startDate: params.get('start_date') || undefined,
          endDate: params.get('end_date') || undefined,
          paymentStatus: params.get('payment_status') as PaymentStatus || undefined
        };
        
        return await getExpenses(filters);
      } else if (subRoute === '/categories') {
        return await getExpenseCategories();
      } else if (subRoute.match(/^\/[a-zA-Z0-9-]+$/)) {
        const id = subRoute.split('/')[1];
        return await getExpenseById(id);
      }
    } else if (req.method === 'POST' && (subRoute === '' || subRoute === '/')) {
      const data = await parseRequestBody<Omit<Expense, 'id' | 'created_at'>>(req);
      return await createExpense(data, user.id);
    } else if (req.method === 'PUT' && subRoute.match(/^\/[a-zA-Z0-9-]+$/)) {
      const id = subRoute.split('/')[1];
      const data = await parseRequestBody<Partial<Omit<Expense, 'id' | 'created_at'>>>(req);
      return await updateExpense(id, data);
    } else if (req.method === 'DELETE' && subRoute.match(/^\/[a-zA-Z0-9-]+$/)) {
      const id = subRoute.split('/')[1];
      return await deleteExpense(id);
    }
  } catch (error) {
    console.error('Expenses function error:', error);
    return errorResponse(error);
  }

  return methodNotAllowed();
});

/**
 * Validate expense data
 */
function validateExpense(expense: Partial<Expense>): ExpenseValidation {
  if (!expense.date) {
    return { isValid: false, message: "Expense date is required", status: 400 };
  }
  
  if (!expense.amount || expense.amount <= 0) {
    return { isValid: false, message: "Amount must be a positive number", status: 400 };
  }
  
  if (!expense.category) {
    return { isValid: false, message: "Category is required", status: 400 };
  }
  
  if (!expense.description) {
    return { isValid: false, message: "Description is required", status: 400 };
  }

  if (!expense.employee_id) {
    return { isValid: false, message: "Employee ID is required", status: 400 };
  }

  // Validate UUID format for employee_id
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(expense.employee_id)) {
    return { isValid: false, message: "Invalid employee ID format", status: 400 };
  }
  
  return { isValid: true };
}

/**
 * Get available expense categories
 */
async function getExpenseCategories(): Promise<Response> {
  try {
    // These are the available expense categories as defined in the ExpenseCategory type
    const categories: ExpenseCategory[] = [
      "utilities", 
      "rent", 
      "salaries", 
      "maintenance", 
      "supplies", 
      "taxes", 
      "insurance", 
      "other"
    ];

    return successResponse(categories);
  } catch (error) {
    console.error('Error fetching expense categories:', error);
    return errorResponse(error);
  }
}

/**
 * Get expenses with optional filtering
 */
async function getExpenses(filters: ExpenseFilters): Promise<Response> {
  try {
    const supabase = createServiceClient();
    
    // Start with base query
    let query = supabase
      .from("expenses")
      .select("*")
      .order("date", { ascending: false });
    
    // Apply filters if provided
    if (filters.category) {
      query = query.eq("category", filters.category);
    }
    
    if (filters.startDate) {
      query = query.gte("date", filters.startDate);
    }
    
    if (filters.endDate) {
      query = query.lte("date", filters.endDate);
    }
    
    if (filters.paymentStatus) {
      query = query.eq("payment_status", filters.paymentStatus);
    }
    
    // Execute the query
    const { data: expenses, error } = await query;

    if (error) throw error;

    // If we have expenses, fetch employee data separately
    if (expenses && expenses.length > 0) {
      const employeeIds = [...new Set(expenses.map(e => e.employee_id).filter(Boolean))];
      
      if (employeeIds.length === 0) {
        return successResponse(expenses);
      }

      const { data: employees, error: employeeError } = await supabase
        .from("employees")
        .select("id, name")
        .in("id", employeeIds);

      if (employeeError) {
        console.error('Error fetching employee data:', employeeError);
        // Return expenses without employee data rather than failing
        return successResponse(expenses);
      }

      // Create a map of employee data
      const employeeMap = new Map(
        (employees || []).map(emp => [emp.id, { id: emp.id, name: emp.name }])
      );

      // Combine the data
      const expensesWithEmployees = expenses.map(expense => ({
        ...expense,
        employee: expense.employee_id ? employeeMap.get(expense.employee_id) || null : null
      }));

      return successResponse(expensesWithEmployees as ExpenseWithRelations[]);
    }

    return successResponse([]);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    return errorResponse(error);
  }
}

/**
 * Get an expense by ID
 */
async function getExpenseById(id: string): Promise<Response> {
  try {
    const supabase = createServiceClient();
    
    const { data: expense, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return notFound('Expense');
      }
      throw error;
    }

    // Fetch employee data separately
    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("id, name")
      .eq("id", expense.employee_id)
      .single();

    if (employeeError) throw employeeError;

    const expenseWithEmployee = {
      ...expense,
      employee: employee || null
    };

    return successResponse(expenseWithEmployee as ExpenseWithRelations);
  } catch (error) {
    console.error(`Error fetching expense ${id}:`, error);
    return errorResponse(error);
  }
}

/**
 * Create a transaction record for an expense
 */
async function createExpenseTransaction(
  expense: Expense,
  userId: string
): Promise<void> {
  const supabase = createServiceClient();
  
  const transactionData: TransactionData = {
    amount: expense.amount,
    payment_method: expense.payment_method || "cash",
    payment_status: "completed",
    employee_id: userId,
    entity_id: expense.id,
    entity_type: "expense",
    description: `Expense: ${expense.description} (${expense.category})`,
    updated_at: new Date().toISOString()
  };
  
  const { error } = await supabase
    .from("transactions")
    .insert(transactionData);
    
  if (error) {
    console.error("Error creating transaction for expense:", error);
    throw error;
  }
}

/**
 * Create a new expense
 */
async function createExpense(
  expense: Omit<Expense, 'id' | 'created_at'>,
  userId: string
): Promise<Response> {
  try {
    const supabase = createServiceClient();
    
    // Validate the expense data
    const validation = validateExpense(expense);
    if (!validation.isValid) {
      return errorResponse({ message: validation.message }, validation.status);
    }
    
    // Set payment status to pending if not provided
    if (!expense.payment_status) {
      expense.payment_status = "pending";
    }
    
    // Create the expense
    const { data: newExpense, error } = await supabase
      .from("expenses")
      .insert(expense)
      .select("*")
      .single();

    if (error) throw error;

    // Fetch employee data separately
    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("id, name")
      .eq("id", newExpense.employee_id)
      .single();

    if (employeeError) throw employeeError;

    const expenseWithEmployee = {
      ...newExpense,
      employee: employee || null
    };

    // If the payment_status is completed, create a transaction record
    if (expense.payment_status === "completed") {
      try {
        await createExpenseTransaction(expenseWithEmployee, userId);
      } catch (transactionError) {
        console.error("Error creating transaction for expense:", transactionError);
        // We don't throw here, as the expense was created successfully
      }
    }

    return successResponse(expenseWithEmployee as ExpenseWithRelations, 201);
  } catch (error) {
    console.error('Error creating expense:', error);
    return errorResponse(error);
  }
}

/**
 * Update an existing expense
 */
async function updateExpense(
  id: string,
  updates: Partial<Omit<Expense, 'id' | 'created_at'>>
): Promise<Response> {
  try {
    const supabase = createServiceClient();
    
    // Validate the updates
    const validation = validateExpense(updates);
    if (!validation.isValid) {
      return errorResponse({ message: validation.message }, validation.status);
    }
    
    // Check if the expense exists
    const { data: existingExpense, error: existingError } = await supabase
      .from("expenses")
      .select("*")
      .eq("id", id)
      .single();
      
    if (existingError) {
      if (existingError.code === 'PGRST116') {
        return notFound('Expense');
      }
      throw existingError;
    }
    
    // Update the expense
    const { data: updatedExpense, error } = await supabase
      .from("expenses")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();
      
    if (error) throw error;

    // Fetch employee data separately
    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("id, name")
      .eq("id", updatedExpense.employee_id)
      .single();

    if (employeeError) throw employeeError;

    const expenseWithEmployee = {
      ...updatedExpense,
      employee: employee || null
    };
    
    // If payment_status is being updated to completed, create a transaction
    if (updates.payment_status === "completed" && existingExpense.payment_status !== "completed") {
      try {
        await createExpenseTransaction(expenseWithEmployee, existingExpense.employee_id);
      } catch (transactionError) {
        console.error("Error creating transaction for expense:", transactionError);
        // We don't throw here, as the expense was updated successfully
      }
    }
    
    return successResponse(expenseWithEmployee as ExpenseWithRelations);
  } catch (error) {
    console.error(`Error updating expense ${id}:`, error);
    return errorResponse(error);
  }
}

/**
 * Delete an expense
 */
async function deleteExpense(id: string): Promise<Response> {
  try {
    const supabase = createServiceClient();
    
    // Check if the expense exists
    const { data: existingExpense, error: existingError } = await supabase
      .from("expenses")
      .select("id, payment_status")
      .eq("id", id)
      .single();
      
    if (existingError) {
      if (existingError.code === 'PGRST116') {
        return notFound('Expense');
      }
      throw existingError;
    }
    
    // If the expense has a completed payment, we should not delete it
    if (existingExpense.payment_status === "completed") {
      return errorResponse({
        message: "Cannot delete an expense with completed payment"
      }, 400);
    }
    
    // Delete the expense
    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", id);
      
    if (error) throw error;
    
    return successResponse(null, 204);
  } catch (error) {
    console.error(`Error deleting expense ${id}:`, error);
    return errorResponse(error);
  }
}
