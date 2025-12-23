import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Coins, Check } from 'lucide-react';
import { useCurrency, AVAILABLE_CURRENCIES } from '@/hooks/useCurrency';

interface CurrencyToggleProps {
  value: 'base' | 'original' | 'preferred';
  onChange: (value: 'base' | 'original' | 'preferred') => void;
  showOriginalOption?: boolean;
}

export function CurrencyToggle({ 
  value, 
  onChange, 
  showOriginalOption = true 
}: CurrencyToggleProps) {
  const { config, getCurrencySymbol, getCurrencyName } = useCurrency();

  const options = [
    {
      value: 'base' as const,
      label: 'Moeda Base',
      description: `${getCurrencySymbol(config.baseCurrency)} ${config.baseCurrency}`,
    },
    ...(showOriginalOption ? [{
      value: 'original' as const,
      label: 'Moeda Original',
      description: 'Moeda de cada loja',
    }] : []),
    {
      value: 'preferred' as const,
      label: 'Minha Preferência',
      description: `${getCurrencySymbol(config.userPreferredCurrency)} ${config.userPreferredCurrency}`,
    },
  ];

  const currentOption = options.find(o => o.value === value) || options[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Coins className="w-4 h-4" />
          <Badge variant="secondary" className="font-mono">
            {value === 'base' && config.baseCurrency}
            {value === 'original' && 'Original'}
            {value === 'preferred' && config.userPreferredCurrency}
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Exibir valores em</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onChange(option.value)}
            className="flex items-center justify-between"
          >
            <div>
              <div className="font-medium">{option.label}</div>
              <div className="text-xs text-muted-foreground">{option.description}</div>
            </div>
            {value === option.value && (
              <Check className="w-4 h-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface CurrencyDisplayProps {
  amount: number;
  originalCurrency?: string;
  showTooltip?: boolean;
  className?: string;
  displayMode?: 'base' | 'original' | 'preferred';
}

export function CurrencyDisplay({
  amount,
  originalCurrency,
  showTooltip = false,
  className = '',
  displayMode = 'base',
}: CurrencyDisplayProps) {
  const { config, formatCurrency, formatWithConversion, getCurrencySymbol } = useCurrency();

  const currency = originalCurrency || config.baseCurrency;

  if (displayMode === 'original' && originalCurrency) {
    return (
      <span className={className} title={showTooltip ? `Moeda original: ${currency}` : undefined}>
        {formatCurrency(amount, currency)}
      </span>
    );
  }

  if (displayMode === 'preferred') {
    const { formatted, rate } = formatWithConversion(amount, currency, config.userPreferredCurrency);
    return (
      <span 
        className={className} 
        title={showTooltip ? `Taxa: ${rate.toFixed(4)} (${currency} → ${config.userPreferredCurrency})` : undefined}
      >
        {formatted}
      </span>
    );
  }

  // Base currency
  const { formatted, rate } = formatWithConversion(amount, currency, config.baseCurrency);
  return (
    <span 
      className={className}
      title={showTooltip && currency !== config.baseCurrency 
        ? `Taxa: ${rate.toFixed(4)} (${currency} → ${config.baseCurrency})` 
        : undefined}
    >
      {formatted}
    </span>
  );
}
