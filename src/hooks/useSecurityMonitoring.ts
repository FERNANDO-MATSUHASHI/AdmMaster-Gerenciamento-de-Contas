import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SecurityEvent {
  event_type: 'failed_login' | 'rate_limit_exceeded' | 'suspicious_activity';
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, any>;
}

interface RateLimitState {
  count: number;
  lastAttempt: number;
  blocked: boolean;
}

const RATE_LIMITS = {
  login: { maxAttempts: 5, windowMs: 15 * 60 * 1000 }, // 5 attempts per 15 minutes
  operations: { maxAttempts: 50, windowMs: 60 * 1000 }, // 50 operations per minute
};

export function useSecurityMonitoring() {
  const [rateLimitState, setRateLimitState] = useState<Map<string, RateLimitState>>(new Map());
  const { toast } = useToast();

  /**
   * Records a security event for monitoring
   */
  const recordSecurityEvent = useCallback(async (event: SecurityEvent): Promise<void> => {
    try {
      // In a real implementation, this would send to a security monitoring service
      console.warn('[Security Event]', {
        timestamp: new Date().toISOString(),
        ...event
      });

      // For now, we'll use browser storage to track events locally
      const events = JSON.parse(localStorage.getItem('security_events') || '[]');
      events.push({
        timestamp: new Date().toISOString(),
        ...event
      });
      
      // Keep only last 100 events
      if (events.length > 100) {
        events.splice(0, events.length - 100);
      }
      
      localStorage.setItem('security_events', JSON.stringify(events));
    } catch (error) {
      console.error('Failed to record security event:', error);
    }
  }, []);

  /**
   * Checks if an operation should be rate limited
   */
  const checkRateLimit = useCallback((key: string, type: 'login' | 'operations' = 'operations'): boolean => {
    const now = Date.now();
    const limit = RATE_LIMITS[type];
    const current = rateLimitState.get(key);

    if (!current) {
      setRateLimitState(prev => new Map(prev).set(key, {
        count: 1,
        lastAttempt: now,
        blocked: false
      }));
      return false;
    }

    // Reset counter if window has passed
    if (now - current.lastAttempt > limit.windowMs) {
      setRateLimitState(prev => new Map(prev).set(key, {
        count: 1,
        lastAttempt: now,
        blocked: false
      }));
      return false;
    }

    // Check if limit exceeded
    if (current.count >= limit.maxAttempts) {
      if (!current.blocked) {
        recordSecurityEvent({
          event_type: 'rate_limit_exceeded',
          metadata: { key, type, attempts: current.count }
        });
        
        toast({
          title: "Muitas tentativas",
          description: "Tente novamente em alguns minutos",
          variant: "destructive",
        });
      }

      setRateLimitState(prev => new Map(prev).set(key, {
        ...current,
        blocked: true
      }));
      return true;
    }

    // Increment counter
    setRateLimitState(prev => new Map(prev).set(key, {
      count: current.count + 1,
      lastAttempt: now,
      blocked: false
    }));
    return false;
  }, [rateLimitState, recordSecurityEvent, toast]);

  /**
   * Records a failed login attempt
   */
  const recordFailedLogin = useCallback(async (email?: string): Promise<void> => {
    await recordSecurityEvent({
      event_type: 'failed_login',
      metadata: { email }
    });
  }, [recordSecurityEvent]);

  /**
   * Gets security event history
   */
  const getSecurityEvents = useCallback((): SecurityEvent[] => {
    try {
      return JSON.parse(localStorage.getItem('security_events') || '[]');
    } catch {
      return [];
    }
  }, []);

  return {
    recordSecurityEvent,
    recordFailedLogin,
    checkRateLimit,
    getSecurityEvents
  };
}
