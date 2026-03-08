import * as React from "react";
import { Check, ChevronsUpDown, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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

// Country data with flags (emoji), dial codes, and names
const countries = [
  { code: "AE", name: "United Arab Emirates", nameAr: "الإمارات العربية المتحدة", flag: "🇦🇪", dialCode: "+971" },
  { code: "SA", name: "Saudi Arabia", nameAr: "المملكة العربية السعودية", flag: "🇸🇦", dialCode: "+966" },
  { code: "EG", name: "Egypt", nameAr: "مصر", flag: "🇪🇬", dialCode: "+20" },
  { code: "JO", name: "Jordan", nameAr: "الأردن", flag: "🇯🇴", dialCode: "+962" },
  { code: "LB", name: "Lebanon", nameAr: "لبنان", flag: "🇱🇧", dialCode: "+961" },
  { code: "KW", name: "Kuwait", nameAr: "الكويت", flag: "🇰🇼", dialCode: "+965" },
  { code: "QA", name: "Qatar", nameAr: "قطر", flag: "🇶🇦", dialCode: "+974" },
  { code: "BH", name: "Bahrain", nameAr: "البحرين", flag: "🇧🇭", dialCode: "+973" },
  { code: "OM", name: "Oman", nameAr: "عمان", flag: "🇴🇲", dialCode: "+968" },
  { code: "MA", name: "Morocco", nameAr: "المغرب", flag: "🇲🇦", dialCode: "+212" },
  { code: "TN", name: "Tunisia", nameAr: "تونس", flag: "🇹🇳", dialCode: "+216" },
  { code: "DZ", name: "Algeria", nameAr: "الجزائر", flag: "🇩🇿", dialCode: "+213" },
  { code: "IQ", name: "Iraq", nameAr: "العراق", flag: "🇮🇶", dialCode: "+964" },
  { code: "SY", name: "Syria", nameAr: "سوريا", flag: "🇸🇾", dialCode: "+963" },
  { code: "PS", name: "Palestine", nameAr: "فلسطين", flag: "🇵🇸", dialCode: "+970" },
  { code: "YE", name: "Yemen", nameAr: "اليمن", flag: "🇾🇪", dialCode: "+967" },
  { code: "LY", name: "Libya", nameAr: "ليبيا", flag: "🇱🇾", dialCode: "+218" },
  { code: "SD", name: "Sudan", nameAr: "السودان", flag: "🇸🇩", dialCode: "+249" },
  { code: "US", name: "United States", nameAr: "الولايات المتحدة", flag: "🇺🇸", dialCode: "+1" },
  { code: "GB", name: "United Kingdom", nameAr: "المملكة المتحدة", flag: "🇬🇧", dialCode: "+44" },
  { code: "DE", name: "Germany", nameAr: "ألمانيا", flag: "🇩🇪", dialCode: "+49" },
  { code: "FR", name: "France", nameAr: "فرنسا", flag: "🇫🇷", dialCode: "+33" },
  { code: "IT", name: "Italy", nameAr: "إيطاليا", flag: "🇮🇹", dialCode: "+39" },
  { code: "ES", name: "Spain", nameAr: "إسبانيا", flag: "🇪🇸", dialCode: "+34" },
  { code: "NL", name: "Netherlands", nameAr: "هولندا", flag: "🇳🇱", dialCode: "+31" },
  { code: "BE", name: "Belgium", nameAr: "بلجيكا", flag: "🇧🇪", dialCode: "+32" },
  { code: "CH", name: "Switzerland", nameAr: "سويسرا", flag: "🇨🇭", dialCode: "+41" },
  { code: "AT", name: "Austria", nameAr: "النمسا", flag: "🇦🇹", dialCode: "+43" },
  { code: "SE", name: "Sweden", nameAr: "السويد", flag: "🇸🇪", dialCode: "+46" },
  { code: "NO", name: "Norway", nameAr: "النرويج", flag: "🇳🇴", dialCode: "+47" },
  { code: "DK", name: "Denmark", nameAr: "الدنمارك", flag: "🇩🇰", dialCode: "+45" },
  { code: "FI", name: "Finland", nameAr: "فنلندا", flag: "🇫🇮", dialCode: "+358" },
  { code: "PL", name: "Poland", nameAr: "بولندا", flag: "🇵🇱", dialCode: "+48" },
  { code: "CZ", name: "Czech Republic", nameAr: "جمهورية التشيك", flag: "🇨🇿", dialCode: "+420" },
  { code: "GR", name: "Greece", nameAr: "اليونان", flag: "🇬🇷", dialCode: "+30" },
  { code: "PT", name: "Portugal", nameAr: "البرتغال", flag: "🇵🇹", dialCode: "+351" },
  { code: "IE", name: "Ireland", nameAr: "أيرلندا", flag: "🇮🇪", dialCode: "+353" },
  { code: "RU", name: "Russia", nameAr: "روسيا", flag: "🇷🇺", dialCode: "+7" },
  { code: "TR", name: "Turkey", nameAr: "تركيا", flag: "🇹🇷", dialCode: "+90" },
  { code: "IN", name: "India", nameAr: "الهند", flag: "🇮🇳", dialCode: "+91" },
  { code: "CN", name: "China", nameAr: "الصين", flag: "🇨🇳", dialCode: "+86" },
  { code: "JP", name: "Japan", nameAr: "اليابان", flag: "🇯🇵", dialCode: "+81" },
  { code: "KR", name: "South Korea", nameAr: "كوريا الجنوبية", flag: "🇰🇷", dialCode: "+82" },
  { code: "AU", name: "Australia", nameAr: "أستراليا", flag: "🇦🇺", dialCode: "+61" },
  { code: "NZ", name: "New Zealand", nameAr: "نيوزيلندا", flag: "🇳🇿", dialCode: "+64" },
  { code: "CA", name: "Canada", nameAr: "كندا", flag: "🇨🇦", dialCode: "+1" },
  { code: "MX", name: "Mexico", nameAr: "المكسيك", flag: "🇲🇽", dialCode: "+52" },
  { code: "BR", name: "Brazil", nameAr: "البرازيل", flag: "🇧🇷", dialCode: "+55" },
  { code: "AR", name: "Argentina", nameAr: "الأرجنتين", flag: "🇦🇷", dialCode: "+54" },
  { code: "CL", name: "Chile", nameAr: "تشيلي", flag: "🇨🇱", dialCode: "+56" },
  { code: "CO", name: "Colombia", nameAr: "كولومبيا", flag: "🇨🇴", dialCode: "+57" },
  { code: "PE", name: "Peru", nameAr: "بيرو", flag: "🇵🇪", dialCode: "+51" },
  { code: "ZA", name: "South Africa", nameAr: "جنوب أفريقيا", flag: "🇿🇦", dialCode: "+27" },
  { code: "NG", name: "Nigeria", nameAr: "نيجيريا", flag: "🇳🇬", dialCode: "+234" },
  { code: "KE", name: "Kenya", nameAr: "كينيا", flag: "🇰🇪", dialCode: "+254" },
  { code: "GH", name: "Ghana", nameAr: "غانا", flag: "🇬🇭", dialCode: "+233" },
  { code: "TH", name: "Thailand", nameAr: "تايلاند", flag: "🇹🇭", dialCode: "+66" },
  { code: "VN", name: "Vietnam", nameAr: "فيتنام", flag: "🇻🇳", dialCode: "+84" },
  { code: "MY", name: "Malaysia", nameAr: "ماليزيا", flag: "🇲🇾", dialCode: "+60" },
  { code: "SG", name: "Singapore", nameAr: "سنغافورة", flag: "🇸🇬", dialCode: "+65" },
  { code: "ID", name: "Indonesia", nameAr: "إندونيسيا", flag: "🇮🇩", dialCode: "+62" },
  { code: "PH", name: "Philippines", nameAr: "الفلبين", flag: "🇵🇭", dialCode: "+63" },
  { code: "PK", name: "Pakistan", nameAr: "باكستان", flag: "🇵🇰", dialCode: "+92" },
  { code: "BD", name: "Bangladesh", nameAr: "بنغلاديش", flag: "🇧🇩", dialCode: "+880" },
];

export { countries };

interface CountrySelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  isRtl?: boolean;
}

