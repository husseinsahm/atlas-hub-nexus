import * as React from "react";
import { Check, ChevronsUpDown, MapPin } from "lucide-react";
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

// Popular travel cities organized by region
const cities = [
  // Middle East
  { name: "Dubai", nameAr: "دبي", country: "AE", region: "Middle East" },
  { name: "Abu Dhabi", nameAr: "أبو ظبي", country: "AE", region: "Middle East" },
  { name: "Sharjah", nameAr: "الشارقة", country: "AE", region: "Middle East" },
  { name: "Riyadh", nameAr: "الرياض", country: "SA", region: "Middle East" },
  { name: "Jeddah", nameAr: "جدة", country: "SA", region: "Middle East" },
  { name: "Makkah", nameAr: "مكة المكرمة", country: "SA", region: "Middle East" },
  { name: "Madinah", nameAr: "المدينة المنورة", country: "SA", region: "Middle East" },
  { name: "Cairo", nameAr: "القاهرة", country: "EG", region: "Middle East" },
  { name: "Alexandria", nameAr: "الإسكندرية", country: "EG", region: "Middle East" },
  { name: "Luxor", nameAr: "الأقصر", country: "EG", region: "Middle East" },
  { name: "Sharm El Sheikh", nameAr: "شرم الشيخ", country: "EG", region: "Middle East" },
  { name: "Hurghada", nameAr: "الغردقة", country: "EG", region: "Middle East" },
  { name: "Amman", nameAr: "عمان", country: "JO", region: "Middle East" },
  { name: "Petra", nameAr: "البتراء", country: "JO", region: "Middle East" },
  { name: "Aqaba", nameAr: "العقبة", country: "JO", region: "Middle East" },
  { name: "Beirut", nameAr: "بيروت", country: "LB", region: "Middle East" },
  { name: "Kuwait City", nameAr: "مدينة الكويت", country: "KW", region: "Middle East" },
  { name: "Doha", nameAr: "الدوحة", country: "QA", region: "Middle East" },
  { name: "Manama", nameAr: "المنامة", country: "BH", region: "Middle East" },
  { name: "Muscat", nameAr: "مسقط", country: "OM", region: "Middle East" },
  { name: "Istanbul", nameAr: "إسطنبول", country: "TR", region: "Middle East" },
  { name: "Antalya", nameAr: "أنطاليا", country: "TR", region: "Middle East" },
  { name: "Cappadocia", nameAr: "كابادوكيا", country: "TR", region: "Middle East" },
  { name: "Bodrum", nameAr: "بودروم", country: "TR", region: "Middle East" },
  
  // Europe
  { name: "London", nameAr: "لندن", country: "GB", region: "Europe" },
  { name: "Paris", nameAr: "باريس", country: "FR", region: "Europe" },
  { name: "Rome", nameAr: "روما", country: "IT", region: "Europe" },
  { name: "Milan", nameAr: "ميلان", country: "IT", region: "Europe" },
  { name: "Venice", nameAr: "البندقية", country: "IT", region: "Europe" },
  { name: "Florence", nameAr: "فلورنسا", country: "IT", region: "Europe" },
  { name: "Barcelona", nameAr: "برشلونة", country: "ES", region: "Europe" },
  { name: "Madrid", nameAr: "مدريد", country: "ES", region: "Europe" },
  { name: "Amsterdam", nameAr: "أمستردام", country: "NL", region: "Europe" },
  { name: "Berlin", nameAr: "برلين", country: "DE", region: "Europe" },
  { name: "Munich", nameAr: "ميونخ", country: "DE", region: "Europe" },
  { name: "Vienna", nameAr: "فيينا", country: "AT", region: "Europe" },
  { name: "Prague", nameAr: "براغ", country: "CZ", region: "Europe" },
  { name: "Zurich", nameAr: "زيورخ", country: "CH", region: "Europe" },
  { name: "Geneva", nameAr: "جنيف", country: "CH", region: "Europe" },
  { name: "Athens", nameAr: "أثينا", country: "GR", region: "Europe" },
  { name: "Santorini", nameAr: "سانتوريني", country: "GR", region: "Europe" },
  { name: "Lisbon", nameAr: "لشبونة", country: "PT", region: "Europe" },
  { name: "Brussels", nameAr: "بروكسل", country: "BE", region: "Europe" },
  { name: "Copenhagen", nameAr: "كوبنهاغن", country: "DK", region: "Europe" },
  { name: "Stockholm", nameAr: "ستوكهولم", country: "SE", region: "Europe" },
  { name: "Oslo", nameAr: "أوسلو", country: "NO", region: "Europe" },
  { name: "Helsinki", nameAr: "هلسنكي", country: "FI", region: "Europe" },
  { name: "Moscow", nameAr: "موسكو", country: "RU", region: "Europe" },
  
  // Asia
  { name: "Tokyo", nameAr: "طوكيو", country: "JP", region: "Asia" },
  { name: "Kyoto", nameAr: "كيوتو", country: "JP", region: "Asia" },
  { name: "Osaka", nameAr: "أوساكا", country: "JP", region: "Asia" },
  { name: "Seoul", nameAr: "سيول", country: "KR", region: "Asia" },
  { name: "Beijing", nameAr: "بكين", country: "CN", region: "Asia" },
  { name: "Shanghai", nameAr: "شنغهاي", country: "CN", region: "Asia" },
  { name: "Hong Kong", nameAr: "هونغ كونغ", country: "CN", region: "Asia" },
  { name: "Bangkok", nameAr: "بانكوك", country: "TH", region: "Asia" },
  { name: "Phuket", nameAr: "بوكيت", country: "TH", region: "Asia" },
  { name: "Chiang Mai", nameAr: "شيانغ ماي", country: "TH", region: "Asia" },
  { name: "Singapore", nameAr: "سنغافورة", country: "SG", region: "Asia" },
  { name: "Kuala Lumpur", nameAr: "كوالالمبور", country: "MY", region: "Asia" },
  { name: "Bali", nameAr: "بالي", country: "ID", region: "Asia" },
  { name: "Jakarta", nameAr: "جاكرتا", country: "ID", region: "Asia" },
  { name: "Manila", nameAr: "مانيلا", country: "PH", region: "Asia" },
  { name: "Ho Chi Minh City", nameAr: "مدينة هو تشي منه", country: "VN", region: "Asia" },
  { name: "Hanoi", nameAr: "هانوي", country: "VN", region: "Asia" },
  { name: "New Delhi", nameAr: "نيودلهي", country: "IN", region: "Asia" },
  { name: "Mumbai", nameAr: "مومباي", country: "IN", region: "Asia" },
  { name: "Goa", nameAr: "جوا", country: "IN", region: "Asia" },
  { name: "Maldives", nameAr: "المالديف", country: "MV", region: "Asia" },
  
  // Americas
  { name: "New York", nameAr: "نيويورك", country: "US", region: "Americas" },
  { name: "Los Angeles", nameAr: "لوس أنجلوس", country: "US", region: "Americas" },
  { name: "Miami", nameAr: "ميامي", country: "US", region: "Americas" },
  { name: "Las Vegas", nameAr: "لاس فيغاس", country: "US", region: "Americas" },
  { name: "San Francisco", nameAr: "سان فرانسيسكو", country: "US", region: "Americas" },
  { name: "Orlando", nameAr: "أورلاندو", country: "US", region: "Americas" },
  { name: "Chicago", nameAr: "شيكاغو", country: "US", region: "Americas" },
  { name: "Toronto", nameAr: "تورونتو", country: "CA", region: "Americas" },
  { name: "Vancouver", nameAr: "فانكوفر", country: "CA", region: "Americas" },
  { name: "Cancun", nameAr: "كانكون", country: "MX", region: "Americas" },
  { name: "Mexico City", nameAr: "مكسيكو سيتي", country: "MX", region: "Americas" },
  { name: "Rio de Janeiro", nameAr: "ريو دي جانيرو", country: "BR", region: "Americas" },
  { name: "Buenos Aires", nameAr: "بوينس آيرس", country: "AR", region: "Americas" },
  
  // Africa & Oceania
  { name: "Marrakech", nameAr: "مراكش", country: "MA", region: "Africa" },
  { name: "Casablanca", nameAr: "الدار البيضاء", country: "MA", region: "Africa" },
  { name: "Cape Town", nameAr: "كيب تاون", country: "ZA", region: "Africa" },
  { name: "Johannesburg", nameAr: "جوهانسبرغ", country: "ZA", region: "Africa" },
  { name: "Nairobi", nameAr: "نيروبي", country: "KE", region: "Africa" },
  { name: "Sydney", nameAr: "سيدني", country: "AU", region: "Oceania" },
  { name: "Melbourne", nameAr: "ملبورن", country: "AU", region: "Oceania" },
  { name: "Auckland", nameAr: "أوكلاند", country: "NZ", region: "Oceania" },
];

