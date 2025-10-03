import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export interface ViaCEPAddress {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

export const useViaCEP = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchAddress = async (cep: string): Promise<ViaCEPAddress | null> => {
    // Remove non-numeric characters
    const cleanCEP = cep.replace(/\D/g, '');
    
    // Validate CEP length
    if (cleanCEP.length !== 8) {
      toast({
        title: "CEP inválido",
        description: "O CEP deve conter 8 dígitos",
        variant: "destructive",
      });
      return null;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
      
      if (!response.ok) {
        throw new Error('Erro ao buscar CEP');
      }

      const data: ViaCEPAddress = await response.json();

      if (data.erro) {
        toast({
          title: "CEP não encontrado",
          description: "Verifique o CEP digitado e tente novamente",
          variant: "destructive",
        });
        return null;
      }

      return data;
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      toast({
        title: "Erro",
        description: "Não foi possível buscar o endereço. Tente novamente.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const formatCEP = (value: string): string => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 5) {
      return cleaned;
    }
    return `${cleaned.slice(0, 5)}-${cleaned.slice(5, 8)}`;
  };

  return {
    fetchAddress,
    formatCEP,
    isLoading
  };
};
