import AppLayout from "@/components/AppLayout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Music, ListMusic, Shield, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

const AdminDashboard = () => {
  const adminModules = [
    {
      title: "User Management",
      description: "Manage band members, roles, invitations, and account access.",
      icon: Users,
      path: "/admin/users",
      color: "text-blue-500",
      bg: "bg-blue-500/10"
    },
    {
      title: "Song Database",
      description: "Review entire song library. (Shortcut to Songs)",
      icon: Music,
      path: "/songs",
      color: "text-green-500",
      bg: "bg-green-500/10"
    },
    {
      title: "Setlists",
      description: "Manage performances and sets. (Shortcut to Setlists)",
      icon: ListMusic,
      path: "/setlists",
      color: "text-purple-500",
      bg: "bg-purple-500/10"
    }
  ];

  return (
    <AppLayout>
      <div className="space-y-6 pb-20">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">Select a management module to proceed.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {adminModules.map((module) => (
            <Link key={module.path} to={module.path}>
              <Card className="hover:bg-accent/40 hover:border-primary/50 transition-all duration-300 cursor-pointer h-full group">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${module.bg} ${module.color}`}>
                      <module.icon className="w-6 h-6" />
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity -mr-2" />
                  </div>
                  <CardTitle className="text-xl">{module.title}</CardTitle>
                  <CardDescription className="pt-2">{module.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>

        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
            <div className="flex items-center gap-4">
                <div className="bg-orange-500/10 p-3 rounded-full">
                    <Shield className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                    <h3 className="font-semibold text-lg">Admin Status Active</h3>
                    <p className="text-sm text-muted-foreground">
                        You have full access to all system configurations and user data.
                    </p>
                </div>
            </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminDashboard;