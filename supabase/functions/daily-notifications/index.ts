import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BillNotification {
  user_email: string;
  user_name: string;
  user_phone?: string;
  bills: Array<{
    description: string;
    amount: number;
    supplier_name?: string;
  }>;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Daily notifications function started");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    console.log(`Checking for bills due today: ${todayStr}`);

    // Get all bills that are due today and are pending
    const { data: bills, error: billsError } = await supabase
      .from('bills')
      .select(`
        id,
        description,
        amount,
        user_id,
        suppliers (name)
      `)
      .eq('due_date', todayStr)
      .eq('status', 'pending');

    if (billsError) {
      throw billsError;
    }

    if (!bills || bills.length === 0) {
      console.log("No bills due today");
      return new Response(JSON.stringify({ message: "No bills due today" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Found ${bills.length} bills due today`);

    // Group bills by user
    const billsByUser = new Map<string, any[]>();
    
    for (const bill of bills) {
      if (!billsByUser.has(bill.user_id)) {
        billsByUser.set(bill.user_id, []);
      }
      billsByUser.get(bill.user_id)!.push(bill);
    }

    // Get user profiles and send notifications
    const notifications: BillNotification[] = [];
    
    for (const [userId, userBills] of billsByUser) {
      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('first_name, last_name, phone')
        .eq('user_id', userId)
        .single();

      // Get user email from auth
      const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
      
      if (!user || !user.email) {
        console.error(`Could not get user email for user ${userId}`);
        continue;
      }

      const notification: BillNotification = {
        user_email: user.email,
        user_name: profile ? `${profile.first_name} ${profile.last_name}` : 'Usuário',
        user_phone: profile?.phone,
        bills: userBills.map(bill => ({
          description: bill.description,
          amount: bill.amount,
          supplier_name: bill.suppliers?.name
        }))
      };

      notifications.push(notification);
    }

    console.log(`Sending notifications to ${notifications.length} users`);

    // Send email notifications
    for (const notification of notifications) {
      try {
        const totalAmount = notification.bills.reduce((sum, bill) => sum + bill.amount, 0);
        
        const billsList = notification.bills.map(bill => 
          `• ${bill.description} - ${new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
          }).format(bill.amount)}${bill.supplier_name ? ` (${bill.supplier_name})` : ''}`
        ).join('\n');

        const emailHtml = `
          <h2>🔔 Contas com vencimento hoje</h2>
          <p>Olá, <strong>${notification.user_name}</strong>!</p>
          <p>Você tem <strong>${notification.bills.length}</strong> conta(s) com vencimento hoje:</p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
            ${notification.bills.map(bill => `
              <div style="margin-bottom: 10px; padding: 10px; background-color: white; border-radius: 3px;">
                <div style="font-weight: bold;">${bill.description}</div>
                <div style="color: #666;">Valor: ${new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL'
                }).format(bill.amount)}</div>
                ${bill.supplier_name ? `<div style="color: #666;">Fornecedor: ${bill.supplier_name}</div>` : ''}
              </div>
            `).join('')}
          </div>
          <p><strong>Total: ${new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
          }).format(totalAmount)}</strong></p>
          <p>Não esqueça de quitar suas contas para evitar juros e multas!</p>
          <p>Acesse seu painel de controle para mais detalhes.</p>
        `;

        // Note: Email functionality is disabled for now
        // To enable email notifications, you would need to add an email service
        console.log(`Would send email to ${notification.user_email}:`, emailHtml);

        // Note: SMS functionality would require a service like Twilio
        // For now, we're only implementing email notifications
        // You can add SMS later by integrating with a service like Twilio

      } catch (error) {
        console.error(`Error sending notification to ${notification.user_email}:`, error);
      }
    }

    return new Response(JSON.stringify({ 
      message: `Notifications sent successfully`,
      users_notified: notifications.length,
      total_bills: bills.length
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in daily-notifications function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: "Check function logs for more information"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);