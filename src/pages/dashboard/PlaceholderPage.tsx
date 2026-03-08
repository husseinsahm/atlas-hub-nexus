import { useLocation } from "react-router-dom";
import { Construction } from "lucide-react";

export default function PlaceholderPage() {
  const location = useLocation();
  const pageName = location.pathname.split("/").pop() || "Page";
  const title = pageName.charAt(0).toUpperCase() + pageName.slice(1);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-6">
        <Construction className="w-7 h-7 text-muted-foreground" />
      </div>
      <h1 className="text-xl font-bold font-display text-foreground mb-2">{title}</h1>
      <p className="text-sm text-muted-foreground max-w-sm text-center">
        This section is being prepared. The full {title.toLowerCase()} management interface will be available soon.
      </p>
    </div>
  );
}
