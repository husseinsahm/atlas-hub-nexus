import { useParams } from "react-router-dom";
import { Compass, Lock } from "lucide-react";

export default function SharedTrip() {
  const { token } = useParams();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center animate-fade-in max-w-md">
        <div className="w-14 h-14 rounded-xl gold-gradient flex items-center justify-center mx-auto mb-6">
          <Compass className="w-7 h-7 text-accent-foreground" />
        </div>
        <h1 className="text-2xl font-bold font-display text-foreground mb-2">Trip Itinerary</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Secure shared view • Token: <span className="font-mono text-xs">{token?.slice(0, 8)}...</span>
        </p>
        <div className="luxury-card p-8 mt-6">
          <Lock className="w-5 h-5 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            This shared trip page will display the full itinerary details for clients with valid access tokens.
          </p>
        </div>
      </div>
    </div>
  );
}