export { cities };

interface CityAutocompleteProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  isRtl?: boolean;
  filterByCountry?: string;
}

export function CityAutocomplete({
  value,
  onValueChange,
  placeholder = "Select city",
  disabled = false,
  className,
  isRtl = false,
  filterByCountry,
}: CityAutocompleteProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  
  const filteredCities = filterByCountry 
    ? cities.filter(c => c.country === filterByCountry)
    : cities;

  const selectedCity = cities.find((c) => c.name === value);

  // Group cities by region
  const groupedCities = filteredCities.reduce((acc, city) => {
    if (!acc[city.region]) {
      acc[city.region] = [];
    }
    acc[city.region].push(city);
    return acc;
  }, {} as Record<string, typeof cities>);

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
          {selectedCity ? (
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{isRtl ? selectedCity.nameAr : selectedCity.name}</span>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {placeholder}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput 
            placeholder="Search city..." 
            className="h-9"
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandEmpty>
              <div className="py-4 text-center text-sm">
                <p className="text-muted-foreground">No city found.</p>
                {inputValue && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      onValueChange?.(inputValue);
                      setOpen(false);
                      setInputValue("");
                    }}
                  >
                    Use "{inputValue}"
                  </Button>
                )}
              </div>
            </CommandEmpty>
            {Object.entries(groupedCities).map(([region, regionCities]) => (
              <CommandGroup key={region} heading={region}>
                {regionCities.map((city) => (
                  <CommandItem
                    key={`${city.country}-${city.name}`}
                    value={`${city.name} ${city.nameAr} ${city.country}`}
                    onSelect={() => {
                      onValueChange?.(city.name);
                      setOpen(false);
                      setInputValue("");
                    }}
                    className="flex items-center gap-2"
                  >
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <span className="flex-1">
                      {isRtl ? city.nameAr : city.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {city.country}
                    </span>
                    <Check
                      className={cn(
                        "h-4 w-4",
                        value === city.name ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
