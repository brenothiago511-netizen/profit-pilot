import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ExchangeRate {
  id: string;
  base_currency: string;
  target_currency: string;
  rate: number;
  date: string;
  source: string;
  created_at: string;
}

export interface CurrencyConfig {
  baseCurrency: string;
  userPreferredCurrency: string;
  exchangeRates: ExchangeRate[];
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  BRL: 'R$',
  EUR: '€',
  GBP: '£',
  ARS: '$',
  CLP: '$',
  MXN: '$',
  COP: '$',
  PEN: 'S/',
  UYU: '$U',
  PYG: '₲',
  BOB: 'Bs',
};

const CURRENCY_NAMES: Record<string, string> = {
  USD: 'Dólar Americano',
  BRL: 'Real Brasileiro',
  EUR: 'Euro',
  GBP: 'Libra Esterlina',
  ARS: 'Peso Argentino',
  CLP: 'Peso Chileno',
  MXN: 'Peso Mexicano',
  COP: 'Peso Colombiano',
  PEN: 'Sol Peruano',
  UYU: 'Peso Uruguaio',
  PYG: 'Guarani Paraguaio',
  BOB: 'Boliviano',
};

export const AVAILABLE_CURRENCIES = Object.keys(CURRENCY_SYMBOLS);

export function useCurrency() {
  const { profile } = useAuth();
  const [config, setConfig] = useState<CurrencyConfig>({
    baseCurrency: 'USD',
    userPreferredCurrency: 'BRL',
    exchangeRates: [],
  });
  const [loading, setLoading] = useState(true);
  const [displayCurrency, setDisplayCurrency] = useState<'base' | 'original' | 'preferred'>('base');

  useEffect(() => {
    fetchCurrencyConfig();
  }, [profile?.id]);

  const fetchCurrencyConfig = async () => {
    setLoading(true);
    try {
      // Fetch base currency from system settings
      const { data: settings } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'base_currency')
        .maybeSingle();

      let baseCurrency = 'USD';
      if (settings?.value) {
        try {
          const raw = settings.value;
          // Value may be stored as a JSON string (e.g. '"USD"') or a plain string (e.g. 'USD')
          if (typeof raw === 'string') {
            baseCurrency = raw.replace(/^"|"$/g, '').trim() || 'USD';
          } else {
            const parsed = JSON.parse(JSON.stringify(raw));
            baseCurrency = String(parsed).replace(/^"|"$/g, '').trim() || 'USD';
          }
        } catch {
          baseCurrency = 'USD';
        }
      }

      // Fetch exchange rates
      const { data: rates } = await supabase
        .from('exchange_rates')
        .select('*')
        .order('date', { ascending: false });

      // Get user preferred currency
      const userPreferredCurrency = (profile as any)?.preferred_currency || 'BRL';

      setConfig({
        baseCurrency,
        userPreferredCurrency,
        exchangeRates: rates || [],
      });
    } catch (error) {
      console.error('Error fetching currency config:', error);
    }
    setLoading(false);
  };

  const getExchangeRate = useCallback((
    fromCurrency: string,
    toCurrency: string,
    date?: string
  ): number => {
    if (fromCurrency === toCurrency) return 1;

    const targetDate = date || new Date().toISOString().split('T')[0];
    
    // Find the most recent rate for the currency pair
    const directRate = config.exchangeRates.find(
      r => r.base_currency === fromCurrency && 
           r.target_currency === toCurrency &&
           r.date <= targetDate
    );

    if (directRate) return directRate.rate;

    // Try reverse rate
    const reverseRate = config.exchangeRates.find(
      r => r.base_currency === toCurrency && 
           r.target_currency === fromCurrency &&
           r.date <= targetDate
    );

    if (reverseRate) return 1 / reverseRate.rate;

    // Try to convert through base currency
    const toBase = config.exchangeRates.find(
      r => r.target_currency === config.baseCurrency && 
           r.base_currency === fromCurrency
    );
    const fromBase = config.exchangeRates.find(
      r => r.base_currency === config.baseCurrency && 
           r.target_currency === toCurrency
    );

    if (toBase && fromBase) {
      return toBase.rate * fromBase.rate;
    }

    return 1;
  }, [config.exchangeRates, config.baseCurrency]);

  const convertAmount = useCallback((
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    date?: string
  ): number => {
    const rate = getExchangeRate(fromCurrency, toCurrency, date);
    return amount * rate;
  }, [getExchangeRate]);

  const formatCurrency = useCallback((
    amount: number,
    currency: string = config.baseCurrency,
    options?: Intl.NumberFormatOptions
  ): string => {
    const formatter = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...options,
    });
    
    try {
      return formatter.format(amount);
    } catch {
      // Fallback for unsupported currencies
      const symbol = CURRENCY_SYMBOLS[currency] || currency;
      return `${symbol} ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    }
  }, [config.baseCurrency]);

  const formatWithConversion = useCallback((
    originalAmount: number,
    originalCurrency: string,
    targetCurrency?: string,
    date?: string
  ): { formatted: string; converted: number; rate: number } => {
    const target = targetCurrency || config.baseCurrency;
    const rate = getExchangeRate(originalCurrency, target, date);
    const converted = originalAmount * rate;
    
    return {
      formatted: formatCurrency(converted, target),
      converted,
      rate,
    };
  }, [config.baseCurrency, getExchangeRate, formatCurrency]);

  const getCurrencySymbol = (currency: string): string => {
    return CURRENCY_SYMBOLS[currency] || currency;
  };

  const getCurrencyName = (currency: string): string => {
    return CURRENCY_NAMES[currency] || currency;
  };

  const updateBaseCurrency = async (newBaseCurrency: string) => {
    const { error } = await supabase
      .from('system_settings')
      .upsert({ 
        key: 'base_currency', 
        value: JSON.stringify(newBaseCurrency) 
      }, { 
        onConflict: 'key' 
      });

    if (!error) {
      setConfig(prev => ({ ...prev, baseCurrency: newBaseCurrency }));
    }
    
    return { error };
  };

  const addExchangeRate = async (rate: Omit<ExchangeRate, 'id' | 'created_at'>) => {
    const { data, error } = await supabase
      .from('exchange_rates')
      .upsert(rate, { 
        onConflict: 'base_currency,target_currency,date' 
      })
      .select()
      .single();

    if (!error && data) {
      await fetchCurrencyConfig();
    }
    
    return { data, error };
  };

  const deleteExchangeRate = async (id: string) => {
    const { error } = await supabase
      .from('exchange_rates')
      .delete()
      .eq('id', id);

    if (!error) {
      await fetchCurrencyConfig();
    }
    
    return { error };
  };

  return {
    config,
    loading,
    displayCurrency,
    setDisplayCurrency,
    getExchangeRate,
    convertAmount,
    formatCurrency,
    formatWithConversion,
    getCurrencySymbol,
    getCurrencyName,
    updateBaseCurrency,
    addExchangeRate,
    deleteExchangeRate,
    refetch: fetchCurrencyConfig,
    AVAILABLE_CURRENCIES,
  };
}
