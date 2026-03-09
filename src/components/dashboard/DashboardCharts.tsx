import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  LineElement,
  PointElement,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, TrendingUp, Users, DollarSign } from "lucide-react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  LineElement,
  PointElement
);

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "bottom" as const,
      labels: {
        usePointStyle: true,
        padding: 16,
        font: {
          family: "var(--font-body)",
          size: 12,
        },
      },
    },
    tooltip: {
      backgroundColor: "hsl(var(--card))",
      titleColor: "hsl(var(--card-foreground))",
      bodyColor: "hsl(var(--card-foreground))",
      borderColor: "hsl(var(--border))",
      borderWidth: 1,
      cornerRadius: 8,
    },
  },
  scales: {
    x: {
      grid: {
        display: false,
      },
      ticks: {
        color: "hsl(var(--muted-foreground))",
        font: {
          family: "var(--font-body)",
        },
      },
    },
    y: {
      grid: {
        color: "hsl(var(--border))",
      },
      ticks: {
        color: "hsl(var(--muted-foreground))",
        font: {
          family: "var(--font-body)",
        },
      },
    },
  },
};

const bookingTrendData = {
  labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
  datasets: [
    {
      label: "Bookings",
      data: [12, 19, 15, 25, 22, 30],
      backgroundColor: "hsl(var(--gold) / 0.8)",
      borderColor: "hsl(var(--gold))",
      borderWidth: 2,
      borderRadius: 4,
    },
    {
      label: "Revenue (k)",
      data: [45, 67, 52, 78, 65, 89],
      backgroundColor: "hsl(var(--primary) / 0.8)",
      borderColor: "hsl(var(--primary))",
      borderWidth: 2,
      borderRadius: 4,
    },
  ],
};

const leadStatusData = {
  labels: ["New", "Contacted", "Qualified", "Proposal", "Closed Won"],
  datasets: [
    {
      data: [23, 15, 8, 12, 5],
      backgroundColor: [
        "hsl(var(--gold) / 0.8)",
        "hsl(var(--primary) / 0.8)",
        "hsl(var(--accent) / 0.8)",
        "hsl(var(--secondary) / 0.8)",
        "hsl(var(--muted) / 0.8)",
      ],
      borderColor: [
        "hsl(var(--gold))",
        "hsl(var(--primary))",
        "hsl(var(--accent))",
        "hsl(var(--secondary))",
        "hsl(var(--muted))",
      ],
      borderWidth: 2,
    },
  ],
};

const revenueData = {
  labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
  datasets: [
    {
      label: "Monthly Revenue",
      data: [45000, 67000, 52000, 78000, 65000, 89000],
      borderColor: "hsl(var(--gold))",
      backgroundColor: "hsl(var(--gold) / 0.1)",
      fill: true,
      tension: 0.4,
      pointBackgroundColor: "hsl(var(--gold))",
      pointBorderColor: "hsl(var(--background))",
      pointBorderWidth: 2,
    },
  ],
};

interface DashboardChartsProps {
  className?: string;
}

export function DashboardCharts({ className }: DashboardChartsProps) {
  return (
    <div className={className}>
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" className="text-xs sm:text-sm">
            <CalendarDays className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="trends" className="text-xs sm:text-sm">
            <TrendingUp className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Trends</span>
          </TabsTrigger>
          <TabsTrigger value="leads" className="text-xs sm:text-sm">
            <Users className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Leads</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <Card className="luxury-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center">
                  <TrendingUp className="w-4 h-4 mr-2 text-gold" />
                  Bookings & Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px] sm:h-[240px]">
                  <Bar data={bookingTrendData} options={chartOptions} />
                </div>
              </CardContent>
            </Card>

            <Card className="luxury-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center">
                  <DollarSign className="w-4 h-4 mr-2 text-gold" />
                  Revenue Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px] sm:h-[240px]">
                  <Line data={revenueData} options={chartOptions} />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card className="luxury-card">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Monthly Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] sm:h-[400px]">
                <Line data={revenueData} options={chartOptions} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leads" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <Card className="luxury-card">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center">
                  <Users className="w-4 h-4 mr-2 text-gold" />
                  Lead Status Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px] sm:h-[300px]">
                  <Doughnut data={leadStatusData} options={{ ...chartOptions, cutout: '60%' }} />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              {leadStatusData.labels.map((label, index) => (
                <div key={label} className="flex items-center justify-between p-3 bg-card rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: leadStatusData.datasets[0].backgroundColor[index] }}
                    />
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{leadStatusData.datasets[0].data[index]}</span>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}