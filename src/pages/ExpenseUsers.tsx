import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, UserPlus, Trash2, Users, UserCheck, Pencil, X, Check, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { getExpenseUsers, addExpenseUser, updateExpenseUser, deleteExpenseUser, ExpenseUser } from "@/lib/expenseUsers";
import { UserReportModal } from "@/components/UserReportModal";

const COLOR_PRESETS = [
  "#3b82f6", // Blue
  "#ec4899", // Pink
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#06b6d4", // Cyan
  "#ef4444", // Red
  "#64748b", // Slate
];

const ExpenseUsers = () => {
  const [users, setUsers] = useState<ExpenseUser[]>([]);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState("#3b82f6");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // User Report Modal state
  const [selectedUserForReport, setSelectedUserForReport] = useState<string | null>(null);
  const [selectedUserColor, setSelectedUserColor] = useState<string>("#3b82f6");
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);

  const loadUsers = async () => {
    try {
      const data = await getExpenseUsers();
      setUsers(data);
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleSelectUserToEdit = (u: ExpenseUser) => {
    setEditingUserId(u.id);
    setName(u.name);
    setSelectedColor(u.color || "#3b82f6");
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setName("");
    setSelectedColor("#3b82f6");
  };

  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "Digite o nome da pessoa/usuário.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      if (editingUserId) {
        await updateExpenseUser(editingUserId, name, selectedColor);
        toast({
          title: "Sucesso!",
          description: `Usuário "${name}" atualizado com sucesso.`,
        });
      } else {
        await addExpenseUser(name, selectedColor);
        toast({
          title: "Sucesso!",
          description: `Usuário "${name}" cadastrado com sucesso.`,
        });
      }
      handleCancelEdit();
      loadUsers();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar usuário.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (e: React.MouseEvent, id: string, userName: string) => {
    e.stopPropagation();
    if (!confirm(`Deseja realmente excluir "${userName}"?`)) return;

    try {
      await deleteExpenseUser(id);
      if (editingUserId === id) {
        handleCancelEdit();
      }
      toast({
        title: "Removido",
        description: `Usuário "${userName}" excluído com sucesso.`,
      });
      loadUsers();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível excluir.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/20 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header navigation */}
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              Usuários de Despesas
            </h1>
            <p className="text-sm text-muted-foreground">
              Cadastre e edite usuários (ex: João, Maria) para atribuir e organizar os gastos familiares/individuais.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* User Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {editingUserId ? (
                    <Pencil className="w-5 h-5 text-primary" />
                  ) : (
                    <UserPlus className="w-5 h-5 text-primary" />
                  )}
                  {editingUserId ? "Editar Usuário" : "Cadastrar Novo Usuário"}
                </span>
                {editingUserId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelEdit}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5 mr-1" />
                    Cancelar
                  </Button>
                )}
              </CardTitle>
              <CardDescription>
                {editingUserId
                  ? "Altere o nome ou a cor de identificação do usuário."
                  : "Adicione o nome do usuário responsável por lançar despesas."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitUser} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="userName">Nome do Usuário</Label>
                  <Input
                    id="userName"
                    placeholder="Ex: João, Maria, Pedro..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Cor de Identificação</Label>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {COLOR_PRESETS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        className={`w-8 h-8 rounded-full border-2 transition-all cursor-pointer ${
                          selectedColor === color
                            ? "border-primary scale-110 shadow-md ring-2 ring-primary/30"
                            : "border-transparent hover:scale-105"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {editingUserId ? (
                      <Check className="w-4 h-4 mr-2" />
                    ) : (
                      <UserPlus className="w-4 h-4 mr-2" />
                    )}
                    {isLoading
                      ? "Salvando..."
                      : editingUserId
                      ? "Salvar Alterações"
                      : "Salvar Usuário"}
                  </Button>
                  {editingUserId && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancelEdit}
                      disabled={isLoading}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Registered Users List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-primary" />
                Usuários Cadastrados ({users.length})
              </CardTitle>
              <CardDescription>
                Clique em um usuário para editar seu nome ou cor de identificação.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {users.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhum usuário cadastrado ainda.
                </p>
              ) : (
                <div className="space-y-3">
                  {users.map((u) => {
                    const isSelected = editingUserId === u.id;
                    return (
                      <div
                        key={u.id}
                        onClick={() => handleSelectUserToEdit(u)}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40"
                            : "bg-card hover:bg-accent/40"
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div
                            className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm"
                            style={{ backgroundColor: u.color || "#3b82f6" }}
                          />
                          <span className="font-medium text-sm sm:text-base">
                            {u.name}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedUserForReport(u.name);
                              setSelectedUserColor(u.color || "#3b82f6");
                              setIsUserModalOpen(true);
                            }}
                            className="text-muted-foreground hover:text-primary"
                            title="Ver relatório individual"
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectUserToEdit(u);
                            }}
                            className="text-muted-foreground hover:text-primary"
                            title="Editar usuário"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleDeleteUser(e, u.id, u.name)}
                            className="text-muted-foreground hover:text-destructive"
                            title="Excluir usuário"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <UserReportModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        userName={selectedUserForReport}
        userColor={selectedUserColor}
      />
    </div>
  );
};

export default ExpenseUsers;

