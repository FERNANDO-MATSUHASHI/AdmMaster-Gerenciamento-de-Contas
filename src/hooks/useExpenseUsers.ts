import { useState, useEffect } from "react";
import { getExpenseUsers, ExpenseUser } from "@/lib/expenseUsers";

export function useExpenseUsers() {
  const [users, setUsers] = useState<ExpenseUser[]>([]);
  const [userColorMap, setUserColorMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let isMounted = true;

    const loadUsers = async () => {
      try {
        const data = await getExpenseUsers();
        if (!isMounted) return;
        setUsers(data);

        const map: Record<string, string> = {};
        data.forEach((u) => {
          if (u.name && u.color) {
            map[u.name.trim().toLowerCase()] = u.color;
          }
        });
        setUserColorMap(map);
      } catch (err) {
        console.error("Erro ao carregar usuários de despesas:", err);
      }
    };

    loadUsers();

    return () => {
      isMounted = false;
    };
  }, []);

  const getUserColor = (name?: string | null): string | undefined => {
    if (!name) return undefined;
    return userColorMap[name.trim().toLowerCase()];
  };

  const getUserBadgeStyle = (name?: string | null) => {
    if (!name) return undefined;
    const color = getUserColor(name);
    if (!color) return undefined;

    if (color.startsWith("#")) {
      let hex = color.slice(1);
      if (hex.length === 3) {
        hex = hex
          .split("")
          .map((c) => c + c)
          .join("");
      }
      if (hex.length === 6) {
        return {
          backgroundColor: `#${hex}20`,
          color: `#${hex}`,
          borderColor: `#${hex}50`,
        };
      }
    }

    return {
      backgroundColor: color,
      color: "#ffffff",
      borderColor: color,
    };
  };

  return { users, userColorMap, getUserColor, getUserBadgeStyle };
}
