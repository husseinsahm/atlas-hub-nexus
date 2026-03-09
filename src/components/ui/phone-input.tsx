import * as React from "react";
import { ChevronsUpDown, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { countries } from "./country-select";

interface PhoneInputProps {
  value?: string;
  onValueChange?: (value: string) => void;
  defaultCountry?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: string;
}

// Validate phone number format
function validatePhoneNumber(phone: string, dialCode: string): { valid: boolean; message?: string } {
  // Remove all non-digit characters except +
  const cleanPhone = phone.replace(/[^\d+]/g, "");
  
  // Check if number starts with dial code
  const withoutCode = cleanPhone.replace(dialCode, "");
  
  // Most phone numbers are between 7-15 digits (excluding country code)
  if (withoutCode.length < 7) {
    return { valid: false, message: "Phone number is too short" };
  }
  if (withoutCode.length > 15) {
    return { valid: false, message: "Phone number is too long" };
  }
  
  return { valid: true };
}

// Format phone number for display
function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");
  
  // Format based on length
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)} ${digits.slice(10)}`;
}

export function PhoneInput({
  value = "",
  onValueChange,
  defaultCountry = "AE",
  placeholder = "Enter phone number",
  disabled = false,
  className,
  error,
}: PhoneInputProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedCountry, setSelectedCountry] = React.useState(
    countries.find((c) => c.code === defaultCountry) || countries[0]
  );
  const [localNumber, setLocalNumber] = React.useState("");
  const [validationError, setValidationError] = React.useState<string>();

  // Parse initial value if provided
  React.useEffect(() => {
    if (value) {
      // Try to detect country from dial code
      const country = countries.find((c) => value.startsWith(c.dialCode));
      if (country) {
        setSelectedCountry(country);
        const numberPart = value.replace(country.dialCode, "").trim();
        setLocalNumber(numberPart);
      } else {
        setLocalNumber(value);
      }
    }
  }, []);

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    // Only allow digits and spaces
    const cleaned = input.replace(/[^\d\s]/g, "");
    setLocalNumber(cleaned);
    
    const fullNumber = `${selectedCountry.dialCode} ${cleaned}`.trim();
    const validation = validatePhoneNumber(fullNumber, selectedCountry.dialCode);
    setValidationError(validation.message);
    
    onValueChange?.(fullNumber);
  };

  const handleCountryChange = (country: typeof countries[0]) => {
    setSelectedCountry(country);
    setOpen(false);
    
    if (localNumber) {
      const fullNumber = `${country.dialCode} ${localNumber}`.trim();
      onValueChange?.(fullNumber);
    }
  };

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              disabled={disabled}
              className="w-[100px] shrink-0 rounded-e-none border-e-0 justify-between px-2"
            >
              <span className="flex items-center gap-1">
                <span className="text-lg">{selectedCountry.flag}</span>
                <span className="text-xs">{selectedCountry.dialCode}</span>
              </span>
              <ChevronsUpDown className="h-3 w-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search country..." className="h-9" />
              <CommandList>
                <CommandEmpty>No country found.</CommandEmpty>
                <CommandGroup className="max-h-[200px] overflow-auto">
                  {countries.map((country) => (
                    <CommandItem
                      key={country.code}
                      value={`${country.name} ${country.dialCode}`}
                      onSelect={() => handleCountryChange(country)}
                      className="flex items-center gap-2"
                    >
                      <span className="text-lg">{country.flag}</span>
                      <span className="flex-1 truncate">{country.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {country.dialCode}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        
        <div className="relative flex-1">
          <Phone className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="tel"
            value={formatPhoneNumber(localNumber)}
            onChange={handleNumberChange}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              "rounded-s-none ps-9",
              (error || validationError) && "border-destructive focus-visible:ring-destructive"
            )}
          />
        </div>
      </div>
      
      {(error || validationError) && (
        <p className="text-xs text-destructive">{error || validationError}</p>
      )}
    </div>
  );
}
