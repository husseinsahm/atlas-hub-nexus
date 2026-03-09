import * as React from "react";
import { X, MapPin, ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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
import { cities } from "@/components/ui/city-autocomplete";

interface MultiCityAutocompleteProps {
  value?: string[];
  onValueChange?: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  isRtl?: boolean;
}

export function MultiCityAutocomplete({
  value = [],
  onValueChange,
  placeholder = "Select cities",
  disabled = false,
  className,
  isRtl = false,
}: MultiCityAutocompleteProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  const groupedCities = React.useMemo(() => {
    return cities.reduce((acc, city) => {
      if (!acc[city.region]) acc[city.region] = [];
      acc[city.region].push(city);
      return acc;
    }, {} as Record<string, typeof cities>);
  }, []);

  const toggleCity = (cityName: string) => {
    const next = value.includes(cityName)
      ? value.filter((v) => v !== cityName)
      : [...value, cityName];
    onValueChange?.(next);
  };

  const removeCity = (cityName: string) => {
    onValueChange?.(value.filter((v) => v !== cityName));
  };

  const addCustomCity = () => {
    if (inputValue && !value.includes(inputValue)) {
      onValueChange?.([...value, inputValue]);
      setInputValue("");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal min-h-[36px] h-auto py-1.5",
            !value.length && "text-muted-foreground",
            className
          )}
        >
          <div className="flex flex-wrap gap-1 flex-1 items-center">
            {value.length > 0 ? (
              value.map((city) => {
                const cityData = cities.find((c) => c.name === city);
                return (
                  <Badge
                    key={city}
                    variant="secondary"
                    className="text-[10px] gap-0.5 px-1.5 py-0 h-5 shrink-0"
                  >
                    <MapPin className="w-2.5 h-2.5" />
                    {isRtl && cityData ? cityData.nameAr : city}
                    <button
                      className="ms-0.5 hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeCity(city);
                      }}
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </Badge>
                );
              })
            ) : (
              <span className="flex items-center gap-1.5 text-sm">
                <MapPin className="h-3.5 w-3.5" />
                {placeholder}
              </span>
            )}
          </div>
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
              <div className="py-3 text-center text-sm">
                <p className="text-muted-foreground">No city found.</p>
                {inputValue && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1.5"
                    onClick={() => {
                      addCustomCity();
                      setOpen(false);
                    }}
                  >
                    Add "{inputValue}"
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
                    onSelect={() => toggleCity(city.name)}
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
                        value.includes(city.name) ? "opacity-100" : "opacity-0"
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
