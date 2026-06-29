import { LogOut, User, Download, BarChart, KeyRound, Lock } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ClassPasscodeManager } from "@/components/lms/ClassPasscodeManager";
import logo from '@/components/assets/logo.png';

export function Header() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [passcodeDialogOpen, setPasscodeDialogOpen] = useState(false);

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

  const getRoleBadgeVariant = (role: string | null) => {
    return role === "teacher" || role === "school" ? "default" : "secondary";
  };

  return (
    <>
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-card/80 backdrop-blur-xl">
      <div className="container flex h-14 sm:h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl gradient-bg-primary shadow-primary">
            {/* <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" /> */}
            <img src={logo} className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground"/>
          </div>
          <div className="flex flex-col">
            <span className="text-base sm:text-lg font-bold tracking-tight" onClick={() => navigate("/")}>StudyHub</span>
            <span className="hidden sm:block text-xs text-muted-foreground">Learning Management System</span>
          </div>
        </div>

        {user && (
          <div className="flex items-center gap-2 sm:gap-4">
            <Badge variant={getRoleBadgeVariant(role)} className="capitalize text-xs sm:text-sm">
              {role || "User"}
            </Badge>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 sm:h-10 sm:w-10 rounded-full">
                  <Avatar className="h-8 w-8 sm:h-10 sm:w-10 border-2 border-primary/20">
                    <AvatarFallback
                      className="
                                bg-primary/10
                                text-primary
                                font-semibold
                                text-xs sm:text-sm
                                hover:text-black
                                focus:text-black
                                active:text-black
                              ">

                      {getInitials(user.email || "U")}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.email}</p>
                    <p className="text-xs leading-none text-muted-foreground capitalize">
                      {role} Account
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {/* <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                  <BarChart className="mr-2 h-4 w-4" />
                  <span>My Dashboard</span>
                </DropdownMenuItem> */}
                <DropdownMenuItem onClick={() => navigate("/downloads")}>
                  <Download className="mr-2 h-4 w-4" />
                  <span>My Downloads</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/change-password")}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  <span>Change Password</span>
                </DropdownMenuItem>
                {(role === "teacher" || role === "school") && (
                  <DropdownMenuItem onClick={() => setPasscodeDialogOpen(true)}>
                    <Lock className="mr-2 h-4 w-4" />
                    <span>Class Passcode Manager</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </header>

    <Dialog open={passcodeDialogOpen} onOpenChange={setPasscodeDialogOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Class Passcode Manager</DialogTitle>
        </DialogHeader>
        <ClassPasscodeManager />
      </DialogContent>
    </Dialog>
  </>
  );
}