export function CountrySelect({
  value,
  onValueChange,
  placeholder = "Select country",
  disabled = false,
  className,
  isRtl = false,
}: CountrySelectProps) {
  const [open, setOpen] = React.useState(false);
  const selectedCountry = countries.find((c) => c.code === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          {selectedCountry ? (
            <span className="flex items-center gap-2">
              <span className="text-lg">{selectedCountry.flag}</span>
              <span>{isRtl ? selectedCountry.nameAr : selectedCountry.name}</span>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              {placeholder}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search country..." className="h-9" />
          <CommandList>
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup className="max-h-[300px] overflow-auto">
              {countries.map((country) => (
                <CommandItem
                  key={country.code}
                  value={`${country.name} ${country.nameAr} ${country.code}`}
                  onSelect={() => {
                    onValueChange?.(country.code);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2"
                >
                  <span className="text-lg">{country.flag}</span>
                  <span className="flex-1">
                    {isRtl ? country.nameAr : country.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {country.dialCode}
                  </span>
                  <Check
                    className={cn(
                      "h-4 w-4",
                      value === country.code ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Nationality Select - Similar but focused on nationality
interface NationalitySelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  isRtl?: boolean;
}

export function NationalitySelect({
  value,
  onValueChange,
  placeholder = "Select nationality",
  disabled = false,
  className,
  isRtl = false,
}: NationalitySelectProps) {
  const [open, setOpen] = React.useState(false);
  const selectedCountry = countries.find((c) => c.code === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          {selectedCountry ? (
            <span className="flex items-center gap-2">
              <span className="text-lg">{selectedCountry.flag}</span>
              <span>{isRtl ? selectedCountry.nameAr : selectedCountry.name}</span>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              {placeholder}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search nationality..." className="h-9" />
          <CommandList>
            <CommandEmpty>No nationality found.</CommandEmpty>
            <CommandGroup className="max-h-[300px] overflow-auto">
              {countries.map((country) => (
                <CommandItem
                  key={country.code}
                  value={`${country.name} ${country.nameAr} ${country.code}`}
                  onSelect={() => {
                    onValueChange?.(country.code);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2"
                >
                  <span className="text-lg">{country.flag}</span>
                  <span className="flex-1">
                    {isRtl ? country.nameAr : country.name}
                  </span>
                  <Check
                    className={cn(
                      "h-4 w-4",
                      value === country.code ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
