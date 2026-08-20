import { supabase } from "@/integrations/supabase/client";

export interface ExpenseUser {
  id: string;
  name: string;
  color?: string;
  created_at?: string;
}

const LOCAL_STORAGE_KEY = "admmaster_expense_users";

export const getExpenseUsers = async (): Promise<ExpenseUser[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data, error }: any = await (supabase as any)
        .from("expense_users")
        .select("*")
        .eq("user_id", user.id)
        .order("name", { ascending: true });

      if (!error && data && Array.isArray(data)) {
        return data.map((item: any) => ({
          id: item.id,
          name: item.name,
          color: item.color || "#3b82f6",
          created_at: item.created_at,
        }));
      }
    }
  } catch (e) {
    console.warn("Using local storage fallback for expense users", e);
  }

  // Fallback to localStorage
  const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (localData !== null) {
    try {
      const parsed = JSON.parse(localData);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (e) {
      console.error("Failed to parse local expense users", e);
    }
  }

  return [];
};

export const addExpenseUser = async (name: string, color: string = "#3b82f6"): Promise<ExpenseUser> => {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("O nome do usuário é obrigatório");

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data, error }: any = await (supabase as any)
        .from("expense_users")
        .insert([{ name: trimmedName, color, user_id: user.id }])
        .select()
        .single();

      if (!error && data) {
        const item: any = data;
        const current = await getExpenseUsers();
        const updated = [...current.filter(u => u.id !== item.id), { id: item.id, name: item.name, color: item.color }];
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
        return { id: item.id, name: item.name, color: item.color };
      }
    }
  } catch (e) {
    console.warn("Falling back to local storage for addExpenseUser", e);
  }

  const current = await getExpenseUsers();
  const newUser: ExpenseUser = {
    id: `user-${Date.now()}`,
    name: trimmedName,
    color,
  };
  const updated = [...current, newUser];
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  return newUser;
};

export const updateExpenseUser = async (id: string, name: string, color: string = "#3b82f6"): Promise<ExpenseUser> => {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("O nome do usuário é obrigatório");

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data, error }: any = await (supabase as any)
        .from("expense_users")
        .update({ name: trimmedName, color })
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (!error && data) {
        const item: any = data;
        const current = await getExpenseUsers();
        const updated = current.map(u => u.id === id ? { ...u, name: item.name, color: item.color } : u);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
        return { id: item.id, name: item.name, color: item.color };
      }
    }
  } catch (e) {
    console.warn("Falling back to local storage for updateExpenseUser", e);
  }

  const current = await getExpenseUsers();
  const updated = current.map((u) => u.id === id ? { ...u, name: trimmedName, color } : u);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  return { id, name: trimmedName, color };
};

export const deleteExpenseUser = async (id: string): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await (supabase as any)
        .from("expense_users")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
    }
  } catch (e) {
    console.warn("Falling back to local storage for deleteExpenseUser", e);
  }

  const current = await getExpenseUsers();
  const updated = current.filter((u) => u.id !== id);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
};

