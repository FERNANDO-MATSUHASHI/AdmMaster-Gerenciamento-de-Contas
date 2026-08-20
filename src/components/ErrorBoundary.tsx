import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught rendering error:", error, errorInfo);
  }

  public handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
          <div className="max-w-md w-full p-6 bg-card rounded-xl border shadow-lg space-y-4">
            <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto text-destructive">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold">Ocorreu um erro ao carregar a tela</h2>
            <p className="text-sm text-muted-foreground">
              {this.state.error?.message || "Erro inesperado na aplicação."}
            </p>
            <Button onClick={this.handleReload} className="w-full flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Recarregar Página
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
